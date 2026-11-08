const db = require('../config/db');
const productionInventory = require('./productionInventoryService');
const orderRepository = require('../models/orderRepository');
const catalogRepository = require('../models/catalogRepository');
const paymentRepository = require('../models/paymentRepository');
const addressRepository = require('../models/addressRepository');
const crypto = require('crypto');

class OrderService {
  /**
   * Create a customer order
   * The server calculates all totals from trusted database prices.
   * Cross-business product ordering is strictly prohibited.
   */
  async createCustomerOrder(args) { return db.transaction(() => this._createCustomerOrder(args)); }

  async _createCustomerOrder({ customerId, businessId, orderData }) {
    const {
      address_id,
      delivery_date = null,
      delivery_time_slot = 'Morning Slot (08:00 AM - 11:00 AM)',
      items,
      special_instructions,
      table_tag,
      qr_code,
      qr_type,
    } = orderData;

    // Normalize order_type (supports 'delivery', 'pickup', 'self_delivery', 'dine_in')
    const rawOrderType = (orderData.order_type || orderData.orderType || orderData.fulfillment_type || 'delivery').toLowerCase();
    const order_type = (rawOrderType === 'pickup' || rawOrderType === 'self_delivery' || rawOrderType === 'self-delivery' || rawOrderType === 'self delivery')
      ? 'pickup'
      : (rawOrderType === 'dine_in' || rawOrderType === 'dine-in' || rawOrderType === 'dine in')
        ? 'dine_in'
        : 'delivery';

    const payment_method = orderData.payment_method || orderData.paymentMethod || 'QR_UPI';

    // Enforce payment method: No Credit/Debit, strictly UPI or Pay on Delivery
    if (payment_method !== 'QR_UPI' && payment_method !== 'CASH_ON_DELIVERY') {
      const err = new Error('Only UPI payment with screenshot and Pay on Delivery are accepted.');
      err.code = 'INVALID_PAYMENT_METHOD';
      err.statusCode = 400;
      throw err;
    }

    // Validate delivery date, slot capacity, and production batch availability
    const deliveryScheduleService = require('./deliveryScheduleService');
    const effectiveDeliveryDate = delivery_date || deliveryScheduleService.getNextAvailableDate();
    const effectiveSlot = delivery_time_slot || 'Morning Fresh Batch (08:00 AM - 11:00 AM)';

    if (order_type === 'delivery') {
      await deliveryScheduleService.validateDeliveryAndStock({
        deliveryDate: effectiveDeliveryDate,
        deliveryTimeSlot: effectiveSlot,
        items,
        businessId,
      });
    }

    // Address validation for delivery orders:
    let resolvedAddressId = null;
    if (order_type === 'delivery') {
      if (address_id && customerId) {
        const address = await addressRepository.getById(address_id, customerId, businessId);
        if (address) {
          resolvedAddressId = address.id;
        }
      } else if (customerId) {
        // Fallback: check if customer has a saved address for this business
        const savedAddresses = await addressRepository.getByUserId(customerId, businessId);
        if (savedAddresses && savedAddresses.length > 0) {
          const def = savedAddresses.find((a) => a.is_default) || savedAddresses[0];
          resolvedAddressId = def.id;
        }
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      const err = new Error('Order must contain at least one item.');
      err.code = 'EMPTY_ORDER';
      err.statusCode = 400;
      throw err;
    }

    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.product_id) {
        const err = new Error('Each order item must specify a valid product_id.');
        err.code = 'INVALID_PRODUCT';
        err.statusCode = 400;
        throw err;
      }

      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0 || qty > 99) {
        const err = new Error(`Invalid quantity '${item.quantity}' for item.`);
        err.code = 'INVALID_QUANTITY';
        err.statusCode = 400;
        throw err;
      }

