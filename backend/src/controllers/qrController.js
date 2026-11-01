const qrService = require('../services/qrService');
const { successResponse, errorResponse } = require('../utils/response');

class QrController {
  async resolveQr(req, res) {
    try {
      const data = await qrService.resolveQr(req.params.uniqueCode);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'QR_ERROR', err.message, err.statusCode || 400);
    }
  }
}

module.exports = new QrController();
