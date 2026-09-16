import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import apiRoutes from './routes';
import { notFound, errorHandler } from './middlewares/error';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'DressSense API', time: new Date().toISOString() });
  });

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
