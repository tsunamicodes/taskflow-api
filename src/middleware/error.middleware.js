const { ZodError } = require('zod');

/**
 * Global Express error handler.
 *
 * Normalizes every error to the uniform response body:
 *
 *   { success: false, message: string, errors: Array | null }
 *
 * ...with the appropriate HTTP status code. `errors` is populated for
 * validation failures (field-level details) and is `null` otherwise.
 */
// eslint-disable-next-line no-unused-vars
module.exports = function errorMiddleware(err, req, res, next) {
  // --- Zod validation errors (fallback path; the validate middleware catches most) ---
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
    });
  }

  // --- Prisma known request errors (duck-typed via code prefix) ---
  if (err && typeof err.code === 'string' && err.code.startsWith('P')) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Unique constraint violation',
        errors: err.meta ? [err.meta] : null,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
        errors: null,
      });
    }
  }

  // --- JWT errors ---
  if (err && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      errors: null,
    });
  }

  // --- Fallback ---
  // eslint-disable-next-line no-console
  console.error(err);
  const status = typeof err.status === 'number' ? err.status : 500;
  return res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errors: null,
  });
};
