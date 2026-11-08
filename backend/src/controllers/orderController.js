const orderService = require('../services/orderService');
const { successResponse, errorResponse } = require('../utils/response');

class OrderController {
  async createOrder(req, res) {
    try {
      const businessId = req.user?.business_id || req.businessId;
      const customerId = req.user?.id || null;

      const data = await orderService.createCustomerOrder({
        customerId,
        businessId,
        orderData: req.body,
        user: req.user || null,
      });
      return successResponse(res, data, 201);
    } catch (err) {
      return errorResponse(res, err.code || 'ORDER_ERROR', err.message, err.statusCode || 400);
    }
  }

  async getOrders(req, res) {
    try {
      const data = await orderService.getCustomerOrders(req.user.id, req.user.business_id);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'ORDER_ERROR', err.message, err.statusCode || 400);
    }
  }

  async getOrderDetails(req, res) {
    try {
      const customerId = req.user?.id || null;
      const businessId = req.user?.business_id || req.query.business_id || null;
      const role = req.user?.role || 'guest';
      const trackingToken = req.query.t || req.query.token || null;
      const data = await orderService.getOrderDetails(req.params.id, customerId, businessId, role, trackingToken);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'ORDER_ERROR', err.message, err.statusCode || 404);
    }
  }

  async getAllBusinessOrders(req, res) {
    try {
      const data = await orderService.getAllOrdersForBusiness(req.user.business_id, req.query, req.user.role);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'ORDER_ERROR', err.message, err.statusCode || 400);
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const { status, notes } = req.body;
      if (!status) {
        return errorResponse(res, 'MISSING_STATUS', 'Order status is required.', 400);
      }
      const updated = await orderService.updateOrderStatus(
        req.params.id,
        status,
        notes,
        req.user.id,
        req.user.business_id
      );
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'ORDER_ERROR', err.message, err.statusCode || 400);
    }
  }

  async approveOrderPayment(req, res) {
    try {
      const updated = await orderService.approveOrderPayment(
        req.params.id,
        req.user.id,
        req.user.business_id
      );
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'PAYMENT_ERROR', err.message, err.statusCode || 400);
    }
  }

  async rejectOrderPayment(req, res) {
    try {
      const { reason } = req.body;
      const updated = await orderService.rejectOrderPayment(
        req.params.id,
        reason || 'Invalid Transaction ID / UTR',
        req.user.id,
        req.user.business_id
      );
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'PAYMENT_ERROR', err.message, err.statusCode || 400);
    }
  }

  async uploadReplacementScreenshot(req, res) {
    try {
      const customerId = req.user?.id || null;
      const businessId = req.user?.business_id || req.body?.business_id || 1;
      const trackingToken = req.body?.tracking_token || req.query?.t || null;
      const screenshot = req.body?.screenshot || req.body?.screenshot_data;

      const data = await orderService.uploadReplacementScreenshot(
        req.params.id,
        screenshot,
        customerId,
        businessId,
        trackingToken
      );
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'SCREENSHOT_ERROR', err.message, err.statusCode || 400);
    }
  }

  async getDeliverySlots(req, res) {
    try {
      const deliveryScheduleService = require('../services/deliveryScheduleService');
      const date = req.query.date;
      const businessId = req.query.business_id || 1;
      const slots = await deliveryScheduleService.getSlotsForDate(date, businessId);
      return successResponse(res, slots, 200);
    } catch (err) {
      return errorResponse(res, 'DELIVERY_SLOTS_ERROR', err.message, 400);
    }
  }

  async checkDeliveryAvailability(req, res) {
    try {
      const deliveryScheduleService = require('../services/deliveryScheduleService');
      const { delivery_date, delivery_time_slot, items, business_id } = req.body;
      const result = await deliveryScheduleService.validateDeliveryAndStock({
        deliveryDate: delivery_date,
        deliveryTimeSlot: delivery_time_slot,
        items,
        businessId: business_id || 1,
      });
      return successResponse(res, result, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'DELIVERY_UNAVAILABLE', err.message, err.statusCode || 400, {
        nextAvailableDate: err.nextAvailableDate,
        nextAvailableSlot: err.nextAvailableSlot,
      });
    }
  }
}

module.exports = new OrderController();

