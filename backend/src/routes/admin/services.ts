import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db.js';

export const adminServicesRouter = Router();

const createServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  price: z.number().nonnegative(),
  durationMinutes: z.number().int().positive(),
});

adminServicesRouter.get('/', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, name, description, price, duration_minutes, is_active FROM services ORDER BY id`
  );
  res.json(
    result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      durationMinutes: row.duration_minutes,
      isActive: row.is_active,
    }))
  );
});

adminServicesRouter.post('/', async (req, res) => {
  const parsed = createServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { name, description, price, durationMinutes } = parsed.data;
  const result = await pool.query(
    `INSERT INTO services (name, description, price, duration_minutes)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, description ?? null, price, durationMinutes]
  );
  res.status(201).json({ id: result.rows[0].id });
});

const updateServiceSchema = createServiceSchema.partial();

adminServicesRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid service id' });
  }
  const parsed = updateServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const fields = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (fields.name !== undefined) { updates.push(`name = $${i++}`); values.push(fields.name); }
  if (fields.description !== undefined) { updates.push(`description = $${i++}`); values.push(fields.description); }
  if (fields.price !== undefined) { updates.push(`price = $${i++}`); values.push(fields.price); }
  if (fields.durationMinutes !== undefined) { updates.push(`duration_minutes = $${i++}`); values.push(fields.durationMinutes); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  await pool.query(`UPDATE services SET ${updates.join(', ')} WHERE id = $${i}`, values);
  res.status(204).end();
});

adminServicesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid service id' });
  }
  await pool.query('UPDATE services SET is_active = false WHERE id = $1', [id]);
  res.status(204).end();
});
