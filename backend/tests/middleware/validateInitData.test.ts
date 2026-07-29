import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function signInitData(fields: Record<string, string>): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('validateInitData middleware (via GET /api/whoami test route)', () => {
  it('rejects requests without an Authorization header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/whoami');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid signature', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/whoami')
      .set('Authorization', 'tma auth_date=1&user=%7B%7D&hash=' + '0'.repeat(64));
    expect(res.status).toBe(401);
  });

  it('upserts the user and attaches req.user for a validly signed request', async () => {
    const app = createApp();
    const initData = signInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 777, first_name: 'Lena' }),
    });

    const res = await request(app).get('/api/whoami').set('Authorization', `tma ${initData}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ telegramId: 777, role: 'client', firstName: 'Lena' });

    const dbUser = await pool.query('SELECT * FROM users WHERE telegram_id = 777');
    expect(dbUser.rows).toHaveLength(1);
  });
});