      // Fetch trusted product from repository
      const product = await catalogRepository.getProductById(item.product_id);
      if (!product) {
        const err = new Error(`Product ID ${item.product_id} not found.`);
        err.code = 'PRODUCT_NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      // Enforce tenant boundary: Product must belong to the active business!
      if (Number(product.business_id) !== Number(businessId)) {
        const err = new Error(`Product '${product.name}' belongs to another bakery and cannot be ordered here.`);
        err.code = 'CROSS_TENANT_PRODUCT';
        err.statusCode = 403;
        throw err;
      }

      if (!product.is_available) {
        const err = new Error(`Product '${product.name}' is currently unavailable.`);
        err.code = 'PRODUCT_UNAVAILABLE';
        err.statusCode = 400;
        throw err;
      }

      // Determine trusted unit price from server data
      let unitPrice = Number(product.base_price);
      let variantId = null;

      let variantName = 'Standard';
      if (item.product_variant_id) {
        const variant = await catalogRepository.getVariantById(item.product_variant_id);
        if (!variant || Number(variant.product_id) !== Number(product.id)) {
          const err = new Error(`Variant ID ${item.product_variant_id} is invalid for product '${product.name}'.`);
          err.code = 'INVALID_VARIANT';
          err.statusCode = 400;
          throw err;
        }
        unitPrice = Number(variant.selling_price);
        variantId = variant.id;
        variantName = variant.name || 'Standard';
      } else {
        const variants = await catalogRepository.getVariantsByProductId(product.id);
        const defaultVar = variants && variants.length > 0 ? (variants.find((v) => v.is_default) || variants[0]) : null;
        if (defaultVar) {
          variantId = defaultVar.id;
          unitPrice = Number(defaultVar.selling_price);
          variantName = defaultVar.name || 'Standard';
        }
      }

      const lineSubtotal = Math.round(unitPrice * qty * 100) / 100;
      const gstRate = Number(product.gst_rate ?? 0);
      const lineTax = Math.round(lineSubtotal * gstRate) / 100;
      calculatedTax += lineTax;
      const costing = await require('../models/recipeRepository').getRecipeByProductId(product.id, businessId);
      calculatedSubtotal += lineSubtotal;
      const prodDeliveryFee = (product.delivery_fee !== null && product.delivery_fee !== undefined && product.delivery_fee !== '')
        ? Number(product.delivery_fee)
        : null;

      const itemWeightGrams = item.weight_grams ? Number(item.weight_grams) : (item.weight ? require('../utils/costing').convertQuantity(item.weight, item.weight_unit || 'g', 'g') : null);

      validatedItems.push({
        product_id: product.id,
        product_variant_id: variantId,
        product_name: product.name,
        variant_name: variantName,
        name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        subtotal: lineSubtotal,
        gst_rate: gstRate, tax_amount: lineTax,
        product_delivery_fee: prodDeliveryFee,
        unit_cost_at_order: costing?.unit_cost ?? null,
        cost_snapshot: costing ? JSON.stringify({ material: costing.raw_material_cost / costing.yield_quantity, labour: costing.labour_cost / costing.yield_quantity, power: costing.power_cost / costing.yield_quantity, packaging: costing.packaging_cost / costing.yield_quantity, other: costing.other_cost / costing.yield_quantity }) : null,
        weight_grams: itemWeightGrams,
        weight_unit: item.weight_unit || 'g',
        selling_method: product.selling_method || (itemWeightGrams ? 'weight' : 'piece')
      });
    }

    // Ingredient-Level Validation: calculate total ingredients required across all requested products
    const totalIngredientsNeeded = new Map();
    for (const item of validatedItems) {
      const recipe = await require('../models/recipeRepository').getRecipeByProductId(item.product_id, businessId);
      if (recipe && Array.isArray(recipe.ingredients)) {
        const yieldQty = Number(recipe.yield_quantity || recipe.batch_yield_units || 1);
        let scaleFactor = Number(item.quantity) / yieldQty;
        if (item.weight_grams && recipe.batch_output_weight) {
          const batchGrams = require('../utils/costing').convertQuantity(recipe.batch_output_weight, recipe.batch_output_weight_unit || 'g', 'g');
          if (batchGrams > 0) {
            scaleFactor = (Number(item.weight_grams) * Number(item.quantity)) / batchGrams;
          }
        }
        for (const ing of recipe.ingredients) {
          const needed = Number(ing.inventory_quantity) * scaleFactor;
          const current = totalIngredientsNeeded.get(Number(ing.raw_material_id)) || {
            name: ing.name,
            unit: ing.raw_unit,
            raw_material_id: ing.raw_material_id,
            totalNeeded: 0
          };
          current.totalNeeded += needed;
          totalIngredientsNeeded.set(Number(ing.raw_material_id), current);
        }
      }
    }

    // Verify sufficient available stock before confirming order. Low-stock triggers replenishment alert, while insufficient stock prevents order confirmation.
    const inventoryRepo = require('../models/inventoryRepository');
    for (const req of totalIngredientsNeeded.values()) {
      const stockItem = await inventoryRepo.getIngredientById(req.raw_material_id, businessId);
      if (stockItem) {
        const available = Number(stockItem.available_stock || 0);
        if (available + 1e-9 < req.totalNeeded) {
          const err = new Error(`Cannot confirm order: Insufficient stock for ${req.name}. Required: ${req.totalNeeded.toFixed(2)} ${req.unit}, Available: ${Math.max(0, available).toFixed(2)} ${req.unit}.`);
          err.code = 'INSUFFICIENT_STOCK';
          err.statusCode = 409;
          throw err;
        }
      }
    }

