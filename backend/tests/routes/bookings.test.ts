import { describe, it, expect, vi } from 'vitest';
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
  it('creates a booking, lists it, then cancels it', async () => {
    const app = createApp();
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;
    const header = authHeaderFor(555);

    // 2099-02-02 is a Monday, 09:00Z = 12:00 Europe/Moscow: within the
    // default seeded working hours (09:00-20:00) and on the 30-minute slot
    // grid, so this is a valid slot per createBooking's revalidation.
    const createRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', header)
      .send({ serviceId, startsAt: '2099-02-02T09:00:00.000Z' });
    expect(createRes.status).toBe(201);
    const bookingId = createRes.body.id;

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

  it('returns 409 (not 422) when the EXCLUDE constraint catches a race the slot check missed', async () => {
    // With createBooking's slot revalidation (Finding 1), a request for an
    // already-booked slot is normally rejected as invalid_slot (422) before
    // it ever reaches the INSERT, since generateSlots excludes slots that
    // overlap an existing confirmed booking. The EXCLUDE-constraint 409 path
    // is reserved for a genuine race: two requests whose slot-validation
    // both ran (and both saw the slot as available) before either INSERT
    // committed. That race is timing-dependent and not safe to rely on for a
    // deterministic test, so we simulate it directly: force the second
    // request's existing-bookings lookup (the query createBooking uses to
    // compute available slots) to return a stale/empty snapshot, exactly as
    // it would if it had run a moment before the first booking's INSERT
    // committed. Slot validation then treats the slot as available, and the
    // real conflict is caught by the DB's EXCLUDE constraint at INSERT time
    // instead, which must still map to 409.
    const app = createApp();
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;
    const startsAt = '2099-02-02T09:00:00.000Z';

    const first = await request(app)
      .post('/api/bookings')
      .set('Authorization', authHeaderFor(555))
      .send({ serviceId, startsAt });
    expect(first.status).toBe(201);

    const originalQuery = pool.query.bind(pool);
    const querySpy = vi
      .spyOn(pool, 'query')
      // @ts-expect-error -- overload signature of pg.Pool#query isn't worth reproducing for a test-only mock
      .mockImplementation((...args: Parameters<typeof pool.query>) => {
        const first = args[0];
        const text = typeof first === 'string' ? first : (first as { text: string }).text;
        if (typeof text === 'string' && text.includes('SELECT starts_at, ends_at FROM bookings')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        // @ts-expect-error -- forwarding to the real implementation with the same args
        return originalQuery(...args);
      });

    try {
      const second = await request(app)
        .post('/api/bookings')
        .set('Authorization', authHeaderFor(556))
        .send({ serviceId, startsAt });
      expect(second.status).toBe(409);
      expect(second.body.error).toBe('Slot no longer available');
    } finally {
      querySpy.mockRestore();
    }
  });

  it('rejects a booking time outside working hours with 422', async () => {
    const app = createApp();
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;

    // 2099-02-02 is a Monday; 03:00Z = 06:00 Europe/Moscow, before the
    // 09:00 working-hours start.
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', authHeaderFor(555))
      .send({ serviceId, startsAt: '2099-02-02T03:00:00.000Z' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Requested time is not a valid slot');
  });

  it('rejects a booking time in the past with 422', async () => {
    const app = createApp();
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', authHeaderFor(555))
      .send({ serviceId, startsAt: '2020-01-06T09:00:00.000Z' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Requested time is not a valid slot');
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
