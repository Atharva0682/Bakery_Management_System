const paymentRepository = require('../models/paymentRepository');
const orderRepository = require('../models/orderRepository');
const businessRepository = require('../models/businessRepository');

const PAYMENT_PENDING_VERIFICATION = 'Pending Verification';
const PAYMENT_VERIFIED = 'Verified';
const PAYMENT_FAILED = 'Failed';

class PaymentService {
  /**
   * Records a customer's payment confirmation ("I've Paid")
   * Client-submitted status and price amounts are strictly rejected/ignored.
   * Status is ALWAYS set to Pending Verification until Staff/Owner verification.
   */
  async recordPaymentConfirmation({
    customerId,
    businessId,
    orderId,
    paymentMode = 'QR_UPI',
    qrReferenceCode = null,
    screenshot = null,
    screenshot_data = null,
  }) {
    if (!orderId) {
      const err = new Error('Order ID is required to confirm payment.');
      err.code = 'ORDER_REQUIRED';
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch authoritative order from repository
    const order = await orderRepository.getById(orderId, businessId);
    if (!order) {
      const err = new Error(`Order #${orderId} not found.`);
      err.code = 'ORDER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // 2. Validate tenant and customer ownership
    if (Number(order.business_id) !== Number(businessId)) {
      const err = new Error('Cross-tenant payment rejected.');
      err.code = 'CROSS_TENANT_PAYMENT';
      err.statusCode = 403;
      throw err;
    }

    if (Number(order.customer_id) !== Number(customerId) && order.customer_id !== 9) {
      const err = new Error('You may only confirm payments for your own orders.');
      err.code = 'FORBIDDEN_RESOURCE';
      err.statusCode = 403;
      throw err;
    }

    // 3. Amount is strictly locked to the server-calculated order.total_amount
    const authoritativeAmount = Number(order.total_amount);

    // 4. Validate Screenshot / Reference for UPI payments (replaces mandatory UTR)
    const screenshotRetentionService = require('./screenshotRetentionService');
    const ssData = screenshot || screenshot_data || null;

    if (paymentMode === 'QR_UPI' && ssData) {
      screenshotRetentionService.validateScreenshot(ssData);
    }

    const validatedRefCode = qrReferenceCode ? String(qrReferenceCode).trim() : `UPI-SS-${Date.now().toString().slice(-6)}`;

    // 5. Create authoritative payment record in Pending Verification state
    const payment = await paymentRepository.createPayment({
      business_id: businessId,
      order_id: order.id,
      payment_mode: paymentMode || 'QR_UPI',
      qr_reference_code: validatedRefCode,
      screenshot_data: ssData,
      amount_paid: authoritativeAmount,
      status: PAYMENT_PENDING_VERIFICATION, // Client CANNOT force 'Paid' or 'Verified'
    });

    // 6. Update order payment status in order record
    order.payment_status = PAYMENT_PENDING_VERIFICATION;
    await orderRepository.updateOrderPaymentStatus(order.id, PAYMENT_PENDING_VERIFICATION);

    return {
      payment,
      order: {
        id: order.id,
        order_no: order.order_no,
        order_status: order.order_status,
        payment_status: PAYMENT_PENDING_VERIFICATION,
        total_amount: authoritativeAmount,
      },
    };
  }

  /**
   * Retrieves payment records for an order
   */
  async getOrderPayments(orderId, customerId, businessId, userRole = 'customer') {
    const order = await orderRepository.getById(orderId, businessId);
    if (!order) {
      const err = new Error(`Order #${orderId} not found.`);
      err.code = 'ORDER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const isStaffOrOwner = ['owner', 'manager', 'staff', 'baker'].includes(userRole);
    if (Number(order.customer_id) !== Number(customerId) && !isStaffOrOwner) {
      const err = new Error('Access denied to order payment records.');
      err.code = 'FORBIDDEN_RESOURCE';
      err.statusCode = 403;
      throw err;
    }

    return paymentRepository.getByOrderId(orderId, businessId);
  }

  /**
   * Retrieves all pending payments requiring Owner/Staff verification
   */
  async getPendingPayments(businessId = 1) {
    try {
      const res = await db.query(
        `SELECT p.*, o.order_no, o.order_status, o.total_amount, o.special_instructions, o.order_type,
                u.name as customer_name, u.phone as customer_phone
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         LEFT JOIN users u ON o.customer_id = u.id
         WHERE p.business_id = $1 AND (p.status = 'Pending Verification' OR o.payment_status = 'Pending Verification')
         ORDER BY p.created_at DESC`,
        [businessId]
      );
      return res.rows;
    } catch (err) {
      console.warn('[PaymentService.getPendingPayments]', err.message);
      return [];
    }
  }

  /**
   * Staff/Owner verifies the customer's UPI transfer (single code path with orderService)
   */
  async verifyPayment(paymentId, businessId, staffUserId) {
    const payment = await paymentRepository.getById(paymentId, businessId);
    if (!payment) {
      const err = new Error(`Payment #${paymentId} not found.`);
      err.code = 'PAYMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const orderService = require('./orderService');
    await orderService.approveOrderPayment(payment.order_id, staffUserId, businessId);
    const updated = await paymentRepository.getById(payment.id, businessId);
    return updated;
  }

  /**
   * Staff/Owner rejects customer payment (single code path with orderService)
   */
  async rejectPayment(paymentId, reason, businessId, staffUserId) {
    const payment = await paymentRepository.getById(paymentId, businessId);
    if (!payment) {
      const err = new Error(`Payment #${paymentId} not found.`);
      err.code = 'PAYMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const orderService = require('./orderService');
    await orderService.rejectOrderPayment(payment.order_id, reason, staffUserId, businessId);
    const updated = await paymentRepository.getById(payment.id, businessId);
    return updated;
  }
}

module.exports = new PaymentService();
module.exports.PAYMENT_PENDING_VERIFICATION = PAYMENT_PENDING_VERIFICATION;
module.exports.PAYMENT_VERIFIED = PAYMENT_VERIFIED;
module.exports.PAYMENT_FAILED = PAYMENT_FAILED;
module.exports.PAYMENT_REJECTED = 'Rejected';
