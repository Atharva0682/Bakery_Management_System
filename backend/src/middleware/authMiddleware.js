const { verifyToken } = require('../utils/security');
const { errorResponse } = require('../utils/response');
const userRepository = require('../models/userRepository');

/**
 * Reusable JWT Authentication Middleware
 * Validates token, loads user from database/repo, and attaches req.user
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return errorResponse(res, 'AUTH_REQUIRED', 'Authentication required. No token provided.', 401);
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return errorResponse(res, 'INVALID_TOKEN_FORMAT', 'Authorization header must follow format: Bearer <token>', 401);
  }

  const token = parts[1];

  try {
    const decoded = verifyToken(token);

    if (!decoded.sub || !decoded.business_id || !decoded.role) {
      return errorResponse(res, 'MALFORMED_TOKEN', 'Token payload is missing required identity claims.', 401);
    }

    // Verify user exists and is active in database
    const user = await userRepository.findById(decoded.sub);
    if (!user || !user.is_active) {
      return errorResponse(res, 'USER_INACTIVE', 'User account does not exist or has been disabled.', 401);
    }

    // Attach verified user identity from trusted server record (never trust frontend input)
    req.user = {
      id: user.id,
      business_id: user.business_id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'TOKEN_EXPIRED', 'Your authentication session has expired. Please log in again.', 401);
    }
    return errorResponse(res, 'INVALID_TOKEN', 'Invalid or tampered authentication token.', 401);
  }
};

/**
 * Optional Authentication Middleware
 * If valid Bearer token is provided, attaches req.user.
 * If no token or invalid token, leaves req.user = null and proceeds (useful for Guest Checkout).
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    req.user = null;
    return next();
  }

  try {
    const decoded = verifyToken(parts[1]);
    if (decoded && decoded.sub) {
      const user = await userRepository.findById(decoded.sub);
      if (user && user.is_active) {
        req.user = {
          id: user.id,
          business_id: user.business_id,
          role: user.role,
          name: user.name,
          email: user.email,
          phone: user.phone,
        };
      }
    }
  } catch (err) {
    req.user = null;
  }
  next();
};

/**
 * Role-Based Access Control Middleware
 * Example: requireRole('owner') or requireRole('staff', 'baker', 'manager')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'AUTH_REQUIRED', 'Authentication required before checking roles.', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        'FORBIDDEN_ROLE',
        `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'.`,
        403
      );
    }

    next();
  };
};

/**
 * Tenant Authorization Middleware
 * Guarantees that any business-owned resource matches the authenticated user's business_id.
 * Cross-tenant tampering (e.g. user from business 1 accessing business 2 resource) is strictly rejected.
 */
const requireTenantScope = (targetBusinessResolver) => {
  return (req, res, next) => {
    if (!req.user || !req.user.business_id) {
      return errorResponse(res, 'AUTH_REQUIRED', 'Authenticated user business is required.', 401);
    }

    let targetBusinessId = null;
    if (typeof targetBusinessResolver === 'function') {
      targetBusinessId = targetBusinessResolver(req);
    } else if (typeof targetBusinessResolver === 'string') {
      targetBusinessId = req.params[targetBusinessResolver] || req.body[targetBusinessResolver] || req.query[targetBusinessResolver];
    } else if (req.targetBusinessId) {
      targetBusinessId = req.targetBusinessId;
    }

    if (targetBusinessId && Number(targetBusinessId) !== Number(req.user.business_id)) {
      return errorResponse(
        res,
        'FORBIDDEN_TENANT',
        'Cross-tenant access denied. You do not have permission to access resources belonging to another bakery.',
        403
      );
    }

    next();
  };
};

/**
 * Customer Self-Access Authorization
 * Ensures Customer A cannot access Customer B's private resources (profile, orders, addresses).
 * Bakery staff/owner belonging to the same business are permitted to view.
 */
const requireSelfOrStaff = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'AUTH_REQUIRED', 'Authentication required.', 401);
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam];
    const isOwnerOrStaff = ['owner', 'manager', 'staff', 'baker'].includes(req.user.role);
    const isSelf = targetUserId && Number(targetUserId) === Number(req.user.id);

    if (isSelf || isOwnerOrStaff) {
      return next();
    }

    return errorResponse(
      res,
      'FORBIDDEN_RESOURCE',
      'Access denied. You may only view or modify your own customer records.',
      403
    );
  };
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  requireTenantScope,
  requireSelfOrStaff,
};
