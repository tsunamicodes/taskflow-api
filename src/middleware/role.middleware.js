/**
 * Role-based access control middleware factory.
 *
 * Usage:
 *   router.delete('/:id', requireRole('ADMIN'), controller.remove);
 *   router.post('/',       requireRole('USER', 'ADMIN'), controller.create);
 *
 * Requires authMiddleware to have run first so req.user is populated.
 * Error responses follow the uniform { success, message, errors } shape.
 */
function requireRole(...roles) {
  const allow = new Set(roles);

  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
        errors: null,
      });
    }
    if (!allow.has(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: insufficient role',
        errors: null,
      });
    }
    return next();
  };
}

module.exports = requireRole;
module.exports.requireRole = requireRole;
