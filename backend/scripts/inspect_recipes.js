const db = require('../src/config/db');

async function main() {
  const prods = (await db.query("SELECT id, name FROM products WHERE name LIKE '%Sourdough%'")).rows;
  for (const p of prods) {
    const recs = (await db.query('SELECT * FROM recipes WHERE product_id = $1', [p.id])).rows;
    console.log(`Product ${p.id} (${p.name}): ${recs.length} recipes`);
    for (const r of recs) {
      const ings = (await db.query('SELECT * FROM recipe_ingredients WHERE recipe_id = $1', [r.id])).rows;
      console.log(`  Recipe ${r.id}: ${ings.length} ingredients`);
    }
  }
  process.exit(0);
}

main();

