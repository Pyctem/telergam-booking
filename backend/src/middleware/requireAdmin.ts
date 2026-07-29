import type { NextFunction, Request, Response } from 'express';

export function requireAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
