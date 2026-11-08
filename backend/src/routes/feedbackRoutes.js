const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Customer feedback submission & history
router.post('/', requireAuth, requireRole('customer'), (req, res) => feedbackController.submitFeedback(req, res));
router.post('/order/:orderId', requireAuth, requireRole('customer'), (req, res) => feedbackController.submitFeedback(req, res));
router.get('/mine', requireAuth, (req, res) => feedbackController.getMyFeedback(req, res));

module.exports = router;
