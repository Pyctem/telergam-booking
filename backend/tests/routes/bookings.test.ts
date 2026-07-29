import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function authHeaderFor(telegramId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Client' }),
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

describe('/api/bookings', () => {
  it('creates a booking, prevents a conflicting one, lists it, then cancels it', async () => {
    const app = createApp();
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;
    const header = authHeaderFor(555);

    const createRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', header)
      .send({ serviceId, startsAt: '2099-02-01T09:00:00.000Z' });
    expect(createRes.status).toBe(201);
    const bookingId = createRes.body.id;

    const conflictRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', authHeaderFor(556))
      .send({ serviceId, startsAt: '2099-02-01T09:15:00.000Z' });
    expect(conflictRes.status).toBe(409);

    const listRes = await request(app).get('/api/bookings/my').set('Authorization', header);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(bookingId);

    const cancelRes = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', header);
    expect(cancelRes.status).toBe(200);

    const afterCancel = await request(app).get('/api/bookings/my').set('Authorization', header);
    expect(afterCancel.body[0].status).toBe('cancelled');
  });

  it('rejects cancelling a booking that belongs to a different user', async () => {
    const app = createApp();
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;

    const createRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', authHeaderFor(1))
      .send({ serviceId, startsAt: '2099-02-02T09:00:00.000Z' });

    const cancelRes = await request(app)
      .patch(`/api/bookings/${createRes.body.id}/cancel`)
      .set('Authorization', authHeaderFor(2));
    expect(cancelRes.status).toBe(404);
  });

  it('rejects a non-numeric booking id with 400 instead of a 500', async () => {
    const app = createApp();
    const cancelRes = await request(app)
      .patch('/api/bookings/abc/cancel')
      .set('Authorization', authHeaderFor(1));
    expect(cancelRes.status).toBe(400);
  });
});