    // Server-computed fees and taxes: Standard fee ₹50 per order, custom product fee override, highest applicable fee once per delivery
    const pricing = (await db.query('SELECT delivery_fee, free_delivery_threshold, delivery_gst_rate FROM businesses WHERE id = $1', [businessId])).rows[0];
    if (!pricing) throw new Error('Business pricing configuration not found');
    const baseStandardFee = Number(pricing.delivery_fee ?? 50);

    let computedDeliveryFee = 0.00;
    if (order_type === 'delivery') {
      if (Number(pricing.free_delivery_threshold) > 0 && calculatedSubtotal >= Number(pricing.free_delivery_threshold)) {
        computedDeliveryFee = 0.00;
      } else if (validatedItems.length > 0) {
        const applicableFees = validatedItems.map(item => {
          return item.product_delivery_fee !== null ? item.product_delivery_fee : baseStandardFee;
        });
        computedDeliveryFee = Math.max(...applicableFees);
      } else {
        computedDeliveryFee = baseStandardFee;
      }
    } else {
      computedDeliveryFee = 0.00;
    }

    const deliveryFee = Number(computedDeliveryFee.toFixed(2));
    const taxAmount = Number((calculatedTax + Math.round(deliveryFee * Number(pricing.delivery_gst_rate)) / 100).toFixed(2));
    const discountAmount = 0.00;
    const grandTotal = Number((calculatedSubtotal + deliveryFee + taxAmount - discountAmount).toFixed(2));

    let formattedInstructions = special_instructions || '';
    if (orderData.guest_name || orderData.guest_phone || orderData.delivery_address) {
      const guestInfoParts = [];
      if (orderData.guest_name) guestInfoParts.push(`Name: ${orderData.guest_name}`);
      if (orderData.guest_phone) guestInfoParts.push(`Phone: ${orderData.guest_phone}`);
      if (orderData.delivery_address) guestInfoParts.push(`Address: ${orderData.delivery_address}`);
      formattedInstructions = `[Guest Details: ${guestInfoParts.join(' | ')}] ${formattedInstructions}`.trim();
    }
    if (table_tag) {
      formattedInstructions = `[Table: ${table_tag}] ${formattedInstructions}`.trim();
    }

    // Screenshot & reference handling for QR_UPI
    const screenshotData = orderData.screenshot || orderData.screenshot_data || null;
    let validatedRefCode = orderData.transaction_id || orderData.qr_reference_code || null;

    if (payment_method === 'QR_UPI') {
      if (!screenshotData) {
        const err = new Error('Payment screenshot is required for UPI verification.');
        err.code = 'SCREENSHOT_REQUIRED';
        err.statusCode = 400;
        throw err;
      }
      if (!validatedRefCode) {
        validatedRefCode = `UPI-SS-${Date.now().toString().slice(-6)}`;
      }
    }

    // Payment status starts as Pending Verification for UPI/online or Unpaid for Cash on Delivery
    const initialPaymentStatus = payment_method === 'CASH_ON_DELIVERY' ? 'Unpaid' : 'Pending Verification';

    // Assign customer_id: use authenticated customer ID, or fallback to default customer ID 9
    let assignedCustomerId = customerId;
    if (!assignedCustomerId) {
      const passwordHash = await require('../utils/security').hashPassword(crypto.randomBytes(32).toString('hex'));
      assignedCustomerId = (await db.query("INSERT INTO users (business_id, name, email, phone, password_hash, role, is_active) VALUES ($1, $2, $3, $4, $5, 'customer', false) RETURNING id", [businessId, orderData.guest_name || 'Guest customer', `guest-${crypto.randomUUID()}@invalid.local`, orderData.guest_phone || '', passwordHash])).rows[0].id;
    }

    const trackingToken = crypto.randomBytes(16).toString('hex');

    const newOrder = await orderRepository.createOrder({
      business_id: businessId,
      customer_id: assignedCustomerId,
      order_type,
      address_id: resolvedAddressId,
      delivery_date,
      delivery_time_slot,
      order_status: 'Order Placed',
      payment_status: initialPaymentStatus,
      payment_method,
      subtotal: calculatedSubtotal,
      delivery_fee: deliveryFee,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: grandTotal,
      special_instructions: formattedInstructions || null,
      table_tag: table_tag || null,
      qr_code: qr_code || null,
      qr_type: qr_type || null,
      tracking_token: trackingToken,
      items: validatedItems,
    });

    // Create authoritative payment record with screenshot
    const payment = await paymentRepository.createPayment({
      business_id: businessId,
      order_id: newOrder.id,
      payment_mode: payment_method,
      qr_reference_code: validatedRefCode,
      screenshot_data: screenshotData,
      amount_paid: grandTotal,
      status: initialPaymentStatus === 'Unpaid' ? 'Initiated' : 'Pending Verification',
    });

