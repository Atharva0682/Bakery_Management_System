const express = require('express');
const router = express.Router();
const { resolveTenantContext } = require('../middleware/tenantResolver');
const orderController = require('../controllers/orderController');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/authMiddleware');

router.patch('/:id/collect-payment', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  try {
    const db = require('../config/db');
    const result = await db.transaction(async () => {
      const order = (await db.query('SELECT * FROM orders WHERE id = $1 AND business_id = $2', [req.params.id, req.user.business_id])).rows[0];
      if (!order || order.payment_method !== 'CASH_ON_DELIVERY' || ['Rejected', 'Cancelled'].includes(order.order_status)) throw new Error('A valid cash-on-delivery order is required');
      if (!Number.isFinite(Number(req.body.amount)) || Math.round(Number(req.body.amount) * 100) !== Math.round(Number(order.total_amount) * 100)) throw new Error('Collected amount must equal the final order total');
      if (order.payment_status === 'Paid') return order;
      if (order.payment_status !== 'Unpaid') throw new Error('This payment cannot be collected in its current state');
      await db.query("UPDATE payments SET status = 'Verified', verified_by = $1, verified_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND business_id = $3", [req.user.id, order.id, req.user.business_id]);
      const updated = (await db.query("UPDATE orders SET payment_status = 'Paid', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND business_id = $2 RETURNING *", [order.id, req.user.business_id])).rows[0];
      await db.query('INSERT INTO order_status_history (order_id, status, notes, updated_by) VALUES ($1, $2, $3, $4)', [order.id, order.order_status, 'Owner recorded full cash payment collection', req.user.id]);
      return updated;
    });
    res.json({ success: true, data: result });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// Customer order placement (supports both authenticated customers and guest checkout)
router.post('/', optionalAuth, resolveTenantContext, (req, res) => orderController.createOrder(req, res));

// Staff & Owner: View all business orders (KDS / order management)
router.get('/business/all', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => orderController.getAllBusinessOrders(req, res));

// Owner/Manager: Approve or Reject Customer Payment (e.g. UPI Transaction ID / UTR verification)
router.patch('/:id/approve-payment', requireAuth, requireRole('manager', 'owner'), (req, res) => orderController.approveOrderPayment(req, res));
router.patch('/:id/reject-payment', requireAuth, requireRole('manager', 'owner'), (req, res) => orderController.rejectOrderPayment(req, res));

// Staff & Owner: Update order lifecycle state
router.patch('/:id/status', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => orderController.updateOrderStatus(req, res));

// Customer: Upload replacement payment screenshot if previous was rejected
router.post('/:id/replacement-screenshot', optionalAuth, (req, res) => orderController.uploadReplacementScreenshot(req, res));

// Delivery Scheduling & Capacity APIs
router.get('/delivery-slots', (req, res) => orderController.getDeliverySlots(req, res));
router.post('/check-delivery-availability', (req, res) => orderController.checkDeliveryAvailability(req, res));

// Customer order listing & tracking (optionalAuth allows guest order tracking by ID)
router.get('/', requireAuth, (req, res) => orderController.getOrders(req, res));
router.get('/:id', optionalAuth, (req, res) => orderController.getOrderDetails(req, res));

module.exports = router;

