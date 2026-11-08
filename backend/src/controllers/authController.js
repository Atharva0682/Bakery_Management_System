const authService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/response');

class AuthController {
  /**
   * POST /api/auth/register
   * Register a customer under a specific business
   */
  async register(req, res) {
    try {
      const { businessSlug, name, email, phone, password } = req.body;
      const result = await authService.registerCustomer({
        businessSlug,
        name,
        email,
        phone,
        password,
      });
      return successResponse(res, result, 201);
    } catch (err) {
      return errorResponse(
        res,
        err.code || 'REGISTRATION_FAILED',
        err.message,
        err.statusCode || 400
      );
    }
  }

  /**
   * POST /api/auth/login
   * Authenticate a user and return a signed JWT
   */
  async login(req, res) {
    try {
      const { businessSlug, identifier, email, password } = req.body;
      const effectiveSlug = businessSlug || req.headers['x-business-slug'] || null;
      const result = await authService.loginUser({
        businessSlug: effectiveSlug,
        identifier: identifier || email,
        password,
      });
      return successResponse(res, result, 200);
    } catch (err) {
      return errorResponse(
        res,
        err.code || 'LOGIN_FAILED',
        err.message,
        err.statusCode || 401
      );
    }
  }

  /**
   * GET /api/auth/me
   * Return authenticated user profile and business details
   */
  async getMe(req, res) {
    try {
      const result = await authService.getCurrentUser(req.user.id);
      return successResponse(res, result, 200);
    } catch (err) {
      return errorResponse(
        res,
        err.code || 'PROFILE_FETCH_FAILED',
        err.message,
        err.statusCode || 404
      );
    }
  }
}

module.exports = new AuthController();
