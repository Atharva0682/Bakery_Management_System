const batchRepository = require('../models/batchRepository');
const orderRepository = require('../models/orderRepository');
const inventoryRepository = require('../models/inventoryRepository');
const { successResponse, errorResponse } = require('../utils/response');

const db = require('../config/db');

class BatchController {
  async getAllBatches(req, res) {
    try {
      const { status, search, bakerId } = req.query;
      const batches = await batchRepository.getAllBatches({
        businessId: req.user.business_id,
        status,
        search,
        bakerId: bakerId || null,
        taskType: req.query.taskType || null,
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
      const { batch_no, product_id, product_name, planned_quantity, priority, shift, source_orders } = req.body;
      if (!product_id && !product_name) {
        return errorResponse(res, 'MISSING_PRODUCT', 'Product ID or name is required.', 400);
      }

      const ordersList = Array.isArray(source_orders) ? source_orders : (source_orders ? [source_orders] : []);

      const newBatch = await batchRepository.createBatch({
        business_id: req.user.business_id,
        batch_no,
        product_id,
        product_name,
        baker_id: ['owner', 'manager'].includes(req.user.role) ? (req.body.baker_id || null) : req.user.id,
        planned_quantity: planned_quantity || 50,
        priority: priority || 'Normal',
        shift: shift || 'Morning Shift',
        source_orders: ordersList
      });

      // Link to batch_orders in PostgreSQL
      if (newBatch && newBatch.id && ordersList.length > 0) {
        for (const ref of ordersList) {
          const cleanRef = String(ref).replace('#', '').trim();
          let ord = await orderRepository.getById(cleanRef, req.user.business_id);
          if (!ord) {
            const numMatch = cleanRef.match(/\d+/g);
            if (numMatch && numMatch.length > 0) {
              ord = await orderRepository.getById(numMatch[numMatch.length - 1], req.user.business_id);
            }
          }
          if (ord) {
            try {
              if (db.isConnected()) {
                await db.query(
                  'INSERT INTO batch_orders (batch_id, order_id, order_reference, quantity) VALUES ($1, $2, $3, $4)',
                  [newBatch.id, ord.id, String(ref), 1]
                );
              }
            } catch (e) {
              console.warn('batch_orders insert warning:', e.message);
            }
          }
        }
      }

      return successResponse(res, { ...newBatch, source_orders: ordersList }, 201);
    } catch (err) {
      return errorResponse(res, 'BATCH_CREATE_ERROR', err.message, 400);
    }
  }

  async updateBatchStatus(req, res) {
    try {
      const { status, completedQuantity, wastageQuantity, packedQuantity, notes, rejectionReason } = req.body;
      if (!status) {
        return errorResponse(res, 'MISSING_STATUS', 'Status is required.', 400);
      }

      const updatedBatch = await batchRepository.updateStatus(req.params.id, status, {
        bakerId: req.user.id,
        completedQuantity,
        wastageQuantity,
        packedQuantity,
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

      // 1. From PostgreSQL batch_orders
      try {
        if (db.isConnected()) {
          const boRes = await db.query(
            'SELECT order_id, order_reference FROM batch_orders WHERE batch_id = $1',
            [req.params.id]
          );
          if (boRes.rows.length > 0) {
            for (const row of boRes.rows) {
              await orderRepository.updateOrderStatus(
                row.order_id,
                customerStatus,
                `Updated via batch ${updatedBatch.batch_no || req.params.id}`,
                req.user.id
              );
            }
          }
        }
      } catch (e) {
        console.warn('[BatchController] batch_orders propagation warning:', e.message);
      }

      // 2. From memory source_orders
      if (updatedBatch.source_orders && Array.isArray(updatedBatch.source_orders)) {
        for (const orderRef of updatedBatch.source_orders) {
          const cleanRef = String(orderRef).replace('#', '').trim();
          let order = await orderRepository.getById(cleanRef, req.user.business_id);
          if (!order) {
            const numMatch = cleanRef.match(/\d+/g);
            if (numMatch && numMatch.length > 0) {
              const lastNum = numMatch[numMatch.length - 1];
              order = await orderRepository.getById(lastNum, req.user.business_id);
            }
          }
          if (order) {
            await orderRepository.updateOrderStatus(
              order.id,
              customerStatus,
              `Updated via batch ${updatedBatch.batch_no || updatedBatch.batch_code}`,
              req.user.id
            );
          }
        }
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
