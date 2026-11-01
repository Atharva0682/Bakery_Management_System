const units = {
  g: ['mass', 1], gram: ['mass', 1], grams: ['mass', 1],
  kg: ['mass', 1000], kilogram: ['mass', 1000], kilograms: ['mass', 1000],
  ml: ['volume', 1], millilitre: ['volume', 1], milliliter: ['volume', 1],
  l: ['volume', 1000], litre: ['volume', 1000], liter: ['volume', 1000], litres: ['volume', 1000], liters: ['volume', 1000],
  pcs: ['count', 1], pc: ['count', 1], piece: ['count', 1], pieces: ['count', 1], unit: ['count', 1], units: ['count', 1],
};
function convertQuantity(quantity, from, to) {
  const source = units[String(from).trim().toLowerCase()];
  const target = units[String(to).trim().toLowerCase()];
  if (!source || !target || source[0] !== target[0]) throw new Error(`Incompatible units: ${from} and ${to}`);
  if (!Number.isFinite(Number(quantity)) || Number(quantity) < 0) throw new Error('Quantity must be a finite nonnegative number');
  return Number(quantity) * source[1] / target[1];
}
const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
function costRecipe(recipe, ingredients, sellingPrice) {
  const yieldQty = Number(recipe.batch_yield_units);
  if (!(yieldQty > 0)) throw new Error('Recipe yield must be positive');
  const raw = ingredients.reduce((sum, item) => sum + item.cost, 0);
  // Preparation duration is active labour; bake duration is powered oven time.
  const labour = Number(recipe.prep_time_mins) * Number(recipe.labour_cost_per_min);
  const power = Number(recipe.bake_time_mins) * Number(recipe.power_cost_per_min);
  const packaging = yieldQty * Number(recipe.packaging_cost_per_unit);
  const other = Number(recipe.other_cost || 0);
  const total = money(raw + labour + power + packaging + other);
  const unit = money(total / yieldQty);
  const price = Number(sellingPrice);
  const profit = money(price - unit);
  return { raw_material_cost: money(raw), labour_cost: money(labour), power_cost: money(power),
    packaging_cost: money(packaging), overhead_cost: money(other), other_cost: money(other),
    total_cost: total, unit_cost: unit, profit_margin: profit, batch_profit: money(price * yieldQty - total),
    margin_percent: price ? money(profit / price * 100) : 0,
    markup_percent: unit ? money(profit / unit * 100) : null };
}
module.exports = { convertQuantity, money, costRecipe };
