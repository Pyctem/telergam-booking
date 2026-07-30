import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

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

describe('/api/admin/settings', () => {
  it('rejects a non-admin user with 403', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/settings').set('Authorization', authHeaderFor(1));
    expect(res.status).toBe(403);
  });

  it('reads then updates business settings', async () => {
    const app = createApp();
    const header = authHeaderFor(1);
    await request(app).get('/api/services').set('Authorization', header);
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 1`);

    const getRes = await request(app).get('/api/admin/settings').set('Authorization', header);
    expect(getRes.status).toBe(200);
    expect(getRes.body.slotIntervalMinutes).toBe(30);

    const patchRes = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', header)
      .send({ ownerChatId: 123456 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.ownerChatId).toBe(123456);
  });
});
