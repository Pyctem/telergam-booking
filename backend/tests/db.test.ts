import { describe, it, expect } from 'vitest';
import { pool } from '../src/db.js';

describe('database schema', () => {
  it('has business_settings seeded with one row and the exclusion constraint on bookings', async () => {
    const settings = await pool.query('SELECT * FROM business_settings WHERE id = 1');
    expect(settings.rows).toHaveLength(1);
    expect(settings.rows[0].slot_interval_minutes).toBe(30);

    const constraint = await pool.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'no_overlapping_bookings'`
    );
    expect(constraint.rows).toHaveLength(1);
  });
});
