const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Staff, Baker, Manager, and Owner can view & manage batches
router.get('/', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => batchController.getAllBatches(req, res));
router.get('/:id', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => batchController.getBatchById(req, res));
router.post('/', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => batchController.createBatch(req, res));
router.post('/allocate', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => batchController.allocateOrder(req, res));
router.post('/:id/allocate', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => batchController.allocateOrder(req, res));
router.patch('/:id/status', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => batchController.updateBatchStatus(req, res));
router.post('/:id/reject', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => batchController.rejectBatch(req, res));

module.exports = router;
