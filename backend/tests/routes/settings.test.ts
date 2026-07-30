import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
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

describe('GET /api/settings', () => {
  it('returns the seeded timezone and booking horizon, accessible to any authenticated (non-admin) user', async () => {
    const app = createApp();
    const res = await request(app).get('/api/settings').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
  });

  it('does not expose ownerChatId or workingHours', async () => {
    const app = createApp();
    const res = await request(app).get('/api/settings').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('ownerChatId');
    expect(res.body).not.toHaveProperty('owner_chat_id');
    expect(res.body).not.toHaveProperty('workingHours');
    expect(res.body).not.toHaveProperty('working_hours');
  });
});
