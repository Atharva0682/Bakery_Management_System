const db = require('../config/db');

// In-memory batches store
const now = new Date().toISOString();
let memoryBatches = [
  {
    id: 1,
    business_id: 1,
    batch_no: 'BC-241',
    batch_code: 'BC-241',
    product_id: 2,
    product_name: 'Butter Croissant',
    baker_id: 4, // Rajesh Kumar
    baker_name: 'Rajesh Kumar (Baker)',
    planned_quantity: 200,
    completed_quantity: 145,
    produced_quantity: 145,
    wastage_quantity: 5,
    packed_quantity: 140,
    status: 'In Production', // Baking
    priority: 'High',
    shift: 'Morning (05:00 AM - 01:00 PM)',
    scheduled_start: '05:30 AM',
    production_date: new Date().toISOString().split('T')[0],
    source_orders: ['#CC-4112', 'ORD-CRUMB-1001'],
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 2,
    business_id: 1,
    batch_no: 'MP-112',
    batch_code: 'MP-112',
    product_id: 3,
    product_name: 'Masala Puff',
    baker_id: 4,
    baker_name: 'Rajesh Kumar (Baker)',
    planned_quantity: 150,
    completed_quantity: 0,
    produced_quantity: 0,
    wastage_quantity: 0,
    packed_quantity: 0,
    status: 'Accepted',
    priority: 'Normal',
    shift: 'Morning (05:00 AM - 01:00 PM)',
    scheduled_start: '07:15 AM',
    production_date: new Date().toISOString().split('T')[0],
    source_orders: ['#CC-4115'],
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 3,
    business_id: 1,
    batch_no: 'TT-082',
    batch_code: 'TT-082',
    product_id: 4,
    product_name: 'Chocolate Truffle Cake Sponge',
    baker_id: 4,
    baker_name: 'Rajesh Kumar (Baker)',
    planned_quantity: 12,
    completed_quantity: 12,
    produced_quantity: 12,
    wastage_quantity: 1,
    packed_quantity: 12,
    status: 'Completed',
    priority: 'Urgent',
    shift: 'Morning (05:00 AM - 01:00 PM)',
    scheduled_start: '06:00 AM',
    production_date: new Date().toISOString().split('T')[0],
    source_orders: ['#CC-4109', 'ORD-CRUMB-1002'],
    created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2700000).toISOString(),
  },
  {
    id: 4,
    business_id: 1,
    batch_no: 'GK-009',
    batch_code: 'GK-009',
    product_id: 5,
    product_name: 'Garlic Khari Biscuit',
    baker_id: 4,
    baker_name: 'Rajesh Kumar (Baker)',
    planned_quantity: 80,
    completed_quantity: 0,
    produced_quantity: 0,
    wastage_quantity: 0,
    packed_quantity: 0,
    status: 'Planned',
    priority: 'Normal',
    shift: 'Morning (05:00 AM - 01:00 PM)',
    scheduled_start: '09:00 AM',
    production_date: new Date().toISOString().split('T')[0],
    source_orders: ['#CC-4118'],
    shortage_alert: 'Cocoa Powder shortage (4.0 kg required, only 1.2 kg available)',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 5,
    business_id: 1,
    batch_no: 'NS-055',
    batch_code: 'NS-055',
    product_id: 6,
    product_name: 'Nankhatai Shortbread',
    baker_id: 4,
    baker_name: 'Rajesh Kumar (Baker)',
    planned_quantity: 120,
    completed_quantity: 120,
    produced_quantity: 120,
    wastage_quantity: 0,
    packed_quantity: 120,
    status: 'Completed',
    priority: 'Normal',
    shift: 'Morning (05:00 AM - 01:00 PM)',
    scheduled_start: '08:00 AM',
    production_date: new Date().toISOString().split('T')[0],
    source_orders: ['#CC-4099'],
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 1200000).toISOString(),
  }
];

let memoryProductionLogs = [
  { id: 1, batch_id: 1, baker_id: 4, previous_status: 'Planned', new_status: 'Accepted', completed_quantity: 0, notes: 'Baker accepted task', created_at: now },
  { id: 2, batch_id: 1, baker_id: 4, previous_status: 'Accepted', new_status: 'In Production', completed_quantity: 145, notes: 'Deck oven loaded', created_at: now }
];

let nextBatchId = 20;

