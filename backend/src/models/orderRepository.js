const db = require('../config/db');

let memoryOrders = [
  {
    id: 1,
    business_id: 1,
    order_no: 'ORD-CRUMB-1001',
    customer_id: 4, // Ananya Nair
    order_type: 'delivery',
    address_id: 1,
    delivery_time_slot: 'Now (30-45 mins)',
    order_status: 'In Production',
    payment_status: 'Paid',
    payment_method: 'QR_UPI',
    subtotal: 360.00,
    delivery_fee: 40.00,
    tax_amount: 18.00,
    discount_amount: 0.00,
    total_amount: 418.00,
    special_instructions: 'Pack warm please',
    delivery_hero_name: 'Ramesh Kumar',
    delivery_hero_phone: '+91 98201 12345',
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    business_id: 1,
    order_no: 'ORD-CRUMB-1002',
    customer_id: 4, // Ananya Nair
    order_type: 'dine_in',
    address_id: null,
    delivery_time_slot: 'Now (30-45 mins)',
    order_status: 'Order Placed',
    payment_status: 'Pending Verification',
    payment_method: 'QR_UPI',
    subtotal: 850.00,
    delivery_fee: 0.00,
    tax_amount: 42.50,
    discount_amount: 0.00,
    total_amount: 892.50,
    special_instructions: '[Table: Table 1 (Indoor)] Please bring warm plates',
    table_tag: 'Table 1 (Indoor)',
    qr_code: 'QR-CRUMB-TBL-01',
    qr_type: 'table_order',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 10,
    business_id: 2,
    order_no: 'ORD-FL-2001',
    customer_id: 13, // Vikram Mehta (Business 2)
    order_type: 'pickup',
    address_id: null,
    delivery_time_slot: 'Now',
    order_status: 'Delivered',
    payment_status: 'Paid',
    payment_method: 'QR_UPI',
    subtotal: 360.00,
    delivery_fee: 0.00,
    tax_amount: 18.00,
    discount_amount: 0.00,
    total_amount: 378.00,
    special_instructions: null,
    delivery_hero_name: null,
    delivery_hero_phone: null,
    created_at: new Date().toISOString(),
  },
];

let memoryOrderItems = [
  { id: 1, order_id: 1, product_id: 2, product_variant_id: 2, batch_id: 1, name: 'Butter Croissant', quantity: 2, unit_price: 180.00, subtotal: 360.00 },
  { id: 2, order_id: 2, product_id: 3, product_variant_id: 3, batch_id: 1, name: 'Chocolate Truffle Cake', quantity: 1, unit_price: 850.00, subtotal: 850.00 },
  { id: 10, order_id: 10, product_id: 10, product_variant_id: 10, batch_id: 10, name: 'Tradition Baguette Parisienne', quantity: 1, unit_price: 140.00, subtotal: 140.00 },
  { id: 11, order_id: 10, product_id: 11, product_variant_id: 11, batch_id: 10, name: 'Quiche Lorraine Smoked Bacon', quantity: 1, unit_price: 220.00, subtotal: 220.00 },
];

let memoryOrderHistory = [
  { id: 1, order_id: 1, status: 'Order Placed', notes: 'Placed via PWA', timestamp: new Date().toISOString() },
  { id: 2, order_id: 1, status: 'Accepted', notes: 'Baker accepted', timestamp: new Date().toISOString() },
  { id: 3, order_id: 1, status: 'In Production', notes: 'Baking in deck ovens', timestamp: new Date().toISOString() },
  { id: 4, order_id: 2, status: 'Order Placed', notes: 'Placed via table QR', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 10, order_id: 10, status: 'Order Placed', notes: 'Placed for pickup', timestamp: new Date().toISOString() },
  { id: 11, order_id: 10, status: 'Delivered', notes: 'Picked up at counter', timestamp: new Date().toISOString() },
];

let nextOrderId = 20;

