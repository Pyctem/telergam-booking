import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db.js';

export const adminSettingsRouter = Router();

function toBusinessSettings(row: any) {
  return {
    workingHours: row.working_hours,
    slotIntervalMinutes: row.slot_interval_minutes,
    bookingHorizonDays: row.booking_horizon_days,
    ownerChatId: row.owner_chat_id !== null ? Number(row.owner_chat_id) : null,
    timezone: row.timezone,
  };
}

adminSettingsRouter.get('/', async (_req, res) => {
  const result = await pool.query('SELECT * FROM business_settings WHERE id = 1');
  res.json(toBusinessSettings(result.rows[0]));
});

const updateSettingsSchema = z.object({
  workingHours: z.record(z.string(), z.any()).optional(),
  slotIntervalMinutes: z.number().int().positive().optional(),
  bookingHorizonDays: z.number().int().positive().optional(),
  // `.nullable().optional()` lets the field be omitted (leave untouched) or
  // explicitly `null` (clear it) — these are distinct cases handled below via
  // `!== undefined`, since `null !== undefined`.
  ownerChatId: z.number().int().nullable().optional(),
  timezone: z.string().optional(),
});

adminSettingsRouter.patch('/', async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const fields = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (fields.workingHours !== undefined) { updates.push(`working_hours = $${i++}`); values.push(JSON.stringify(fields.workingHours)); }
  if (fields.slotIntervalMinutes !== undefined) { updates.push(`slot_interval_minutes = $${i++}`); values.push(fields.slotIntervalMinutes); }
  if (fields.bookingHorizonDays !== undefined) { updates.push(`booking_horizon_days = $${i++}`); values.push(fields.bookingHorizonDays); }
  if (fields.ownerChatId !== undefined) { updates.push(`owner_chat_id = $${i++}`); values.push(fields.ownerChatId); }
  if (fields.timezone !== undefined) { updates.push(`timezone = $${i++}`); values.push(fields.timezone); }
  updates.push(`updated_at = now()`);
  if (updates.length > 0) {
    await pool.query(`UPDATE business_settings SET ${updates.join(', ')} WHERE id = 1`, values);
  }
  const result = await pool.query('SELECT * FROM business_settings WHERE id = 1');
  res.json(toBusinessSettings(result.rows[0]));
});
