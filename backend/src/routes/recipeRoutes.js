const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Recipe management - Baker, Staff, Manager, Owner
router.get('/', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) =>
  recipeController.getAllRecipes(req, res)
);

router.post('/bulk', requireAuth, requireRole('manager', 'owner'), async (req, res) => {
  try {
    const db = require('../config/db');
    const repository = require('../models/recipeRepository');
    const { ids, changes } = req.body;
    const allowed = ['labour_cost_per_min', 'power_cost_per_min', 'packaging_cost_per_unit', 'other_cost', 'gst_rate'];
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || new Set(ids).size !== ids.length || !changes || !Object.keys(changes).length || Object.keys(changes).some(key => !allowed.includes(key))) throw new Error('Select recipes and valid bulk costing fields');
    const rows = await db.transaction(async () => { const result = []; for (const id of ids) result.push(await repository.updateRecipe(id, changes, req.user.business_id)); return result; });
    return res.json({ success: true, data: rows });
  } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
});

router.post('/', requireAuth, requireRole('manager', 'owner'), (req, res) =>
  recipeController.createRecipe(req, res)
);

router.put('/:id', requireAuth, requireRole('manager', 'owner'), (req, res) =>
  recipeController.updateRecipe(req, res)
);

router.delete('/:id', requireAuth, requireRole('manager', 'owner'), (req, res) =>
  recipeController.deleteRecipe(req, res)
);

module.exports = router;
