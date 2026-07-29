import { describe, it, expect, beforeEach } from 'vitest';
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

describe('GET /api/services', () => {
  beforeEach(async () => {
    await pool.query(
      `INSERT INTO services (name, price, duration_minutes, is_active) VALUES
       ('Haircut', 1500, 30, true),
       ('Beard trim', 800, 20, true),
       ('Retired service', 500, 15, false)`
    );
  });

  it('returns only active services', async () => {
    const app = createApp();
    const res = await request(app).get('/api/services').set('Authorization', authHeaderFor(1));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((s: { name: string }) => s.name).sort()).toEqual(['Beard trim', 'Haircut']);
  });

  it('returns id as a real number, not a string, over the HTTP/JSON layer', async () => {
    // services.id is a Postgres BIGSERIAL (OID 20); node-postgres returns int8
    // columns as strings by default. db.ts registers a global type parser for
    // OID 20 so ids are numbers end-to-end, matching the `number` type declared
    // in src/types.ts. Assert this through the actual HTTP response (not just
    // at the DB layer) so a regression here is caught by an API-level test.
    const app = createApp();
    const res = await request(app).get('/api/services').set('Authorization', authHeaderFor(1));

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(typeof res.body[0].id).toBe('number');
  });
});
