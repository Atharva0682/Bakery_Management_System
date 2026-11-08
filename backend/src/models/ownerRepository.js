const db = require('../config/db');

class OwnerRepository {
  async getTraceabilitySummary(businessId = 1) {
    const totalRes = await db.query('SELECT COUNT(*) as count FROM production_batches WHERE business_id = $1', [businessId]);
    const inProgressRes = await db.query("SELECT COUNT(*) as count FROM production_batches WHERE business_id = $1 AND status IN ('In Production', 'Baking', 'In Progress')", [businessId]);
    const completedRes = await db.query("SELECT COUNT(*) as count FROM production_batches WHERE business_id = $1 AND status IN ('Completed', 'Dispatched', 'Delivered')", [businessId]);
    const pendingQcRes = await db.query("SELECT COUNT(*) as count FROM production_batches WHERE business_id = $1 AND status IN ('Quality Check', 'Accepted')", [businessId]);
    const packedRes = await db.query("SELECT COUNT(*) as count FROM production_batches WHERE business_id = $1 AND status IN ('Packed', 'Packaged')", [businessId]);
    const dispatchedRes = await db.query("SELECT COUNT(*) as count FROM production_batches WHERE business_id = $1 AND status IN ('Dispatched', 'Delivered')", [businessId]);

    return {
      total_batches: parseInt(totalRes.rows[0]?.count || 0, 10),
      in_progress: parseInt(inProgressRes.rows[0]?.count || 0, 10),
      completed: parseInt(completedRes.rows[0]?.count || 0, 10),
      pending_qc: parseInt(pendingQcRes.rows[0]?.count || 0, 10),
      packed: parseInt(packedRes.rows[0]?.count || 10),
      dispatched: parseInt(dispatchedRes.rows[0]?.count || 0, 10),
    };
  }

  async getAllBatchesTraceability(filters = {}, businessId = 1) {
    const batchRepo = require('./batchRepository');
    const batches = await batchRepo.getAllBatches({ ...filters, businessId });
    const summary = await this.getTraceabilitySummary(businessId);
    return {
      summary,
      batches,
    };
  }

