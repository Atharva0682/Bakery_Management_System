const db = require('../config/db');
const recipeRepository = require('./recipeRepository');
const inventoryRepository = require('./inventoryRepository');
const { convertQuantity, money } = require('../utils/costing');

// Status normalizer helper supporting all production workflow stages:
// Scheduled / Planned -> Accepted -> In Progress / In Production -> Quality Check / Quality Checked -> Packed -> Ready for Dispatch -> Dispatched / Completed
function normalizeStatus(status) {
  if (!status) return 'Planned';
  const s = status.toUpperCase().trim();
  if (s === 'PLANNED' || s === 'SCHEDULED') return 'Planned';
  if (s === 'ACCEPTED') return 'Accepted';
  if (s === 'BAKING' || s === 'IN PRODUCTION' || s === 'IN PROGRESS') return 'In Production';
  if (s === 'QUALITY CHECK' || s === 'QC') return 'Quality Check';
  if (s === 'QUALITY CHECKED' || s === 'QC_PASSED') return 'Quality Checked';
  if (s === 'QUALITY FAILED' || s === 'QC_FAILED') return 'Quality Failed';
  if (s === 'PACKAGING' || s === 'PACKAGED' || s === 'PACKED' || s === 'PRODUCT PACKED' || s === 'PRODUCT COMPLETED & PACKED') return 'Packed';
  if (s === 'READY FOR DISPATCH') return 'Ready for Dispatch';
  if (s === 'COMPLETED' || s === 'PRODUCT COMPLETED') return 'Completed';
  if (s === 'DISPATCHED' || s === 'DELIVERED') return 'Dispatched';
  if (s === 'REJECTED' || s === 'CANCELLED') return 'Rejected';
  return status;
}

