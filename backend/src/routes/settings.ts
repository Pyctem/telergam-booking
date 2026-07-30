import { Router } from 'express';
import { pool } from '../db.js';

export const settingsRouter = Router();

// Deliberately narrow, public (any authenticated Telegram user, not just
// admins) subset of business_settings. Do NOT add owner_chat_id or
// working_hours here — those stay admin-only via /api/admin/settings.
settingsRouter.get('/', async (_req, res) => {
  const result = await pool.query('SELECT timezone, booking_horizon_days FROM business_settings WHERE id = 1');
  const row = result.rows[0];
  res.json({
    timezone: row.timezone,
    bookingHorizonDays: row.booking_horizon_days,
  });
});