class OrderRepository {
  async getByCustomerId(customerId, businessId) {
    try {
      const res = await db.query(
        'SELECT * FROM orders WHERE customer_id = $1 AND business_id = $2 ORDER BY created_at DESC',
        [customerId, businessId]
      );
      return res.rows;
    } catch (err) {

      throw err;
    }
  }

  async getById(orderIdOrNo, businessId = null) {
    try {
      const isNum = !isNaN(orderIdOrNo) && !isNaN(parseInt(orderIdOrNo, 10)) && String(orderIdOrNo).trim() !== '';
      let query;
      let params;
      if (isNum) {
        query = `
          SELECT o.*,
                 COALESCE(u.name, 'Customer') as customer_name,
                 u.phone as customer_phone,
                 u.email as customer_email
          FROM orders o
          LEFT JOIN users u ON o.customer_id = u.id
          WHERE (o.id = $1 OR o.order_no = $2)
        `;
        params = [parseInt(orderIdOrNo, 10), String(orderIdOrNo)];
      } else {
        query = `
          SELECT o.*,
                 COALESCE(u.name, 'Customer') as customer_name,
                 u.phone as customer_phone,
                 u.email as customer_email
          FROM orders o
          LEFT JOIN users u ON o.customer_id = u.id
          WHERE o.order_no = $1
        `;
        params = [String(orderIdOrNo)];
      }
      if (businessId) {
        params.push(businessId);
        query += ` AND o.business_id = $${params.length}`;
      }
      const res = await db.query(query, params);
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async getOrderItems(orderId) {
    try {
      const res = await db.query(
        `SELECT oi.*, 
                COALESCE(oi.product_name, p.name) as product_name,
                COALESCE(oi.product_name, p.name) as name,
                COALESCE(oi.variant_name, pv.name, 'Standard') as variant_name,
                COALESCE(oi.variant_name, pv.name, 'Standard') as variant,
                COALESCE(oi.product_id, p.id, pv.product_id) as product_id
         FROM order_items oi
         LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
         LEFT JOIN products p ON (oi.product_id = p.id OR pv.product_id = p.id)
         WHERE oi.order_id = $1`,
        [orderId]
      );
      return res.rows;
    } catch (err) {

      throw err;
    }
  }

  async getOrderStatusHistory(orderId) {
    try {
      const res = await db.query('SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY timestamp ASC', [orderId]);
      return res.rows;
    } catch (err) {

      throw err;
    }
  }

  async createOrder({
    business_id,
    customer_id,
    order_type,
    address_id,
    delivery_date = null,
    delivery_time_slot = 'Tomorrow Morning (08:00 AM - 11:00 AM)',
    order_status = 'Order Placed',
    payment_status = 'Unpaid',
    payment_method = 'QR_UPI',
    subtotal = null,
    delivery_fee = 0,
    tax_amount = 0,
    discount_amount = 0,
    total_amount,
    special_instructions = null,
    table_tag = null,
    qr_code = null,
    qr_type = null,
    tracking_token = null,
    items = [],
  }) {
    const sequencePart = nextOrderId;
    const timeSuffix = Date.now().toString().slice(-4);
    const orderNo = `ORD-${business_id}-${1000 + sequencePart}-${timeSuffix}`;
    const finalSubtotal = (subtotal !== undefined && subtotal !== null) ? Number(subtotal) : Math.max(0, Number(total_amount || 0) - Number(delivery_fee || 0) - Number(tax_amount || 0));
    try {
      const res = await db.query(
        `INSERT INTO orders (business_id, order_no, customer_id, order_type, address_id, delivery_date, delivery_time_slot, order_status, payment_status, payment_method, subtotal, delivery_fee, tax_amount, discount_amount, total_amount, special_instructions, tracking_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
        [business_id, orderNo, customer_id, order_type, address_id, delivery_date, delivery_time_slot, order_status, payment_status, payment_method, finalSubtotal, delivery_fee, tax_amount, discount_amount, total_amount, special_instructions, tracking_token]
      );
      const newOrder = {
        ...res.rows[0],
        table_tag,
        qr_code,
        qr_type,
        tracking_token,
      };

      for (const item of items) {
        await db.query(
          `INSERT INTO order_items (order_id, product_id, product_variant_id, product_name, variant_name, quantity, unit_price, subtotal, gst_rate, tax_amount, unit_cost_at_order, cost_snapshot, weight_grams, weight_unit, selling_method)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            newOrder.id,
            item.product_id || null,
            item.product_variant_id || null,
            item.product_name || item.name || null,
            item.variant_name || item.variant || null,
            item.quantity,
            item.unit_price ?? item.price ?? 0,
            item.subtotal ?? ((item.quantity || 1) * (item.unit_price ?? item.price ?? 0)),
            item.gst_rate ?? null, item.tax_amount ?? null, item.unit_cost_at_order ?? null, item.cost_snapshot ?? null, item.weight_grams ?? null, item.weight_unit ?? null, item.selling_method ?? "piece"
          ]
        );
      }

      await db.query(
        `INSERT INTO order_status_history (order_id, status, notes) VALUES ($1, $2, $3)`,
        [newOrder.id, 'Order Placed', 'Customer placed order via PWA']
      );

      return newOrder;
    } catch (err) {

      throw err;
    }
  }

