const db = require('../src/config/db');

async function main() {
  try {
    const products = (await db.query("SELECT id, name, slug FROM products WHERE name LIKE '%San Francisco%' OR name LIKE '%Sourdough%'")).rows;
    console.log('Products:', products);

    const rawMaterials = (await db.query("SELECT id, name, current_stock, unit FROM raw_materials WHERE name LIKE '%T65%' OR name LIKE '%Flour%'")).rows;
    console.log('Raw Materials:', rawMaterials);

    if (products.length > 0) {
      for (const p of products) {
        const recipes = (await db.query('SELECT * FROM recipes WHERE product_id = $1', [p.id])).rows;
        console.log(`Recipes for product ${p.name} (id: ${p.id}):`, recipes);
        for (const r of recipes) {
          const ings = (await db.query('SELECT ri.*, rm.name as mat_name, rm.unit as mat_unit FROM recipe_ingredients ri LEFT JOIN raw_materials rm ON ri.raw_material_id = rm.id WHERE ri.recipe_id = $1', [r.id])).rows;
          console.log(`Ingredients for recipe ${r.id}:`, ings);
        }
      }
    }

    const reservations = (await db.query('SELECT * FROM inventory_reservations ORDER BY id DESC LIMIT 10')).rows;
    console.log('Recent Reservations:', reservations);

    const movements = (await db.query('SELECT * FROM stock_movements ORDER BY id DESC LIMIT 10')).rows;
    console.log('Recent Stock Movements:', movements);

    const recentOrders = (await db.query('SELECT id, order_no, order_status, created_at, updated_at FROM orders ORDER BY id DESC LIMIT 5')).rows;
    console.log('Recent Orders:', recentOrders);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();

