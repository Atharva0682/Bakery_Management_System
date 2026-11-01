const ownerRepository = require('../models/ownerRepository');
const recipeRepository = require('../models/recipeRepository');
const vendorRepository = require('../models/vendorRepository');
const workerRepository = require('../models/workerRepository');
const { successResponse, errorResponse } = require('../utils/response');

class OwnerController {
  async getAnalytics(req, res) {
    try {
      const { range = 'this_week', startDate, endDate } = req.query;
      const data = await ownerRepository.getAnalytics(req.user.business_id, range, startDate, endDate);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, 'ANALYTICS_ERROR', err.message, 500);
    }
  }

  async getTraceability(req, res) {
    try {
      const query = req.params.query || req.query.query || 'BC-0918-01';
      const data = await ownerRepository.getTraceability(query, req.user.business_id);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, 'TRACEABILITY_ERROR', err.message, 500);
    }
  }

  async getRecallReportCsv(req, res) {
    try {
      const { lotQuery } = req.params;
      const data = await ownerRepository.getRecallReportData(lotQuery, req.user.business_id);

      const rows = [];
      rows.push(['FOOD SAFETY RECALL REPORT - CHAIN OF CUSTODY AUDIT']);
      rows.push(['Generated At', new Date().toISOString()]);
      rows.push(['Lot Number', data.lot.lot_number]);
      rows.push(['Raw Material', data.lot.material_name]);
      rows.push(['Supplier', data.lot.supplier_name || 'N/A']);
      rows.push(['Supplier FSSAI / GSTIN', data.lot.fssai_license || 'N/A']);
      rows.push(['Received Date', data.lot.received_date || 'N/A']);
      rows.push(['Expiry Date', data.lot.expiry_date || 'N/A']);
      rows.push([]);
      rows.push(['AFFECTED PRODUCTION BATCHES']);
      rows.push(['Batch Code', 'Product Name', 'Production Date', 'Status', 'Produced Quantity']);
      if (data.batches.length === 0) {
        rows.push(['No batches produced with this lot.']);
      } else {
        data.batches.forEach((b) => {
          rows.push([b.batch_no, b.product_name, b.production_date, b.status, b.completed_quantity]);
        });
      }
      rows.push([]);
      rows.push(['AFFECTED CUSTOMER ORDERS & RECALL CONTACT LIST']);
      rows.push(['Order Number', 'Batch Code', 'Product Name', 'Customer Name', 'Customer Phone', 'Delivery City', 'Order Status', 'Order Date']);
      if (data.orders.length === 0) {
        rows.push(['No customer orders directly linked to this lot.']);
      } else {
        data.orders.forEach((o) => {
          rows.push([
            o.order_no,
            o.batch_no,
            o.product_name,
            o.customer_name,
            o.customer_phone,
            o.city || 'Local',
            o.order_status,
            o.created_at,
          ]);
        });
      }

      const csvContent = rows
        .map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="recall_report_${data.lot.lot_number}.csv"`);
      return res.status(200).send(csvContent);
    } catch (err) {
      return errorResponse(res, 'RECALL_REPORT_ERROR', err.message, 400);
    }
  }

  async getProductionPlanning(req, res) {
    try {
      const data = await ownerRepository.getProductionPlanning(req.user.business_id);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, 'PLANNING_ERROR', err.message, 500);
    }
  }

  async getCostingAndMargins(req, res) {
    try {
      const recipes = await recipeRepository.getAllRecipes(req.user.business_id);
      const costingRows = recipes;
      return successResponse(res, costingRows, 200);
    } catch (err) {
      return errorResponse(res, 'COSTING_ERROR', err.message, 500);
    }
  }

  async getVendors(req, res) {
    try {
      const vendors = await vendorRepository.getAllVendors(req.user.business_id);
      const priceHistory = await vendorRepository.getVendorPriceHistory('', req.user.business_id);
      return successResponse(res, { vendors, priceHistory }, 200);
    } catch (err) {
      return errorResponse(res, 'VENDORS_ERROR', err.message, 500);
    }
  }

  async createVendor(req, res) {
    try {
      const { name, contact_name, contact_person, phone, email, lead_time_days } = req.body;
      if (!name || !name.trim()) {
        return errorResponse(res, 'VALIDATION_ERROR', 'Supplier name is required', 400);
      }
      const vendor = await vendorRepository.createVendor({
        name: name.trim(),
        contact_name: (contact_name || contact_person || '').trim() || null,
        contact_person: (contact_person || contact_name || '').trim() || null,
        phone: phone ? String(phone).trim() : null,
        email: email ? String(email).trim() : null,
        lead_time_days: parseInt(lead_time_days, 10) || 1,
        businessId: req.user.business_id
      });
      return successResponse(res, vendor, 201);
    } catch (err) {
      return errorResponse(res, 'VENDOR_CREATE_ERROR', err.message, err.statusCode || 500);
    }
  }

  async getWorkers(req, res) {
    try {
      const summary = await workerRepository.getAttendanceSummary(req.user.business_id);
      return successResponse(res, summary, 200);
    } catch (err) {
      return errorResponse(res, 'WORKERS_ERROR', err.message, 500);
    }
  }

  async onboardWorker(req, res) {
    try {
      const { name, email, phone, role, password, shift, shift_name, shift_start, shift_end, daily_wage } = req.body;
      if (!name || !email) {
        return errorResponse(res, 'VALIDATION_ERROR', 'Name and email are required for staff onboarding.', 400);
      }
      const result = await workerRepository.onboardWorker({
        businessId: req.user.business_id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        role: role || 'baker',
        password,
        shift: shift || null,
        shift_name: shift_name || null,
        shift_start: shift_start || null,
        shift_end: shift_end || null,
        dailyWage: parseFloat(daily_wage) || 1000
      });
      return successResponse(res, result, 201);
    } catch (err) {
      const statusCode = err.statusCode || (err.code === 'EMAIL_EXISTS' ? 409 : 500);
      return errorResponse(res, err.code || 'ONBOARD_ERROR', err.message, statusCode);
    }
  }

  async updateWorker(req, res) {
    try {
      const { id } = req.params;
      const { name, phone, role, shift, shift_name, shift_start, shift_end, daily_wage, password, is_active } = req.body;
      const updated = await workerRepository.updateWorker(id, {
        name: name ? name.trim() : undefined,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : undefined,
        role,
        shift_name,
        shift_start,
        shift_end,
        dailyWage: daily_wage !== undefined ? parseFloat(daily_wage) : undefined,
        password,
        is_active
      }, req.user.business_id);
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'UPDATE_WORKER_ERROR', err.message, err.statusCode || 400);
    }
  }

  async dismissWorker(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const dismissed = await workerRepository.dismissWorker(id, { reason }, req.user.business_id, req.user);
      return successResponse(res, dismissed, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'DISMISS_WORKER_ERROR', err.message, err.statusCode || 400);
    }
  }

  async reactivateWorker(req, res) {
    try {
      const { id } = req.params;
      const reactivated = await workerRepository.reactivateWorker(id, req.user.business_id);
      return successResponse(res, reactivated, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'REACTIVATE_WORKER_ERROR', err.message, err.statusCode || 400);
    }
  }

  async getShiftPolicy(req, res) {
    try {
      const db = require('../config/db');
      const bizRes = await db.query('SELECT block_out_of_shift_login FROM businesses WHERE id = $1', [req.user.business_id]);
      const blockOutOfShift = Boolean(bizRes.rows[0]?.block_out_of_shift_login);
      return successResponse(res, { block_out_of_shift_login: blockOutOfShift }, 200);
    } catch (err) {
      return errorResponse(res, 'POLICY_ERROR', err.message, 500);
    }
  }

  async updateShiftPolicy(req, res) {
    try {
      const db = require('../config/db');
      const { block_out_of_shift_login } = req.body;
      const val = block_out_of_shift_login ? 1 : 0;
      await db.query('UPDATE businesses SET block_out_of_shift_login = $1 WHERE id = $2', [val, req.user.business_id]);
      return successResponse(res, { block_out_of_shift_login: Boolean(val) }, 200);
    } catch (err) {
      return errorResponse(res, 'POLICY_ERROR', err.message, 500);
    }
  }

  async getRecipes(req, res) {
    try {
      const recipes = await recipeRepository.getAllRecipes(req.user.business_id);
      return successResponse(res, recipes, 200);
    } catch (err) {
      return errorResponse(res, 'RECIPES_ERROR', err.message, 500);
    }
  }

  async updateRecipe(req, res) {
    try {
      const { id } = req.params;
      const updated = await recipeRepository.updateRecipe(id, req.body, req.user.business_id);
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, 'UPDATE_RECIPE_ERROR', err.message, 400);
    }
  }

  async getDashboardSummary(req, res) {
    try {
      const summary = await ownerRepository.getDashboardSummary(req.user.business_id);
      return successResponse(res, summary, 200);
    } catch (err) {
      return errorResponse(res, 'DASHBOARD_SUMMARY_ERROR', err.message, 500);
    }
  }

  async getVendorComparisons(req, res) {
    try {
      const data = await vendorRepository.getComparativeVendors(req.user.business_id);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, 'VENDOR_COMPARISONS_ERROR', err.message, 500);
    }
  }

  async placeVendorOrder(req, res) {
    try {
      const order = await vendorRepository.placeVendorOrder({
        business_id: req.user.business_id,
        ...req.body
      });
      return successResponse(res, order, 201);
    } catch (err) {
      return errorResponse(res, 'VENDOR_ORDER_ERROR', err.message, 500);
    }
  }
}

module.exports = new OwnerController();
