const authMiddleware = require('./authMiddleware');

module.exports = {
  ...authMiddleware,
  // Backwards compatibility aliases
  authenticateToken: authMiddleware.requireAuth,
  authorizeRoles: authMiddleware.requireRole,
};
