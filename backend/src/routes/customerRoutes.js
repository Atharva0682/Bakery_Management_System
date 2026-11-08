const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { requireAuth } = require('../middleware/authMiddleware');

// Customer profile
router.get('/me', requireAuth, (req, res) => customerController.getProfile(req, res));
router.put('/me', requireAuth, (req, res) => customerController.updateProfile(req, res));

// Customer saved addresses (strictly scoped to authenticated customer)
router.get('/me/addresses', requireAuth, (req, res) => customerController.getAddresses(req, res));
router.post('/me/addresses', requireAuth, (req, res) => customerController.createAddress(req, res));
router.put('/me/addresses/:id', requireAuth, (req, res) => customerController.updateAddress(req, res));
router.put('/me/addresses/:id/default', requireAuth, (req, res) => customerController.setDefaultAddress(req, res));
router.delete('/me/addresses/:id', requireAuth, (req, res) => customerController.deleteAddress(req, res));

module.exports = router;
