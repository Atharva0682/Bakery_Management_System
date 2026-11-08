/**
 * Crumb & Co. Production Costing, Recipe Scaling & Packaging Engine
 * Handles Weight-Based Scaling, Pack-Based Product Economics, and Healthy Margin Analysis.
 */

const units = {
  g: ['mass', 1], gm: ['mass', 1], gms: ['mass', 1], gram: ['mass', 1], grams: ['mass', 1],
  kg: ['mass', 1000], kgs: ['mass', 1000], kilogram: ['mass', 1000], kilograms: ['mass', 1000],
  ml: ['volume', 1], millilitre: ['volume', 1], milliliter: ['volume', 1], millilitres: ['volume', 1], milliliters: ['volume', 1],
  l: ['volume', 1000], litre: ['volume', 1000], liter: ['volume', 1000], litres: ['volume', 1000], liters: ['volume', 1000],
  pcs: ['count', 1], pc: ['count', 1], piece: ['count', 1], pieces: ['count', 1], unit: ['count', 1], units: ['count', 1], nos: ['count', 1], loaves: ['count', 1], cakes: ['count', 1]
};

function normalizeUnit(unitStr) {
  if (!unitStr) return 'g';
  const clean = String(unitStr).trim().toLowerCase();
  if (['gm', 'gms', 'gram', 'grams', 'g'].includes(clean)) return 'g';
  if (['kgs', 'kilogram', 'kilograms', 'kg'].includes(clean)) return 'kg';
  if (['millilitre', 'milliliter', 'millilitres', 'milliliters', 'ml'].includes(clean)) return 'ml';
  if (['liter', 'liters', 'litres', 'litre', 'l'].includes(clean)) return 'l';
  if (['pc', 'piece', 'pieces', 'unit', 'units', 'nos', 'loaves', 'cakes', 'pcs'].includes(clean)) return 'pcs';
  return clean;
}

function convertQuantity(quantity, from, to) {
  const normFrom = normalizeUnit(from);
  const normTo = normalizeUnit(to);
  const source = units[normFrom];
  const target = units[normTo];
  if (!source || !target || source[0] !== target[0]) {
    throw new Error(`Incompatible measurement units: '${from}' (${source ? source[0] : 'unknown'}) and '${to}' (${target ? target[0] : 'unknown'})`);
  }
  if (!Number.isFinite(Number(quantity)) || Number(quantity) < 0) {
    throw new Error('Quantity must be a finite nonnegative number');
  }
  return (Number(quantity) * source[1]) / target[1];
}

const money = value => (Number.isFinite(Number(value)) ? Math.round((Number(value) + Number.EPSILON) * 100) / 100 : 0);

/**
 * Calculates measurable raw ingredient weight in grams.
 * Treats mass directly; volume (liquids like cream, milk, water) as 1g/ml density.
 * Count-based items (pieces/eggs) are included only if pieceWeightGrams is explicitly passed.
 */
