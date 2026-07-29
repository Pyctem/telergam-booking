import express, { type NextFunction, type Request, type Response } from 'express';
import 'express-async-errors';
import cors from 'cors';
import { config } from './config.js';
import { validateInitDataMiddleware } from './middleware/validateInitData.js';
import { servicesRouter } from './routes/services.js';
import { adminServicesRouter } from './routes/admin/services.js';
import { slotsRouter } from './routes/slots.js';
import { bookingsRouter } from './routes/bookings.js';
import { requireAdminMiddleware } from './middleware/requireAdmin.js';

// Global error handler. Express identifies this as error-handling middleware
// by its 4-argument signature. Combined with `express-async-errors` (imported
// above, before any routes are registered), any rejected promise from an
// async route/middleware handler is forwarded here automatically instead of
// crashing the process on an unhandled rejection. Exported so tests can wire
// it up standalone against a throwaway route to prove the safety net works
// without relying on internal route-registration order in `createApp()`.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/whoami', validateInitDataMiddleware, (req, res) => {
    res.json(req.user);
  });

  app.use('/api/services', validateInitDataMiddleware, servicesRouter);

  app.use('/api/slots', validateInitDataMiddleware, slotsRouter);

  app.use('/api/bookings', validateInitDataMiddleware, bookingsRouter);

  app.use(
    '/api/admin/services',
    validateInitDataMiddleware,
    requireAdminMiddleware,
    adminServicesRouter
  );

  app.use(errorHandler);

  return app;
}
