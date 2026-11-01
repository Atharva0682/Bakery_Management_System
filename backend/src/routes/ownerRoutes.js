const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const pricingFields = ['delivery_fee', 'free_delivery_threshold', 'delivery_gst_rate'];
router.get('/settings/pricing', requireAuth, requireRole('manager', 'owner'), async (req, res, next) => {
  try { const row = (await require('../config/db').query('SELECT delivery_fee, free_delivery_threshold, delivery_gst_rate FROM businesses WHERE id = $1', [req.user.business_id])).rows[0]; res.json({ success: true, data: row }); } catch (error) { next(error); }
});
router.patch('/settings/pricing', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  try {
    if (!pricingFields.every(key => req.body[key] !== '' && req.body[key] !== null && Number.isFinite(Number(req.body[key])) && Number(req.body[key]) >= 0) || Number(req.body.delivery_gst_rate) > 100) throw new Error('Enter valid nonnegative pricing values and a tax rate from 0 to 100');
    const row = (await require('../config/db').query('UPDATE businesses SET delivery_fee = $1, free_delivery_threshold = $2, delivery_gst_rate = $3 WHERE id = $4 RETURNING delivery_fee, free_delivery_threshold, delivery_gst_rate', [...pricingFields.map(key => Number(req.body[key])), req.user.business_id])).rows[0];
    res.json({ success: true, data: row });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// Owner and Manager operational endpoints
router.get('/analytics', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getAnalytics(req, res));
router.get('/traceability/recall-csv/:lotQuery', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getRecallReportCsv(req, res));
router.get('/traceability/:query?', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getTraceability(req, res));
router.get('/production-planning', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getProductionPlanning(req, res));
router.get('/costing', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getCostingAndMargins(req, res));
router.get('/vendors', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getVendors(req, res));
router.post('/vendors', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.createVendor(req, res));
router.get('/workers', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getWorkers(req, res));
router.post('/workers', requireAuth, requireRole('owner'), (req, res) => ownerController.onboardWorker(req, res));
router.put('/workers/:id', requireAuth, requireRole('owner'), (req, res) => ownerController.updateWorker(req, res));
router.delete('/workers/:id', requireAuth, requireRole('owner'), (req, res) => ownerController.dismissWorker(req, res));
router.post('/workers/:id/dismiss', requireAuth, requireRole('owner'), (req, res) => ownerController.dismissWorker(req, res));
router.post('/workers/:id/reactivate', requireAuth, requireRole('owner'), (req, res) => ownerController.reactivateWorker(req, res));
router.get('/settings/shift-policy', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getShiftPolicy(req, res));
router.get('/recipes', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getRecipes(req, res));
router.put('/recipes/:id', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.updateRecipe(req, res));
router.get('/dashboard-summary', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getDashboardSummary(req, res));
router.get('/vendor-comparisons', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.getVendorComparisons(req, res));
router.post('/vendor-order', requireAuth, requireRole('manager', 'owner'), (req, res) => ownerController.placeVendorOrder(req, res));

module.exports = router;