// Automatically generate sequential unique batch ID in format: BATCH-YYYY-XXXXX
async function generateNextBatchId(businessId = 1) {
  const currentYear = new Date().getFullYear();
  const prefix = `BATCH-${currentYear}-`;
  const row = (await db.query(
    `SELECT batch_no FROM production_batches
     WHERE business_id = $1 AND batch_no LIKE $2
     ORDER BY id DESC LIMIT 1`,
    [businessId, `${prefix}%`]
  )).rows[0];

  let nextSeq = 1;
  if (row && row.batch_no) {
    const parts = row.batch_no.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }
  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

class BatchRepository {
  async getAllBatches(filters = {}) {
    const { businessId = 1, status, search, bakerId, taskType, productId, orderId } = filters;
    let query = `
      SELECT pb.*,
             p.name as product_name,
             p.slug as product_slug,
             p.image_url as product_image,
             p.selling_method as product_selling_method,
             r.recipe_name,
             r.instructions as recipe_instructions,
             r.batch_yield_units,
             r.yield_unit,
             r.batch_output_weight,
             r.batch_output_weight_unit,
             r.standard_unit_weight_grams,
             u.name as baker_name
      FROM production_batches pb
      LEFT JOIN products p ON pb.product_id = p.id
      LEFT JOIN recipes r ON pb.recipe_id = r.id OR (pb.recipe_id IS NULL AND r.product_id = p.id)
      LEFT JOIN users u ON pb.baker_id = u.id
      WHERE pb.business_id = $1
    `;
    const params = [businessId];

    if (bakerId) {
      query += ` AND (pb.baker_id = $${params.length + 1} OR pb.baker_id IS NULL)`;
      params.push(bakerId);
    }

    if (productId) {
      query += ` AND pb.product_id = $${params.length + 1}`;
      params.push(productId);
    }

    if (status && status !== 'All' && status !== 'ALL') {
      const norm = normalizeStatus(status);
      query += ` AND (pb.status = $${params.length + 1} OR LOWER(pb.status) = LOWER($${params.length + 1}))`;
      params.push(norm);
    }

    if (search && search.trim()) {
      const rawSearch = search.trim();
      const cleanSearch = rawSearch.replace(/^#/, '').trim();
      query += ` AND (LOWER(p.name) LIKE $${params.length + 1} OR LOWER(pb.batch_no) LIKE $${params.length + 1} OR LOWER(pb.batch_no) LIKE $${params.length + 2} OR LOWER(COALESCE(u.name, '')) LIKE $${params.length + 1})`;
      params.push(`%${rawSearch.toLowerCase()}%`);
      params.push(`%${cleanSearch.toLowerCase()}%`);
    }

    query += ` ORDER BY pb.id DESC`;
    const res = await db.query(query, params);
    const batches = res.rows;

    // Fetch batch_orders mappings for all returned batches in a single bulk query
    const batchIds = batches.map(b => b.id);
    let orderLinks = [];
    if (batchIds.length > 0) {
      const placeholders = batchIds.map((_, i) => `$${i + 1}`).join(',');
      orderLinks = (await db.query(`
        SELECT bo.id as link_id, bo.batch_id, bo.order_id, bo.order_reference,
               bo.quantity as allocated_quantity, bo.weight_grams, bo.status as allocation_status,
               o.order_no, o.order_status, o.delivery_time_slot, o.total_amount,
               COALESCE(u_cust.name, o.guest_name) as customer_name,
               COALESCE(u_cust.phone, o.guest_phone) as customer_phone
        FROM batch_orders bo
        JOIN orders o ON bo.order_id = o.id
        LEFT JOIN users u_cust ON o.customer_id = u_cust.id
        WHERE bo.batch_id IN (${placeholders}) AND bo.status != 'Cancelled'
        ORDER BY bo.id ASC
      `, batchIds)).rows;
    }

    const orderLinksByBatch = new Map();
    for (const link of orderLinks) {
      if (!orderLinksByBatch.has(link.batch_id)) {
        orderLinksByBatch.set(link.batch_id, []);
      }
      orderLinksByBatch.get(link.batch_id).push(link);
    }

    // Enrich batch records with proper multi-customer allocations
    const enriched = batches.map(b => {
      const links = orderLinksByBatch.get(b.id) || [];
      const totalAllocated = links.reduce((sum, l) => sum + Number(l.allocated_quantity || 0), 0);
      const totalCapacity = Number(b.completed_quantity || b.planned_quantity || 0);
      const wastage = Number(b.wastage_quantity || 0);
      const remainingQty = Math.max(0, totalCapacity - totalAllocated - wastage);

      let customerName = null;
      let linkedCustomerName = null;
      let orderId = null;
      let orderReference = null;

      if (links.length === 1) {
        customerName = links[0].customer_name || 'Customer';
        linkedCustomerName = customerName;
        orderId = links[0].order_id;
        orderReference = links[0].order_reference || links[0].order_no;
      } else if (links.length > 1) {
        customerName = `Multiple Customers (${links.length})`;
        linkedCustomerName = customerName;
        orderReference = links.map(l => l.order_reference || l.order_no).join(', ');
      }

      const isInternal = links.length === 0;
      const computedTaskType = isInternal ? 'batch_production' : 'customer_order';

      return {
        ...b,
        linked_orders: links,
        source_orders: links.map(l => l.order_reference || l.order_no || `#${l.order_id}`),
        customer_name: customerName,
        linked_customer_name: linkedCustomerName,
        order_id: orderId,
        order_reference: orderReference,
        total_allocated_quantity: totalAllocated,
        remaining_quantity: remainingQty,
        is_internal_production: isInternal ? 1 : 0,
        task_type: b.task_type || computedTaskType,
        is_planned: b.is_planned || (isInternal ? 1 : 0),
        actual_total_output_weight: b.actual_output_weight || (b.completed_quantity && b.standard_unit_weight_grams ? b.completed_quantity * b.standard_unit_weight_grams : null),
        output_weight_unit: b.output_weight_unit || 'g',
      };
    });

    // Apply post-enrichment filters if specified
    return enriched.filter(b => {
      if (taskType === 'batch_production' && !b.is_internal_production) return false;
      if (taskType === 'customer_order' && b.is_internal_production) return false;
      if (orderId && !b.linked_orders.some(l => Number(l.order_id) === Number(orderId))) return false;
      return true;
    });
  }

  async getBatchById(id, businessId = 1) {
    const rawId = String(id || '').trim();
    const cleanId = rawId.replace(/^#/, '').trim();
    const numericId = parseInt(cleanId, 10) || 0;

    const res = await db.query(
      `SELECT pb.*,
              p.name as product_name,
              p.slug as product_slug,
              p.image_url as product_image,
              p.selling_method as product_selling_method,
              r.recipe_name,
              r.instructions as recipe_instructions,
              r.batch_yield_units,
              r.yield_unit,
              r.batch_output_weight,
              r.batch_output_weight_unit,
              r.standard_unit_weight_grams,
              u.name as baker_name
       FROM production_batches pb
       LEFT JOIN products p ON pb.product_id = p.id
       LEFT JOIN recipes r ON pb.recipe_id = r.id OR (pb.recipe_id IS NULL AND r.product_id = p.id)
       LEFT JOIN users u ON pb.baker_id = u.id
       WHERE (pb.id = $1 OR LOWER(pb.batch_no) = LOWER($2) OR LOWER(pb.batch_no) = LOWER($3)) AND pb.business_id = $4`,
      [numericId, rawId, cleanId, businessId]
    );

    const batch = res.rows[0];
    if (!batch) return null;

    // Load customer order allocations
    const links = (await db.query(`
      SELECT bo.id as link_id, bo.batch_id, bo.order_id, bo.order_reference,
             bo.quantity as allocated_quantity, bo.weight_grams, bo.status as allocation_status,
             o.order_no, o.order_status, o.delivery_time_slot, o.total_amount,
             COALESCE(u_cust.name, o.guest_name) as customer_name,
             COALESCE(u_cust.phone, o.guest_phone) as customer_phone
      FROM batch_orders bo
      JOIN orders o ON bo.order_id = o.id
      LEFT JOIN users u_cust ON o.customer_id = u_cust.id
      WHERE bo.batch_id = $1 AND bo.status != 'Cancelled'
      ORDER BY bo.id ASC
    `, [batch.id])).rows;

    const totalAllocated = links.reduce((sum, l) => sum + Number(l.allocated_quantity || 0), 0);
    const totalCapacity = Number(batch.completed_quantity || batch.planned_quantity || 0);
    const wastage = Number(batch.wastage_quantity || 0);
    const remainingQty = Math.max(0, totalCapacity - totalAllocated - wastage);

    let customerName = null;
    let orderId = null;
    let orderReference = null;
    if (links.length === 1) {
      customerName = links[0].customer_name;
      orderId = links[0].order_id;
      orderReference = links[0].order_reference || links[0].order_no;
    } else if (links.length > 1) {
      customerName = `Multiple Customers (${links.length})`;
      orderReference = links.map(l => l.order_reference || l.order_no).join(', ');
    }

    return {
      ...batch,
      linked_orders: links,
      source_orders: links.map(l => l.order_reference || l.order_no || `#${l.order_id}`),
      customer_name: customerName,
      linked_customer_name: customerName,
      order_id: orderId,
      order_reference: orderReference,
      total_allocated_quantity: totalAllocated,
      remaining_quantity: remainingQty,
      is_internal_production: links.length === 0 ? 1 : 0,
      task_type: links.length > 0 ? 'customer_order' : 'batch_production',
      is_planned: batch.is_planned || (links.length === 0 ? 1 : 0),
      actual_total_output_weight: batch.actual_output_weight || (batch.completed_quantity && batch.standard_unit_weight_grams ? batch.completed_quantity * batch.standard_unit_weight_grams : null),
      output_weight_unit: batch.output_weight_unit || 'g',
    };
  }

  async createBatch(data) {
    const {
      business_id = 1,
      batch_no,
      product_id,
      baker_id = null,
      planned_quantity = 50,
      planned_weight = null,
      planned_weight_unit = 'g',
      selling_method = 'piece',
      priority = 'Normal',
      shift = 'Morning Shift',
      source_orders = [],
      order_id = null,
      is_planned = null,
      notes = ''
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

    if (!resolvedProductId) throw new Error('A valid product is required');
    if (!Number.isFinite(Number(planned_quantity)) || Number(planned_quantity) <= 0) {
      throw new Error('Planned quantity must be a positive number');
    }

    const prodCheck = (await db.query('SELECT id, name, selling_method FROM products WHERE id = $1 AND business_id = $2', [resolvedProductId, business_id])).rows[0];
    if (!prodCheck) throw new Error('Product not found in this bakery');

    if (baker_id) {
      const bakerCheck = (await db.query("SELECT id FROM users WHERE id = $1 AND business_id = $2 AND is_active = 1", [baker_id, business_id])).rows;
      if (!bakerCheck.length) throw new Error('Assigned worker not found in this bakery');
    }

    // Always generate a sequential unique batch ID if not provided in standard format
    let finalBatchNo = batch_no;
    const finalBatchCode = data.batch_code || batch_no || null;
    if (!finalBatchNo) {
      finalBatchNo = await generateNextBatchId(business_id);
    }

    // Retrieve active recipe
    const recipe = await recipeRepository.getRecipeByProductId(resolvedProductId, business_id);

    // Compute Weight and Packaging Scaling Metrics
    const itemsPerPack = Math.max(1, Number(prodCheck.items_per_pack || recipe?.items_per_pack || 1));
    const packsPerBatch = Math.max(1, Number(prodCheck.packs_per_batch || recipe?.packs_per_batch || 1));
    const yieldQty = Math.max(1, Number(recipe?.batch_yield_units || 1));
    
    let standardBatchWeightGrams = 0;
    if (recipe?.batch_output_weight && Number(recipe.batch_output_weight) > 0) {
      standardBatchWeightGrams = convertQuantity(Number(recipe.batch_output_weight), recipe.batch_output_weight_unit || 'g', 'g');
    } else if (prodCheck.standard_batch_weight_g && Number(prodCheck.standard_batch_weight_g) > 0) {
      standardBatchWeightGrams = Number(prodCheck.standard_batch_weight_g);
    } else if (recipe?.weight_per_piece_g || prodCheck.weight_per_piece_g) {
      standardBatchWeightGrams = Number(recipe?.weight_per_piece_g || prodCheck.weight_per_piece_g) * Number(recipe?.total_pieces_per_batch || yieldQty);
    } else {
      standardBatchWeightGrams = recipe?.raw_ingredient_weight_g || 1000;
    }

    let scalingFactor = 1.0;
    let targetWeightVal = planned_weight !== null && planned_weight !== undefined && planned_weight !== '' ? Number(planned_weight) : null;
    let targetWeightUnitVal = planned_weight_unit || 'g';
    let targetWeightGrams = null;

    if (targetWeightVal && targetWeightVal > 0) {
      targetWeightGrams = convertQuantity(targetWeightVal, targetWeightUnitVal, 'g');
      scalingFactor = standardBatchWeightGrams > 0 ? (targetWeightGrams / standardBatchWeightGrams) : 1.0;
    } else if (planned_quantity && Number(planned_quantity) > 0) {
      scalingFactor = Number(planned_quantity) / yieldQty;
      if (standardBatchWeightGrams > 0) {
        targetWeightGrams = standardBatchWeightGrams * scalingFactor;
      }
    }

    const rawIngredientWeightGrams = Math.round(Number(recipe?.raw_ingredient_weight_g || standardBatchWeightGrams) * scalingFactor * 100) / 100;
    const expectedYieldWeightGrams = targetWeightGrams || (standardBatchWeightGrams * scalingFactor);
    const packsProduced = itemsPerPack > 0 ? Math.ceil(Number(planned_quantity) / itemsPerPack) : 1;

    // Determine if this is a planned production batch (no customer orders linked)
    const validOrders = Array.isArray(source_orders) ? source_orders : (source_orders ? [source_orders] : []);
    if (order_id && !validOrders.includes(order_id)) validOrders.push(order_id);
    const resolvedIsPlanned = is_planned !== null ? (is_planned ? 1 : 0) : (validOrders.length === 0 ? 1 : 0);

    return db.transaction(async () => {
      // Prevent duplicate creation with same batch_no
      const existing = (await db.query('SELECT id FROM production_batches WHERE business_id = $1 AND batch_no = $2', [business_id, finalBatchNo])).rows[0];
      if (existing) {
        finalBatchNo = await generateNextBatchId(business_id);
      }

      const q = `
        INSERT INTO production_batches (
          business_id, batch_no, batch_code, product_id, recipe_id, planned_quantity, completed_quantity, actual_usable_qty,
          status, priority, shift, baker_id, notes, unit_production_cost,
          planned_weight, planned_weight_unit, selling_method, is_planned,
          target_weight, target_weight_unit, raw_ingredient_weight_g, expected_yield_weight_g, scaling_factor, items_per_pack, packs_produced,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 0, 0, 'Planned', $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;
      const res = await db.query(q, [
        business_id,
        finalBatchNo,
        finalBatchCode || finalBatchNo,
        resolvedProductId,
        recipe?.id || null,
        planned_quantity,
        priority,
        shift,
        baker_id,
        notes,
        recipe?.unit_cost || null,
        targetWeightVal,
        targetWeightUnitVal,
        selling_method || prodCheck.selling_method || 'piece',
        resolvedIsPlanned,
        targetWeightVal,
        targetWeightUnitVal,
        rawIngredientWeightGrams,
        expectedYieldWeightGrams,
        scalingFactor,
        itemsPerPack,
        packsProduced
      ]);
      const created = res.rows[0];

      // Link genuine customer orders only if explicitly provided
      if (validOrders.length > 0 && resolvedIsPlanned === 0) {
        for (const orderRef of validOrders) {
          const cleanRef = String(orderRef).replace(/^#/, '').trim();
          const ord = (await db.query(
            'SELECT id, order_no FROM orders WHERE (id = $1 OR LOWER(order_no) = LOWER($1) OR LOWER(order_no) = LOWER($2)) AND business_id = $3',
            [cleanRef, `#${cleanRef}`, business_id]
          )).rows[0];

          if (ord) {
            const existingLink = (await db.query('SELECT id FROM batch_orders WHERE batch_id = $1 AND order_id = $2', [created.id, ord.id])).rows[0];
            if (!existingLink) {
              await db.query(
                'INSERT INTO batch_orders (batch_id, order_id, order_reference, quantity, status, allocated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
                [created.id, ord.id, ord.order_no, planned_quantity, 'Allocated']
              );
            }
          }
        }
      }

      // Initial production log
      await db.query(
        'INSERT INTO production_logs (batch_id, baker_id, previous_status, new_status, completed_quantity, notes) VALUES ($1, $2, NULL, $3, 0, $4)',
        [created.id, baker_id, 'Planned', notes || (resolvedIsPlanned ? 'Planned batch scheduled for anticipated demand' : 'Batch created and linked to order')]
      );

      return this.getBatchById(created.id, business_id);
    });
  }

  /**
   * Allocate a customer order (or portion thereof) to an existing production batch
   * Supports multiple customer allocations under a single production batch!
   */
  async allocateOrderToBatch(data) {
    const {
      batch_id,
      order_id,
      quantity = 1,
      weight_grams = null,
      business_id = 1
    } = data;

    return db.transaction(async () => {
      const batch = (await db.query('SELECT * FROM production_batches WHERE id = $1 AND business_id = $2', [batch_id, business_id])).rows[0];
      if (!batch) throw new Error('Production batch not found');

      const order = (await db.query('SELECT * FROM orders WHERE id = $1 AND business_id = $2', [order_id, business_id])).rows[0];
      if (!order) throw new Error('Customer order not found');

      // Check existing allocations on this batch
      const allocRows = (await db.query("SELECT COALESCE(SUM(quantity), 0) as total FROM batch_orders WHERE batch_id = $1 AND status != 'Cancelled'", [batch_id])).rows;
      const currentAllocated = Number(allocRows[0]?.total || 0);
      const batchCapacity = Number(batch.completed_quantity || batch.planned_quantity || 0);

      // Check if order already linked to this batch
      const existing = (await db.query('SELECT * FROM batch_orders WHERE batch_id = $1 AND order_id = $2', [batch_id, order_id])).rows[0];
      let allocationRecord = null;

      if (existing) {
        const res = await db.query(
          `UPDATE batch_orders
           SET quantity = quantity + $1,
               weight_grams = COALESCE($2, weight_grams),
               status = 'Allocated'
           WHERE id = $3
           RETURNING *`,
          [Number(quantity), weight_grams ? Number(weight_grams) : null, existing.id]
        );
        allocationRecord = res.rows[0];
      } else {
        const res = await db.query(
          `INSERT INTO batch_orders (batch_id, order_id, order_reference, quantity, weight_grams, allocated_quantity, status, allocated_at)
           VALUES ($1, $2, $3, $4, $5, $4, 'Allocated', CURRENT_TIMESTAMP)
           RETURNING *`,
          [batch_id, order_id, order.order_no || `ORD-${order_id}`, Number(quantity), weight_grams ? Number(weight_grams) : null]
        );
        allocationRecord = res.rows[0];
      }

      // If batch is completed, update usable quantity
      if (batch.status === 'Completed' || batch.completed_quantity > 0) {
        const newUsable = Math.max(0, batchCapacity - currentAllocated - Number(quantity) - Number(batch.wastage_quantity || 0));
        await db.query('UPDATE production_batches SET actual_usable_qty = $1 WHERE id = $2', [newUsable, batch_id]);
      }

      // Log allocation event
      await db.query(
        'INSERT INTO production_logs (batch_id, baker_id, previous_status, new_status, completed_quantity, notes) VALUES ($1, $2, $3, $3, $4, $5)',
        [batch_id, null, batch.status, batch.completed_quantity, `Allocated ${quantity} units to Order #${order.order_no || order_id}`]
      );

      return {
        batch: await this.getBatchById(batch_id, business_id),
        allocation: allocationRecord
      };
    });
  }

  async consumeIngredientsForBatch(batchId, businessId = 1) {
    const batch = (await db.query('SELECT * FROM production_batches WHERE id = $1 AND business_id = $2', [batchId, businessId])).rows[0];
    if (!batch) throw new Error('Batch not found');

    // Retrieve active recipe
    let recipe = batch.recipe_id
      ? await recipeRepository.getRecipeById(batch.recipe_id, businessId)
      : null;
    if (!recipe) {
      recipe = await recipeRepository.getRecipeByProductId(batch.product_id, businessId);
    }
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      return [];
    }

    // Determine proportional scaling: support weight-based and unit-based formulas
    const yieldQty = Number(recipe.batch_yield_units || recipe.yield_quantity || 1);
    let scaleFactor = 1;

    if (batch.scaling_factor && Number(batch.scaling_factor) > 0) {
      scaleFactor = Number(batch.scaling_factor);
    } else if (batch.planned_weight && Number(batch.planned_weight) > 0 && recipe.batch_output_weight) {
      const targetGrams = convertQuantity(batch.planned_weight, batch.planned_weight_unit || 'g', 'g');
      const batchOutputGrams = convertQuantity(recipe.batch_output_weight, recipe.batch_output_weight_unit || 'g', 'g');
      if (batchOutputGrams > 0) {
        scaleFactor = targetGrams / batchOutputGrams;
      }
    } else {
      scaleFactor = Number(batch.planned_quantity || yieldQty) / yieldQty;
    }

    // Avoid double deduction if already consumed for this batch
    const alreadyConsumed = (await db.query(
      'SELECT id FROM batch_ingredient_consumption WHERE batch_id = $1 AND business_id = $2',
      [batchId, businessId]
    )).rows;
    if (alreadyConsumed.length > 0) {
      return (await db.query('SELECT * FROM batch_ingredient_consumption WHERE batch_id = $1', [batchId])).rows;
    }

    const results = [];
    for (const ing of recipe.ingredients) {
      const rawMaterialId = ing.raw_material_id;
      const material = (await db.query('SELECT * FROM raw_materials WHERE id = $1 AND business_id = $2', [rawMaterialId, businessId])).rows[0];
      if (!material) continue;

      const requiredQty = Math.round(Number(ing.quantity) * scaleFactor * 1000) / 1000;
      const actualConsumedQty = requiredQty;

      // Convert recipe consumed quantity to raw material inventory unit
      const deductedStockQty = Math.round(convertQuantity(actualConsumedQty, ing.unit, material.unit) * 1000) / 1000;

      const stockBefore = Math.round(Number(material.current_stock) * 1000) / 1000;
      const stockAfter = Math.round(Math.max(0, stockBefore - deductedStockQty) * 1000) / 1000;

      // Deduct inventory stock
      await db.query(
        'UPDATE raw_materials SET current_stock = current_stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND business_id = $3',
        [deductedStockQty, rawMaterialId, businessId]
      );

      // Consume from lots via FEFO
      await inventoryRepository.consumeLots(rawMaterialId, deductedStockQty, businessId);

      // Identify lot number for traceability
      const lot = (await db.query(
        'SELECT id, lot_number FROM raw_material_lots WHERE raw_material_id = $1 AND business_id = $2 ORDER BY id ASC LIMIT 1',
        [rawMaterialId, businessId]
      )).rows[0];

      // Record stock movement
      const movRes = await db.query(
        'INSERT INTO stock_movements (business_id, raw_material_id, movement_type, quantity, unit, reference_type, reference_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [businessId, rawMaterialId, 'batch_consumption', -deductedStockQty, material.unit, 'batch', batchId, `Consumed for batch ${batch.batch_no}`]
      );
      const movId = movRes.rows[0]?.id || null;

      // Record in batch_ingredient_consumption
      const bicRes = await db.query(`
        INSERT INTO batch_ingredient_consumption (
          business_id, batch_id, raw_material_id, ingredient_name, recipe_required_qty, actual_consumed_qty, unit, difference, stock_before, stock_after, lot_id, lot_number, movement_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        businessId, batchId, rawMaterialId, ing.name || material.name, requiredQty, actualConsumedQty,
        ing.unit || material.unit, stockBefore, stockAfter, lot?.id || null, lot?.lot_number || null, movId
      ]);

      // Record in batch_lot_consumption
      if (lot) {
        await db.query(`
          INSERT INTO batch_lot_consumption (business_id, batch_id, raw_material_id, lot_id, consumed_quantity, quantity_consumed)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [businessId, batchId, rawMaterialId, lot.id, actualConsumedQty, actualConsumedQty]);
      }

      results.push(bicRes.rows[0]);
    }

    // Recalculate stock notifications
    await inventoryRepository.syncStockNotifications(businessId);
    return results;
  }

  async updateStatus(id, newStatus, options = {}) {
    return db.transaction(async () => {
      const businessId = options.businessId || 1;
      const batch = (await db.query('SELECT * FROM production_batches WHERE id = $1 AND business_id = $2', [id, businessId])).rows[0];
      if (!batch) throw new Error('Batch not found');

      const normStatus = normalizeStatus(newStatus);

      // Trigger ingredient consumption when starting production
      if (['In Production', 'Baking'].includes(normStatus) && !['In Production', 'Baking', 'Quality Checked', 'Packed', 'Completed'].includes(batch.status)) {
        await this.consumeIngredientsForBatch(id, businessId);
        await db.query('UPDATE production_batches SET started_at = CURRENT_TIMESTAMP WHERE id = $1 AND started_at IS NULL', [id]);
      }

      // Handle completion timestamp
      if (['Completed', 'Quality Check', 'Quality Checked', 'Packed'].includes(normStatus) && !batch.completed_at) {
        await db.query('UPDATE production_batches SET completed_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      }

      const completedQty = options.completedQuantity !== undefined ? Number(options.completedQuantity) : undefined;
      const wastageQty = options.wastageQuantity !== undefined ? Number(options.wastageQuantity) : undefined;
      const packedQty = options.packedQuantity !== undefined ? Number(options.packedQuantity) : undefined;
      const outputWeight = options.actualOutputWeight !== undefined ? Number(options.actualOutputWeight) : undefined;

      let actualFinishedGrams = null;
      let wastageWeightGrams = null;
      let yieldPct = null;
      let sellableWeightGrams = null;

      if (outputWeight !== undefined && outputWeight !== null && Number(outputWeight) > 0) {
        const outUnit = options.outputWeightUnit || batch.output_weight_unit || 'g';
        actualFinishedGrams = convertQuantity(Number(outputWeight), outUnit, 'g');
        const baselineWeight = Number(batch.expected_yield_weight_g || batch.raw_ingredient_weight_g || (batch.planned_weight ? convertQuantity(Number(batch.planned_weight), batch.planned_weight_unit || 'g', 'g') : actualFinishedGrams));
        if (baselineWeight > 0) {
          wastageWeightGrams = Math.max(0, Math.round((baselineWeight - actualFinishedGrams) * 100) / 100);
          yieldPct = Math.round((actualFinishedGrams / baselineWeight) * 10000) / 100;
        }
        sellableWeightGrams = actualFinishedGrams;
      }

      let q = `
        UPDATE production_batches
        SET status = $1,
            completed_quantity = COALESCE($2, completed_quantity),
            produced_quantity = COALESCE($2, produced_quantity),
            actual_baked_qty = COALESCE($2, actual_baked_qty),
            wastage_quantity = COALESCE($3, wastage_quantity),
            packed_quantity = COALESCE($4, packed_quantity),
            actual_output_weight = COALESCE($5, actual_output_weight),
            actual_finished_weight_g = COALESCE($8, actual_finished_weight_g),
            wastage_weight_g = COALESCE($9, wastage_weight_g),
            yield_percentage = COALESCE($10, yield_percentage),
            sellable_weight_g = COALESCE($11, sellable_weight_g),
            packaging_status = CASE WHEN $4 IS NOT NULL AND $4 > 0 THEN 'Packed' ELSE packaging_status END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 AND business_id = $7
        RETURNING *
      `;
      const res = await db.query(q, [
        normStatus, completedQty ?? null, wastageQty ?? null, packedQty ?? null, outputWeight ?? null, id, businessId,
        actualFinishedGrams ?? null, wastageWeightGrams ?? null, yieldPct ?? null, sellableWeightGrams ?? null
      ]);
      const updated = res.rows[0];

      // Update usable output
      if (completedQty !== undefined || wastageQty !== undefined || ['Completed', 'Packed'].includes(normStatus)) {
        const curProduced = Number(updated.completed_quantity || updated.planned_quantity);
        const curWasted = Number(updated.wastage_quantity || 0);
        let alreadyDelivered = 0;
        try {
          const soldRes = await db.query(
            "SELECT COALESCE(SUM(quantity), 0) AS total_sold FROM finished_goods_movements WHERE batch_id = $1 AND movement_type = 'sale'",
            [id]
          );
          alreadyDelivered = Number(soldRes.rows[0]?.total_sold || 0);
        } catch (e) {}
        const usable = Math.max(0, curProduced - curWasted - alreadyDelivered);
        await db.query('UPDATE production_batches SET actual_usable_qty = $1 WHERE id = $2', [usable, id]);
        updated.actual_usable_qty = usable;
      }

      // Record in production_logs
      if (updated.status !== batch.status || options.notes) {
        await db.query(
          'INSERT INTO production_logs (batch_id, baker_id, previous_status, new_status, completed_quantity, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [id, options.bakerId || options.workerId || null, batch.status, updated.status, updated.completed_quantity, options.notes || `Batch status updated to ${updated.status}`]
        );
      }

      return this.getBatchById(id, businessId);
    });
  }

  async getBatchIngredients(batchId, businessId = 1) {
    const res = await db.query(`
      SELECT bic.*, rm.category as ingredient_category, rm.cost_per_unit,
             rml.lot_number, rml.expiry_date,
             s.name as supplier_name
      FROM batch_ingredient_consumption bic
      JOIN raw_materials rm ON bic.raw_material_id = rm.id
      LEFT JOIN raw_material_lots rml ON bic.lot_id = rml.id
      LEFT JOIN suppliers s ON rm.primary_supplier_id = s.id OR rml.supplier_id = s.id
      WHERE bic.batch_id = $1 AND bic.business_id = $2
      ORDER BY bic.id ASC
    `, [batchId, businessId]);
    return res.rows;
  }

  async getProductionLogs(batchId) {
    const res = await db.query(`
      SELECT pl.*, u.name as baker_name
      FROM production_logs pl
      LEFT JOIN users u ON pl.baker_id = u.id
      WHERE pl.batch_id = $1
      ORDER BY pl.id ASC
    `, [batchId]);
    return res.rows;
  }
}

module.exports = new BatchRepository();
