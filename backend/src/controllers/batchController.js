const batchRepository = require('../models/batchRepository');
const orderRepository = require('../models/orderRepository');
const inventoryRepository = require('../models/inventoryRepository');
const { successResponse, errorResponse } = require('../utils/response');
const db = require('../config/db');

class BatchController {
  async getAllBatches(req, res) {
    try {
      const { status, search, bakerId, taskType, productId, orderId } = req.query;
      const batches = await batchRepository.getAllBatches({
        businessId: req.user.business_id,
        status,
        search,
        bakerId: bakerId || null,
        taskType: taskType || null,
        productId: productId || null,
        orderId: orderId || null,
      });
      return successResponse(res, batches, 200);
    } catch (err) {
      return errorResponse(res, 'BATCH_FETCH_ERROR', err.message, 500);
    }
  }

  async getBatchById(req, res) {
    try {
      const batch = await batchRepository.getBatchById(req.params.id, req.user.business_id);
      if (!batch) {
        return errorResponse(res, 'BATCH_NOT_FOUND', `Batch with ID ${req.params.id} not found.`, 404);
      }
      const logs = await batchRepository.getProductionLogs(batch.id);
      return successResponse(res, { ...batch, logs }, 200);
    } catch (err) {
      return errorResponse(res, 'BATCH_FETCH_ERROR', err.message, 500);
    }
  }

  async createBatch(req, res) {
    try {
      const {
        batch_no,
        product_id,
        product_name,
        planned_quantity,
        planned_weight,
        planned_weight_unit,
        selling_method,
        priority,
        shift,
        source_orders,
        order_id,
        is_planned,
        notes
      } = req.body;

      if (!product_id && !product_name) {
        return errorResponse(res, 'MISSING_PRODUCT', 'Product ID or name is required.', 400);
      }

      const ordersList = Array.isArray(source_orders) ? source_orders : (source_orders ? [source_orders] : []);
      if (order_id && !ordersList.includes(order_id)) ordersList.push(order_id);

      const newBatch = await batchRepository.createBatch({
        business_id: req.user.business_id,
        batch_no,
        product_id,
        product_name,
        baker_id: ['owner', 'manager'].includes(req.user.role) ? (req.body.baker_id || null) : req.user.id,
        planned_quantity: planned_quantity || 50,
        planned_weight: planned_weight || null,
        planned_weight_unit: planned_weight_unit || 'g',
        selling_method: selling_method || 'piece',
        priority: priority || 'Normal',
        shift: shift || 'Morning Shift',
        source_orders: ordersList,
        is_planned: is_planned !== undefined ? (is_planned ? 1 : 0) : (ordersList.length === 0 ? 1 : 0),
        notes: notes || ''
      });

      return successResponse(res, newBatch, 201);
    } catch (err) {
      return errorResponse(res, 'BATCH_CREATE_ERROR', err.message, 400);
    }
  }

  async allocateOrder(req, res) {
    try {
      const batchId = req.params.id || req.body.batch_id;
      const { order_id, quantity = 1, weight_grams = null } = req.body;

      if (!batchId) {
        return errorResponse(res, 'MISSING_BATCH', 'Batch ID is required.', 400);
      }
      if (!order_id) {
        return errorResponse(res, 'MISSING_ORDER', 'Order ID is required.', 400);
      }

      const result = await batchRepository.allocateOrderToBatch({
        batch_id: batchId,
        order_id,
        quantity,
        weight_grams,
        business_id: req.user.business_id,
      });

      return successResponse(res, result, 200);
    } catch (err) {
      return errorResponse(res, 'ALLOCATE_ORDER_ERROR', err.message, 400);
    }
  }

  async updateBatchStatus(req, res) {
    try {
      const {
        status,
        completedQuantity,
        wastageQuantity,
        packedQuantity,
        actualOutputWeight,
        notes,
        rejectionReason
      } = req.body;

      if (!status) {
        return errorResponse(res, 'MISSING_STATUS', 'Status is required.', 400);
      }

      const updatedBatch = await batchRepository.updateStatus(req.params.id, status, {
        bakerId: req.user.id,
        completedQuantity,
        wastageQuantity,
        packedQuantity,
        actualOutputWeight,
        notes,
        rejectionReason,
        businessId: req.user.business_id
      });

      if (!updatedBatch) {
        return errorResponse(res, 'BATCH_NOT_FOUND', `Batch with ID ${req.params.id} not found.`, 404);
      }

      // Automatically propagate status to linked customer orders
      let customerStatus = updatedBatch.status;
      if (['Completed', 'Packaged', 'Packaging', 'Product Packed', 'Product Completed & Packed'].includes(customerStatus)) {
        customerStatus = 'Product Completed & Packed';
      }

      // Propagate to linked batch_orders
      try {
        const boRes = await db.query(
          "SELECT order_id FROM batch_orders WHERE batch_id = $1 AND status != 'Cancelled'",
          [req.params.id]
        );
        for (const row of boRes.rows) {
          await orderRepository.updateOrderStatus(
            row.order_id,
            customerStatus,
            `Updated via batch ${updatedBatch.batch_no || req.params.id}`,
            req.user.id
          );
        }
      } catch (e) {
        console.warn('[BatchController] batch_orders propagation warning:', e.message);
      }

      return successResponse(res, updatedBatch, 200);
    } catch (err) {
      return errorResponse(res, 'BATCH_UPDATE_ERROR', err.message, 400);
    }
  }

  async rejectBatch(req, res) {
    try {
      const { reason = 'Equipment', notes = '' } = req.body;
      const updated = await batchRepository.updateStatus(req.params.id, 'Rejected', {
        bakerId: req.user.id,
        rejectionReason: reason,
        notes: `Rejected: ${reason} - ${notes}`,
        businessId: req.user.business_id
      });
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, 'BATCH_REJECT_ERROR', err.message, 400);
    }
  }
}

module.exports = new BatchController();
