import { describe, it, expect, vi, afterEach } from 'vitest';
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/bookings notifications', () => {
  it('still returns 201 even if the Telegram API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const app = createApp();
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', authHeaderFor(42))
      .send({ serviceId: serviceRes.rows[0].id, startsAt: '2099-04-01T09:00:00.000Z' });

    expect(res.status).toBe(201);
  });

  it('still notifies the client even when the owner_chat_id settings lookup fails', async () => {
    // Reproduces the second half of the bug this suite guards against: if
    // `SELECT owner_chat_id FROM business_settings ...` throws (transient DB
    // blip, pool exhaustion, etc.), the client's own booking-confirmation
    // notification must still be sent — it doesn't depend on that query at
    // all. Before the fix, the settings-query failure prevented
    // notifyBookingCreated from ever being called, silently skipping the
    // client's notification too.
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );

    const originalQuery = pool.query.bind(pool);
    const querySpy = vi
      .spyOn(pool, 'query')
      // @ts-expect-error -- overload signature of pg.Pool#query isn't worth reproducing for a test-only mock
      .mockImplementation((...args: Parameters<typeof pool.query>) => {
        const first = args[0];
        const text = typeof first === 'string' ? first : (first as { text: string }).text;
        if (text.includes('business_settings')) {
          return Promise.reject(new Error('settings lookup failed'));
        }
        // @ts-expect-error -- forwarding to the real implementation with the same args
        return originalQuery(...args);
      });

    try {
      const app = createApp();
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', authHeaderFor(99))
        .send({ serviceId: serviceRes.rows[0].id, startsAt: '2099-05-01T09:00:00.000Z' });

      expect(res.status).toBe(201);

      // notifyBookingCreated runs fire-and-forget after the response is
      // sent, so wait for the client notification's fetch call to land.
      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      // Exactly one Telegram call: the client's confirmation. The owner
      // notification is skipped because the settings lookup failed and
      // fell back to ownerChatId = null (never a truthy-check bug: null
      // is checked with !== null / !== undefined, not truthiness).
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(options.body);
      expect(body.chat_id).toBe(99);
      expect(body.text).toContain('Вы записаны');
    } finally {
      querySpy.mockRestore();
    }
  });
});
