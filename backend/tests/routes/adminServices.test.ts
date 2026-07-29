import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function authHeaderFor(telegramId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'User' }),
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

describe('/api/admin/services', () => {
  it('rejects a non-admin user with 403', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/services')
      .set('Authorization', authHeaderFor(1))
      .send({ name: 'Haircut', price: 1500, durationMinutes: 30 });
    expect(res.status).toBe(403);
  });

  it('allows an admin to create, list, and soft-delete a service', async () => {
    const app = createApp();
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);
    // ensure the admin user row exists before promoting it
    const adminHeader = authHeaderFor(2);
    await request(app).get('/api/services').set('Authorization', adminHeader);
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);

    const createRes = await request(app)
      .post('/api/admin/services')
      .set('Authorization', adminHeader)
      .send({ name: 'Haircut', price: 1500, durationMinutes: 30 });
    expect(createRes.status).toBe(201);
    const serviceId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/admin/services/${serviceId}`)
      .set('Authorization', adminHeader);
    expect(deleteRes.status).toBe(204);

    const remaining = await pool.query('SELECT is_active FROM services WHERE id = $1', [serviceId]);
    expect(remaining.rows[0].is_active).toBe(false);
  });

  it('lists all services for an admin, including inactive ones (no is_active filtering)', async () => {
    const app = createApp();
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);
    const adminHeader = authHeaderFor(2);
    await request(app).get('/api/services').set('Authorization', adminHeader);
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);

    const activeRes = await request(app)
      .post('/api/admin/services')
      .set('Authorization', adminHeader)
      .send({ name: 'Active Service', price: 1000, durationMinutes: 30 });
    expect(activeRes.status).toBe(201);

    const inactiveRes = await request(app)
      .post('/api/admin/services')
      .set('Authorization', adminHeader)
      .send({ name: 'Inactive Service', price: 2000, durationMinutes: 45 });
    expect(inactiveRes.status).toBe(201);
    const inactiveId = inactiveRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/admin/services/${inactiveId}`)
      .set('Authorization', adminHeader);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get('/api/admin/services')
      .set('Authorization', adminHeader);
    expect(listRes.status).toBe(200);
    const names = listRes.body.map((s: { name: string }) => s.name).sort();
    expect(names).toEqual(['Active Service', 'Inactive Service']);

    const inactiveEntry = listRes.body.find((s: { id: number }) => s.id === inactiveId);
    expect(inactiveEntry.isActive).toBe(false);
  });

  it('allows an admin to PATCH a service and persists the changes', async () => {
    const app = createApp();
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);
    const adminHeader = authHeaderFor(2);
    await request(app).get('/api/services').set('Authorization', adminHeader);
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);

    const createRes = await request(app)
      .post('/api/admin/services')
      .set('Authorization', adminHeader)
      .send({ name: 'Haircut', price: 1500, durationMinutes: 30 });
    expect(createRes.status).toBe(201);
    const serviceId = createRes.body.id;

    const patchRes = await request(app)
      .patch(`/api/admin/services/${serviceId}`)
      .set('Authorization', adminHeader)
      .send({ name: 'Deluxe Haircut', price: 2500 });
    expect(patchRes.status).toBe(204);

    const updated = await pool.query(
      'SELECT name, price, duration_minutes FROM services WHERE id = $1',
      [serviceId]
    );
    expect(updated.rows[0].name).toBe('Deluxe Haircut');
    expect(Number(updated.rows[0].price)).toBe(2500);
    expect(updated.rows[0].duration_minutes).toBe(30);
  });

  it('rejects a PATCH with no valid fields with 400', async () => {
    const app = createApp();
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);
    const adminHeader = authHeaderFor(2);
    await request(app).get('/api/services').set('Authorization', adminHeader);
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);

    const createRes = await request(app)
      .post('/api/admin/services')
      .set('Authorization', adminHeader)
      .send({ name: 'Haircut', price: 1500, durationMinutes: 30 });
    expect(createRes.status).toBe(201);
    const serviceId = createRes.body.id;

    const patchRes = await request(app)
      .patch(`/api/admin/services/${serviceId}`)
      .set('Authorization', adminHeader)
      .send({});
    expect(patchRes.status).toBe(400);
  });

  it('rejects a non-numeric service id with 400 instead of a 500', async () => {
    const app = createApp();
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);
    const adminHeader = authHeaderFor(2);
    await request(app).get('/api/services').set('Authorization', adminHeader);
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);

    const patchRes = await request(app)
      .patch('/api/admin/services/abc')
      .set('Authorization', adminHeader)
      .send({ name: 'Whatever' });
    expect(patchRes.status).toBe(400);

    const deleteRes = await request(app)
      .delete('/api/admin/services/abc')
      .set('Authorization', adminHeader);
    expect(deleteRes.status).toBe(400);
  });
});
