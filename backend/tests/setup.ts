import { beforeEach, afterAll } from 'vitest';
import { pool } from '../src/db.js';

beforeEach(async () => {
  await pool.query('TRUNCATE bookings, users RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE services RESTART IDENTITY CASCADE');

  // business_settings is a singleton row (id=1) and is never truncated (other
  // tests assume it always has exactly one row), but several tests mutate it
  // (working_hours/timezone/slot_interval_minutes/owner_chat_id) without
  // restoring it. Reset it to the exact seed values from
  // migrations/001_init.sql so every test starts from known state regardless
  // of execution order.
  await pool.query(
    `UPDATE business_settings SET
       working_hours = $1::jsonb,
       slot_interval_minutes = 30,
       booking_horizon_days = 14,
       owner_chat_id = NULL,
       timezone = 'Europe/Moscow'
     WHERE id = 1`,
    [
      '{"mon":{"start":"09:00","end":"20:00"},"tue":{"start":"09:00","end":"20:00"},"wed":{"start":"09:00","end":"20:00"},"thu":{"start":"09:00","end":"20:00"},"fri":{"start":"09:00","end":"20:00"},"sat":{"start":"10:00","end":"18:00"},"sun":{"isClosed":true}}',
    ]
  );
});

afterAll(async () => {
  await pool.end();
});
