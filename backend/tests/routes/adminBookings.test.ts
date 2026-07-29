import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';
import { createBooking } from '../../src/services/bookingService.js';

function authHeaderFor(telegramId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Admin' }),
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

describe('GET /api/admin/bookings', () => {
  it('returns confirmed bookings for the requested date only', async () => {
    const app = createApp();
    const header = authHeaderFor(1);
    await request(app).get('/api/services').set('Authorization', header); // ensures user row exists
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 1`);

    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const clientRow = await pool.query(`INSERT INTO users (telegram_id) VALUES (2) RETURNING id`);
    await createBooking({ userId: clientRow.rows[0].id, serviceId: serviceRes.rows[0].id, startsAt: '2099-03-01T09:00:00.000Z' });
    await createBooking({ userId: clientRow.rows[0].id, serviceId: serviceRes.rows[0].id, startsAt: '2099-03-02T09:00:00.000Z' });

    const res = await request(app).get('/api/admin/bookings?date=2099-03-01').set('Authorization', header);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].startsAt).toBe('2099-03-01T09:00:00.000Z');
  });

  it('filters bookings by the business-local day, not the UTC day (Europe/Moscow boundary)', async () => {
    const app = createApp();
    const header = authHeaderFor(1);
    await request(app).get('/api/services').set('Authorization', header); // ensures user row exists
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 1`);

    // business_settings.timezone is seeded as 'Europe/Moscow' (migrations/001_init.sql), but it's a
    // singleton row not reset between tests, so pin it explicitly rather than relying on the default.
    await pool.query(`UPDATE business_settings SET timezone = 'Europe/Moscow' WHERE id = 1`);

    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const clientRow = await pool.query(`INSERT INTO users (telegram_id) VALUES (2) RETURNING id`);
    // 2099-01-04T22:00:00Z == 2099-01-05T01:00:00+03:00: on the UTC calendar it's Jan 4, but it
    // falls inside the Jan 5 Moscow-local calendar day and must be treated as such.
    await createBooking({
      userId: clientRow.rows[0].id,
      serviceId: serviceRes.rows[0].id,
      startsAt: '2099-01-04T22:00:00.000Z',
    });

    // Under the old `starts_at::date = $1::date` (UTC) filter, this booking's UTC date is
    // 2099-01-04, which never matches the requested '2099-01-05', so it would be wrongly excluded.
    const resLocal = await request(app).get('/api/admin/bookings?date=2099-01-05').set('Authorization', header);
    expect(resLocal.status).toBe(200);
    expect(resLocal.body).toHaveLength(1);
    expect(resLocal.body[0].startsAt).toBe('2099-01-04T22:00:00.000Z');

    // Conversely, it must NOT show up under the UTC date, since that's not its Moscow-local day.
    const resUtc = await request(app).get('/api/admin/bookings?date=2099-01-04').set('Authorization', header);
    expect(resUtc.status).toBe(200);
    expect(resUtc.body).toHaveLength(0);
  });
});
