import { beforeEach, afterAll } from 'vitest';
import { pool } from '../src/db.js';

beforeEach(async () => {
  await pool.query('TRUNCATE bookings, users RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE services RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});
