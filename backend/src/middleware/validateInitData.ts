import type { NextFunction, Request, Response } from 'express';
import { validateInitData } from '../lib/telegramAuth.js';
import { pool } from '../db.js';
import { config } from '../config.js';
import type { AuthenticatedUser } from '../types.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function validateInitDataMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('tma ')) {
    return res.status(401).json({ error: 'Missing Telegram init data' });
  }

  const initData = header.slice('tma '.length);
  const parsed = validateInitData(initData, config.botToken);
  if (!parsed) {
    return res.status(401).json({ error: 'Invalid Telegram init data' });
  }

  const result = await pool.query<{ id: number; role: 'client' | 'admin'; first_name: string | null }>(
    `INSERT INTO users (telegram_id, first_name, last_name, username)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id) DO UPDATE
       SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, username = EXCLUDED.username
     RETURNING id, role, first_name`,
    [parsed.telegramId, parsed.firstName, parsed.lastName, parsed.username]
  );

  const row = result.rows[0];
  req.user = { id: row.id, telegramId: parsed.telegramId, role: row.role, firstName: row.first_name };
  next();
}
