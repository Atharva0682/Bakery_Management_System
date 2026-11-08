const feedbackService = require('../services/feedbackService');
const { successResponse, errorResponse } = require('../utils/response');

class FeedbackController {
  async submitFeedback(req, res) {
    try {
      const orderId = req.params?.orderId || req.body?.order_id;
      const data = await feedbackService.submitFeedback({
        customerId: req.user.id,
        businessId: req.user.business_id,
        orderId,
        ratingData: req.body,
      });
      return successResponse(res, data, 201);
    } catch (err) {
      return errorResponse(res, err.code || 'FEEDBACK_ERROR', err.message, err.statusCode || 400);
    }
  }

  async getMyFeedback(req, res) {
    try {
      const data = await feedbackService.getCustomerFeedback(req.user.id, req.user.business_id);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'FEEDBACK_ERROR', err.message, err.statusCode || 400);
    }
  }
}

module.exports = new FeedbackController();
