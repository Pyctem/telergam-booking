import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function authHeader(): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 1, first_name: 'Client' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return `tma ${params.toString()}`;
}

describe('GET /api/slots', () => {
  it('returns generated slots for a service on a given date, excluding an existing booking', async () => {
    await pool.query(
      `UPDATE business_settings SET working_hours = $1, slot_interval_minutes = 30, timezone = 'UTC' WHERE id = 1`,
      ['{"mon":{"start":"09:00","end":"10:00"}}']
    );
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;
    const userRes = await pool.query(
      `INSERT INTO users (telegram_id) VALUES (999) RETURNING id`
    );
    await pool.query(
      `INSERT INTO bookings (user_id, service_id, starts_at, ends_at)
       VALUES ($1, $2, '2099-01-05T09:00:00Z', '2099-01-05T09:30:00Z')`,
      [userRes.rows[0].id, serviceId]
    );

    const app = createApp();
    // 2099-01-05 is a Monday
    const res = await request(app)
      .get(`/api/slots?date=2099-01-05&service_id=${serviceId}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ startsAt: '2099-01-05T09:30:00.000Z' }]);
  });

  it('returns 400 for a missing service_id', async () => {
    const app = createApp();
    const res = await request(app).get('/api/slots?date=2099-01-05').set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('filters existing bookings by the business-local day, not the UTC day (Europe/Moscow boundary)', async () => {
    // 2099-01-05 is a Monday (see the first test above). Working hours 01:00-02:00 *local*
    // (Europe/Moscow, UTC+3) span 2099-01-04T22:00:00Z - 2099-01-04T23:00:00Z in UTC, i.e. the
    // whole business day falls on the *previous* UTC calendar date.
    await pool.query(
      `UPDATE business_settings SET working_hours = $1, slot_interval_minutes = 30, timezone = 'Europe/Moscow' WHERE id = 1`,
      ['{"mon":{"start":"01:00","end":"02:00"}}']
    );
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;
    const userRes = await pool.query(`INSERT INTO users (telegram_id) VALUES (999) RETURNING id`);
    // 2099-01-04T22:00:00Z == 2099-01-05T01:00:00+03:00: on the UTC calendar it's Jan 4, but it
    // falls inside the Jan 5 Moscow-local business day and must be treated as such.
    await pool.query(
      `INSERT INTO bookings (user_id, service_id, starts_at, ends_at)
       VALUES ($1, $2, '2099-01-04T22:00:00.000Z', '2099-01-04T22:30:00.000Z')`,
      [userRes.rows[0].id, serviceId]
    );

    const app = createApp();
    const res = await request(app)
      .get(`/api/slots?date=2099-01-05&service_id=${serviceId}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    // The 01:00-01:30 local slot overlaps the booking and must be excluded; only 01:30-02:00 remains.
    // Under the old `starts_at::date = $1::date` (UTC) filter, the booking's UTC date is
    // 2099-01-04, which never matches the requested '2099-01-05', so the booking would be
    // silently ignored and BOTH slots would incorrectly be returned as available.
    expect(res.body).toEqual([{ startsAt: '2099-01-04T22:30:00.000Z' }]);
  });
});
