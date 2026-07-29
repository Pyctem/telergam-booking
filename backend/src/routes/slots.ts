import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { generateSlots } from '../lib/slotGenerator.js';
import type { WorkingHours } from '../types.js';

export const slotsRouter = Router();

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  service_id: z.coerce.number().int().positive(),
});

slotsRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { date, service_id: serviceId } = parsed.data;

  const serviceResult = await pool.query('SELECT duration_minutes FROM services WHERE id = $1 AND is_active = true', [
    serviceId,
  ]);
  if (serviceResult.rows.length === 0) {
    return res.status(404).json({ error: 'Service not found' });
  }
  const durationMinutes = serviceResult.rows[0].duration_minutes;

  const settingsResult = await pool.query('SELECT * FROM business_settings WHERE id = 1');
  const settings = settingsResult.rows[0];

  const bookingsResult = await pool.query(
    `SELECT starts_at, ends_at FROM bookings
     WHERE status = 'confirmed' AND starts_at::date = $1::date`,
    [date]
  );

  const slots = generateSlots({
    date,
    workingHours: settings.working_hours as WorkingHours,
    slotIntervalMinutes: settings.slot_interval_minutes,
    serviceDurationMinutes: durationMinutes,
    existingBookings: bookingsResult.rows.map((row) => ({
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
    })),
    timezone: settings.timezone,
    now: new Date(),
  });

  res.json(slots.map((startsAt) => ({ startsAt })));
});
