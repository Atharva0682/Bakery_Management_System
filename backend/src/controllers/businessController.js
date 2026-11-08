const catalogService = require('../services/catalogService');
const businessRepository = require('../models/businessRepository');
const { successResponse, errorResponse } = require('../utils/response');

class BusinessController {
  async getPublicBusiness(req, res) {
    try {
      const data = await catalogService.getPublicBusiness(req.params.slug);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'BUSINESS_ERROR', err.message, err.statusCode || 404);
    }
  }

  async updateBusinessBranding(req, res) {
    try {
      const businessId = req.user?.business_id || 1;
      const updated = await businessRepository.updateBusiness(businessId, req.body);
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'BRANDING_ERROR', err.message, 400);
    }
  }
}

module.exports = new BusinessController();
