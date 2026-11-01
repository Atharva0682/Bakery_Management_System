const fs = require('fs');
const file = './backend/src/routes/ingredientRoutes.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "router.get('/', requireAuth,",
  "router.get('/movements/history', requireAuth, requireRole('staff', 'baker', 'manager', 'owner'), (req, res) => ingredientController.getStockMovements(req, res));\nrouter.get('/', requireAuth,"
);

fs.writeFileSync(file, c);
console.log('ingredientRoutes patched');

