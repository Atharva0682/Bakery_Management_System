const db = require('../config/db');
const { convertQuantity, money, costRecipe } = require('../utils/costing');
const fields = ['recipe_name', 'batch_yield_units', 'yield_unit', 'prep_time_mins', 'bake_time_mins', 'oven_temp_c', 'labour_cost_per_min', 'power_cost_per_min', 'packaging_cost_per_unit', 'other_cost', 'instructions'];
function normalize(data) {
  const result = { ...data };
  for (const [alias, field] of Object.entries({ yield_quantity: 'batch_yield_units', prep_time_minutes: 'prep_time_mins', bake_time_minutes: 'bake_time_mins' })) {
    if (result[field] === undefined && result[alias] !== undefined) result[field] = result[alias];
  }
  for (const key of ['batch_yield_units', 'prep_time_mins', 'bake_time_mins', 'oven_temp_c', 'labour_cost_per_min', 'power_cost_per_min', 'packaging_cost_per_unit', 'other_cost', 'selling_price', 'gst_rate']) {
    if (result[key] !== undefined) {
      if (result[key] === '' || result[key] === null || typeof result[key] === 'boolean') throw new Error(`${key} must be a number`);
      const value = Number(result[key]);
      if (!Number.isFinite(value) || value < 0 || (key === 'batch_yield_units' && (!Number.isInteger(value) || value <= 0)) || (key === 'gst_rate' && value > 100)) throw new Error(`Invalid ${key}`);
      result[key] = value;
    }
  }
  if (result.recipe_name !== undefined && (typeof result.recipe_name !== 'string' || !result.recipe_name.trim())) throw new Error('Recipe name is required');
  return result;
}
async function validateIngredients(ingredients, businessId) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) throw new Error('At least one ingredient is required');
  const seen = new Set();
  for (const item of ingredients) {
    if (!Number.isInteger(Number(item.raw_material_id)) || seen.has(Number(item.raw_material_id))) throw new Error('Invalid or duplicate ingredient');
    seen.add(Number(item.raw_material_id));
    const material = (await db.query('SELECT * FROM raw_materials WHERE id = $1 AND business_id = $2', [item.raw_material_id, businessId])).rows[0];
    if (!material) throw new Error('Ingredient not found in this bakery');
    const quantity = Number(item.quantity ?? item.quantity_required);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Ingredient quantity must be positive');
    convertQuantity(quantity, item.unit, material.unit);
  }
}
async function replaceIngredients(recipeId, ingredients) {
  await db.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [recipeId]);
  for (const item of ingredients) await db.query('INSERT INTO recipe_ingredients (recipe_id, raw_material_id, quantity, unit) VALUES ($1, $2, $3, $4)', [recipeId, item.raw_material_id, Number(item.quantity ?? item.quantity_required), item.unit]);
}
class RecipeRepository {
  async getAllRecipes(businessId = 1) {
    const recipes = (await db.query(`SELECT r.*, p.name AS product_name, c.name AS category, p.base_price AS selling_price, p.gst_rate, p.active_recipe_id
      FROM recipes r JOIN products p ON r.product_id = p.id AND p.business_id = r.business_id
      LEFT JOIN categories c ON p.category_id = c.id WHERE r.business_id = $1 ORDER BY r.id`, [businessId])).rows;
    return Promise.all(recipes.map(async recipe => {
      const rows = (await db.query(`SELECT ri.*, rm.name, rm.cost_per_unit, rm.unit AS raw_unit, rm.current_stock, rm.min_reorder_level
        FROM recipe_ingredients ri JOIN raw_materials rm ON ri.raw_material_id = rm.id AND rm.business_id = $2 WHERE ri.recipe_id = $1`, [recipe.id, businessId])).rows;
      const ingredients = rows.map(item => {
        const quantity = Number(item.quantity);
        const required = convertQuantity(quantity, item.unit, item.raw_unit);
        const stock = Number(item.current_stock);
        return { ...item, quantity, quantity_required: quantity, unit_cost: Number(item.cost_per_unit),
          cost: required * Number(item.cost_per_unit), inventory_quantity: required,
          minimum_stock: Number(item.min_reorder_level), is_sufficient: stock >= required,
          percent_available: required > 0 ? Math.min(100, money(stock / required * 100)) : 100 };
      });
      const costs = costRecipe(recipe, ingredients, recipe.selling_price);
      return { ...recipe, ingredients, ...costs, is_active_formula: Number(recipe.active_recipe_id) === Number(recipe.id), yield_quantity: Number(recipe.batch_yield_units),
        prep_time_minutes: Number(recipe.prep_time_mins), bake_time_minutes: Number(recipe.bake_time_mins),
        tax_per_item: money(Number(recipe.selling_price) * Number(recipe.gst_rate) / 100),
        customer_price: money(Number(recipe.selling_price) * (1 + Number(recipe.gst_rate) / 100)) };
    }));
  }
  async getRecipeByProductId(productId, businessId = 1) {
    const list = (await this.getAllRecipes(businessId)).filter(item => Number(item.product_id) === Number(productId));
    return list.find(item => item.is_active_formula) || list[0] || null;
  }
  async createRecipe(input) {
    const data = normalize(input);
    const businessId = data.business_id;
    return db.transaction(async () => {
      const product = (await db.query('SELECT id FROM products WHERE id = $1 AND business_id = $2', [data.product_id, businessId])).rows[0];
      if (!product) throw new Error('Product not found in this bakery');
      const existing = (await db.query('SELECT id FROM recipes WHERE product_id = $1 AND business_id = $2', [data.product_id, businessId])).rows[0];
      if (existing) throw new Error('This product already has a recipe. Edit the existing recipe.');
      await validateIngredients(data.ingredients, businessId);
      const defaults = { batch_yield_units: 1, yield_unit: 'pcs', prep_time_mins: 0, bake_time_mins: 0, oven_temp_c: 0, labour_cost_per_min: 0, power_cost_per_min: 0, packaging_cost_per_unit: 0, other_cost: 0, instructions: '' };
      const values = { ...defaults, ...data };
      if (!values.recipe_name) throw new Error('Recipe name is required');
      const recipe = (await db.query(`INSERT INTO recipes (business_id, product_id, ${fields.join(', ')}) VALUES (${[...Array(fields.length + 2)].map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING *`, [businessId, data.product_id, ...fields.map(key => values[key])])).rows[0];
      await replaceIngredients(recipe.id, data.ingredients);
      await this.updatePricing(recipe, { ...data, make_active: true }, businessId);
      return recipe;
    });
  }
  async updatePricing(recipe, data, businessId) {
    if (data.make_active === true) await db.query('UPDATE products SET active_recipe_id = $1 WHERE id = $2 AND business_id = $3', [recipe.id, recipe.product_id, businessId]);
    for (const field of ['selling_price', 'gst_rate']) if (data[field] !== undefined) {
      await db.query(`UPDATE products SET ${field === 'selling_price' ? 'base_price' : field} = $1 WHERE id = $2 AND business_id = $3`, [data[field], recipe.product_id, businessId]);
      if (field === 'selling_price') await db.query('UPDATE product_variants SET selling_price = $1 WHERE product_id = $2 AND is_default = true', [data[field], recipe.product_id]);
    }
  }
  async updateRecipe(id, input = {}, businessId) {
    if (!businessId) throw new Error('Authenticated bakery is required');
    const data = normalize(input);
    return db.transaction(async () => {
      const recipe = (await db.query('SELECT * FROM recipes WHERE id = $1 AND business_id = $2', [id, businessId])).rows[0];
      if (!recipe) throw new Error('Recipe not found in this bakery');
      if (data.ingredients !== undefined) await validateIngredients(data.ingredients, businessId);
      const changed = fields.filter(key => data[key] !== undefined);
      if (changed.length) await db.query(`UPDATE recipes SET ${changed.map((key, i) => `${key} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${changed.length + 1} AND business_id = $${changed.length + 2}`, [...changed.map(key => data[key]), id, businessId]);
      if (data.ingredients !== undefined) await replaceIngredients(id, data.ingredients);
      await this.updatePricing(recipe, data, businessId);
      return (await db.query('SELECT * FROM recipes WHERE id = $1 AND business_id = $2', [id, businessId])).rows[0];
    });
  }
  async calculateCosting(recipeId, businessId = 1) {
    return (await this.getAllRecipes(businessId)).find(item => Number(item.id) === Number(recipeId)) || null;
  }
  async deleteRecipe(id, businessId) {
    return db.transaction(async () => {
      const recipe = (await db.query('SELECT * FROM recipes WHERE id = $1 AND business_id = $2', [id, businessId])).rows[0];
      if (!recipe) throw new Error('Recipe not found in this bakery');
      const active = (await db.query("SELECT id FROM production_batches WHERE product_id = $1 AND business_id = $2 AND status NOT IN ('Completed', 'Rejected')", [recipe.product_id, businessId])).rows;
      if (active.length) throw new Error('Cannot delete a recipe with active production batches');
      await db.query('UPDATE products SET active_recipe_id = (SELECT MIN(id) FROM recipes WHERE product_id = $1 AND business_id = $2 AND id <> $3) WHERE id = $1 AND business_id = $2 AND active_recipe_id = $3', [recipe.product_id, businessId, id]);
      await db.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);
      await db.query('DELETE FROM recipes WHERE id = $1 AND business_id = $2', [id, businessId]);
      return recipe;
    });
  }
}
module.exports = new RecipeRepository();
