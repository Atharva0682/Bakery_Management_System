const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const { resolveTenantContext } = require('../middleware/tenantResolver');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Public catalog routes with tenant resolution
router.get('/categories', resolveTenantContext, (req, res) => catalogController.getCategories(req, res));
router.get('/products', resolveTenantContext, (req, res) => catalogController.getProducts(req, res));
router.get('/products/:id', resolveTenantContext, (req, res) => catalogController.getProductDetails(req, res));

router.post('/products', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => catalogController.createProduct(req, res));
router.put('/products/:id', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => catalogController.updateProduct(req, res));
router.delete('/products/:id', requireAuth, requireRole('manager', 'owner'), (req, res) => catalogController.deleteProduct(req, res));

module.exports = router;
