// Express application factory. No network binding here — see src/index.js.
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config } from './config.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: config.maxBodyBytes }));
  app.use(cookieParser());

  // API.
  app.use('/api', apiRouter);
  app.use('/api', notFoundHandler); // unknown /api/* → JSON 404

  // Static SPA assets.
  app.use(express.static(config.publicDir));

  // SPA fallback: any non-API, non-asset GET serves the app shell so the hash
  // router works. Asset-like paths (with a file extension) fall through to a
  // real 404 instead of being served the HTML shell.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (/\.\w+$/.test(req.path)) return next();
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  app.use(errorHandler);
  return app;
}
