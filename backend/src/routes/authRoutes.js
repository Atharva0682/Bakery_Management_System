const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Public authentication routes
router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));

// Authenticated current user profile
router.get('/me', requireAuth, (req, res) => authController.getMe(req, res));

module.exports = router;
