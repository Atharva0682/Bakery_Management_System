const db = require('../config/db');
const { convertQuantity } = require('../utils/costing');
const { randomUUID } = require('node:crypto');
function positive(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Quantity must be a finite positive number');
  return n;
}
class InventoryRepository {
  async getAllIngredients({ businessId = 1, search, status, category } = {}) {
    const rows = (await db.query(`SELECT rm.*, s.name AS supplier_name, s.phone AS supplier_phone, s.lead_time_days AS supplier_lead_time,
      rm.cost_per_unit AS lot_unit_cost,
      COALESCE((SELECT SUM(ir.quantity) FROM inventory_reservations ir WHERE ir.raw_material_id = rm.id AND ir.business_id = rm.business_id AND ir.status = 'reserved'), 0) AS reserved_stock
      FROM raw_materials rm LEFT JOIN suppliers s ON rm.primary_supplier_id = s.id AND s.business_id = rm.business_id WHERE rm.business_id = $1 ORDER BY rm.id`, [businessId])).rows;

    const usageMap = new Map();
    try {
      const movements = (await db.query(`SELECT raw_material_id, SUM(ABS(quantity)) as total_used FROM stock_movements WHERE business_id = $1 AND (movement_type = 'deduction' OR movement_type = 'dispatch_to_floor') GROUP BY raw_material_id`, [businessId])).rows;
      for (const m of movements) {
        usageMap.set(Number(m.raw_material_id), Math.max(0.1, Math.round((Number(m.total_used) / 30) * 100) / 100));
      }
    } catch (e) {}

    return rows.map(item => {
      const available = Number(item.current_stock) - Number(item.reserved_stock);
      const threshold = item.threshold_mode === 'percentage' ? Number(item.reference_stock) * Number(item.threshold_percent) / 100 : Number(item.min_reorder_level);

      const leadTimeDays = Number(item.supplier_lead_time || 2);
      const avgDailyUsage = usageMap.get(Number(item.id)) || Math.round((Number(item.min_reorder_level || 5) / 7) * 100) / 100;

      // Three-Level Inventory System:
      // Green (Optimal): Available stock > minimum threshold. Bakery fully operational and accepting orders.
      // Yellow (Low Stock): Available stock <= minimum threshold (and > 0). Alerts owner to replenish; orders continue if sufficient ingredients exist.
      // Red (Insufficient / Out of Stock): Available stock <= 0. Disables affected products.
      let stockLevel = 'green';
      let stockStatus = 'Optimal';
      let reorderAlert = null;

      if (available <= 0) {
        stockLevel = 'red';
        stockStatus = 'Out of Stock';
        reorderAlert = 'Stock depleted! Affected products disabled.';
      } else if (available <= threshold) {
        stockLevel = 'yellow';
        stockStatus = 'Low Stock';
        reorderAlert = 'Stock is below configured minimum threshold; replenish soon.';
      }

      return {
        ...item,
        ingredient_name: item.name,
        material_name: item.name,
        available_stock: available,
        minimum_stock: threshold,
        safety_stock: threshold,
        lead_time_days: leadTimeDays,
        average_daily_usage: avgDailyUsage,
        reorder_point: threshold,
        stock_level: stockLevel,
        stock_status: stockStatus,
        status: stockStatus,
        reorder_needed: stockLevel !== 'green',
        reorder_alert: reorderAlert,
        suggested_replenishment: Math.max(0, threshold - available),
      };
    }).filter(item => (!search || `${item.name} ${item.sku || ''}`.toLowerCase().includes(search.toLowerCase())) &&
      (!category || ['ALL', 'All'].includes(category) || item.category === category) &&
      (!status || status === 'All' || item.stock_status.toLowerCase() === status.toLowerCase() || item.stock_level === status.toLowerCase()));
  }
  async getIngredientById(id, businessId = 1) {
    return (await this.getAllIngredients({ businessId })).find(item => Number(item.id) === Number(id)) || null;
  }
  async updateStock(id, amount, { isDeduction = true, businessId = 1, lotNumber, supplierId, unitPrice, expiryDate, referenceType = 'adjustment', referenceId = null } = {}) {
    const quantity = positive(amount);
    return db.transaction(async () => {
      if (db.engine === 'postgres') await db.query('SELECT id FROM raw_materials WHERE id = $1 AND business_id = $2 FOR UPDATE', [id, businessId]);
      const item = await this.getIngredientById(id, businessId);
      if (!item) throw new Error('Ingredient not found in this bakery');
      if (isDeduction && Number(item.available_stock) + 1e-9 < quantity) throw new Error(`Insufficient available stock for ${item.name}`);
      const price = unitPrice === undefined ? Number(item.cost_per_unit) : Number(unitPrice);
      if (!Number.isFinite(price) || price < 0) throw new Error('Purchase cost must be nonnegative');
      if (supplierId && !(await db.query('SELECT id FROM suppliers WHERE id = $1 AND business_id = $2', [supplierId, businessId])).rows.length) throw new Error('Supplier not found in this bakery');
      if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) throw new Error('Invalid expiry date');
      const change = isDeduction ? -quantity : quantity;
      await db.query('UPDATE raw_materials SET current_stock = current_stock + $1, cost_per_unit = $2, primary_supplier_id = COALESCE($3, primary_supplier_id), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND business_id = $5', [change, price, supplierId || null, id, businessId]);
      if (!isDeduction) await db.query('INSERT INTO raw_material_lots (business_id, raw_material_id, supplier_id, lot_number, procured_quantity, remaining_quantity, unit_price, expiry_date) VALUES ($1, $2, $3, $4, $5, $5, $6, $7)', [businessId, id, supplierId || item.primary_supplier_id || null, lotNumber || `LOT-${randomUUID()}`, quantity, price, expiryDate || null]);
      else await this.consumeLots(id, quantity, businessId);
      await db.query('INSERT INTO stock_movements (business_id, raw_material_id, movement_type, quantity, unit, reference_type, reference_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [businessId, id, isDeduction ? 'deduction' : 'purchase', change, item.unit, referenceType, referenceId, 'Recorded atomically with stock']);
      return this.getIngredientById(id, businessId);
    });
  }
  async consumeLots(id, quantity, businessId) {
    // Existing stock may predate lot tracking. Deduct known lots without fabricating provenance.
    const lots = (await db.query('SELECT * FROM raw_material_lots WHERE raw_material_id = $1 AND business_id = $2 AND remaining_quantity > 0 ORDER BY expiry_date IS NULL, expiry_date, id', [id, businessId])).rows;
    let remaining = quantity;
    for (const lot of lots) {
      const used = Math.min(remaining, Number(lot.remaining_quantity));
      if (used <= 0) break;
      await db.query('UPDATE raw_material_lots SET remaining_quantity = remaining_quantity - $1 WHERE id = $2', [used, lot.id]);
      remaining -= used;
    }
  }
  async createRequisition(data) {
    const item = await this.getIngredientById(data.raw_material_id, data.business_id);
    if (!item) throw new Error('Ingredient not found in this bakery');
    const quantity = convertQuantity(positive(data.requested_quantity), data.unit, item.unit);
    return (await db.query("INSERT INTO stock_requisitions (business_id, raw_material_id, requested_by, quantity, unit, status, notes) VALUES ($1, $2, $3, $4, $5, 'Pending', $6) RETURNING *", [data.business_id, item.id, data.baker_id, quantity, item.unit, data.notes || ''])).rows[0];
  }
  async getAllRequisitions({ businessId = 1, status } = {}) {
    const rows = (await db.query('SELECT sr.*, sr.quantity AS requested_quantity, rm.name AS ingredient_name, u.name AS baker_name FROM stock_requisitions sr JOIN raw_materials rm ON sr.raw_material_id = rm.id LEFT JOIN users u ON sr.requested_by = u.id WHERE sr.business_id = $1 ORDER BY sr.id DESC', [businessId])).rows;
    return rows.filter(item => !status || status === 'All' || item.status === status);
  }
  async updateRequisitionStatus(id, status, { businessId = 1 } = {}) {
    if (!['Approved', 'Dispatched', 'Rejected', 'Pending'].includes(status)) throw new Error('Invalid requisition status');
    return db.transaction(async () => {
      const row = (await db.query('SELECT * FROM stock_requisitions WHERE id = $1 AND business_id = $2', [id, businessId])).rows[0];
      if (!row) return null;
      if (row.status === 'Dispatched' || row.status === 'Rejected') {
        if (row.status === status || (row.status === 'Dispatched' && status === 'Approved')) return row;
        throw new Error('A completed requisition cannot be reopened');
      }
      const finalStatus = status === 'Approved' ? 'Dispatched' : status;
      // Store-to-floor transfer stays within total bakery stock. Production alone consumes it.
      if (finalStatus === 'Dispatched') {
        const item = await this.getIngredientById(row.raw_material_id, businessId);
        if (Number(item.available_stock) < Number(row.quantity)) throw new Error('Insufficient available stock for dispatch');
        await db.query("INSERT INTO stock_movements (business_id, raw_material_id, movement_type, quantity, unit, reference_type, reference_id, notes) VALUES ($1, $2, 'dispatch_to_floor', $3, $4, 'stock_requisition', $5, 'Internal transfer; total bakery stock unchanged')", [businessId, row.raw_material_id, row.quantity, row.unit, id]);
      }
      return (await db.query('UPDATE stock_requisitions SET status = $1 WHERE id = $2 AND business_id = $3 RETURNING *', [finalStatus, id, businessId])).rows[0];
    });
  }
  async approveRequisition(id, businessId) { return this.updateRequisitionStatus(id, 'Dispatched', { businessId }); }
  async rejectRequisition(id, businessId) { return this.updateRequisitionStatus(id, 'Rejected', { businessId }); }
}
module.exports = new InventoryRepository();