// Status normalizer helper - Quality Check removed, directly from In Production to Packaged
function normalizeStatus(status) {
  if (!status) return 'Planned';
  const s = status.toUpperCase().trim();
  if (s === 'PLANNED') return 'Planned';
  if (s === 'ACCEPTED') return 'Accepted';
  if (s === 'BAKING' || s === 'IN PRODUCTION') return 'In Production';
  if (s === 'QUALITY CHECK' || s === 'QC' || s === 'PACKAGING' || s === 'PACKAGED' || s === 'PRODUCT PACKED' || s === 'PACKED' || s === 'PRODUCT COMPLETED & PACKED' || s === 'PRODUCT COMPLETED') return 'Packaged';
  if (s === 'READY FOR DISPATCH' || s === 'COMPLETED' || s === 'DELIVERED') return 'Completed';
  return status;
}

class BatchRepository {
  async getAllBatches(filters = {}) {
    const { businessId = 1, status, search, bakerId, taskType } = filters;
    try {
      let query = `
        SELECT pb.*,
               p.name as product_name,
               p.slug as product_slug,
               u.name as baker_name,
               bo.order_id,
               bo.order_reference,
               COALESCE(u_cust.name, o.guest_name) as linked_customer_name,
               COALESCE(u_cust.name, o.guest_name) as customer_name,
               CASE WHEN bo.order_id IS NOT NULL THEN 'customer_order' ELSE 'batch_production' END as task_type,
               CASE WHEN bo.order_id IS NULL THEN 1 ELSE 0 END as is_internal_production
        FROM production_batches pb
        LEFT JOIN products p ON pb.product_id = p.id
        LEFT JOIN users u ON pb.baker_id = u.id
        LEFT JOIN batch_orders bo ON pb.id = bo.batch_id
        LEFT JOIN orders o ON bo.order_id = o.id
        LEFT JOIN users u_cust ON o.customer_id = u_cust.id
        WHERE pb.business_id = $1
      `;
      const params = [businessId];

      if (bakerId) {
        query += ` AND (pb.baker_id = $${params.length + 1} OR pb.baker_id IS NULL)`;
        params.push(bakerId);
      }

      if (taskType === 'batch_production') {
        query += ` AND bo.order_id IS NULL`;
      } else if (taskType === 'customer_order') {
        query += ` AND bo.order_id IS NOT NULL`;
      }

      if (search && search.trim()) {
        query += ` AND (LOWER(p.name) LIKE $${params.length + 1} OR LOWER(pb.batch_no) LIKE $${params.length + 1})`;
        params.push(`%${search.trim().toLowerCase()}%`);
      }

      if (status && status !== 'All') {
        const norm = normalizeStatus(status);
        query += ` AND pb.status = $${params.length + 1}`;
        params.push(norm);
      }

      query += ` ORDER BY pb.id DESC`;
      const res = await db.query(query, params);
      return res.rows;
    } catch (err) {
      throw err;
    }
  }

  async getBatchById(id, businessId = 1) {
    try {
      const res = await db.query(
        `SELECT pb.*,
                p.name as product_name,
                p.slug as product_slug,
                u.name as baker_name,
                bo.order_id,
                bo.order_reference,
                COALESCE(u_cust.name, o.guest_name) as linked_customer_name,
                COALESCE(u_cust.name, o.guest_name) as customer_name,
                CASE WHEN bo.order_id IS NOT NULL THEN 'customer_order' ELSE 'batch_production' END as task_type,
                CASE WHEN bo.order_id IS NULL THEN 1 ELSE 0 END as is_internal_production
         FROM production_batches pb
         LEFT JOIN products p ON pb.product_id = p.id
         LEFT JOIN users u ON pb.baker_id = u.id
         LEFT JOIN batch_orders bo ON pb.id = bo.batch_id
         LEFT JOIN orders o ON bo.order_id = o.id
         LEFT JOIN users u_cust ON o.customer_id = u_cust.id
         WHERE pb.id = $1 AND pb.business_id = $2`,
        [id, businessId]
      );
      return res.rows[0] || null;
    } catch (err) {
      throw err;
    }
  }

