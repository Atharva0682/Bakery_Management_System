const paymentService = require('../services/paymentService');
const { successResponse, errorResponse } = require('../utils/response');

class PaymentController {
  /**
   * Customer confirms payment ("I've Paid")
   * Locks amount to server-calculated order total and transitions to Pending Verification.
   */
  async confirmPayment(req, res) {
    try {
      const data = await paymentService.recordPaymentConfirmation({
        customerId: req.user.id,
        businessId: req.user.business_id,
        orderId: req.body.order_id,
        paymentMode: req.body.payment_mode || 'QR_UPI',
        qrReferenceCode: req.body.qr_reference_code || null,
        screenshot: req.body.screenshot || req.body.screenshot_data || null,
      });
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'PAYMENT_ERROR', err.message, err.statusCode || 400);
    }
  }

  /**
   * Fetch payments for an order
   */
  async getOrderPayments(req, res) {
    try {
      const data = await paymentService.getOrderPayments(
        req.params.orderId,
        req.user?.id,
        req.user?.business_id || 1,
        req.user?.role || 'customer'
      );
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'PAYMENT_ERROR', err.message, err.statusCode || 404);
    }
  }

  /**
   * Fetch all pending verification payments (Owner/Manager)
   */
  async getPendingPayments(req, res) {
    try {
      const businessId = req.user?.business_id || 1;
      const data = await paymentService.getPendingPayments(businessId);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, 'PAYMENTS_ERROR', err.message, 500);
    }
  }

  /**
   * Owner/Manager verifies and approves a payment
   */
  async verifyPayment(req, res) {
    try {
      const businessId = req.user?.business_id || 1;
      const staffUserId = req.user?.id || 1;
      const data = await paymentService.verifyPayment(req.params.id, businessId, staffUserId);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'VERIFICATION_ERROR', err.message, err.statusCode || 400);
    }
  }

  /**
   * Owner/Manager rejects a payment
   */
  async rejectPayment(req, res) {
    try {
      const businessId = req.user?.business_id || 1;
      const staffUserId = req.user?.id || 1;
      const { reason } = req.body || {};
      const data = await paymentService.rejectPayment(req.params.id, reason, businessId, staffUserId);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'REJECTION_ERROR', err.message, err.statusCode || 400);
    }
  }
}

module.exports = new PaymentController();
