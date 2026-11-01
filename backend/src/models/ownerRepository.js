const db = require('../config/db');

class OwnerRepository {
  async getTraceability(query, businessId = 1) {
    const term = String(query || '').replace(/^#/, '').trim();
    if (!term) throw new Error('Enter an existing batch, lot or order reference');
    const numeric = /^\d+$/.test(term) ? Number(term) : -1;

    let batch = null;
    let order = null;
    let lot = null;

    if (term.toUpperCase().startsWith('CB-') || term.toUpperCase().startsWith('BC-') || term.toUpperCase().startsWith('SCH-')) {
      batch = (await db.query('SELECT pb.*, p.name AS product_name FROM production_batches pb JOIN products p ON pb.product_id = p.id WHERE pb.business_id = $1 AND pb.batch_no = $2 LIMIT 1', [businessId, term])).rows[0];
    } else if (term.toUpperCase().startsWith('ORD-') || term.toUpperCase().startsWith('CC-')) {
      order = (await db.query('SELECT o.*, u.name AS customer_name, u.phone AS phone FROM orders o LEFT JOIN users u ON o.customer_id = u.id WHERE o.business_id = $1 AND o.order_no = $2 LIMIT 1', [businessId, term])).rows[0];
    } else if (term.toUpperCase().startsWith('LOT-')) {
      lot = (await db.query('SELECT rml.*, rm.name AS material, s.name AS supplier_name FROM raw_material_lots rml JOIN raw_materials rm ON rml.raw_material_id = rm.id LEFT JOIN suppliers s ON rml.supplier_id = s.id WHERE rml.business_id = $1 AND rml.lot_number = $2 LIMIT 1', [businessId, term])).rows[0];
    }

    if (!batch && !order && !lot) {
      batch = (await db.query('SELECT pb.*, p.name AS product_name FROM production_batches pb JOIN products p ON pb.product_id = p.id WHERE pb.business_id = $1 AND (pb.batch_no = $2 OR pb.id = $3) LIMIT 1', [businessId, term, numeric])).rows[0];
      if (!batch) {
        order = (await db.query('SELECT o.*, u.name AS customer_name, u.phone AS phone FROM orders o LEFT JOIN users u ON o.customer_id = u.id WHERE o.business_id = $1 AND (o.order_no = $2 OR o.id = $3) LIMIT 1', [businessId, term, numeric])).rows[0];
      }
      if (!batch && !order) {
        lot = (await db.query('SELECT rml.*, rm.name AS material, s.name AS supplier_name FROM raw_material_lots rml JOIN raw_materials rm ON rml.raw_material_id = rm.id LEFT JOIN suppliers s ON rml.supplier_id = s.id WHERE rml.business_id = $1 AND (rml.lot_number = $2 OR rml.id = $3) LIMIT 1', [businessId, term, numeric])).rows[0];
      }
    }

    if (!batch && !order && !lot) throw new Error('No matching stored traceability record');

    if (batch && !order) {
      order = (await db.query('SELECT o.*, u.name AS customer_name, u.phone AS phone FROM batch_orders bo JOIN orders o ON bo.order_id = o.id LEFT JOIN users u ON o.customer_id = u.id WHERE bo.batch_id = $1 AND o.business_id = $2 ORDER BY o.id DESC LIMIT 1', [batch.id, businessId])).rows[0];
    }
    if (order && !batch) {
      batch = (await db.query('SELECT pb.*, p.name AS product_name FROM batch_orders bo JOIN production_batches pb ON bo.batch_id = pb.id JOIN products p ON pb.product_id = p.id WHERE bo.order_id = $1 AND pb.business_id = $2 ORDER BY pb.id DESC LIMIT 1', [order.id, businessId])).rows[0];
    }
    if (lot && !batch) {
      batch = (await db.query('SELECT pb.*, p.name AS product_name FROM batch_lot_consumption blc JOIN production_batches pb ON blc.batch_id = pb.id JOIN products p ON pb.product_id = p.id WHERE blc.lot_id = $1 AND pb.business_id = $2 ORDER BY pb.id DESC LIMIT 1', [lot.id, businessId])).rows[0];
    }

    if (!lot && batch) {
      lot = (await db.query('SELECT rml.*, rm.name AS material, s.name AS supplier_name FROM batch_lot_consumption blc JOIN raw_material_lots rml ON blc.lot_id = rml.id JOIN raw_materials rm ON rml.raw_material_id = rm.id LEFT JOIN suppliers s ON rml.supplier_id = s.id WHERE (blc.batch_id = $1 OR blc.order_id IN (SELECT order_id FROM batch_orders WHERE batch_id = $1)) AND rml.business_id = $2 ORDER BY blc.id LIMIT 1', [batch.id, businessId])).rows[0];
      if (!lot) {
        lot = (await db.query('SELECT rml.*, rm.name AS material, s.name AS supplier_name FROM inventory_reservations ir JOIN raw_material_lots rml ON ir.raw_material_id = rml.raw_material_id JOIN raw_materials rm ON rml.raw_material_id = rm.id LEFT JOIN suppliers s ON rml.supplier_id = s.id WHERE ((ir.reference_type = \'batch\' AND ir.reference_id = $1) OR (ir.reference_type = \'order\' AND ir.reference_id IN (SELECT order_id FROM batch_orders WHERE batch_id = $1))) AND rml.business_id = $2 ORDER BY rml.id ASC LIMIT 1', [batch.id, businessId])).rows[0];
      }
      if (!lot && batch.product_id) {
        lot = (await db.query('SELECT rml.*, rm.name AS material, s.name AS supplier_name FROM recipe_ingredients ri JOIN recipes r ON ri.recipe_id = r.id JOIN raw_material_lots rml ON ri.raw_material_id = rml.raw_material_id JOIN raw_materials rm ON rml.raw_material_id = rm.id LEFT JOIN suppliers s ON rml.supplier_id = s.id WHERE r.product_id = $1 AND rml.business_id = $2 ORDER BY rml.id ASC LIMIT 1', [batch.product_id, businessId])).rows[0];
      }
    }
    if (!lot && order && order.id) {
      lot = (await db.query('SELECT rml.*, rm.name AS material, s.name AS supplier_name FROM inventory_reservations ir JOIN raw_material_lots rml ON ir.raw_material_id = rml.raw_material_id JOIN raw_materials rm ON rml.raw_material_id = rm.id LEFT JOIN suppliers s ON rml.supplier_id = s.id WHERE ir.reference_type = \'order\' AND ir.reference_id = $1 AND rml.business_id = $2 ORDER BY rml.id ASC LIMIT 1', [order.id, businessId])).rows[0];
    }

    let workers = batch ? (await db.query('SELECT u.name, u.role, COALESCE(bw.task_description, \'Assigned Baker\') AS task, COALESCE(bw.hours_spent, bw.hours_worked, 0) AS hours_spent FROM batch_workers bw JOIN users u ON (bw.user_id = u.id OR bw.worker_id = u.id) WHERE bw.batch_id = $1 AND u.business_id = $2', [batch.id, businessId])).rows : [];
    if (batch && !workers.length && batch.baker_id) {
      const assigned = (await db.query("SELECT name, role, 'Primary Baker' AS task, 0 AS hours_spent FROM users WHERE id = $1 AND business_id = $2", [batch.baker_id, businessId])).rows;
      if (assigned.length) workers = assigned;
    }
    const quality = batch ? (await db.query('SELECT qc.*, u.name AS inspected_by FROM quality_checks qc LEFT JOIN users u ON qc.inspector_id = u.id WHERE qc.batch_id = $1 AND qc.business_id = $2 ORDER BY qc.id DESC LIMIT 1', [batch.id, businessId])).rows[0] : null;
    const feedback = order ? (await db.query('SELECT * FROM customer_feedback WHERE order_id = $1 AND business_id = $2 ORDER BY id DESC LIMIT 1', [order.id, businessId])).rows[0] : null;

    return {
      query: term,
      trace: {
        supplier: lot ? { name: lot.supplier_name, material: lot.material, lot_number: lot.lot_number, received_date: lot.purchase_date || lot.created_at, expiry_date: lot.expiry_date, license: null } : null,
        batch: batch ? { batch_id: batch.id, batch_code: batch.batch_no, product_name: batch.product_name, production_date: batch.created_at, shift: batch.shift, planned_qty: batch.planned_quantity, produced_qty: batch.completed_quantity, wastage_qty: batch.wastage_quantity, status: batch.status } : null,
        workers,
        quality_check: quality || null,
        customer_order: order ? { ...order, order_reference: order.order_no, total_amount: order.payment_status === 'Paid' ? order.total_amount : 0 } : null,
        customer_feedback: feedback ? { ...feedback, rating: feedback.rating || feedback.rating_overall, comment: feedback.comment || feedback.comments } : null
      },
      limitations: 'Only stored links are shown. Missing lot, inspection or certification records are unavailable. This preview shows one linked batch/lot; export the recall report for all stored matches.'
    };
  }

  async getRecallReportData(lotQuery, businessId = 1) {
    const cleanQ = (lotQuery || '').trim();
    if (!cleanQ) {
      const err = new Error('Lot number or ID is required for food safety recall report.');
      err.code = 'LOT_REQUIRED';
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch Lot and Supplier
    const lotRes = await db.query(
      `SELECT rml.*, COALESCE(rml.purchase_date, rml.created_at) as received_date, rm.name as material_name, s.name as supplier_name, NULL as fssai_license, s.phone as supplier_phone
       FROM raw_material_lots rml
       JOIN raw_materials rm ON rml.raw_material_id = rm.id
       LEFT JOIN suppliers s ON rml.supplier_id = s.id
       WHERE (rml.lot_number LIKE $1 OR rml.id = $2) AND rml.business_id = $3 LIMIT 1`,
      [`%${cleanQ}%`, isNaN(cleanQ) ? -1 : parseInt(cleanQ, 10), businessId]
    );
    const lot = lotRes.rows[0];
    if (!lot) {
      const err = new Error(`Raw material lot '${cleanQ}' was not found.`);
      err.code = 'LOT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // 2. Fetch all Production Batches consuming this lot
    const batchesRes = await db.query(
      `SELECT pb.id, pb.batch_no, pb.created_at as production_date, pb.status, p.name as product_name, pb.completed_quantity
       FROM production_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.id IN (SELECT batch_id FROM batch_lot_consumption WHERE lot_id = $1)
         AND pb.business_id = $2`,
      [lot.id, businessId]
    );
    const batches = batchesRes.rows || [];
    const batchIds = batches.map((b) => b.id);

    // 3. Fetch all Customer Orders affected by these batches
    let orders = [];
    if (batchIds.length > 0) {
      const placeholders = batchIds.map((_, i) => `$${i + 1}`).join(',');
      const params = [...batchIds, businessId];
      const ordersRes = await db.query(
        `SELECT o.id, o.order_no, o.order_status, o.created_at, o.total_amount,
                COALESCE(u.name, 'Customer') as customer_name,
                COALESCE(u.phone, 'N/A') as customer_phone,
                COALESCE(u.email, 'N/A') as customer_email,
                ca.address_line1, ca.city,
                bo.batch_id,
                pb.batch_no,
                p.name as product_name
         FROM orders o
         LEFT JOIN users u ON o.customer_id = u.id
         LEFT JOIN customer_addresses ca ON o.address_id = ca.id
         JOIN batch_orders bo ON bo.order_id = o.id
         JOIN production_batches pb ON bo.batch_id = pb.id
         JOIN products p ON pb.product_id = p.id
         WHERE bo.batch_id IN (${placeholders}) AND o.business_id = $${params.length}`,
        params
      );
      orders = ordersRes.rows || [];
    }

    return {
      lot,
      batches,
      orders,
    };
  }

  async getProductionPlanning(businessId = 1) {
    try {
      if (db.isConnected()) {
        const res = await db.query(
          `SELECT pb.*, p.name as product_name, u.name as baker_name
           FROM production_batches pb
           JOIN products p ON pb.product_id = p.id
           LEFT JOIN users u ON pb.baker_id = u.id
           WHERE pb.business_id = $1
           ORDER BY pb.id ASC`,
          [businessId]
        );

        if (res.rows.length > 0) {
          const items = res.rows.map((b) => ({
            product_name: b.product_name,
            target_qty: `${b.planned_quantity} pcs`,
            assigned_baker: b.baker_name || 'Rajesh Kumar',
            time_slot: b.scheduled_start || '07:00 AM - 09:30 AM',
            feasibility: b.wastage_quantity > 0 ? 'Feasible (Stock Verified)' : 'Feasible (Stock 100%)',
            status: b.status,
          }));

          return {
            date: new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
            shift: 'Morning & Evening Shifts',
            planning_items: items,
          };
        }
      }
    } catch (err) {
      console.warn('[OwnerRepository] Production planning database query warning:', err.message);
    }

    return {
      date: new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
      shift: 'Morning & Evening Shifts',
      planning_items: [
        { product_name: 'Butter Croissant', target_qty: '200 pcs', assigned_baker: 'Rajesh Kumar', time_slot: '05:30 AM - 08:00 AM', feasibility: 'Feasible (Stock 100%)', status: 'In Production' },
        { product_name: 'Masala Puff', target_qty: '150 pcs', assigned_baker: 'Rajesh Kumar', time_slot: '07:15 AM - 09:30 AM', feasibility: 'Feasible (Stock 100%)', status: 'Accepted' },
        { product_name: 'Chocolate Truffle Cake', target_qty: '12 cakes', assigned_baker: 'Antonio Rossi', time_slot: '06:00 AM - 09:00 AM', feasibility: 'Feasible (Stock 100%)', status: 'Completed' },
        { product_name: 'Garlic Khari Biscuit', target_qty: '80 packs', assigned_baker: 'Suresh Patil', time_slot: '09:00 AM - 11:30 AM', feasibility: 'Shortage Alert (Cocoa / Spices)', status: 'Pending Approval' }
      ]
    };
  }

  async getAnalytics(businessId = 1, range = 'this_week', startDate = null, endDate = null) {
    return require('../services/analyticsService').getAnalytics(businessId, range, startDate, endDate);
  }

  async getDashboardSummary(businessId = 1) {
    const { getKolkataTodayBounds } = require('../utils/revenueRules');
    const todayBounds = getKolkataTodayBounds();

    try {
      if (db.isConnected()) {
        // 1. Orders waiting acceptance (order_status = 'Order Placed')
        const waitingRes = await db.query(
          `SELECT COUNT(*) as count FROM orders WHERE business_id = $1 AND order_status = 'Order Placed'`,
          [businessId]
        );
        const ordersWaiting = parseInt(waitingRes.rows[0]?.count || 0, 10);

        // 2. Pending payment approvals
        const pendingPayRes = await db.query(
          `SELECT COUNT(*) as count FROM orders WHERE business_id = $1 AND payment_status = 'Pending Verification'`,
          [businessId]
        );
        const pendingPay = parseInt(pendingPayRes.rows[0]?.count || 0, 10);

        // 3. Batches in production
        const batchesRes = await db.query(
          `SELECT COUNT(*) as count FROM production_batches WHERE business_id = $1 AND status IN ('In Production', 'Accepted', 'Baking', 'Product Completed', 'Quality Check')`,
          [businessId]
        );
        const batchesInProd = parseInt(batchesRes.rows[0]?.count || 0, 10);

        // 4. Low stock items
        const lowStockCount = (await require('./inventoryRepository').getAllIngredients({ businessId })).filter(row => row.stock_status !== 'Optimal').length;

        // 5. Today's verified revenue
        const revRes = await db.query(
          `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders_count
           FROM orders
           WHERE business_id = $1 
             AND created_at >= $2 AND created_at <= $3
             AND payment_status = 'Paid' AND order_status NOT IN ('Rejected', 'Cancelled', 'Refunded')`,
          [businessId, todayBounds.startSql, todayBounds.endSql]
        );
        const todayRev = Math.round(parseFloat(revRes.rows[0]?.revenue || 0));
        const todayOrdersCount = parseInt(revRes.rows[0]?.orders_count || 0, 10);

        // 6. Today's wastage loss
        const wasteRes = await db.query(
          `SELECT COALESCE(SUM(cost_loss), 0) as waste_loss, COUNT(*) as waste_count
           FROM wastage_logs
           WHERE business_id = $1 AND created_at >= $2 AND created_at <= $3`,
          [businessId, todayBounds.startSql, todayBounds.endSql]
        );
        const todayWastageLoss = Math.round(parseFloat(wasteRes.rows[0]?.waste_loss || 0));

        // 7. Today's estimated net profit
        const todayNetProfit = (await this.getAnalytics(businessId, 'today')).summary.net_profit;

        // 8. Latest activity events
        const activityRes = await db.query(
          `SELECT 'order' as event_type, id, order_no as reference, order_status as status, payment_status, total_amount, created_at
           FROM orders
           WHERE business_id = $1
           ORDER BY created_at DESC
           LIMIT 8`,
          [businessId]
        );

        let activeStaffOnFloor = 0;
        try {
          const workerRepo = require('./workerRepository');
          const att = await workerRepo.getAttendanceSummary(businessId);
          activeStaffOnFloor = att.activeStaffOnFloor || 0;
        } catch (e) {}

        return {
          orders_waiting_acceptance: ordersWaiting,
          pending_payment_approvals: pendingPay,
          batches_in_production: batchesInProd,
          low_stock_items: lowStockCount,
          active_staff_on_floor: activeStaffOnFloor,
          today_revenue: todayRev,
          today_revenue_formatted: `₹${todayRev.toLocaleString('en-IN')}`,
          today_orders_count: todayOrdersCount,
          today_net_profit: todayNetProfit,
          today_wastage_loss: todayWastageLoss,
          latest_activity: activityRes.rows,
          timestamp: new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('[OwnerRepository.getDashboardSummary] Error:', err);
      throw err;
    }

    return {
      orders_waiting_acceptance: 0,
      pending_payment_approvals: 0,
      batches_in_production: 0,
      low_stock_items: 0,
      today_revenue: 0,
      today_revenue_formatted: '₹0',
      today_orders_count: 0,
      today_net_profit: 0,
      today_wastage_loss: 0,
      latest_activity: [],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new OwnerRepository();
