// JSON error envelope: { error: { code, message, fields? } }.
import { AppError } from '../lib/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) },
    });
  }
  // Unexpected — log and return a generic 500.
  console.error('[error]', err);
  res.status(500).json({ error: { code: 'internal', message: 'Internal server error' } });
}
