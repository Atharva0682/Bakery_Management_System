const wastageRepository = require('../models/wastageRepository');
const { successResponse, errorResponse } = require('../utils/response');

class WastageController {
  async recordWastage(req, res) {
    try {
      const batch_id = req.body.batch_id || req.body.batchId;
      const order_id = req.body.order_id || req.body.orderId || null;
      const product_name = req.body.product_name || null;
      const quantity_wasted = req.body.quantity_wasted !== undefined ? parseFloat(req.body.quantity_wasted) : parseFloat(req.body.quantity || 0);
      const surplus_buffer_quantity = parseFloat(req.body.surplus_buffer_quantity || req.body.surplusQty || 0);
      const expiry_date = req.body.expiry_date || req.body.use_by || null;
      const reason = req.body.reason || (surplus_buffer_quantity > 0 ? 'Surplus Production Yield' : 'Overproduction / Trim');
      const unit = req.body.unit || 'pcs';
      const notes = req.body.notes || req.body.wastageNotes || '';

      if (!batch_id && !order_id && !product_name && !req.body.raw_material_id) {
        return errorResponse(res, 'MISSING_DATA', 'Batch ID, Order ID, or Product Name is required.', 400);
      }

      if (quantity_wasted < 0 || surplus_buffer_quantity < 0) {
        return errorResponse(res, 'INVALID_QUANTITY', 'Quantities must be non-negative numbers.', 400);
      }

      const record = await wastageRepository.recordWastage({
        business_id: req.user.business_id,
        raw_material_id: req.body.raw_material_id,
        idempotency_key: req.headers['idempotency-key'] || req.body.idempotency_key,
        batch_id,
        order_id,
        product_name,
        quantity_wasted,
        surplus_buffer_quantity,
        expiry_date,
        unit: unit || 'pcs',
        reason,
        notes,
        baker_id: req.user.id,
        logged_by: req.user.name || 'Baker'
      });

      return successResponse(res, record, 201);
    } catch (err) {
      return errorResponse(res, 'WASTAGE_LOG_ERROR', err.message, 400);
    }
  }

  async getAllWastage(req, res) {
    try {
      const { batchId, range } = req.query;
      const records = await wastageRepository.getAllWastage({
        businessId: req.user.business_id,
        batchId, range
      });
      return successResponse(res, records, 200);
    } catch (err) {
      return errorResponse(res, 'WASTAGE_FETCH_ERROR', err.message, 500);
    }
  }

  async getTodaySummary(req, res) {
    try {
      const summary = await wastageRepository.getTodaySummary(req.user.business_id);
      return successResponse(res, summary, 200);
    } catch (err) {
      return errorResponse(res, 'WASTAGE_FETCH_ERROR', err.message, 500);
    }
  }
}

module.exports = new WastageController();