function calculateRawIngredientWeightGrams(ingredients = [], explicitPieceWeightMap = {}) {
  let totalGrams = 0;
  for (const ing of ingredients) {
    const qty = Number(ing.quantity ?? ing.quantity_required ?? ing.base_qty ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const unit = normalizeUnit(ing.unit);
    if (unit === 'g') {
      totalGrams += qty;
    } else if (unit === 'kg') {
      totalGrams += qty * 1000;
    } else if (unit === 'ml') {
      totalGrams += qty; // standard culinary density 1 ml = 1 g
    } else if (unit === 'l') {
      totalGrams += qty * 1000;
    } else if (unit === 'pcs') {
      const pieceWeight = explicitPieceWeightMap[ing.raw_material_id] || explicitPieceWeightMap[ing.name];
      if (pieceWeight && Number(pieceWeight) > 0) {
        totalGrams += qty * Number(pieceWeight);
      }
    }
  }
  return Math.round(totalGrams * 100) / 100;
}

/**
 * Comprehensive Recipe Costing & Margin Engine
 * Computes packaging economics, weight metrics, multi-level costs, gross margin & markup.
 */
function costRecipe(recipe, ingredients = [], sellingPrice = null) {
  const yieldQty = Math.max(1, Number(recipe.batch_yield_units || recipe.yield_quantity || 1));
  const sellingUnit = recipe.selling_unit || 'per_piece';
  const ingList = (ingredients && ingredients.length > 0) ? ingredients : (recipe.ingredients || []);

  // 1. Raw Ingredient Cost
  const rawCost = ingList.reduce((sum, item) => {
    let itemCost = 0;
    if (item.cost != null) {
      itemCost = Number(item.cost);
    } else {
      const q = Number(item.quantity ?? item.quantity_required ?? 0);
      const c = Number(item.cost_per_unit ?? item.unit_cost ?? 0);
      itemCost = q * c;
    }
    return sum + (Number.isFinite(itemCost) ? itemCost : 0);
  }, 0);

  // 2. Production Overheads
  const labourCost = money(Number(recipe.prep_time_mins || 0) * Number(recipe.labour_cost_per_min || 0));
  const powerCost = money(Number(recipe.bake_time_mins || 0) * Number(recipe.power_cost_per_min || 0));
  const otherCost = money(Number(recipe.other_cost || 0));

  // 3. Packaging Configuration & Costing
  const itemsPerPack = Math.max(1, parseInt(recipe.items_per_pack, 10) || 1);
  const packsPerBatch = Math.max(1, parseInt(recipe.packs_per_batch, 10) || Math.ceil(yieldQty / itemsPerPack) || 1);
  const totalPiecesPerBatch = recipe.total_pieces_per_batch
    ? Number(recipe.total_pieces_per_batch)
    : (itemsPerPack * packsPerBatch || yieldQty);

  const packagingCostPerPack = Number(recipe.packaging_cost_per_pack || 0);
  const packagingCostPerUnit = Number(recipe.packaging_cost_per_unit || 0);

  let totalPackagingCost = 0;
  if (sellingUnit === 'per_pack' || packagingCostPerPack > 0) {
    totalPackagingCost = money(packsPerBatch * packagingCostPerPack);
  } else {
    totalPackagingCost = money(yieldQty * packagingCostPerUnit);
  }

  // 4. Total Batch Cost
  const totalCost = money(rawCost + labourCost + powerCost + totalPackagingCost + otherCost);

  // 5. Weight Metrics
  const rawIngredientWeightGrams = calculateRawIngredientWeightGrams(ingList);
  const weightPerPieceGrams = recipe.weight_per_piece_g ? Number(recipe.weight_per_piece_g) : (recipe.standard_unit_weight_grams ? Number(recipe.standard_unit_weight_grams) : null);
  const netWeightPerPackGrams = recipe.net_weight_per_pack_g
    ? Number(recipe.net_weight_per_pack_g)
    : (weightPerPieceGrams && itemsPerPack ? Math.round(weightPerPieceGrams * itemsPerPack * 100) / 100 : null);

  let batchOutputWeightGrams = 0;
  if (recipe.batch_output_weight && Number(recipe.batch_output_weight) > 0) {
    batchOutputWeightGrams = convertQuantity(Number(recipe.batch_output_weight), recipe.batch_output_weight_unit || 'g', 'g');
  } else if (weightPerPieceGrams && totalPiecesPerBatch > 0) {
    batchOutputWeightGrams = Math.round(weightPerPieceGrams * totalPiecesPerBatch * 100) / 100;
  } else if (rawIngredientWeightGrams > 0) {
    // If output weight not explicitly configured, baking yield estimates from input
    const expYield = Number(recipe.expected_yield_percent ?? 100) / 100;
    const wastage = Number(recipe.production_wastage_percent ?? 0) / 100;
    batchOutputWeightGrams = Math.round(rawIngredientWeightGrams * expYield * (1 - wastage) * 100) / 100;
  }

  const expectedYieldPercent = Number(recipe.expected_yield_percent ?? 100);
  const productionWastagePercent = Number(recipe.production_wastage_percent ?? 0);
  const expectedOutputWeightGrams = batchOutputWeightGrams > 0
    ? money(batchOutputWeightGrams * (expectedYieldPercent / 100) * (1 - (productionWastagePercent / 100)))
    : null;
  const wastageWeightGrams = (rawIngredientWeightGrams > 0 && batchOutputWeightGrams > 0)
    ? Math.max(0, Math.round((rawIngredientWeightGrams - batchOutputWeightGrams) * 100) / 100)
    : null;

  // 6. Pricing & Selling Economics
  const configuredPrice = Number(sellingPrice !== null ? sellingPrice : (recipe.selling_price ?? recipe.base_price ?? 0));
  let sellingPricePerPack = recipe.selling_price_per_pack ? Number(recipe.selling_price_per_pack) : null;
  let sellingPricePerPiece = recipe.selling_price_per_piece ? Number(recipe.selling_price_per_piece) : null;

  if (sellingUnit === 'per_pack') {
    if (!sellingPricePerPack && configuredPrice > 0) sellingPricePerPack = configuredPrice;
    if (sellingPricePerPack && itemsPerPack > 0 && !sellingPricePerPiece) {
      sellingPricePerPiece = money(sellingPricePerPack / itemsPerPack);
    }
  } else if (sellingUnit === 'per_piece') {
    if (!sellingPricePerPiece && configuredPrice > 0) sellingPricePerPiece = configuredPrice;
    if (sellingPricePerPiece && itemsPerPack > 1 && !sellingPricePerPack) {
      sellingPricePerPack = money(sellingPricePerPiece * itemsPerPack);
    }
  }

  // Active selling price per selling unit
  let activeSellingPrice = configuredPrice;
  if (sellingUnit === 'per_pack' && sellingPricePerPack) {
    activeSellingPrice = sellingPricePerPack;
  } else if (sellingUnit === 'per_piece' && sellingPricePerPiece) {
    activeSellingPrice = sellingPricePerPiece;
  }

  // Multi-Level Costing
  const costPerPiece = totalPiecesPerBatch > 0 ? money(totalCost / totalPiecesPerBatch) : money(totalCost / yieldQty);
  const costPerPack = packsPerBatch > 0 ? money(totalCost / packsPerBatch) : money(totalCost);
  const costPerGram = batchOutputWeightGrams > 0 ? (totalCost / batchOutputWeightGrams) : null;
  const costPer100g = costPerGram !== null ? money(costPerGram * 100) : null;
  const costPerKg = costPerGram !== null ? money(costPerGram * 1000) : null;

  let costPerSellingUnit = costPerPiece;
  let revenuePerSellingUnit = activeSellingPrice;
  let batchRevenue = 0;

  if (sellingUnit === 'per_pack') {
    costPerSellingUnit = costPerPack;
    revenuePerSellingUnit = sellingPricePerPack || activeSellingPrice;
    batchRevenue = money(packsPerBatch * revenuePerSellingUnit);
  } else if (sellingUnit === 'per_kg') {
    costPerSellingUnit = costPerKg || totalCost;
    revenuePerSellingUnit = activeSellingPrice;
    const batchKg = (batchOutputWeightGrams || 1000) / 1000;
    batchRevenue = money(batchKg * revenuePerSellingUnit);
  } else if (sellingUnit === 'per_100g') {
    costPerSellingUnit = costPer100g || totalCost;
    revenuePerSellingUnit = activeSellingPrice;
    const batch100g = (batchOutputWeightGrams || 1000) / 100;
    batchRevenue = money(batch100g * revenuePerSellingUnit);
  } else {
    // per_piece or custom
    costPerSellingUnit = costPerPiece;
    revenuePerSellingUnit = sellingPricePerPiece || activeSellingPrice;
    batchRevenue = money(yieldQty * revenuePerSellingUnit);
  }

  const grossProfitPerUnit = money(revenuePerSellingUnit - costPerSellingUnit);
  const totalBatchProfit = money(batchRevenue - totalCost);
  const grossMarginPercent = revenuePerSellingUnit > 0
    ? money((grossProfitPerUnit / revenuePerSellingUnit) * 100)
    : 0;
  const markupPercent = costPerSellingUnit > 0
    ? money((grossProfitPerUnit / costPerSellingUnit) * 100)
    : null;

  // GST Breakdown
  const gstRate = Number(recipe.gst_rate || 0);
  const gstAmount = gstRate > 0 ? money(revenuePerSellingUnit * (gstRate / (100 + gstRate))) : 0;
  const netRevenueExGst = money(revenuePerSellingUnit - gstAmount);

  return {
    raw_material_cost: money(rawCost),
    labour_cost: labourCost,
    power_cost: powerCost,
    packaging_cost: totalPackagingCost,
    packaging_cost_per_pack: packagingCostPerPack,
    overhead_cost: otherCost,
    other_cost: otherCost,
    total_cost: totalCost,
    unit_cost: costPerSellingUnit,

    // Packaging & Selling Structure
    selling_unit: sellingUnit,
    items_per_pack: itemsPerPack,
    packs_per_batch: packsPerBatch,
    total_pieces_per_batch: totalPiecesPerBatch,
    weight_per_piece_g: weightPerPieceGrams,
    net_weight_per_pack_g: netWeightPerPackGrams,
    selling_price_per_pack: sellingPricePerPack,
    selling_price_per_piece: sellingPricePerPiece,

    // Multi-Level Costing
    cost_per_piece: costPerPiece,
    cost_per_pack: costPerPack,
    cost_per_gram: costPerGram !== null ? Math.round(costPerGram * 10000) / 10000 : null,
    cost_per_100g: costPer100g,
    cost_per_kg: costPerKg,
    cost_per_selling_unit: costPerSellingUnit,

    // Margin & Profitability
    selling_price: revenuePerSellingUnit,
    profit_margin: grossProfitPerUnit,
    gross_profit_per_unit: grossProfitPerUnit,
    gross_profit_per_selling_unit: grossProfitPerUnit,
    gross_margin_percent: grossMarginPercent,
    margin_percent: grossMarginPercent,
    markup_percent: markupPercent,
    batch_revenue: batchRevenue,
    total_batch_revenue: batchRevenue,
    batch_profit: totalBatchProfit,
    total_batch_profit: totalBatchProfit,
    total_production_cost: totalCost,

    // GST Breakdown
    gst_rate: gstRate,
    gst_amount: gstAmount,
    net_revenue_ex_gst: netRevenueExGst,

    // Weight & Yield Metrics
    raw_ingredient_weight_g: rawIngredientWeightGrams,
    batch_output_weight: recipe.batch_output_weight || (batchOutputWeightGrams ? (recipe.batch_output_weight_unit === 'kg' ? batchOutputWeightGrams / 1000 : batchOutputWeightGrams) : null),
    batch_output_weight_unit: recipe.batch_output_weight_unit || 'g',
    batch_output_weight_g: batchOutputWeightGrams || null,
    batch_output_weight_grams: batchOutputWeightGrams || null,
    standard_batch_output_weight_g: batchOutputWeightGrams || null,
    standard_unit_weight_grams: weightPerPieceGrams,
    expected_yield_percent: expectedYieldPercent,
    production_wastage_percent: productionWastagePercent,
    expected_output_weight_grams: expectedOutputWeightGrams,
    wastage_weight_g: wastageWeightGrams,
    yield_percentage: rawIngredientWeightGrams > 0 && batchOutputWeightGrams > 0
      ? money((batchOutputWeightGrams / rawIngredientWeightGrams) * 100)
      : expectedYieldPercent,
    selling_method: recipe.selling_method || (sellingUnit === 'per_kg' || sellingUnit === 'per_100g' ? 'weight' : (sellingUnit === 'per_pack' ? 'pack' : 'piece')),
    batch_identifier: recipe.batch_identifier || null,
  };
}

/**
 * Proportional Recipe Scaling for Weight-Based or Pack-Based Production
 * Calculates Scaling Factor = Required Finished Weight / Standard Finished Batch Weight
 * Scales all ingredients proportionally. Supports g, kg, ml, l, pcs without piece-to-gram coercion.
 */
function scaleRecipe(recipe, options = {}) {
  const {
    targetWeight,
    targetWeightUnit = 'g',
    targetWeightGrams,
    targetPacks,
    targetPieces
  } = options;

  const yieldQty = Math.max(1, Number(recipe.batch_yield_units || recipe.yield_quantity || 1));
  const itemsPerPack = Math.max(1, Number(recipe.items_per_pack || 1));
  const packsPerBatch = Math.max(1, Number(recipe.packs_per_batch || Math.ceil(yieldQty / itemsPerPack) || 1));
  const totalPieces = Number(recipe.total_pieces_per_batch || itemsPerPack * packsPerBatch || yieldQty);

  // Determine standard batch output weight in grams
  let standardBatchWeightGrams = 0;
  if (recipe.batch_output_weight && Number(recipe.batch_output_weight) > 0) {
    standardBatchWeightGrams = convertQuantity(Number(recipe.batch_output_weight), recipe.batch_output_weight_unit || 'g', 'g');
  } else if (recipe.weight_per_piece_g && totalPieces > 0) {
    standardBatchWeightGrams = Number(recipe.weight_per_piece_g) * totalPieces;
  } else if (recipe.standard_unit_weight_grams && totalPieces > 0) {
    standardBatchWeightGrams = Number(recipe.standard_unit_weight_grams) * totalPieces;
  } else {
    // Calculate sum of measurable ingredients as baseline
    standardBatchWeightGrams = calculateRawIngredientWeightGrams(recipe.ingredients || []) || 1000;
  }

  let scaleFactor = 1.0;
  let resolvedTargetWeightGrams = null;
  let resolvedTargetPieces = null;
  let resolvedTargetPacks = null;

  // 1. Weight-based scaling requested (e.g. 500g, 750g, 1500g, 2kg)
  if (targetWeightGrams !== undefined && targetWeightGrams !== null && Number(targetWeightGrams) > 0) {
    resolvedTargetWeightGrams = Number(targetWeightGrams);
    scaleFactor = standardBatchWeightGrams > 0 ? resolvedTargetWeightGrams / standardBatchWeightGrams : 1.0;
  } else if (targetWeight !== undefined && targetWeight !== null && Number(targetWeight) > 0) {
    resolvedTargetWeightGrams = convertQuantity(Number(targetWeight), targetWeightUnit, 'g');
    scaleFactor = standardBatchWeightGrams > 0 ? resolvedTargetWeightGrams / standardBatchWeightGrams : 1.0;
  }
  // 2. Pack-based scaling requested (e.g. 4 packs of Nankhatai)
  else if (targetPacks !== undefined && targetPacks !== null && Number(targetPacks) > 0) {
    resolvedTargetPacks = Number(targetPacks);
    scaleFactor = packsPerBatch > 0 ? resolvedTargetPacks / packsPerBatch : 1.0;
    resolvedTargetPieces = resolvedTargetPacks * itemsPerPack;
    if (standardBatchWeightGrams > 0) {
      resolvedTargetWeightGrams = standardBatchWeightGrams * scaleFactor;
    }
  }
  // 3. Piece-based scaling requested (e.g. 48 pieces)
  else if (targetPieces !== undefined && targetPieces !== null && Number(targetPieces) > 0) {
    resolvedTargetPieces = Number(targetPieces);
    scaleFactor = totalPieces > 0 ? resolvedTargetPieces / totalPieces : (yieldQty > 0 ? resolvedTargetPieces / yieldQty : 1.0);
    if (itemsPerPack > 0) {
      resolvedTargetPacks = Math.ceil(resolvedTargetPieces / itemsPerPack);
    }
    if (standardBatchWeightGrams > 0) {
      resolvedTargetWeightGrams = standardBatchWeightGrams * scaleFactor;
    }
  }

  // Prevent invalid, zero or negative scaling
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
    scaleFactor = 1.0;
  }

  // Scale Ingredients
  const rawIngredients = recipe.ingredients || [];
  const scaledIngredients = rawIngredients.map(ing => {
    const originalQty = Number(ing.quantity ?? ing.quantity_required ?? ing.base_qty ?? 0);
    // Formula: Scaled Ingredient Quantity = Original Ingredient Quantity × Scaling Factor
    const scaledQty = Math.round(originalQty * scaleFactor * 1000) / 1000;
    const unit = ing.unit || 'g';
    const unitCost = Number(ing.unit_cost ?? ing.cost_per_unit ?? 0);
    const scaledCost = money((Number(ing.cost) || (originalQty * unitCost)) * scaleFactor);

    return {
      ...ing,
      original_quantity: originalQty,
      quantity: scaledQty,
      quantity_required: scaledQty,
      scaled_quantity: scaledQty,
      unit,
      cost: scaledCost,
      inventory_quantity: scaledQty,
    };
  });

  const scaledRawInputWeightGrams = calculateRawIngredientWeightGrams(scaledIngredients);
  const scaledRawCost = money(scaledIngredients.reduce((sum, item) => sum + item.cost, 0));
  const labourCost = money((Number(recipe.labour_cost || (Number(recipe.prep_time_mins || 0) * Number(recipe.labour_cost_per_min || 0)))) * scaleFactor);
  const powerCost = money((Number(recipe.power_cost || (Number(recipe.bake_time_mins || 0) * Number(recipe.power_cost_per_min || 0)))) * scaleFactor);
  const packagingCostPerPack = Number(recipe.packaging_cost_per_pack || 0);
  const packagingCost = money(
    packagingCostPerPack > 0
      ? (resolvedTargetPacks ? resolvedTargetPacks * packagingCostPerPack : (packsPerBatch * scaleFactor * packagingCostPerPack))
      : (Number(recipe.packaging_cost || (yieldQty * Number(recipe.packaging_cost_per_unit || 0)))) * scaleFactor
  );
  const otherCost = money((Number(recipe.other_cost || 0)) * scaleFactor);
  const totalCost = money(scaledRawCost + labourCost + powerCost + packagingCost + otherCost);

  const calculatedPieces = resolvedTargetPieces || Math.round(totalPieces * scaleFactor * 100) / 100;
  const calculatedPacks = resolvedTargetPacks || (itemsPerPack > 0 ? Math.ceil(calculatedPieces / itemsPerPack) : 1);

  return {
    ...recipe,
    scaling_factor: Math.round(scaleFactor * 10000) / 10000,
    scale_factor: Math.round(scaleFactor * 10000) / 10000,
    target_weight_grams: resolvedTargetWeightGrams ? Math.round(resolvedTargetWeightGrams * 100) / 100 : standardBatchWeightGrams,
    target_weight_g: resolvedTargetWeightGrams ? Math.round(resolvedTargetWeightGrams * 100) / 100 : standardBatchWeightGrams,
    target_pieces: calculatedPieces,
    target_packs: calculatedPacks,
    scaled_yield_units: calculatedPieces,
    scaled_packs: calculatedPacks,
    scaled_pieces: calculatedPieces,
    standard_batch_output_weight_g: standardBatchWeightGrams,
    raw_ingredient_input_weight_g: scaledRawInputWeightGrams,
    expected_yield_weight_g: resolvedTargetWeightGrams || (standardBatchWeightGrams * scaleFactor),
    ingredients: scaledIngredients,
    raw_material_cost: scaledRawCost,
    labour_cost: labourCost,
    power_cost: powerCost,
    packaging_cost: packagingCost,
    overhead_cost: otherCost,
    other_cost: otherCost,
    total_cost: totalCost,
    unit_cost: calculatedPieces > 0 ? money(totalCost / calculatedPieces) : money(totalCost),
    cost_per_pack: calculatedPacks > 0 ? money(totalCost / calculatedPacks) : money(totalCost),
  };
}

module.exports = {
  units,
  normalizeUnit,
  convertQuantity,
  money,
  calculateRawIngredientWeightGrams,
  costRecipe,
  scaleRecipe,
};
