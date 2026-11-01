const fs = require('fs');
const file = './backend/src/controllers/ingredientController.js';
let c = fs.readFileSync(file, 'utf8');

const newMethod = `  async getStockMovements(req, res) {
    try {
      const db = require('../config/db');
      const movements = (await db.query(\`
        SELECT sm.*, rm.name as ingredient_name, rm.unit as ingredient_unit
        FROM stock_movements sm
        LEFT JOIN raw_materials rm ON sm.raw_material_id = rm.id
        WHERE sm.business_id = $1
        ORDER BY sm.id DESC
        LIMIT 100
      \`, [req.user.business_id])).rows;
      return successResponse(res, movements, 200);
    } catch (err) {
      return errorResponse(res, 'MOVEMENTS_FETCH_ERROR', err.message, 500);
    }
  }
}

module.exports = new IngredientController();`;

c = c.replace(/}\s*module\.exports\s*=\s*new\s*IngredientController\(\);/, newMethod);
fs.writeFileSync(file, c);
console.log('ingredientController patched');

