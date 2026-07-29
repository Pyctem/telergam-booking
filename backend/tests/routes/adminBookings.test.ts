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
});
