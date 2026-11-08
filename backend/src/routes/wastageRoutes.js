const express = require('express');
const router = express.Router();
const wastageController = require('../controllers/wastageController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.post('/', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => wastageController.recordWastage(req, res));
router.get('/', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => wastageController.getAllWastage(req, res));
router.get('/today-summary', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => wastageController.getTodaySummary(req, res));

module.exports = router;
