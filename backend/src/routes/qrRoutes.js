const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');

// GET /api/qr/:uniqueCode - Resolve QR code and retrieve business + table context
router.get('/:uniqueCode', qrController.resolveQr);

module.exports = router;
