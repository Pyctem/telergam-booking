import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { validateInitDataMiddleware } from './middleware/validateInitData.js';

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

  return app;
}
