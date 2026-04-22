const jwt = require('jsonwebtoken');

/**
 * Auth middleware.
 * Extracts the Bearer token from the Authorization header, verifies it with
 * process.env.JWT_SECRET, and attaches req.user = { userId, role }.
 */
module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Missing or invalid Authorization header',
      errors: null,
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: payload.userId,
      role: payload.role,
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      errors: null,
    });
  }
};
