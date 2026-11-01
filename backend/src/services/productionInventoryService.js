const db = require('../config/db');
const recipes = require('../models/recipeRepository');
const inventory = require('../models/inventoryRepository');
async function requirements(type, id, businessId) {
  let items;
  if (type === 'order') {
    if (!(await db.query('SELECT id FROM orders WHERE id = $1 AND business_id = $2', [id, businessId])).rows.length) throw new Error('Order not found');
    items = (await db.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [id])).rows;
  } else {
    const batch = (await db.query('SELECT * FROM production_batches WHERE id = $1 AND business_id = $2', [id, businessId])).rows[0];
    if (!batch) throw new Error('Batch not found');
    items = [{ product_id: batch.product_id, quantity: batch.planned_quantity }];
  }
  if (!items.length) throw new Error('Production has no items');
  const totals = new Map();
  for (const item of items) {
    const recipe = await recipes.getRecipeByProductId(item.product_id, businessId);
    if (!recipe || !recipe.ingredients.length) throw new Error(`A valid recipe is required for product ${item.product_id}`);
    for (const ing of recipe.ingredients) {
      const quantity = ing.inventory_quantity * Number(item.quantity) / recipe.yield_quantity;
      const entry = totals.get(ing.raw_material_id) || { raw_material_id: ing.raw_material_id, name: ing.name, quantity: 0, unit: ing.raw_unit, unit_cost: ing.unit_cost };
      entry.quantity += quantity;
      totals.set(ing.raw_material_id, entry);
    }
  }
  return [...totals.values()];
}
async function availability(type, id, businessId) {
  const needed = await requirements(type, id, businessId);
  const stock = await inventory.getAllIngredients({ businessId });
  const own = (await db.query("SELECT raw_material_id, quantity FROM inventory_reservations WHERE business_id = $1 AND reference_type = $2 AND reference_id = $3 AND status = 'reserved'", [businessId, type, id])).rows;
  return needed.map(item => {
    const material = stock.find(row => Number(row.id) === Number(item.raw_material_id));
    const available = Number(material?.available_stock || 0) + Number(own.find(row => Number(row.raw_material_id) === Number(item.raw_material_id))?.quantity || 0);
    return { ...item, available, shortage: Math.max(0, item.quantity - available) };
  });
}
async function reserve(type, id, businessId) {
  return db.transaction(async () => {
    const existing = (await db.query('SELECT * FROM inventory_reservations WHERE reference_type = $1 AND reference_id = $2 AND business_id = $3', [type, id, businessId])).rows;
    if (existing.some(row => row.status !== 'released')) return existing;
    if (existing.length) throw new Error('Released production cannot be reopened');
    if (db.engine === 'postgres') await db.query('SELECT id FROM raw_materials WHERE business_id = $1 ORDER BY id FOR UPDATE', [businessId]);
    const needed = await availability(type, id, businessId);
    const shortages = needed.filter(row => row.shortage > 1e-9);
    if (shortages.length) {
      const error = new Error('Insufficient ingredients: ' + shortages.map(row => `${row.name}: short ${row.shortage.toFixed(4)} ${row.unit}`).join(', '));
      error.code = 'INSUFFICIENT_STOCK'; error.statusCode = 409; throw error;
    }
    for (const row of needed) await db.query('INSERT INTO inventory_reservations (business_id, reference_type, reference_id, raw_material_id, quantity, unit, unit_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)', [businessId, type, id, row.raw_material_id, row.quantity, row.unit, row.unit_cost]);
    return needed;
  });
}
async function consume(type, id, businessId) {
  return db.transaction(async () => {
    await reserve(type, id, businessId);
    const rows = (await db.query("SELECT * FROM inventory_reservations WHERE reference_type = $1 AND reference_id = $2 AND business_id = $3 AND status = 'reserved'", [type, id, businessId])).rows;
    for (const row of rows) {
      await db.query("UPDATE inventory_reservations SET status = 'consumed' WHERE id = $1", [row.id]);
      await inventory.updateStock(row.raw_material_id, row.quantity, { businessId, isDeduction: true, referenceType: type, referenceId: id });
      try {
        const activeLot = (await db.query('SELECT id FROM raw_material_lots WHERE raw_material_id = $1 AND business_id = $2 ORDER BY id ASC LIMIT 1', [row.raw_material_id, businessId])).rows[0];
        if (activeLot) {
          await db.query(
            'INSERT INTO batch_lot_consumption (business_id, batch_id, order_id, raw_material_id, lot_id, consumed_quantity, quantity_consumed) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [businessId, type === 'batch' ? id : null, type === 'order' ? id : null, row.raw_material_id, activeLot.id, row.quantity, row.quantity]
          );
        }
      } catch (e) {}
    }
  });
}
async function release(type, id, businessId) {
  await db.query("UPDATE inventory_reservations SET status = 'released' WHERE reference_type = $1 AND reference_id = $2 AND business_id = $3 AND status = 'reserved'", [type, id, businessId]);
}
async function forBatch(id, businessId, action) {
  const links = (await db.query('SELECT bo.order_id FROM batch_orders bo JOIN orders o ON bo.order_id = o.id WHERE bo.batch_id = $1 AND o.business_id = $2', [id, businessId])).rows;
  if (links.length) { for (const row of links) await action('order', row.order_id, businessId); }
  else await action('batch', id, businessId);
}
module.exports = { requirements, availability, reserve, consume, release, forBatch };
