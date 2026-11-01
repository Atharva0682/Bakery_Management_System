const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Owner / Manager: Update bakery white-label branding & info
router.put('/branding', requireAuth, requireRole('owner', 'manager'), (req, res) => businessController.updateBusinessBranding(req, res));
router.put('/settings', requireAuth, requireRole('owner', 'manager'), (req, res) => businessController.updateBusinessBranding(req, res));
router.put('/:id/branding', requireAuth, requireRole('owner', 'manager'), (req, res) => businessController.updateBusinessBranding(req, res));
router.put('/:id/settings', requireAuth, requireRole('owner', 'manager'), (req, res) => businessController.updateBusinessBranding(req, res));

// Public business metadata endpoint
router.get('/:slug', (req, res) => businessController.getPublicBusiness(req, res));

module.exports = router;
