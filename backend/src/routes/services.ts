import { Router } from 'express';
import { pool } from '../db.js';
import type { Service } from '../types.js';

export const servicesRouter = Router();

servicesRouter.get('/', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, name, description, price, duration_minutes, is_active
     FROM services WHERE is_active = true ORDER BY id`
  );
  const services: Service[] = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
  }));
  res.json(services);
});
