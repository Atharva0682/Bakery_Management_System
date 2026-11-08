const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Customer confirms payment ("I've Paid" with Transaction ID / UTR)
router.post('/confirm', (req, res) =>
  paymentController.confirmPayment(req, res)
);

// Owner / Manager: View all payments pending verification
router.get('/pending', requireAuth, requireRole('manager', 'owner'), (req, res) =>
  paymentController.getPendingPayments(req, res)
);

// Owner / Manager: Verify and approve incoming customer payment
router.patch('/:id/verify', requireAuth, requireRole('manager', 'owner'), (req, res) =>
  paymentController.verifyPayment(req, res)
);

// Owner / Manager: Reject incoming customer payment
router.patch('/:id/reject', requireAuth, requireRole('manager', 'owner'), (req, res) =>
  paymentController.rejectPayment(req, res)
);

// Get payments for an order
router.get('/order/:orderId', (req, res) =>
  paymentController.getOrderPayments(req, res)
);

module.exports = router;