  async getAllOrders(businessId = 1, filters = {}) {
    const { status, search, role } = filters;
    const isFloorWorker = role === 'baker' || role === 'staff';
    try {
      let q = `
        SELECT o.*,
               COALESCE(u.name, 'Customer') as customer_name,
               u.phone as customer_phone,
               u.email as customer_email
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.id
        WHERE o.business_id = $1
      `;
      const params = [businessId];
      if (status && status !== 'All') {
        q += ` AND o.order_status = $${params.length + 1}`;
        params.push(status);
      }
      if (isFloorWorker) {
        q += ` AND o.order_status IN ('Accepted', 'In Production', 'Baking', 'Preparation', 'Proofing', 'Cooling', 'Quality Check', 'Packaging', 'Packaged', 'Product Packed', 'Product Completed', 'Product Completed & Packed', 'Completed') AND (o.payment_status IN ('Paid', 'Verified') OR o.payment_method = 'CASH_ON_DELIVERY')`;
      }
      q += ' ORDER BY o.created_at DESC';
      const res = await db.query(q, params);
      return res.rows;
    } catch (err) {

      throw err;
    }
  }

  async updateOrderStatus(orderId, newStatus, notes = null, updatedBy = null) {
    try {
      const res = await db.query(
        `UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [newStatus, orderId]
      );
      if (res.rows[0]) {
        await db.query(
          `INSERT INTO order_status_history (order_id, status, notes, updated_by) VALUES ($1, $2, $3, $4)`,
          [orderId, newStatus, notes || `Status updated to ${newStatus}`, updatedBy]
        );
      }
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async updateOrderPaymentStatus(orderId, paymentStatus) {
    try {
      const res = await db.query(
        `UPDATE orders SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [paymentStatus, orderId]
      );
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async setOrderRejection(orderId, rejectionReason, rejectedBy = null) {
    try {
      const res = await db.query(
        `UPDATE orders SET order_status = 'Rejected', payment_status = 'Rejected', rejection_reason = $1, rejected_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
        [rejectionReason, rejectedBy, orderId]
      );
      await db.query(
        `INSERT INTO order_status_history (order_id, status, notes, updated_by) VALUES ($1, $2, $3, $4)`,
        [orderId, 'Rejected', `Payment rejected: ${rejectionReason}`, rejectedBy]
      );
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  _getMemoryOrders() {
    return memoryOrders;
  }

  _updateOrderStatus(orderId, newStatus) {
    const o = memoryOrders.find((ord) => ord.id === Number(orderId));
    if (o) {
      o.order_status = newStatus;
    }
    return o;
  }
}

module.exports = new OrderRepository();

