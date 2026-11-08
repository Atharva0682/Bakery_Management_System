const db = require('../config/db');
const inventory = require('./inventoryRepository');
const { convertQuantity, money } = require('../utils/costing');
class WastageRepository {
  async recordWastage(data) {
    const businessId = data.business_id || 1;
    const qty = Number(data.quantity_wasted ?? 0);
    const surplus = Number(data.surplus_buffer_quantity ?? 0);
    if (!Number.isFinite(qty) || !Number.isFinite(surplus) || qty < 0 || surplus < 0 || qty + surplus <= 0) throw new Error('Enter a positive wastage or surplus quantity');
    if (!data.reason || typeof data.reason !== 'string') throw new Error('A reason is required');
    if (data.raw_material_id && data.batch_id) throw new Error('Choose an ingredient or finished batch');
    return db.transaction(async () => {
      if (data.idempotency_key) {
        const prior = (await db.query('SELECT * FROM wastage_logs WHERE business_id = $1 AND idempotency_key = $2', [businessId, data.idempotency_key])).rows[0];
        if (prior) return prior;
      }
      let cost = 0;
      let name;
      if (data.raw_material_id) {
        if (surplus) throw new Error('Ingredient wastage cannot create finished surplus');
        const material = await inventory.getIngredientById(data.raw_material_id, businessId);
        if (!material) throw new Error('Ingredient not found in this bakery');
        const amount = convertQuantity(qty, data.unit, material.unit);
        cost = money(amount * Number(material.cost_per_unit)); name = material.name;
        await inventory.updateStock(material.id, amount, { businessId, referenceType: 'ingredient_wastage' });
      } else {
        if (!data.batch_id) throw new Error('Select the finished production batch to reconcile stock');
        const batch = (await db.query('SELECT * FROM production_batches WHERE id = $1 AND business_id = $2', [data.batch_id, businessId])).rows[0];
        if (!batch) throw new Error('Batch not found in this bakery');
        convertQuantity(qty, data.unit, 'pcs');
        if (!Number.isInteger(qty) || !Number.isInteger(surplus)) throw new Error('Finished item quantities must be whole numbers');
        if (qty > Number(batch.actual_usable_qty)) throw new Error('Wastage exceeds usable finished stock');
        if (qty && batch.unit_production_cost === null) throw new Error('This historical batch has no cost snapshot. Reconcile its cost before recording wastage.');
        cost = money(qty * Number(batch.unit_production_cost || 0));
        await db.query('UPDATE production_batches SET actual_usable_qty = actual_usable_qty - $1 + $2, wastage_quantity = wastage_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND business_id = $4', [qty, surplus, batch.id, businessId]);
      }
      if (!qty) return { surplus_buffer_quantity: surplus, batch_id: data.batch_id, cost_loss: 0 };
      const inserted = (await db.query('INSERT INTO wastage_logs (business_id, batch_id, raw_material_id, material_name, quantity_wasted, unit, reason, notes, cost_loss, recorded_by, idempotency_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *', [businessId, data.batch_id || null, data.raw_material_id || null, name || null, qty, data.unit || 'pcs', data.reason, data.notes || '', cost, data.baker_id, data.idempotency_key || null])).rows[0];
      return { ...inserted, surplus_buffer_quantity: surplus };
    });
  }
  async getAllWastage({ businessId = 1, batchId, range } = {}) {
    const rows = (await db.query('SELECT wl.*, pb.batch_no AS batch_code, p.name AS product_name, u.name AS logged_by FROM wastage_logs wl LEFT JOIN production_batches pb ON wl.batch_id = pb.id LEFT JOIN products p ON pb.product_id = p.id LEFT JOIN users u ON wl.recorded_by = u.id WHERE wl.business_id = $1 ORDER BY wl.id DESC', [businessId])).rows;
    const bounds = range ? require('../utils/revenueRules').getDateRangeBounds(range) : null;
    return rows.filter(row => { const timestamp = String(row.recorded_at || row.created_at); const date = new Date(/Z$/.test(timestamp) ? timestamp : timestamp.replace(' ', 'T') + 'Z'); return (!batchId || Number(row.batch_id) === Number(batchId)) && (!bounds || (date >= new Date(bounds.startIso) && date <= new Date(bounds.endIso))); });
  }
  async getTodaySummary(businessId = 1) {
    const { getKolkataDateString } = require('../utils/revenueRules');
    const today = getKolkataDateString();
    const items = (await this.getAllWastage({ businessId })).filter(row => getKolkataDateString(String(row.recorded_at || row.created_at).replace(' ', 'T') + (/Z|[+]\d\d:/.test(row.recorded_at || row.created_at) ? '' : 'Z')) === today);
    const totalCostLoss = money(items.reduce((sum, item) => sum + Number(item.cost_loss), 0));
    const totalWastedUnits = items.filter(row => !row.raw_material_id).reduce((sum, item) => sum + Number(item.quantity_wasted), 0);
    return { totalItemsToday: items.length, totalWastedUnits, totalCostLoss, total_units_wasted: totalWastedUnits, total_cost_loss: totalCostLoss, percentageOfProduction: null, items };
  }
}
module.exports = new WastageRepository();
