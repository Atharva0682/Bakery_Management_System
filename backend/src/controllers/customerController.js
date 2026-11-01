const customerService = require('../services/customerService');
const { successResponse, errorResponse } = require('../utils/response');

class CustomerController {
  async getProfile(req, res) {
    try {
      const data = await customerService.getProfile(req.user.id);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'PROFILE_ERROR', err.message, err.statusCode || 400);
    }
  }

  async updateProfile(req, res) {
    try {
      const data = await customerService.updateProfile(req.user.id, req.body);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'UPDATE_ERROR', err.message, err.statusCode || 400);
    }
  }

  async getAddresses(req, res) {
    try {
      const data = await customerService.getAddresses(req.user.id, req.user.business_id);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'ADDRESS_ERROR', err.message, err.statusCode || 400);
    }
  }

  async createAddress(req, res) {
    try {
      const data = await customerService.createAddress(req.user.id, req.user.business_id, req.body);
      return successResponse(res, data, 201);
    } catch (err) {
      return errorResponse(res, err.code || 'ADDRESS_ERROR', err.message, err.statusCode || 400);
    }
  }

  async updateAddress(req, res) {
    try {
      const data = await customerService.updateAddress(req.user.id, req.user.business_id, req.params.id, req.body);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'ADDRESS_ERROR', err.message, err.statusCode || 400);
    }
  }

  async deleteAddress(req, res) {
    try {
      const data = await customerService.deleteAddress(req.user.id, req.user.business_id, req.params.id);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'ADDRESS_ERROR', err.message, err.statusCode || 400);
    }
  }

  async setDefaultAddress(req, res) {
    try {
      const data = await customerService.setDefaultAddress(req.user.id, req.user.business_id, req.params.id);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'ADDRESS_ERROR', err.message, err.statusCode || 400);
    }
  }
}

module.exports = new CustomerController();
