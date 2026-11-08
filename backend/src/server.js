const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');

// Route Handlers
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const customerRoutes = require('./routes/customerRoutes');
const orderRoutes = require('./routes/orderRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const qrRoutes = require('./routes/qrRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const batchRoutes = require('./routes/batchRoutes');
const ingredientRoutes = require('./routes/ingredientRoutes');
const wastageRoutes = require('./routes/wastageRoutes');
const qualityRoutes = require('./routes/qualityRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const recipeRoutes = require('./routes/recipeRoutes');

const screenshotRetentionService = require('./services/screenshotRetentionService');

const app = express();
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) throw new Error('Production requires a JWT_SECRET of at least 32 characters');

// Middleware - Resilient CORS allowing any local frontend dev port (5173, 5174, etc.)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === process.env.FRONTEND_URL || (origin && origin.endsWith('.vercel.app'))) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Health Check Route with live PostgreSQL status reporting
app.get('/api/health', async (req, res) => {
  await db.checkConnection();
  const dbStatus = db.getDbStatus();
  res.status(dbStatus.connected ? 200 : 503).json({
    status: dbStatus.connected ? 'OK' : 'UNAVAILABLE',
    service: 'Universal Bakery Management System API (Crumb & Co.)',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api', catalogRoutes); // Exposes /api/categories and /api/products
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/wastage', wastageRoutes);
app.use('/api/quality-checks', qualityRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/owner', ownerRoutes);

// Optional same-origin production hosting for the existing Vite build.
if (process.env.SERVE_FRONTEND === 'true') {
  const path = require('node:path');
  const dist = path.resolve(__dirname, '../../frontend/dist');
  if (!require('node:fs').existsSync(path.join(dist, 'index.html'))) throw new Error('Build the frontend before starting production hosting');
  app.use(express.static(dist, { setHeaders: (res, file) => { if (file.endsWith('sw.js') || file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
  app.get('*', (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(dist, 'index.html')));
}

// Root Route
app.get('/', (req, res) => {
  res.send('Universal Bakery Management Platform API is running.');
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Internal Server Error',
    },
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Server] Bakery Management API listening on port ${PORT}`);
    screenshotRetentionService.startScheduler();
  });
}

module.exports = app;
