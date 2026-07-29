import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { createBooking } from '../services/bookingService.js';

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
    return res.status(404).json({ error: 'Service not found' });
  }

  res.status(201).json(result.booking);
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
