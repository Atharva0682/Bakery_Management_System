const businessRepository = require('../models/businessRepository');
const { errorResponse } = require('../utils/response');

/**
 * Tenant Resolver Middleware for Customer Portal
 * Resolves active business context from X-Business-Slug header, query param, or authenticated user
 */
const resolveTenantContext = async (req, res, next) => {
  let slug =
    req.params.slug ||
    req.headers['x-business-slug'] ||
    req.query.businessSlug ||
    req.body.businessSlug;

  // If user is authenticated, derive business from verified user record
  if (req.user && req.user.business_id) {
    req.businessId = req.user.business_id;
    return next();
  }

  // Fallback to default demo business if unspecified for public catalog
  if (!slug) {
    slug = 'crumbandco';
  }

  try {
    const business = await businessRepository.findBySlug(slug);
    if (!business || !business.is_active) {
      return errorResponse(res, 'BUSINESS_NOT_FOUND', `Bakery business '${slug}' not found or inactive.`, 404);
    }

    req.businessId = business.id;
    req.businessSlug = business.slug;
    req.business = business;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  resolveTenantContext,
};