    return {
      ...newOrder,
      items: validatedItems,
      payment,
      guest_name: orderData.guest_name || null,
      guest_phone: orderData.guest_phone || null,
    };
  }

  async getCustomerOrders(customerId, businessId) {
    const orders = await orderRepository.getByCustomerId(customerId, businessId);
    const enriched = await Promise.all(
      orders.map(async (order) => {
        const items = await orderRepository.getOrderItems(order.id);
        const payments = await paymentRepository.getByOrderId(order.id, businessId);
        return {
          ...order,
          items,
          payment: payments[0] || null,
        };
      })
    );
    return enriched;
  }

  async getOrderDetails(orderId, customerId, businessId, userRole = 'customer', trackingToken = null) {
    const order = await orderRepository.getById(orderId, businessId);
    if (!order) {
      const err = new Error('Order not found.');
      err.code = 'ORDER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const isStaffOrOwner = ['staff', 'baker', 'manager', 'owner', 'admin'].includes(userRole);
    const isOwnerCustomer = customerId && order.customer_id && Number(customerId) === Number(order.customer_id);
    const hasValidToken = trackingToken && order.tracking_token && String(trackingToken).trim() === String(order.tracking_token).trim();

    // If order has an assigned customer and caller is another customer without tracking token:
    if (!isStaffOrOwner && order.customer_id && !isOwnerCustomer && !hasValidToken) {
      // Check if it's a guest customer (customer_id 9 or user is_active = false)
      let isGuest = order.customer_id === 9;
      if (!isGuest && order.customer_id) {
        try {
          const uRes = await db.query('SELECT is_active FROM users WHERE id = $1', [order.customer_id]);
          if (uRes.rows.length > 0 && (uRes.rows[0].is_active === false || uRes.rows[0].is_active === 0)) {
            isGuest = true;
          }
        } catch (_) { }
      }
      if (!isGuest) {
        const err = new Error('Access denied. You may only view orders that belong to your account.');
        err.code = 'FORBIDDEN_RESOURCE';
        err.statusCode = 403;
        throw err;
      }
    }

    const items = await orderRepository.getOrderItems(order.id);
    const history = await orderRepository.getOrderStatusHistory(order.id);
    const payments = await paymentRepository.getByOrderId(order.id, businessId);

    let customerName = order.customer_name;
    let customerPhone = order.customer_phone;
    if (order.special_instructions && order.special_instructions.includes('[Guest Details:')) {
      const nameMatch = order.special_instructions.match(/Name:\s*([^|\]]+)/);
      if (nameMatch && nameMatch[1].trim()) {
        customerName = nameMatch[1].trim();
      }
      const phoneMatch = order.special_instructions.match(/Phone:\s*([^|\]]+)/);
      if (phoneMatch && phoneMatch[1].trim()) {
        customerPhone = phoneMatch[1].trim();
      }
    }

    return {
      ...order,
      customer_name: customerName || 'Customer',
      guest_name: customerName || 'Customer',
      guest_phone: customerPhone || null,
      status: order.order_status || order.status || 'Order Placed',
      order_status: order.order_status || order.status || 'Order Placed',
      items,
      payment: payments[0] || null,
      transaction_id: payments[0]?.qr_reference_code || order.transaction_id || null,
      screenshot_data: payments[0]?.screenshot_data || order.screenshot_data || null,
      screenshot: payments[0]?.screenshot_data || order.screenshot || null,
      payment_screenshot: payments[0]?.screenshot_data || null,
      screenshot_uploaded_at: payments[0]?.screenshot_uploaded_at || payments[0]?.created_at || null,
      trackingHistory: history,
      rejection_reason: order.rejection_reason || (payments[0]?.rejection_reason) || null,
      rejected_by: order.rejected_by || (payments[0]?.verified_by) || null,
    };
  }

  async getAllOrdersForBusiness(businessId, filters = {}, userRole = null) {
    const orders = await orderRepository.getAllOrders(businessId, filters);
    const enriched = await Promise.all(
      orders.map(async (order) => {
        const items = await orderRepository.getOrderItems(order.id);
        const payments = await paymentRepository.getByOrderId(order.id, businessId);
        const latestPayment = payments[0] || null;
        const isPaidOrVerified = order.payment_status === 'Paid' || order.payment_status === 'Verified';
        const isCod = order.payment_method === 'CASH_ON_DELIVERY';
        const isTerminal = order.order_status === 'Rejected' || order.order_status === 'Cancelled' || order.payment_status === 'Rejected';

        let customerName = order.customer_name;
        let customerPhone = order.customer_phone;
        if (order.special_instructions && order.special_instructions.includes('[Guest Details:')) {
          const nameMatch = order.special_instructions.match(/Name:\s*([^|\]]+)/);
          if (nameMatch && nameMatch[1].trim()) {
            customerName = nameMatch[1].trim();
          }
          const phoneMatch = order.special_instructions.match(/Phone:\s*([^|\]]+)/);
          if (phoneMatch && phoneMatch[1].trim()) {
            customerPhone = phoneMatch[1].trim();
          }
        }

        return {
          ...order,
          customer_name: customerName || 'Customer',
          guest_name: customerName || 'Customer',
          guest_phone: customerPhone || null,
          items,
          payment: latestPayment,
          transaction_id: latestPayment?.qr_reference_code || order.transaction_id || null,
          screenshot_data: latestPayment?.screenshot_data || order.screenshot_data || null,
          screenshot: latestPayment?.screenshot_data || order.screenshot || null,
          payment_screenshot: latestPayment?.screenshot_data || null,
          screenshot_uploaded_at: latestPayment?.screenshot_uploaded_at || latestPayment?.created_at || null,
          is_ready_for_baker: (isPaidOrVerified || isCod) && !isTerminal,
          needs_payment_approval: order.payment_status === 'Pending Verification' && !isTerminal,
          rejection_reason: order.rejection_reason || latestPayment?.rejection_reason || null,
          rejected_by: order.rejected_by || latestPayment?.verified_by || null,
        };
      })
    );

    // If caller is a baker or staff floor worker, strictly show only approved / COD orders that are NOT rejected or cancelled
    const isFloorWorker = userRole === 'baker' || userRole === 'staff' || filters.role === 'baker' || filters.role === 'staff';
    if (isFloorWorker) {
      return enriched.filter((o) => {
        const isTerminal = o.order_status === 'Rejected' || o.order_status === 'Cancelled' || o.payment_status === 'Rejected';
        if (isTerminal) return false;
        if (o.payment_status === 'Pending Verification' || o.order_status === 'Order Placed') return false;
        // Quality Check removed - directly from production to packaging & packed
        const validStatuses = ['Accepted', 'In Production', 'Baking', 'Preparation', 'Proofing', 'Cooling', 'Packaging', 'Packaged', 'Product Packed', 'Product Completed', 'Product Completed & Packed', 'Completed'];
        if (!o.is_ready_for_baker || !validStatuses.includes(o.order_status)) return false;

        // Auto-remove completed orders on the next day
        const isCompleted = ['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered'].includes(o.order_status);
        if (isCompleted) {
          const compTimestamp = o.updated_at || o.completed_at || o.delivery_date || o.created_at;
          if (compTimestamp) {
            const compDate = new Date(String(compTimestamp).replace(' ', 'T'));
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (compDate < todayStart) {
              return false; // Automatically removed on next day!
            }
          }
        }
        return true;
      });
    }

    return enriched;
  }

  async updateOrderStatus(orderId, newStatus, notes, updatedBy, businessId) {
    return db.transaction(() => this._updateOrderStatus(orderId, newStatus, notes, updatedBy, businessId));
  }

  async _updateOrderStatus(orderId, newStatus, notes, updatedBy, businessId) {
    const order = await orderRepository.getById(orderId, businessId);
    if (!order) {
      const err = new Error('Order not found.');
      err.code = 'ORDER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }
    if (order.order_status === 'Rejected' || order.payment_status === 'Rejected') {
      const err = new Error('Order payment was rejected and is in a terminal state. No further status changes are permitted.');
      err.code = 'ORDER_TERMINAL_REJECTED';
      err.statusCode = 409;
      throw err;
    }
    if (order.order_status === 'Cancelled') {
      const err = new Error('Order has been cancelled. No further status changes are permitted.');
      err.code = 'ORDER_TERMINAL_CANCELLED';
      err.statusCode = 409;
      throw err;
    }
    const stages = { 'Order Placed': 0, Accepted: 1, Preparation: 2, Proofing: 2, 'In Production': 3, Baking: 3, Cooling: 4, 'Quality Check': 4, 'Product Completed': 5, Packaging: 6, Packaged: 6, 'Product Packed': 6, 'Product Completed & Packed': 6, Completed: 7, Delivered: 8 };
    if (!(newStatus in stages) && !['Cancelled', 'Rejected'].includes(newStatus)) throw new Error('Invalid order status');
    if (newStatus in stages && order.order_status in stages && stages[newStatus] < stages[order.order_status]) throw new Error('Order production cannot move backwards');
    if (newStatus === 'Accepted') await productionInventory.reserve('order', order.id, businessId);
    if (['In Production', 'Baking', 'Quality Check', 'Cooling', 'Product Completed', 'Product Completed & Packed', 'Product Packed', 'Packaging', 'Packaged', 'Completed', 'Delivered'].includes(newStatus)) await productionInventory.consume('order', order.id, businessId);
    if (['Rejected', 'Cancelled'].includes(newStatus)) await productionInventory.release('order', order.id, businessId);
    const updated = await orderRepository.updateOrderStatus(order.id, newStatus, notes, updatedBy);
    if (['In Production', 'Baking', 'Cooling', 'Quality Check', 'Product Completed', 'Packaging', 'Packaged', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered'].includes(newStatus)) {
      await this.scheduleOrderProducts(order.id, businessId);
      const batches = (await db.query('SELECT pb.*, bo.id as bo_id, bo.quantity AS order_quantity FROM batch_orders bo JOIN production_batches pb ON bo.batch_id = pb.id WHERE bo.order_id = $1 AND pb.business_id = $2', [order.id, businessId])).rows;
      const complete = ['Product Completed', 'Packaging', 'Packaged', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered'].includes(newStatus);
      for (const batch of batches) {
        const orderQty = Number(batch.order_quantity || batch.planned_quantity);
        if (newStatus === 'Delivered') {
          await db.query("UPDATE batch_orders SET status = 'Delivered', delivered_quantity = quantity WHERE id = $1", [batch.bo_id]);
          const prior = (await db.query("SELECT id FROM finished_goods_movements WHERE business_id = $1 AND order_id = $2 AND batch_id = $3 AND movement_type = 'sale'", [businessId, order.id, batch.id])).rows[0];
          if (!prior) {
            const current = (await db.query('SELECT actual_usable_qty FROM production_batches WHERE id = $1', [batch.id])).rows[0];
            const deliverQty = Math.min(orderQty, Number(batch.planned_quantity));
            if (Number(current.actual_usable_qty) < deliverQty) throw new Error('Insufficient usable finished goods. Record replacement production before delivery.');
            await db.query('UPDATE production_batches SET actual_usable_qty = actual_usable_qty - $1 WHERE id = $2 AND business_id = $3', [deliverQty, batch.id, businessId]);
            await db.query("INSERT INTO finished_goods_movements (business_id, order_id, batch_id, quantity, movement_type) VALUES ($1, $2, $3, $4, 'sale')", [businessId, order.id, batch.id, deliverQty]);
          }
        } else if (['Product Packed', 'Packaged', 'Packed'].includes(newStatus)) {
          await db.query("UPDATE batch_orders SET status = 'Packed' WHERE id = $1", [batch.bo_id]);
        }
      }
    }
    if (['Accepted', 'In Production', 'Baking'].includes(newStatus)) {
      await this.scheduleOrderProducts(order.id, businessId);
    }
    if (['Rejected', 'Cancelled'].includes(newStatus)) {
      await db.query("UPDATE batch_orders SET status = 'Cancelled' WHERE order_id = $1", [order.id]);
    }
    return updated;
  }

  async scheduleOrderProducts(orderId, businessId = 1) {
    try {
      const order = await orderRepository.getById(orderId, businessId);
      if (!order) return;
      const items = await orderRepository.getOrderItems(order.id);
      if (!items || items.length === 0) return;

      const batchRepo = require('../models/batchRepository');
      const db = require('../config/db');

      const grouped = new Map();
      for (const item of items) {
        const key = item.product_id;
        const existing = grouped.get(key);
        if (existing) {
          existing.quantity += Number(item.quantity);
          if (item.weight_grams) existing.weight_grams = (existing.weight_grams || 0) + Number(item.weight_grams);
        } else {
          grouped.set(key, { ...item, quantity: Number(item.quantity) });
        }
      }

      for (const item of grouped.values()) {
        const prodId = item.product_id || item.id;
        const prodName = item.product_name || item.name || 'Artisanal Baked Item';
        const qty = parseInt(item.quantity, 10) || 1;

        // Check if this order is ALREADY linked to any batch for this product
        const alreadyLinked = (await db.query(
          `SELECT bo.id, bo.batch_id FROM batch_orders bo
           JOIN production_batches pb ON bo.batch_id = pb.id
           WHERE bo.order_id = $1 AND pb.product_id = $2 AND bo.status != 'Cancelled'`,
          [order.id, prodId]
        )).rows[0];

        if (alreadyLinked) {
          continue; // Already allocated to a batch!
        }

        // Check if there is an existing ACTIVE or PLANNED batch for this product with available capacity!
        const candidates = (await db.query(
          `SELECT pb.id, pb.batch_no, pb.planned_quantity, pb.completed_quantity, pb.actual_usable_qty,
                  COALESCE((SELECT SUM(quantity) FROM batch_orders bo WHERE bo.batch_id = pb.id AND bo.status != 'Cancelled'), 0) as total_allocated
           FROM production_batches pb
           WHERE pb.business_id = $1 AND pb.product_id = $2
             AND pb.status IN ('Planned', 'Accepted', 'In Production', 'Baking', 'Quality Check', 'Packed', 'Completed')
           ORDER BY pb.id ASC`,
          [businessId, prodId]
        )).rows;

        let allocatedBatch = null;
        for (const cand of candidates) {
          const cap = Number(cand.completed_quantity || cand.planned_quantity || 0);
          const alloc = Number(cand.total_allocated || 0);
          const available = cap - alloc;
          if (available >= qty) {
            allocatedBatch = cand;
            break;
          }
        }

        if (allocatedBatch) {
          // Allocate this customer order to the existing batch!
          await batchRepo.allocateOrderToBatch({
            batch_id: allocatedBatch.id,
            order_id: order.id,
            quantity: qty,
            weight_grams: item.weight_grams || null,
            business_id: businessId,
          });
        } else {
          // Create a new batch for this demand
          const currentYear = new Date().getFullYear();
          const batchCode = `BATCH-${currentYear}-${String(order.id).padStart(5, '0')}`;
          await batchRepo.createBatch({
            business_id: businessId,
            batch_no: batchCode,
            product_id: prodId,
            product_name: prodName,
            planned_quantity: qty,
            planned_weight: item.weight_grams ? Number(item.weight_grams) * qty : null,
            selling_method: item.selling_method || 'piece',
            priority: order.table_tag ? 'Urgent' : 'Normal',
            shift: order.delivery_time_slot || 'Morning Fresh Batch',
            source_orders: [order.id],
            is_planned: 0
          });
        }
      }
    } catch (err) {
      console.warn('[OrderService] scheduleOrderProducts note:', err.message);
    }
  }

  async approveOrderPayment(orderId, updatedBy, businessId) {
    return db.transaction(() => this._approveOrderPayment(orderId, updatedBy, businessId));
  }

  async _approveOrderPayment(orderId, updatedBy, businessId) {
    const order = await orderRepository.getById(orderId, businessId);
    if (!order) {
      const err = new Error('Order not found.');
      err.code = 'ORDER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // 1. Strict state check: Only "Pending Verification" can be approved
    const currentPayment = order.payment_status;
    if (currentPayment === 'Paid' || currentPayment === 'Verified') {
      const err = new Error('Payment has already been approved and verified.');
      err.code = 'PAYMENT_ALREADY_VERIFIED';
      err.statusCode = 409;
      throw err;
    }
    if (currentPayment === 'Rejected' || order.order_status === 'Rejected') {
      const err = new Error('Cannot approve payment: Order was already rejected.');
      err.code = 'PAYMENT_ALREADY_REJECTED';
      err.statusCode = 409;
      throw err;
    }
    if (currentPayment !== 'Pending Verification') {
      const err = new Error(`Cannot approve payment in state "${currentPayment}". Only "Pending Verification" payments can be approved.`);
      err.code = 'INVALID_PAYMENT_STATE';
      err.statusCode = 409;
      throw err;
    }
    if (order.order_status === 'Cancelled') {
      const err = new Error('Cannot approve payment for a cancelled order.');
      err.code = 'ORDER_CANCELLED';
      err.statusCode = 409;
      throw err;
    }

    await productionInventory.reserve('order', order.id, businessId);

    // 2. Update order payment status to Paid, and advance lifecycle to Accepted (Ready for Kitchen)
    await orderRepository.updateOrderPaymentStatus(order.id, 'Paid');
    const newStatus = order.order_status === 'Order Placed' ? 'Accepted' : order.order_status;
    await orderRepository.updateOrderStatus(order.id, newStatus, 'Payment verified and approved by Owner. Sent to Kitchen.', updatedBy);

    // Schedule products one by one from received order into kitchen production
    await this.scheduleOrderProducts(order.id, businessId);

    // 3. Update all payment records for this order to Verified
    const payments = await paymentRepository.getByOrderId(order.id, businessId);
    if (payments && payments.length > 0) {
      for (const p of payments) {
        await paymentRepository.updatePaymentStatus(p.id, 'Verified', businessId);
        try {
          const db = require('../config/db');
          await db.query(
            'UPDATE payments SET verified_by = $1, verified_at = CURRENT_TIMESTAMP WHERE id = $2',
            [updatedBy, p.id]
          );
        } catch (e) { }
      }
    }

    const refreshed = await this.getOrderDetails(order.id, null, businessId, 'owner');
    return refreshed;
  }

  async rejectOrderPayment(orderId, reason, updatedBy, businessId) {
    const order = await orderRepository.getById(orderId, businessId);
    if (!order) {
      const err = new Error('Order not found.');
      err.code = 'ORDER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // 1. Strict state check: Only "Pending Verification" can be rejected
    const currentPayment = order.payment_status;
    if (currentPayment === 'Paid' || currentPayment === 'Verified') {
      const err = new Error('Cannot reject payment: Order payment was already approved and verified.');
      err.code = 'PAYMENT_ALREADY_VERIFIED';
      err.statusCode = 409;
      throw err;
    }
    if (currentPayment === 'Rejected' || order.order_status === 'Rejected') {
      const err = new Error('Order payment is already rejected.');
      err.code = 'PAYMENT_ALREADY_REJECTED';
      err.statusCode = 409;
      throw err;
    }
    if (currentPayment !== 'Pending Verification') {
      const err = new Error(`Cannot reject payment in state "${currentPayment}". Only "Pending Verification" payments can be rejected.`);
      err.code = 'INVALID_PAYMENT_STATE';
      err.statusCode = 409;
      throw err;
    }

    const rejectionReason = (reason && String(reason).trim()) ? String(reason).trim() : 'Invalid Transaction ID / UTR or unverified bank credit.';

    // 2. Reject order and payment into terminal 'Rejected' state
    await orderRepository.setOrderRejection(order.id, rejectionReason, updatedBy);

    const payments = await paymentRepository.getByOrderId(order.id, businessId);
    if (payments && payments.length > 0) {
      for (const p of payments) {
        await paymentRepository.setPaymentRejection(p.id, rejectionReason, updatedBy, businessId);
      }
    }

    const refreshed = await this.getOrderDetails(order.id, null, businessId, 'owner');
    return refreshed;
  }

  /**
   * Customer re-uploads a payment screenshot when a previous screenshot was rejected or needs replacement.
   * Requirement 1:
   * - Validates image format (JPG, JPEG, PNG, WebP) and size limit (<= 8MB).
   * - Applies a separate, fresh 30-day retention period for the replacement screenshot.
   * - Transitions order and payment status back to Pending Verification.
   */
  async uploadReplacementScreenshot(orderId, screenshotData, customerId, businessId = 1, trackingToken = null) {
    if (!screenshotData) {
      const err = new Error('Replacement payment screenshot is required.');
      err.code = 'SCREENSHOT_REQUIRED';
      err.statusCode = 400;
      throw err;
    }

    const screenshotRetentionService = require('./screenshotRetentionService');
    screenshotRetentionService.validateScreenshot(screenshotData);

    const order = await orderRepository.getById(orderId, businessId);
    if (!order) {
      const err = new Error(`Order #${orderId} not found.`);
      err.code = 'ORDER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Verify ownership
    const isOwnerCustomer = customerId && order.customer_id && Number(customerId) === Number(order.customer_id);
    const hasValidToken = trackingToken && order.tracking_token && String(trackingToken).trim() === String(order.tracking_token).trim();
    if (!isOwnerCustomer && !hasValidToken && order.customer_id !== 9) {
      const err = new Error('Unauthorized to replace screenshot for this order.');
      err.code = 'FORBIDDEN_RESOURCE';
      err.statusCode = 403;
      throw err;
    }

    // Update or create payment record with new screenshot and fresh 30-day retention timestamp
    const db = require('../config/db');
    const payments = await paymentRepository.getByOrderId(order.id, businessId);
    if (payments && payments.length > 0) {
      const p = payments[0];
      await db.query(
        `UPDATE payments 
         SET screenshot_data = $1, 
             screenshot_uploaded_at = CURRENT_TIMESTAMP, 
             status = 'Pending Verification', 
             rejection_reason = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [screenshotData, p.id]
      );
    } else {
      await paymentRepository.createPayment({
        business_id: businessId,
        order_id: order.id,
        payment_mode: 'QR_UPI',
        screenshot_data: screenshotData,
        amount_paid: order.total_amount,
        status: 'Pending Verification',
      });
    }

    // Update order status back to Order Placed with Pending Verification
    await orderRepository.updateOrderPaymentStatus(order.id, 'Pending Verification');
    await db.query(
      `UPDATE orders 
       SET order_status = 'Order Placed', 
           payment_status = 'Pending Verification', 
           rejection_reason = NULL, 
           rejected_by = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id]
    );

    await orderRepository.addStatusHistory(
      order.id,
      'Order Placed',
      'Replacement payment screenshot uploaded by customer. Awaiting verification.',
      customerId || 9
    );

    const refreshed = await this.getOrderDetails(order.id, customerId, businessId, 'customer', trackingToken);
    return refreshed;
  }
}

module.exports = new OrderService();

