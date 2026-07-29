import { describe, it, expect, afterAll } from 'vitest';
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

describe('no_overlapping_bookings exclusion constraint (behavioral)', () => {
  // Unique per test run so re-running the suite never collides with leftover rows.
  const runId = Date.now();
  const userIds: string[] = [];
  const serviceIds: string[] = [];

  async function createUser(suffix: number) {
    const res = await pool.query(
      `INSERT INTO users (telegram_id, first_name) VALUES ($1, $2) RETURNING id`,
      [runId + suffix, 'Test User']
    );
    const id = res.rows[0].id as string;
    userIds.push(id);
    return id;
  }

  async function createService(suffix: number) {
    const res = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ($1, $2, $3) RETURNING id`,
      [`Constraint Test Service ${runId}-${suffix}`, 100, 60]
    );
    const id = res.rows[0].id as string;
    serviceIds.push(id);
    return id;
  }

  afterAll(async () => {
    if (userIds.length > 0) {
      await pool.query('DELETE FROM bookings WHERE user_id = ANY($1::bigint[])', [userIds]);
      await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [userIds]);
    }
    if (serviceIds.length > 0) {
      await pool.query('DELETE FROM services WHERE id = ANY($1::bigint[])', [serviceIds]);
    }
  });

  it('rejects an overlapping confirmed booking, allows a non-overlapping one, and ignores cancelled overlaps', async () => {
    const userA = await createUser(1);
    const userB = await createUser(2);
    const serviceA = await createService(1);
    const serviceB = await createService(2);

    // Base confirmed booking: 10:00 - 11:00
    await pool.query(
      `INSERT INTO bookings (user_id, service_id, starts_at, ends_at, status)
       VALUES ($1, $2, '2026-08-10T10:00:00Z', '2026-08-10T11:00:00Z', 'confirmed')`,
      [userA, serviceA]
    );

    // Overlapping confirmed booking for a different user/service (10:30 - 11:30) must be rejected.
    await expect(
      pool.query(
        `INSERT INTO bookings (user_id, service_id, starts_at, ends_at, status)
         VALUES ($1, $2, '2026-08-10T10:30:00Z', '2026-08-10T11:30:00Z', 'confirmed')`,
        [userB, serviceB]
      )
    ).rejects.toMatchObject({ code: '23P01' });

    // Non-overlapping confirmed booking later the same day must succeed.
    const nonOverlapping = await pool.query(
      `INSERT INTO bookings (user_id, service_id, starts_at, ends_at, status)
       VALUES ($1, $2, '2026-08-10T12:00:00Z', '2026-08-10T13:00:00Z', 'confirmed')
       RETURNING id`,
      [userB, serviceB]
    );
    expect(nonOverlapping.rows).toHaveLength(1);

    // Overlapping but cancelled booking must NOT be rejected (constraint only applies to confirmed).
    const cancelledOverlap = await pool.query(
      `INSERT INTO bookings (user_id, service_id, starts_at, ends_at, status)
       VALUES ($1, $2, '2026-08-10T10:15:00Z', '2026-08-10T11:15:00Z', 'cancelled')
       RETURNING id`,
      [userB, serviceB]
    );
    expect(cancelledOverlap.rows).toHaveLength(1);
  });
});