  async createBatch(data) {
    const {
      business_id = 1,
      batch_no,
      product_id,
      baker_id = null,
      planned_quantity = 50,
      priority = 'Normal',
      shift = 'Morning Shift',
      source_orders = []
    } = data;

    let resolvedProductId = product_id;
    if (!resolvedProductId && data.product_name) {
      try {
        const pRes = await db.query(
          'SELECT id FROM products WHERE business_id = $3 AND (LOWER(name) = LOWER($1) OR name LIKE $2) LIMIT 1',
          [data.product_name, `%${data.product_name}%`, business_id]
        );
        if (pRes.rows && pRes.rows[0]) {
          resolvedProductId = pRes.rows[0].id;
        }
      } catch (e) {}
    }
    if (!resolvedProductId) {
      throw new Error('A valid product is required');
    }

    if (!Number.isInteger(Number(planned_quantity)) || Number(planned_quantity) <= 0) throw new Error('Planned quantity must be a positive integer');
    if (!(await db.query('SELECT id FROM products WHERE id = $1 AND business_id = $2', [resolvedProductId, business_id])).rows.length) throw new Error('Product not found in this bakery');

    if (baker_id && !(await db.query("SELECT id FROM users WHERE id = $1 AND business_id = $2 AND role IN ('baker','staff','manager','owner') AND is_active = true", [baker_id, business_id])).rows.length) throw new Error('Assigned worker not found in this bakery');

    const normalizedBatchNo = batch_no || `BC-${Date.now().toString().slice(-4)}`;

    try {
      const q = `
        INSERT INTO production_batches (business_id, batch_no, product_id, planned_quantity, status, created_at, updated_at, baker_id, priority, shift)
        VALUES ($1, $2, $3, $4, 'Planned', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5, $6, $7)
        RETURNING *
      `;
      const res = await db.query(q, [business_id, normalizedBatchNo, resolvedProductId, planned_quantity, baker_id, priority, shift]);
      return res.rows[0];
    } catch (err) {

      throw err;
    }
  }

  async updateStatus(id, newStatus, options = {}) {
    return db.transaction(async () => {
      const production = require('../services/productionInventoryService');
      const businessId = options.businessId || 1;
      if (newStatus === 'Accepted') await production.forBatch(id, businessId, production.reserve);
      if (['In Production', 'Baking', 'Quality Check', 'Packaged', 'Completed', 'Product Completed', 'Product Completed & Packed', 'Product Packed'].includes(newStatus)) await production.forBatch(id, businessId, production.consume);
      if (newStatus === 'Rejected') await production.forBatch(id, businessId, production.release);
      const batch = (await db.query('SELECT * FROM production_batches WHERE id = $1 AND business_id = $2', [id, businessId])).rows[0];
      if (!batch) throw new Error('Batch not found');
      if (options.wastageQuantity !== undefined && Number(options.wastageQuantity) !== Number(batch.wastage_quantity)) throw new Error('Record wastage in the wastage module before updating production status');
      if (options.packedQuantity !== undefined && (!Number.isInteger(Number(options.packedQuantity)) || Number(options.packedQuantity) < 0 || Number(options.packedQuantity) > Number(batch.actual_usable_qty))) throw new Error('Packed quantity exceeds usable finished stock');
      if (options.completedQuantity !== undefined && Number(options.completedQuantity) < Number(batch.completed_quantity)) throw new Error('Completed production cannot be reduced through a status update');
      if (options.completedQuantity !== undefined && (!Number.isInteger(Number(options.completedQuantity)) || Number(options.completedQuantity) < 0)) throw new Error('Completed quantity must be a nonnegative integer');
      if (batch.unit_production_cost === null && ['Accepted', 'In Production', 'Baking'].includes(newStatus)) {
        const recipe = await require('./recipeRepository').getRecipeByProductId(batch.product_id, businessId);
        if (recipe) await db.query('UPDATE production_batches SET unit_production_cost = $1 WHERE id = $2', [recipe.unit_cost, id]);
      }
      const updated = await this._updateStatus(id, newStatus, options);
      if (options.packedQuantity !== undefined) await db.query('UPDATE production_batches SET packed_quantity = $1 WHERE id = $2', [options.packedQuantity, id]);
      if (updated.status !== batch.status) await db.query('INSERT INTO production_logs (batch_id, baker_id, previous_status, new_status, completed_quantity, notes) VALUES ($1, $2, $3, $4, $5, $6)', [id, options.bakerId || null, batch.status, updated.status, updated.completed_quantity, options.notes || 'Production status updated']);
      return updated;
    });
  }
  async _updateStatus(id, newStatus, options = {}) {
    const norm = normalizeStatus(newStatus);
    const { bakerId, completedQuantity, wastageQuantity, packedQuantity, notes, rejectionReason, businessId = 1 } = options;

    try {
      const q = `
        UPDATE production_batches
        SET status = $1,
            completed_quantity = COALESCE($2, completed_quantity),
            actual_usable_qty = actual_usable_qty + COALESCE($2, completed_quantity) - completed_quantity,
            wastage_quantity = COALESCE($3, wastage_quantity),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND business_id = $5
        RETURNING *
      `;
      const res = await db.query(q, [norm, completedQuantity ?? null, wastageQuantity ?? null, id, businessId]);
      return res.rows[0];
    } catch (err) {

      throw err;
    }
  }

  async getProductionLogs(batchId) {
    return (await db.query('SELECT * FROM production_logs WHERE batch_id = $1 ORDER BY id', [batchId])).rows;
  }
}

module.exports = new BatchRepository();
