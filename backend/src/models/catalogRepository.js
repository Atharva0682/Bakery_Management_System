const db = require('../config/db');
const { randomUUID } = require('node:crypto');
function validate(data) {
  for (const key of ['base_price', 'gst_rate', 'shelf_life_days']) if (data[key] !== undefined && (!Number.isFinite(Number(data[key])) || Number(data[key]) < 0 || (key === 'gst_rate' && Number(data[key]) > 100))) throw new Error(`Invalid ${key}`);
  if (data.delivery_fee !== undefined && data.delivery_fee !== null && data.delivery_fee !== '' && (!Number.isFinite(Number(data.delivery_fee)) || Number(data.delivery_fee) < 0)) throw new Error('Invalid delivery_fee');
  if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim())) throw new Error('Product name is required');
}
class CatalogRepository {
  async getCategories(businessId) { return (await db.query('SELECT * FROM categories WHERE business_id = $1 AND is_active = true ORDER BY display_order', [businessId])).rows; }
  async getProducts({ businessId, categoryId, isAvailable = null, search = null } = {}) {
    const rows = (await db.query('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.business_id = $1 ORDER BY p.id', [businessId])).rows;
    const { convertQuantity } = require('../utils/costing');

    // Query active recipe ingredients and available floor stock for business
    const recipeRows = (await db.query(`
      SELECT p.id AS product_id, r.batch_yield_units, ri.raw_material_id, ri.quantity AS ing_qty, ri.unit AS ing_unit,
             rm.name AS material_name, rm.unit AS raw_unit, rm.current_stock,
             COALESCE((SELECT SUM(ir.quantity) FROM inventory_reservations ir WHERE ir.raw_material_id = rm.id AND ir.business_id = rm.business_id AND ir.status = 'reserved'), 0) AS reserved_stock
      FROM products p
      JOIN recipes r ON (p.active_recipe_id = r.id OR (p.active_recipe_id IS NULL AND r.product_id = p.id))
      JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      JOIN raw_materials rm ON ri.raw_material_id = rm.id
      WHERE p.business_id = $1
    `, [businessId])).rows;

    const mapped = rows.map(p => {
      let available = Boolean(p.is_available);
      let shortageReason = null;

      if (available) {
        const ingredients = recipeRows.filter(r => Number(r.product_id) === Number(p.id));
        for (const ing of ingredients) {
          const yieldUnits = Number(ing.batch_yield_units) || 1;
          const needed = convertQuantity(Number(ing.ing_qty) / yieldUnits, ing.ing_unit, ing.raw_unit);
          const currentAvailable = Number(ing.current_stock) - Number(ing.reserved_stock);
          if (currentAvailable < needed || currentAvailable <= 0) {
            available = false;
            shortageReason = `Insufficient ingredient: ${ing.material_name}`;
            break;
          }
        }
      }

      return {
        ...p,
        is_available: available,
        shortage_reason: shortageReason
      };
    });

    return mapped.filter(p => (isAvailable === null || Boolean(p.is_available) === Boolean(isAvailable)) && (!categoryId || Number(p.category_id) === Number(categoryId)) && (!search || p.name.toLowerCase().includes(search.toLowerCase())));
  }
  async getProductById(idOrSlug, businessId = null) {
    const id = /^\d+$/.test(String(idOrSlug)) ? Number(idOrSlug) : -1;
    const row = (await db.query('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE (p.id = $1 OR p.slug = $2)' + (businessId ? ' AND p.business_id = $3' : ''), businessId ? [id, String(idOrSlug), businessId] : [id, String(idOrSlug)])).rows[0] || null;
    if (!row) return null;

    let available = Boolean(row.is_available);
    let shortageReason = null;
    if (available) {
      const { convertQuantity } = require('../utils/costing');
      const ingredients = (await db.query(`
        SELECT r.batch_yield_units, ri.quantity AS ing_qty, ri.unit AS ing_unit,
               rm.name AS material_name, rm.unit AS raw_unit, rm.current_stock,
               COALESCE((SELECT SUM(ir.quantity) FROM inventory_reservations ir WHERE ir.raw_material_id = rm.id AND ir.business_id = rm.business_id AND ir.status = 'reserved'), 0) AS reserved_stock
        FROM recipes r
        JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        JOIN raw_materials rm ON ri.raw_material_id = rm.id
        WHERE (r.id = $1 OR (r.product_id = $2 AND $1 IS NULL))
      `, [row.active_recipe_id, row.id])).rows;

      for (const ing of ingredients) {
        const yieldUnits = Number(ing.batch_yield_units) || 1;
        const needed = convertQuantity(Number(ing.ing_qty) / yieldUnits, ing.ing_unit, ing.raw_unit);
        const currentAvailable = Number(ing.current_stock) - Number(ing.reserved_stock);
        if (currentAvailable < needed || currentAvailable <= 0) {
          available = false;
          shortageReason = `Insufficient ingredient: ${ing.material_name}`;
          break;
        }
      }
    }

    return {
      ...row,
      is_available: available,
      shortage_reason: shortageReason
    };
  }
  async getVariantsByProductId(productId) { return (await db.query('SELECT * FROM product_variants WHERE product_id = $1 AND is_available = true', [productId])).rows; }
  async getVariantById(id) { return (await db.query('SELECT * FROM product_variants WHERE id = $1 AND is_available = true', [id])).rows[0] || null; }
  async createProduct(data) {
    validate(data);
    return db.transaction(async () => {
      if (!(await db.query('SELECT id FROM categories WHERE id = $1 AND business_id = $2', [data.category_id, data.business_id])).rows.length) throw new Error('Category not found in this bakery');
      const deliveryFee = (data.delivery_fee !== undefined && data.delivery_fee !== null && data.delivery_fee !== '') ? Number(data.delivery_fee) : null;
      const row = (await db.query('INSERT INTO products (business_id, category_id, name, slug, description, image_url, base_price, is_eggless, shelf_life_days, is_available, gst_rate, delivery_fee) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11) RETURNING *', [data.business_id, data.category_id, data.name.trim(), data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + randomUUID(), data.description || '', data.image_url || '', Number(data.base_price ?? 0), Boolean(data.is_eggless), Number(data.shelf_life_days ?? 3), Number(data.gst_rate ?? 0), deliveryFee])).rows[0];
      await db.query("INSERT INTO product_variants (product_id, name, sku, selling_price, is_default, is_available) VALUES ($1, 'Standard', $2, $3, true, true)", [row.id, `SKU-${row.id}-STD`, row.base_price]);
      return row;
    });
  }
  async updateProduct(id, data, businessId = 1) {
    validate(data);
    return db.transaction(async () => {
      if (data.category_id !== undefined && !(await db.query('SELECT id FROM categories WHERE id = $1 AND business_id = $2', [data.category_id, businessId])).rows.length) throw new Error('Category not found in this bakery');
      const allowedKeys = ['name', 'description', 'image_url', 'base_price', 'is_eggless', 'shelf_life_days', 'is_available', 'category_id', 'gst_rate', 'delivery_fee'];
      const keys = allowedKeys.filter(k => data[k] !== undefined);
      if (!keys.length) return this.getProductById(id, businessId);
      const values = keys.map(k => {
        if (k === 'delivery_fee') {
          return (data.delivery_fee === null || data.delivery_fee === '' || data.delivery_fee === undefined) ? null : Number(data.delivery_fee);
        }
        return data[k];
      });
      const row = (await db.query(`UPDATE products SET ${keys.map((key, i) => key + ' = $' + (i + 1)).join(', ')} WHERE id = $${keys.length + 1} AND business_id = $${keys.length + 2} RETURNING *`, [...values, id, businessId])).rows[0];
      if (row && data.base_price !== undefined) await db.query('UPDATE product_variants SET selling_price = $1 WHERE product_id = $2 AND is_default = true', [data.base_price, id]);
      return row || null;
    });
  }
  async deleteProduct(id, businessId = 1) {
    const product = await this.updateProduct(id, { is_available: false }, businessId);
    if (!product) throw new Error('Product not found in this bakery');
    return { ...product, archived: true }; // Preserve recipes, historical items and traceability.
  }
}
module.exports = new CatalogRepository();
