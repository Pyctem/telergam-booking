import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { createBooking } from '../services/bookingService.js';
import { notifyBookingCreated } from '../services/telegramNotify.js';

export const bookingsRouter = Router();

const createBookingSchema = z.object({
  // `services.id` is BIGSERIAL; node-postgres returns bigint columns as
  // strings to avoid precision loss, so an id round-tripped from the DB
  // (e.g. `services.id` in a JSON request body) may arrive as "1" rather
  // than 1. Coerce so both numeric and numeric-string input validate.
  serviceId: z.coerce.number().int().positive(),
  startsAt: z.string().datetime(),
});

bookingsRouter.post('/', async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const result = await createBooking({
    userId: req.user!.id,
    serviceId: parsed.data.serviceId,
    startsAt: parsed.data.startsAt,
  });

  if (!result.ok) {
    if (result.reason === 'conflict') return res.status(409).json({ error: 'Slot no longer available' });
    if (result.reason === 'invalid_slot') return res.status(422).json({ error: 'Requested time is not a valid slot' });
    return res.status(404).json({ error: 'Service not found' });
  }

  res.status(201).json(result.booking);

  // Fire-and-forget notification work, isolated in its own async IIFE so a
  // failure here (e.g. the settings lookup) can never surface as a rejected
  // promise reaching Express's error-forwarding machinery after the response
  // has already been sent (see errorHandler's headersSent guard in app.ts
  // for defense-in-depth). The client notification must still fire even if
  // the owner lookup fails.
  void (async () => {
    let ownerChatId: number | null = null;
    let timezone = 'UTC';
    try {
      const settingsResult = await pool.query('SELECT owner_chat_id, timezone FROM business_settings WHERE id = 1');
      const settingsRow = settingsResult.rows[0];
      const rawOwnerChatId = settingsRow?.owner_chat_id;
      ownerChatId = rawOwnerChatId !== null && rawOwnerChatId !== undefined ? Number(rawOwnerChatId) : null;
      if (settingsRow?.timezone) timezone = settingsRow.timezone;
    } catch (err) {
      console.error('Failed to fetch owner_chat_id/timezone for booking notification', err);
    }
    await notifyBookingCreated(
      result.booking,
      req.user!.telegramId,
      ownerChatId,
      timezone,
      req.user!.firstName
    );
  })();
});

bookingsRouter.get('/my', async (req, res) => {
  const result = await pool.query(
    `SELECT b.id, b.user_id, b.service_id, s.name AS service_name, b.starts_at, b.ends_at, b.status, b.created_at
     FROM bookings b JOIN services s ON s.id = b.service_id
     WHERE b.user_id = $1 ORDER BY b.starts_at DESC`,
    [req.user!.id]
  );
  res.json(
    result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      serviceId: row.service_id,
      serviceName: row.service_name,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }))
  );
});

bookingsRouter.patch('/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid booking id' });
  }
  const result = await pool.query(
    `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status = 'confirmed' RETURNING id`,
    [id, req.user!.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  res.json({ ok: true });
});
