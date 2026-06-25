// Typed application errors with HTTP status + machine code.
export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (msg, fields) =>
  new AppError(400, 'bad_request', msg, fields);
export const notFound = (msg = 'Not found') =>
  new AppError(404, 'not_found', msg);
export const conflict = (msg, fields) =>
  new AppError(409, 'conflict', msg, fields);
export const unprocessable = (msg, fields) =>
  new AppError(422, 'unprocessable', msg, fields);

/** Wrap an async route handler so thrown errors reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
