import { Router } from 'express';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { pool } from '../../db.js';

export const adminBookingsRouter = Router();

const querySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

adminBookingsRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // Day boundaries must respect business_settings.timezone, not a bare UTC
  // `::date` cast (see Task 7's slots route fix) — otherwise a booking whose
  // UTC calendar date differs from its business-local date (e.g. evening
  // slots in Europe/Moscow that land after 21:00 UTC) would be silently
  // excluded from the admin's daily view for the date it was actually booked.
  const settingsResult = await pool.query('SELECT timezone FROM business_settings WHERE id = 1');
  const timezone = settingsResult.rows[0].timezone;
  const dayStart = DateTime.fromISO(parsed.data.date, { zone: timezone }).startOf('day');
  const dayEnd = dayStart.plus({ days: 1 });

  const result = await pool.query(
    `SELECT b.id, b.user_id, u.first_name, u.username, b.service_id, s.name AS service_name,
            b.starts_at, b.ends_at, b.status, b.created_at
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN users u ON u.id = b.user_id
     WHERE b.status = 'confirmed' AND b.starts_at >= $1 AND b.starts_at < $2
     ORDER BY b.starts_at`,
    [dayStart.toUTC().toISO(), dayEnd.toUTC().toISO()]
  );
  res.json(
    result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      clientFirstName: row.first_name,
      clientUsername: row.username,
      serviceId: row.service_id,
      serviceName: row.service_name,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }))
  );
});
