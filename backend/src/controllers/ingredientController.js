const inventoryRepository = require('../models/inventoryRepository');
const { successResponse, errorResponse } = require('../utils/response');

class IngredientController {
  async getAllIngredients(req, res) {
    try {
      const { search, status, category } = req.query;
      const ingredients = await inventoryRepository.getAllIngredients({
        businessId: req.user.business_id,
        search,
        status,
        category
      });
      return successResponse(res, ingredients, 200);
    } catch (err) {
      return errorResponse(res, 'INGREDIENT_FETCH_ERROR', err.message, 500);
    }
  }

  async getIngredientById(req, res) {
    try {
      const ing = await inventoryRepository.getIngredientById(req.params.id, req.user.business_id);
      if (!ing) {
        return errorResponse(res, 'INGREDIENT_NOT_FOUND', `Ingredient with ID ${req.params.id} not found.`, 404);
      }
      return successResponse(res, ing, 200);
    } catch (err) {
      return errorResponse(res, 'INGREDIENT_FETCH_ERROR', err.message, 500);
    }
  }

  async createRequisition(req, res) {
    try {
      let raw_material_id = req.body.raw_material_id || req.body.material_id;
      const requested_quantity = req.body.requested_quantity !== undefined ? req.body.requested_quantity : req.body.quantity;
      const unit = req.body.unit || 'kg';
      const notes = req.body.notes || req.body.urgency || '';

      if (!raw_material_id && req.body.material_name) {
        // Resolve raw material by name from floor stock
        const all = await inventoryRepository.getAllIngredients({ businessId: req.user.business_id });
        const target = String(req.body.material_name).toLowerCase();
        const found = all.find(i => (i.material_name || i.name || i.ingredient_name || '').toLowerCase().includes(target));
        raw_material_id = found ? found.id : null;
      }

      if (!raw_material_id) return errorResponse(res, 'MISSING_INGREDIENT', 'Select a valid ingredient.', 400);

      if (requested_quantity === undefined || isNaN(Number(requested_quantity))) {
        return errorResponse(res, 'MISSING_DATA', 'Requested quantity is required and must be numeric.', 400);
      }

      const reqRecord = await inventoryRepository.createRequisition({
        business_id: req.user.business_id,
        raw_material_id,
        baker_id: req.user.id,
        baker_name: req.user.name,
        requested_quantity,
        unit,
        notes
      });

      return successResponse(res, reqRecord, 201);
    } catch (err) {
      return errorResponse(res, 'REQUISITION_ERROR', err.message, 400);
    }
  }

  async getAllRequisitions(req, res) {
    try {
      const { status } = req.query;
      const requisitions = await inventoryRepository.getAllRequisitions({
        businessId: req.user.business_id,
        status
      });
      return successResponse(res, requisitions, 200);
    } catch (err) {
      return errorResponse(res, 'REQUISITION_FETCH_ERROR', err.message, 500);
    }
  }

  async updateRequisitionStatus(req, res) {
    try {
      const { status } = req.body;
      const validStatuses = ['Approved', 'Dispatched', 'Rejected', 'Pending'];
      if (!validStatuses.includes(status)) {
        return errorResponse(res, 'INVALID_STATUS', 'Status must be Approved, Dispatched, Rejected, or Pending.', 400);
      }

      const updated = await inventoryRepository.updateRequisitionStatus(req.params.id, status, {
        businessId: req.user.business_id,
        updatedBy: req.user.id
      });
      if (!updated) {
        return errorResponse(res, 'REQUISITION_NOT_FOUND', 'Requisition not found.', 404);
      }
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, 'REQUISITION_UPDATE_ERROR', err.message, 400);
    }
  }

  async approveRequisition(req, res) {
    try {
      const updated = await inventoryRepository.updateRequisitionStatus(req.params.id, 'Dispatched', {
        businessId: req.user.business_id,
        updatedBy: req.user.id
      });
      if (!updated) {
        return errorResponse(res, 'REQUISITION_NOT_FOUND', 'Requisition not found.', 404);
      }
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, 'REQUISITION_APPROVE_ERROR', err.message, 400);
    }
  }

  async rejectRequisition(req, res) {
    try {
      const updated = await inventoryRepository.updateRequisitionStatus(req.params.id, 'Rejected', {
        businessId: req.user.business_id,
        updatedBy: req.user.id
      });
      if (!updated) {
        return errorResponse(res, 'REQUISITION_NOT_FOUND', 'Requisition not found.', 404);
      }
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, 'REQUISITION_REJECT_ERROR', err.message, 400);
    }
  }

  async restockIngredient(req, res) {
    try {
      const amount = req.body.amount !== undefined ? req.body.amount : req.body.quantity;
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return errorResponse(res, 'INVALID_AMOUNT', 'Restock amount must be a positive number.', 400);
      }

      const item = await inventoryRepository.getIngredientById(req.params.id, req.user.business_id);
      if (!item) {
        return errorResponse(res, 'INGREDIENT_NOT_FOUND', `Ingredient with ID ${req.params.id} not found.`, 404);
      }

      const { convertQuantity } = require('../utils/costing');
      let finalAmount = parsedAmount;
      let finalUnitPrice = req.body.unit_price !== undefined && req.body.unit_price !== null && req.body.unit_price !== ''
        ? parseFloat(req.body.unit_price)
        : undefined;

      const inputUnit = req.body.unit || req.body.input_unit;
      if (inputUnit && inputUnit.trim().toLowerCase() !== item.unit.trim().toLowerCase()) {
        try {
          finalAmount = convertQuantity(parsedAmount, inputUnit, item.unit);
          if (finalUnitPrice !== undefined && !isNaN(finalUnitPrice)) {
            const factor = convertQuantity(1, inputUnit, item.unit);
            if (factor > 0) {
              finalUnitPrice = finalUnitPrice / factor;
            }
          }
        } catch (convErr) {
          return errorResponse(res, 'UNIT_CONVERSION_ERROR', convErr.message, 400);
        }
      }

      let supplierId = req.body.supplier_id;
      if (!supplierId && (req.body.new_supplier_name || req.body.supplier_name)) {
        const vendorRepository = require('../models/vendorRepository');
        const newVendor = await vendorRepository.createVendor({
          name: req.body.new_supplier_name || req.body.supplier_name,
          contact_name: req.body.supplier_contact || req.body.contact_name,
          phone: req.body.supplier_phone || req.body.phone,
          businessId: req.user.business_id
        });
        supplierId = newVendor?.id;
      }
      const updated = await inventoryRepository.updateStock(req.params.id, finalAmount, {
        isDeduction: false,
        businessId: req.user.business_id,
        lotNumber: req.body.lot_number,
        supplierId: supplierId,
        unitPrice: finalUnitPrice,
        expiryDate: req.body.expiry_date
      });
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, 'RESTOCK_ERROR', err.message, 500);
    }
  }
  async getStockMovements(req, res) {
    try {
      const db = require('../config/db');
      const movements = (await db.query(`
        SELECT sm.*, rm.name as ingredient_name, rm.unit as ingredient_unit
        FROM stock_movements sm
        LEFT JOIN raw_materials rm ON sm.raw_material_id = rm.id
        WHERE sm.business_id = $1
        ORDER BY sm.id DESC
        LIMIT 100
      `, [req.user.business_id])).rows;
      return successResponse(res, movements, 200);
    } catch (err) {
      return errorResponse(res, 'MOVEMENTS_FETCH_ERROR', err.message, 500);
    }
  }
}

module.exports = new IngredientController();