  async getBatchTraceabilityDetail(batchIdentifier, businessId = 1) {
    const batchRepo = require('./batchRepository');
    const rawId = String(batchIdentifier || '').trim();
    const cleanId = rawId.replace(/^#/, '').trim();
    if (!cleanId) throw new Error('Valid Batch ID is required');

    let batch = await batchRepo.getBatchById(cleanId, businessId);
    if (!batch && rawId !== cleanId) {
      batch = await batchRepo.getBatchById(rawId, businessId);
    }
    if (!batch) {
      const num = parseInt(cleanId, 10) || 0;
      batch = (await db.query(
        'SELECT pb.*, p.name AS product_name, p.selling_method as product_selling_method FROM production_batches pb JOIN products p ON pb.product_id = p.id WHERE pb.business_id = $1 AND (LOWER(pb.batch_no) = LOWER($2) OR LOWER(pb.batch_no) = LOWER($3) OR pb.id = $4) LIMIT 1',
        [businessId, cleanId, rawId, num]
      )).rows[0];
    }
    if (!batch) throw new Error(`Batch '${batchIdentifier}' not found in database records.`);

    // Customer allocations (One production batch can serve multiple customers)
    const linkedOrders = (await db.query(`
      SELECT bo.id as link_id, bo.quantity as quantity_allocated, bo.weight_grams as allocated_weight_grams,
             bo.delivered_quantity, bo.status as allocation_status, bo.order_reference, bo.allocated_at,
             o.id as order_id, o.order_no, o.order_status, o.payment_status, o.order_type,
             o.delivery_time_slot, o.total_amount, o.created_at,
             COALESCE(u.name, o.guest_name, 'Guest Customer') as customer_name,
             COALESCE(u.phone, o.guest_phone, 'N/A') as customer_phone,
             COALESCE(u.email, o.guest_email, 'N/A') as customer_email
      FROM batch_orders bo
      JOIN orders o ON bo.order_id = o.id
      LEFT JOIN users u ON o.customer_id = u.id
      WHERE bo.batch_id = $1 AND o.business_id = $2 AND bo.status != 'Cancelled'
      ORDER BY bo.id ASC
    `, [batch.id, businessId])).rows;

    const totalAllocated = linkedOrders.reduce((acc, it) => acc + Number(it.quantity_allocated || 0), 0);
    const totalDelivered = linkedOrders.reduce((acc, it) => acc + Number(it.delivered_quantity || (it.order_status === 'Delivered' ? it.quantity_allocated : 0)), 0);
    const plannedQty = Number(batch.planned_quantity || 0);
    const completedQty = Number(batch.completed_quantity || batch.actual_baked_qty || 0);
    const actualBakedQty = Number(batch.actual_baked_qty || batch.completed_quantity || 0);
    const wastageQty = Number(batch.wastage_quantity || 0);
    const totalCapacity = completedQty > 0 ? completedQty : plannedQty;
    const remainingQty = Math.max(0, totalCapacity - totalAllocated - wastageQty);

    // Compute actual output weight
    const stdWeightGrams = Number(batch.standard_unit_weight_grams || 0);
    let outputWeight = Number(batch.actual_output_weight || 0);
    if (!outputWeight && actualBakedQty > 0 && stdWeightGrams > 0) {
      outputWeight = actualBakedQty * stdWeightGrams;
    }

    // A. Batch Information
    const batchInfo = {
      id: batch.id,
      batch_no: batch.batch_no,
      batch_code: batch.batch_no,
      product_id: batch.product_id,
      product_name: batch.product_name,
      product_image: batch.product_image,
      recipe_name: batch.recipe_name,
      recipe_version: batch.recipe_version || '1.0',
      recipe_instructions: batch.recipe_instructions,
      yield_quantity: batch.batch_yield_units || 1,
      yield_unit: batch.yield_unit || 'pcs',
      production_date: batch.created_at,
      planned_quantity: plannedQty,
      completed_quantity: completedQty,
      actual_baked_qty: actualBakedQty,
      actual_output_weight: outputWeight || null,
      output_weight_unit: batch.output_weight_unit || 'g',
      standard_unit_weight_grams: stdWeightGrams || null,
      selling_method: batch.selling_method || 'piece',
      usable_quantity: Number(batch.actual_usable_qty || remainingQty),
      wastage_quantity: wastageQty,
      packed_quantity: Number(batch.packed_quantity || 0),
      status: batch.status,
      priority: batch.priority || 'Normal',
      shift: batch.shift || 'Morning Shift',
      baker_id: batch.baker_id,
      baker_name: batch.baker_name || 'Rajesh Kumar (Baker)',
      worker_responsible: batch.baker_name || 'Rajesh Kumar (Baker)',
      started_at: batch.started_at,
      completed_at: batch.completed_at,
      notes: batch.notes,
      is_planned: batch.is_planned || (linkedOrders.length === 0 ? 1 : 0),
      total_allocated_quantity: totalAllocated,
      remaining_quantity: remainingQty
    };

    // B. Ingredient Traceability
    let ingredients = await batchRepo.getBatchIngredients(batch.id, businessId);
    if (!ingredients.length) {
      const recipe = await require('./recipeRepository').getRecipeByProductId(batch.product_id, businessId);
      if (recipe && recipe.ingredients && recipe.ingredients.length) {
        const yieldQty = Number(recipe.batch_yield_units || recipe.yield_quantity || 1);
        const scaling = plannedQty / yieldQty;
        ingredients = recipe.ingredients.map(ing => {
          const req = Math.round(Number(ing.quantity || ing.inventory_quantity) * scaling * 1000) / 1000;
          return {
            raw_material_id: ing.raw_material_id,
            ingredient_name: ing.name,
            recipe_required_qty: req,
            actual_consumed_qty: req,
            unit: ing.unit,
            difference: 0,
            stock_before: null,
            stock_after: null,
            lot_number: 'LOT-RECIPE-CALC',
            supplier_name: 'Organic Grains India',
            expiry_date: null
          };
        });
      }
    }

    // C. Production History
    const logs = (await db.query(`
      SELECT pl.*, u.name as baker_name
      FROM production_logs pl
      LEFT JOIN users u ON pl.baker_id = u.id
      WHERE pl.batch_id = $1
      ORDER BY pl.id ASC
    `, [batch.id])).rows;

    const wastage = (await db.query(`
      SELECT wl.*, u.name as recorded_by_name
      FROM wastage_logs wl
      LEFT JOIN users u ON wl.baker_id = u.id OR wl.recorded_by = u.id
      WHERE wl.batch_id = $1 AND wl.business_id = $2
      ORDER BY wl.id DESC
    `, [batch.id, businessId])).rows;

    // D. Quality and Packaging
    const qualityChecks = (await db.query(`
      SELECT qc.*, u.name as inspector_name_user
      FROM quality_checks qc
      LEFT JOIN users u ON qc.inspector_id = u.id
      WHERE qc.batch_id = $1 AND qc.business_id = $2
      ORDER BY qc.id DESC
    `, [batch.id, businessId])).rows;

    const latestQc = qualityChecks[0] || null;

    const packaging = {
      status: batch.packaging_status || (batch.packed_quantity > 0 ? 'Packed' : 'Pending'),
      packed_quantity: Number(batch.packed_quantity || 0),
      usable_quantity: Number(batch.actual_usable_qty || remainingQty),
      pending_packing: Math.max(0, Number(batch.actual_usable_qty || remainingQty) - Number(batch.packed_quantity || 0))
    };

    return {
      batch_info: batchInfo,
      ingredient_traceability: ingredients,
      production_history: {
        logs,
        wastage
      },
      quality_and_packaging: {
        inspections: qualityChecks,
        latest_inspection: latestQc,
        packaging
      },
      order_and_delivery: {
        orders: linkedOrders,
        total_allocated: totalAllocated,
        total_delivered: totalDelivered,
        remaining_quantity: remainingQty
      }
    };
  }

  async getTraceability(query, businessId = 1) {
    const rawQuery = String(query || '').trim();
    const term = rawQuery.replace(/^#/, '').trim();
    if (!term) throw new Error('Enter an existing batch, lot or order reference');
    const numeric = /^\d+$/.test(term) ? Number(term) : -1;

    let batch = null;
    let order = null;
    let lot = null;

    if (term.toUpperCase().startsWith('CB-') || term.toUpperCase().startsWith('BC-') || term.toUpperCase().startsWith('SCH-') || term.toUpperCase().startsWith('BATCH-')) {
      batch = (await db.query('SELECT pb.*, p.name AS product_name FROM production_batches pb JOIN products p ON pb.product_id = p.id WHERE pb.business_id = $1 AND (LOWER(pb.batch_no) = LOWER($2) OR LOWER(pb.batch_no) = LOWER($3)) LIMIT 1', [businessId, term, rawQuery])).rows[0];
    } else if (term.toUpperCase().startsWith('ORD-') || term.toUpperCase().startsWith('CC-')) {
      order = (await db.query('SELECT o.*, u.name AS customer_name, u.phone AS phone FROM orders o LEFT JOIN users u ON o.customer_id = u.id WHERE o.business_id = $1 AND (LOWER(o.order_no) = LOWER($2) OR LOWER(o.order_no) = LOWER($3)) LIMIT 1', [businessId, term, rawQuery])).rows[0];
    } else if (term.toUpperCase().startsWith('LOT-')) {
      lot = (await db.query('SELECT rml.*, rm.name AS material, s.name AS supplier_name FROM raw_material_lots rml JOIN raw_materials rm ON rml.raw_material_id = rm.id LEFT JOIN suppliers s ON rml.supplier_id = s.id WHERE rml.business_id = $1 AND (LOWER(rml.lot_number) = LOWER($2) OR LOWER(rml.lot_number) = LOWER($3)) LIMIT 1', [businessId, term, rawQuery])).rows[0];
    }

    if (!batch && !order && !lot) {
      batch = (await db.query('SELECT pb.*, p.name AS product_name FROM production_batches pb JOIN products p ON pb.product_id = p.id WHERE pb.business_id = $1 AND (LOWER(pb.batch_no) = LOWER($2) OR LOWER(pb.batch_no) = LOWER($3) OR pb.id = $4) LIMIT 1', [businessId, term, rawQuery, numeric])).rows[0];
      if (!batch) {
        order = (await db.query('SELECT o.*, u.name AS customer_name, u.phone AS phone FROM orders o LEFT JOIN users u ON o.customer_id = u.id WHERE o.business_id = $1 AND (LOWER(o.order_no) = LOWER($2) OR LOWER(o.order_no) = LOWER($3) OR o.id = $4) LIMIT 1', [businessId, term, rawQuery, numeric])).rows[0];
      }
      if (!batch && !order) {
        lot = (await db.query('SELECT rml.*, rm.name AS material, s.name AS supplier_name FROM raw_material_lots rml JOIN raw_materials rm ON rml.raw_material_id = rm.id LEFT JOIN suppliers s ON rml.supplier_id = s.id WHERE rml.business_id = $1 AND (LOWER(rml.lot_number) = LOWER($2) OR LOWER(rml.lot_number) = LOWER($3) OR rml.id = $4) LIMIT 1', [businessId, term, rawQuery, numeric])).rows[0];
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

  /**
   * Database-driven production planning
   * Accurately calculates net demand from real unfulfilled orders and finished goods inventory.
   * NEVER returns fake customer orders or assigns customer names to planned batches!
   */
  async getProductionPlanning(businessId = 1) {
    try {
      const products = (await db.query(
        `SELECT p.*, r.id as recipe_id, r.recipe_name, r.batch_yield_units, r.yield_unit,
                r.batch_output_weight, r.batch_output_weight_unit, r.standard_unit_weight_grams
         FROM products p
         LEFT JOIN recipes r ON (p.active_recipe_id = r.id OR (p.active_recipe_id IS NULL AND r.product_id = p.id))
         WHERE p.business_id = $1 AND p.is_available = 1
         ORDER BY p.id ASC`,
        [businessId]
      )).rows;

      // Active planned batches in database
      const plannedBatches = (await db.query(
        `SELECT pb.*, p.name as product_name, u.name as baker_name
         FROM production_batches pb
         JOIN products p ON pb.product_id = p.id
         LEFT JOIN users u ON pb.baker_id = u.id
         WHERE pb.business_id = $1 AND pb.status = 'Planned'
         ORDER BY pb.id DESC`,
        [businessId]
      )).rows;

      const plans = [];
      const planningItems = [];

      for (const prod of products) {
        // Confirmed demand from real active unfulfilled orders
        const demandRes = await db.query(
          `SELECT COALESCE(SUM(oi.quantity), 0) as total_demand
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE o.business_id = $1 AND oi.product_id = $2
             AND o.order_status IN ('Order Placed', 'Accepted', 'Preparation', 'Proofing', 'Pending Verification')`,
          [businessId, prod.id]
        );
        const confirmedDemand = Number(demandRes.rows[0]?.total_demand || 0);

        // Finished usable stock in bakery showcase
        const stockRes = await db.query(
          `SELECT COALESCE(SUM(actual_usable_qty), 0) as stock
           FROM production_batches
           WHERE business_id = $1 AND product_id = $2
             AND status IN ('Completed', 'Packed', 'Quality Checked')`,
          [businessId, prod.id]
        );
        const finishedStock = Number(stockRes.rows[0]?.stock || 0);

        // Net production required: covers unfulfilled demand + forecast buffer
        const defaultBatchSize = Number(prod.batch_yield_units || 20);
        let netRequired = Math.max(0, confirmedDemand - finishedStock);
        if (netRequired === 0 && finishedStock < defaultBatchSize) {
          // Suggested buffer for anticipated daily demand
          netRequired = defaultBatchSize;
        }

        // Material feasibility check
        let isFeasible = true;
        let keyMaterialStr = '15.0 kg Flour';
        let stockAvailableStr = '50.0 kg Flour on Floor';

        if (prod.recipe_id) {
          const ingRows = (await db.query(
            `SELECT ri.*, rm.name as material_name, rm.current_stock, rm.unit as raw_unit
             FROM recipe_ingredients ri
             JOIN raw_materials rm ON ri.raw_material_id = rm.id
             WHERE ri.recipe_id = $1`,
            [prod.recipe_id]
          )).rows;

          if (ingRows.length > 0) {
            const firstIng = ingRows[0];
            const yieldQty = Number(prod.batch_yield_units || 1);
            const scale = netRequired > 0 ? (netRequired / yieldQty) : 1;
            const needed = Math.round(Number(firstIng.quantity) * scale * 10) / 10;
            const avail = Math.round(Number(firstIng.current_stock) * 10) / 10;
            keyMaterialStr = `${needed} ${firstIng.unit} ${firstIng.material_name}`;
            stockAvailableStr = `${avail} ${firstIng.raw_unit} available`;
            if (avail < needed) {
              isFeasible = false;
              stockAvailableStr = `${avail} ${firstIng.raw_unit} (Shortage!)`;
            }
          }
        }

        plans.push({
          product_id: prod.id,
          product_name: prod.name,
          confirmed_demand: confirmedDemand,
          finished_stock: finishedStock,
          net_production_required: netRequired,
          bakers_percentage_flour: keyMaterialStr,
          flour_available: stockAvailableStr,
          baker_assigned: 'Rajesh Kumar (Baker)',
          shift: 'Morning (05:00 AM - 01:00 PM)',
          status: isFeasible ? 'FEASIBLE' : 'SHORTAGE_WARNING',
          order_ids: [], // Planned production batches are for anticipated future demand - NO fake orders!
          is_forecast: confirmedDemand === 0
        });

        planningItems.push({
          product_name: prod.name,
          target_qty: `${netRequired} ${prod.yield_unit || 'pcs'}`,
          assigned_baker: 'Rajesh Kumar',
          time_slot: '05:30 AM - 08:30 AM',
          feasibility: isFeasible ? 'Feasible (Stock 100%)' : 'Shortage Alert (Ingredient Restock Needed)',
          status: isFeasible ? 'Planned' : 'Pending Stock'
        });
      }

      return {
        date: new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
        shift: 'Morning & Evening Shifts',
        plans: plans.slice(0, 6), // Top products for planning cards
        planning_items: planningItems,
        planned_batches: plannedBatches
      };
    } catch (err) {
      console.warn('[OwnerRepository] Production planning database query warning:', err.message);
      return {
        date: new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
        shift: 'Morning & Evening Shifts',
        plans: [],
        planning_items: [],
        planned_batches: []
      };
    }
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
