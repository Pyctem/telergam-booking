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
});
