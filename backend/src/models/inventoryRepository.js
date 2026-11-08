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
    const rows = (await db.query(`
      SELECT rm.*, s.name AS supplier_name, s.phone AS supplier_phone, s.lead_time_days AS supplier_lead_time,
      rm.cost_per_unit AS lot_unit_cost,
      COALESCE((SELECT SUM(ir.quantity) FROM inventory_reservations ir WHERE ir.raw_material_id = rm.id AND ir.business_id = rm.business_id AND ir.status = 'reserved'), 0) AS reserved_stock
      FROM raw_materials rm
      LEFT JOIN suppliers s ON rm.primary_supplier_id = s.id AND s.business_id = rm.business_id
      WHERE rm.business_id = $1
      ORDER BY rm.id
    `, [businessId])).rows;

    const usageMap = new Map();
    try {
      const movements = (await db.query(`
        SELECT raw_material_id, SUM(ABS(quantity)) as total_used
        FROM stock_movements
        WHERE business_id = $1 AND (movement_type = 'deduction' OR movement_type = 'dispatch_to_floor' OR movement_type = 'batch_consumption')
        GROUP BY raw_material_id
      `, [businessId])).rows;
      for (const m of movements) {
        usageMap.set(Number(m.raw_material_id), Math.max(0.1, Math.round((Number(m.total_used) / 30) * 100) / 100));
      }
    } catch (e) {}

    return rows.map(item => {
      const available = Math.round((Number(item.current_stock) - Number(item.reserved_stock)) * 1000) / 1000;
      const threshold = item.threshold_mode === 'percentage'
        ? Math.round((Number(item.reference_stock) * Number(item.threshold_percent) / 100) * 1000) / 1000
        : Math.round(Number(item.minimum_stock ?? item.min_reorder_level ?? 0) * 1000) / 1000;

      const leadTimeDays = Number(item.supplier_lead_time || 2);
      const avgDailyUsage = usageMap.get(Number(item.id)) || Math.round((Number(item.min_reorder_level || 5) / 7) * 100) / 100;

      // Single consistent stock-status calculation used across all modules:
      // Available quantity > minimum threshold = OPTIMAL (green)
      // Available quantity <= minimum threshold (and > 0) = LOW STOCK (yellow)
      // Available quantity <= 0 = OUT OF STOCK (red)
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
        reorderAlert = 'Stock is at or below configured minimum threshold; replenish soon.';
      }

      return {
        ...item,
        ingredient_name: item.name,
        material_name: item.name,
        current_stock: Math.round(Number(item.current_stock) * 1000) / 1000,
        reserved_stock: Math.round(Number(item.reserved_stock) * 1000) / 1000,
        available_stock: available,
        minimum_stock: threshold,
        min_reorder_level: threshold,
        safety_stock: threshold,
        lead_time_days: leadTimeDays,
        average_daily_usage: avgDailyUsage,
        reorder_point: threshold,
        stock_level: stockLevel,
        stock_status: stockStatus,
        status: stockStatus,
        reorder_needed: stockLevel !== 'green',
        reorder_alert: reorderAlert,
        suggested_replenishment: Math.max(0, Math.round((threshold - available) * 1000) / 1000),
      };
    }).filter(item => (!search || `${item.name} ${item.sku || ''}`.toLowerCase().includes(search.toLowerCase())) &&
      (!category || ['ALL', 'All'].includes(category) || item.category === category) &&
      (!status || status === 'All' || item.stock_status.toLowerCase() === status.toLowerCase() || item.stock_level === status.toLowerCase()));
  }

  async getIngredientById(id, businessId = 1) {
    return (await this.getAllIngredients({ businessId })).find(item => Number(item.id) === Number(id)) || null;
  }

  async updateStock(id, amount, { isDeduction = true, businessId = 1, lotNumber, supplierId, unitPrice, expiryDate, referenceType = 'adjustment', referenceId = null, notes } = {}) {
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
      await db.query(
        'UPDATE raw_materials SET current_stock = current_stock + $1, cost_per_unit = $2, primary_supplier_id = COALESCE($3, primary_supplier_id), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND business_id = $5',
        [change, price, supplierId || null, id, businessId]
      );

      if (!isDeduction) {
        await db.query(
          'INSERT INTO raw_material_lots (business_id, raw_material_id, supplier_id, lot_number, procured_quantity, remaining_quantity, unit_price, expiry_date) VALUES ($1, $2, $3, $4, $5, $5, $6, $7)',
          [businessId, id, supplierId || item.primary_supplier_id || null, lotNumber || `LOT-${randomUUID().slice(0, 8).toUpperCase()}`, quantity, price, expiryDate || null]
        );
      } else {
        await this.consumeLots(id, quantity, businessId);
      }

      await db.query(
        'INSERT INTO stock_movements (business_id, raw_material_id, movement_type, quantity, unit, reference_type, reference_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [businessId, id, isDeduction ? 'deduction' : 'purchase', change, item.unit, referenceType, referenceId, notes || (isDeduction ? 'Stock consumed' : 'Stock replenished')]
      );

      // Automatically recalculate stock status and sync notifications
      await this.syncStockNotifications(businessId);

      return this.getIngredientById(id, businessId);
    });
  }

  async consumeLots(id, quantity, businessId) {
    const lots = (await db.query(
      'SELECT * FROM raw_material_lots WHERE raw_material_id = $1 AND business_id = $2 AND remaining_quantity > 0 ORDER BY expiry_date IS NULL, expiry_date, id',
      [id, businessId]
    )).rows;
    let remaining = quantity;
    for (const lot of lots) {
      const used = Math.min(remaining, Number(lot.remaining_quantity));
      if (used <= 0) break;
      await db.query('UPDATE raw_material_lots SET remaining_quantity = remaining_quantity - $1 WHERE id = $2', [used, lot.id]);
      remaining -= used;
    }
  }

  // Step 1: Send Replacement Request (Creates/updates request; does NOT increase inventory)
  async createRequisition(data) {
    const businessId = data.business_id || 1;
    const item = await this.getIngredientById(data.raw_material_id, businessId);
    if (!item) throw new Error('Ingredient not found in this bakery');
    const quantity = convertQuantity(positive(data.requested_quantity), data.unit || item.unit, item.unit);
    const urgency = data.urgency || (item.stock_level === 'red' ? 'Critical' : item.stock_level === 'yellow' ? 'High' : 'Normal');

    return (await db.query(`
      INSERT INTO stock_requisitions (
        business_id, raw_material_id, requested_by, material_name, ingredient_name, quantity, unit, urgency, status, notes, request_date
      ) VALUES ($1, $2, $3, $4, $4, $5, $6, $7, 'Pending', $8, CURRENT_TIMESTAMP)
      RETURNING *
    `, [businessId, item.id, data.baker_id || data.requested_by || null, item.name, quantity, item.unit, urgency, data.notes || 'Replacement requested'])).rows[0];
  }

  async getAllRequisitions({ businessId = 1, status } = {}) {
    const rows = (await db.query(`
      SELECT sr.*, sr.quantity AS requested_quantity,
             COALESCE(sr.ingredient_name, rm.name, sr.material_name) AS ingredient_name,
             rm.current_stock, rm.unit AS ingredient_unit,
             u.name AS baker_name,
             u_rec.name AS received_by_name
      FROM stock_requisitions sr
      LEFT JOIN raw_materials rm ON sr.raw_material_id = rm.id
      LEFT JOIN users u ON sr.requested_by = u.id
      LEFT JOIN users u_rec ON sr.received_by = u_rec.id
      WHERE sr.business_id = $1
      ORDER BY sr.id DESC
    `, [businessId])).rows;
    return rows.filter(item => !status || status === 'All' || item.status.toLowerCase() === status.toLowerCase());
  }

  // Step 2: Confirm Replenishment (Owner confirms goods actually received -> increases available stock permanently)
  async confirmReplenishment(requisitionId, actualReceivedQty, { businessId = 1, lotNumber, supplierId, unitPrice, expiryDate, notes, userId } = {}) {
    const reqId = Number(requisitionId);
    const bId = Number(businessId || 1);
    return db.transaction(async () => {
      const req = (await db.query('SELECT * FROM stock_requisitions WHERE id = $1 AND (business_id = $2 OR business_id IS NULL)', [reqId, bId])).rows[0];
      if (!req) throw new Error('Replenishment request not found');
      if (req.status === 'Received' || req.status === 'Fulfilled') {
        throw new Error('This replenishment request has already been confirmed and processed');
      }

      const item = await this.getIngredientById(req.raw_material_id, bId);
      if (!item) throw new Error('Ingredient not found');

      const qty = actualReceivedQty !== undefined && actualReceivedQty !== null && actualReceivedQty !== ''
        ? positive(actualReceivedQty)
        : positive(req.quantity);

      const price = unitPrice !== undefined && unitPrice !== null && unitPrice !== ''
        ? Number(unitPrice)
        : Number(item.cost_per_unit || 0);

      const finalLot = lotNumber || `LOT-REP-${Date.now().toString().slice(-6)}`;

      // 1. Permanently update available stock in PostgreSQL/database
      await db.query(
        'UPDATE raw_materials SET current_stock = current_stock + $1, cost_per_unit = $2, primary_supplier_id = COALESCE($3, primary_supplier_id), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND business_id = $5',
        [qty, price, supplierId || item.primary_supplier_id || null, item.id, businessId]
      );

      // 2. Insert into raw_material_lots for lot traceability
      await db.query(
        'INSERT INTO raw_material_lots (business_id, raw_material_id, supplier_id, lot_number, procured_quantity, remaining_quantity, unit_price, expiry_date) VALUES ($1, $2, $3, $4, $5, $5, $6, $7)',
        [businessId, item.id, supplierId || item.primary_supplier_id || null, finalLot, qty, price, expiryDate || null]
      );

      // 3. Record replenishment transaction movement
      await db.query(
        'INSERT INTO stock_movements (business_id, raw_material_id, movement_type, quantity, unit, reference_type, reference_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [businessId, item.id, 'replenishment', qty, item.unit, 'replenishment', reqId, notes || 'Confirmed goods received from supplier']
      );

      // 4. Update requisition permanently to 'Received'
      const updatedReq = (await db.query(`
        UPDATE stock_requisitions
        SET status = 'Received',
            received_quantity = $1,
            received_at = CURRENT_TIMESTAMP,
            received_by = $2,
            replenishment_notes = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND business_id = $5
        RETURNING *
      `, [qty, userId || null, notes || 'Confirmed replenishment received', reqId, businessId])).rows[0];

      // 5. Automatically resolve old alerts and recalculate status
      await this.syncStockNotifications(businessId);

      const updatedItem = await this.getIngredientById(item.id, businessId);

      return {
        success: true,
        ingredient: updatedItem,
        requisition: updatedReq,
        received_quantity: qty,
        previous_stock: Number(item.available_stock),
        new_available_stock: Number(updatedItem.available_stock),
        new_stock: Number(updatedItem.current_stock),
        lot_number: finalLot
      };
    });
  }

  async updateRequisitionStatus(id, status, { businessId = 1, updatedBy } = {}) {
    if (!['Approved', 'Dispatched', 'Rejected', 'Pending', 'Received'].includes(status)) throw new Error('Invalid requisition status');
    return db.transaction(async () => {
      const row = (await db.query('SELECT * FROM stock_requisitions WHERE id = $1 AND business_id = $2', [id, businessId])).rows[0];
      if (!row) return null;
      if (row.status === 'Received' || row.status === 'Rejected') {
        if (row.status === status) return row;
        throw new Error('A completed requisition cannot be reopened');
      }
      return (await db.query(
        'UPDATE stock_requisitions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3 RETURNING *',
        [status, id, businessId]
      )).rows[0];
    });
  }

  // Centralized Stock Notifications Engine (Deduplicated, Auto-Resolving)
  async syncStockNotifications(businessId = 1) {
    try {
      const ingredients = await this.getAllIngredients({ businessId });
      for (const item of ingredients) {
        const available = Number(item.available_stock);
        const threshold = Number(item.minimum_stock);

        if (available <= threshold) {
          const status = available <= 0 ? 'OUT OF STOCK' : 'LOW STOCK';
          const severity = available <= 0 ? 'critical' : 'warning';
          const msg = `${item.name} (${available.toFixed(2)} ${item.unit} available, threshold ${threshold.toFixed(2)} ${item.unit}) - ${status}`;

          // Check if an active notification already exists for this ingredient
          const existing = (await db.query(
            'SELECT id, stock_status FROM stock_notifications WHERE business_id = $1 AND raw_material_id = $2 AND is_resolved = 0',
            [businessId, item.id]
          )).rows[0];

          if (!existing) {
            await db.query(`
              INSERT INTO stock_notifications (
                business_id, raw_material_id, ingredient_name, available_stock, minimum_threshold, unit, stock_status, severity, message, is_resolved
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
            `, [businessId, item.id, item.name, available, threshold, item.unit, status, severity, msg]);
          } else if (existing.stock_status !== status) {
            // Severity changed (e.g., from LOW STOCK to OUT OF STOCK)
            await db.query('UPDATE stock_notifications SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE id = $1', [existing.id]);
            await db.query(`
              INSERT INTO stock_notifications (
                business_id, raw_material_id, ingredient_name, available_stock, minimum_threshold, unit, stock_status, severity, message, is_resolved
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
            `, [businessId, item.id, item.name, available, threshold, item.unit, status, severity, msg]);
          }
        } else {
          // Stock is OPTIMAL: Automatically resolve any active notifications
          await db.query(
            'UPDATE stock_notifications SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE business_id = $1 AND raw_material_id = $2 AND is_resolved = 0',
            [businessId, item.id]
          );
        }
      }
    } catch (e) {
      console.warn('[Stock Notifications Sync Note]', e.message);
    }
  }

  async getActiveNotifications(businessId = 1) {
    await this.syncStockNotifications(businessId);
    const res = await db.query(`
      SELECT sn.*, rm.name AS ingredient_name, rm.unit AS ingredient_unit
      FROM stock_notifications sn
      JOIN raw_materials rm ON sn.raw_material_id = rm.id
      WHERE sn.business_id = $1 AND sn.is_resolved = 0
      ORDER BY CASE sn.severity WHEN 'critical' THEN 1 ELSE 2 END, sn.id DESC
    `, [businessId]);
    return res.rows;
  }
}

module.exports = new InventoryRepository();
