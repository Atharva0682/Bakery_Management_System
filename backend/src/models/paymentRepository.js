const db = require('../config/db');

// In-memory payment store fallback for testing and development
let memoryPayments = [
  {
    id: 1,
    business_id: 1,
    order_id: 1,
    payment_mode: 'QR_UPI',
    qr_reference_code: 'UPI-UTR-CRUMB-99120',
    amount_paid: 418.00,
    status: 'Verified',
    created_at: new Date().toISOString(),
  },
  {
    id: 10,
    business_id: 2,
    order_id: 10,
    payment_mode: 'QR_UPI',
    qr_reference_code: 'UPI-UTR-FL-88319',
    amount_paid: 378.00,
    status: 'Verified',
    created_at: new Date().toISOString(),
  },
];

let nextPaymentId = 20;

class PaymentRepository {
  async createPayment({
    business_id,
    order_id,
    payment_mode = 'QR_UPI',
    qr_reference_code = null,
    screenshot_data = null,
    amount_paid,
    status = 'Pending Verification',
  }) {
    try {
      const res = await db.query(
        `INSERT INTO payments (business_id, order_id, payment_mode, qr_reference_code, screenshot_data, screenshot_uploaded_at, amount_paid, status)
         VALUES ($1, $2, $3, $4, $5, datetime('now', 'localtime'), $6, $7) RETURNING *`,
        [business_id, order_id, payment_mode, qr_reference_code, screenshot_data, amount_paid, status]
      );
      return res.rows[0];
    } catch (err) {

      throw err;
    }
  }

  async cleanExpiredScreenshots() {
    try {
      const res = await db.query(
        `UPDATE payments 
         SET screenshot_data = NULL
         WHERE (created_at < datetime('now', '-30 days') OR screenshot_uploaded_at < datetime('now', '-30 days'))
           AND screenshot_data IS NOT NULL`
      );
      return res.rowCount || 0;
    } catch (err) {
      console.warn('[PaymentRepository] Expired screenshot cleanup warning:', err.message);
      return 0;
    }
  }

  async getByOrderId(orderId, businessId = null) {
    try {
      let query = 'SELECT * FROM payments WHERE order_id = $1';
      const params = [orderId];
      if (businessId) {
        params.push(businessId);
        query += ' AND business_id = $2';
      }
      query += ' ORDER BY created_at DESC';
      const res = await db.query(query, params);
      return res.rows;
    } catch (err) {

      throw err;
    }
  }

  async getById(id, businessId = null) {
    try {
      let query = 'SELECT * FROM payments WHERE id = $1';
      const params = [id];
      if (businessId) {
        params.push(businessId);
        query += ' AND business_id = $2';
      }
      const res = await db.query(query, params);
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async getByUtr(utr, businessId) {
    try {
      const res = await db.query(
        `SELECT * FROM payments WHERE business_id = $1 AND qr_reference_code = $2 AND status != 'Rejected' LIMIT 1`,
        [businessId, utr]
      );
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async updatePaymentStatus(id, newStatus, businessId = null) {
    try {
      let query = 'UPDATE payments SET status = $1 WHERE id = $2';
      const params = [newStatus, id];
      if (businessId) {
        params.push(businessId);
        query += ' AND business_id = $3';
      }
      query += ' RETURNING *';
      const res = await db.query(query, params);
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  async setPaymentRejection(id, rejectionReason, verifiedBy = null, businessId = null) {
    try {
      let query = 'UPDATE payments SET status = $1, rejection_reason = $2, verified_by = $3, verified_at = CURRENT_TIMESTAMP WHERE id = $4';
      const params = ['Rejected', rejectionReason, verifiedBy, id];
      if (businessId) {
        params.push(businessId);
        query += ' AND business_id = $5';
      }
      query += ' RETURNING *';
      const res = await db.query(query, params);
      return res.rows[0] || null;
    } catch (err) {

      throw err;
    }
  }

  _resetMemoryPayments() {
    memoryPayments = [
      {
        id: 1,
        business_id: 1,
        order_id: 1,
        payment_mode: 'QR_UPI',
        qr_reference_code: 'UPI-UTR-CRUMB-99120',
        amount_paid: 418.00,
        status: 'Verified',
        created_at: new Date().toISOString(),
      },
      {
        id: 10,
        business_id: 2,
        order_id: 10,
        payment_mode: 'QR_UPI',
        qr_reference_code: 'UPI-UTR-FL-88319',
        amount_paid: 378.00,
        status: 'Verified',
        created_at: new Date().toISOString(),
      },
    ];
    nextPaymentId = 20;
  }
}

module.exports = new PaymentRepository();
