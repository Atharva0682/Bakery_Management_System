const express = require('express');
const router = express.Router();
const ingredientController = require('../controllers/ingredientController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Stock requisitions (must be defined before /:id so Express doesn't match 'requisitions' as an id)
router.post('/requisitions', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => ingredientController.createRequisition(req, res));
router.get('/requisitions/all', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => ingredientController.getAllRequisitions(req, res));
router.patch('/requisitions/:id/status', requireAuth, requireRole('manager', 'owner'), (req, res) => ingredientController.updateRequisitionStatus(req, res));
router.patch('/requisitions/:id/approve', requireAuth, requireRole('manager', 'owner'), (req, res) => ingredientController.approveRequisition(req, res));
router.patch('/requisitions/:id/reject', requireAuth, requireRole('manager', 'owner'), (req, res) => ingredientController.rejectRequisition(req, res));

router.patch('/:id/policy', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  try {
    const db = require('../config/db');
    const { convertQuantity } = require('../utils/costing');
    const item = (await db.query('SELECT * FROM raw_materials WHERE id = $1 AND business_id = $2', [req.params.id, req.user.business_id])).rows[0];
    if (!item) return res.status(404).json({ success: false, message: 'Ingredient not found' });

    const mode = req.body.threshold_mode || 'absolute';
    let reference = Number(req.body.reference_stock ?? item.reference_stock ?? 0);
    const percent = Number(req.body.threshold_percent ?? 30);
    let minimum = Number(req.body.minimum_stock ?? req.body.min_reorder_level ?? req.body.threshold ?? item.minimum_stock ?? 0);

    const inputUnit = req.body.unit || req.body.input_unit;
    if (inputUnit && inputUnit.trim().toLowerCase() !== item.unit.trim().toLowerCase()) {
      if (minimum > 0) minimum = convertQuantity(minimum, inputUnit, item.unit);
      if (reference > 0) reference = convertQuantity(reference, inputUnit, item.unit);
    }

    if (!['absolute', 'percentage'].includes(mode) || !Number.isFinite(minimum) || minimum < 0) {
      throw new Error('Enter a valid nonnegative minimum threshold');
    }
    if (mode === 'percentage') {
      if (!Number.isFinite(reference) || reference <= 0 || !Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new Error('Enter a valid threshold and fixed reference stock');
      }
    }
    const result = await db.query(
      'UPDATE raw_materials SET threshold_mode = $1, reference_stock = $2, threshold_percent = $3, min_reorder_level = $4, minimum_stock = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND business_id = $6 RETURNING *',
      [mode, reference, percent, minimum, req.params.id, req.user.business_id]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
});

// Ingredients inventory
router.get('/movements/history', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => ingredientController.getStockMovements(req, res));
router.get('/', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => ingredientController.getAllIngredients(req, res));
router.get('/:id', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => ingredientController.getIngredientById(req, res));
router.post('/:id/restock', requireAuth, requireRole('manager', 'owner'), (req, res) => ingredientController.restockIngredient(req, res));

module.exports = router;
