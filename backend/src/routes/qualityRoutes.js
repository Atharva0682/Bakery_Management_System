const express = require('express');
const router = express.Router();
const qualityController = require('../controllers/qualityController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.post('/', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => qualityController.submitQualityCheck(req, res));
router.get('/', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => qualityController.getAllChecks(req, res));
router.get('/batch/:batchId', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => qualityController.getChecksByBatch(req, res));

module.exports = router;
