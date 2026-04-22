const { ZodError } = require('zod');

/**
 * Zod validation middleware factory.
 *
 * Parses the chosen request field (default `body`) against a Zod schema and
 * replaces it with the parsed/coerced value. On a ZodError it short-circuits
 * with HTTP 400 and a field-level error list:
 *
 *   {
 *     success: false,
 *     message: 'Validation failed',
 *     errors: [{ path: 'email', message: 'Invalid email', code: 'invalid_string' }, ...]
 *   }
 *
 * Any non-Zod error is forwarded to the global error handler.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), authController.register);
 *   router.patch('/:id', validate(taskIdSchema, 'params'), validate(updateTaskSchema), ctrl.updateTask);
 */
function validate(schema, source = 'body') {
  return function validateMiddleware(req, res, next) {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      return next();
    } catch (err) {
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
      return next(err);
    }
  };
}

module.exports = validate;
module.exports.validate = validate;
