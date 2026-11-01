import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Flame,
  ShieldCheck,
  PackageCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  CheckSquare,
  Square,
  Scale,
  ChefHat,
  Info,
  BookOpen,
  ShoppingBag,
  Check,
  RefreshCw,
  ArrowLeft,
  User
} from 'lucide-react';
import staffService from '../../services/staffService';
import api from '../../services/api';
import { PageHeader, RefreshButton, MetricStrip, StatusBadge, Dialog } from '../../components/owner/OwnerUI';
import '../../styles/owner-workspace.css';

// Kitchen Measurement Converter: Strict Grams (g) for solids, Milliliters (ml) for liquids
export const formatKitchenMeasurement = (rawQty, rawUnit) => {
  const unit = (rawUnit || '').toLowerCase().trim();
  const qty = parseFloat(rawQty) || 0;

  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(unit)) {
    const g = Math.round(qty * 1000);
    return {
      main: `${g.toLocaleString()} g`,
      sub: qty >= 1 ? `(${qty.toFixed(2)} kg)` : null,
      unitType: 'mass'
    };
  }
  if (['g', 'gm', 'gram', 'grams'].includes(unit)) {
    const g = Math.round(qty);
    return {
      main: `${g.toLocaleString()} g`,
      sub: g >= 1000 ? `(${(g / 1000).toFixed(2)} kg)` : null,
      unitType: 'mass'
    };
  }
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(unit)) {
    const ml = Math.round(qty * 1000);
    return {
      main: `${ml.toLocaleString()} ml`,
      sub: qty >= 1 ? `(${qty.toFixed(2)} L)` : null,
      unitType: 'volume'
    };
  }
  if (['ml', 'milliliter', 'milliliters'].includes(unit)) {
    const ml = Math.round(qty);
    return {
      main: `${ml.toLocaleString()} ml`,
      sub: ml >= 1000 ? `(${(ml / 1000).toFixed(2)} L)` : null,
      unitType: 'volume'
    };
  }

  return {
    main: `${Number.isInteger(qty) ? qty : qty.toFixed(1)} ${rawUnit || 'units'}`,
    sub: null,
    unitType: 'count'
  };
};

// Unit converter for comparing stock vs required recipe quantities
export const normalizeStockToUnit = (stockValue, stockUnit, reqUnit) => {
  if (stockValue === null || stockValue === undefined || isNaN(stockValue)) return null;
  const sUnit = (stockUnit || '').toLowerCase().trim();
  const rUnit = (reqUnit || '').toLowerCase().trim();

  const num = Number(stockValue);
  if (!Number.isFinite(num)) return null;

  // Direct match
  if (sUnit === rUnit) return num;

  // Solid mass conversions (kg <-> g)
  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(sUnit) && ['g', 'gm', 'gram', 'grams'].includes(rUnit)) {
    return num * 1000;
  }
  if (['g', 'gm', 'gram', 'grams'].includes(sUnit) && ['kg', 'kgs', 'kilogram', 'kilograms'].includes(rUnit)) {
    return num / 1000;
  }

  // Liquid volume conversions (L <-> ml)
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(sUnit) && ['ml', 'milliliter', 'milliliters'].includes(rUnit)) {
    return num * 1000;
  }
  if (['ml', 'milliliter', 'milliliters'].includes(sUnit) && ['l', 'liter', 'liters', 'litre', 'litres'].includes(rUnit)) {
    return num / 1000;
  }

  return num;
};


// Fallback Master Formulations if API recipes not yet populated
// Comprehensive Master Formulations for all 23 bakery catalog items
const MASTER_RECIPES_FALLBACK = [
  {
    id: 1,
    product_id: 1,
    product_name: 'San Francisco Sourdough Loaf',
    category: 'Artisan Breads',
    yield_quantity: 4,
    yield_unit: 'loaves',
    prep_time_minutes: 240,
    bake_time_minutes: 40,
    oven_temp_c: 235,
    instructions: '1. Autolyse French T65 flour with 78% hydration filtered water for 45 mins.\n2. Inoculate 20% ripe levain starter culture, perform 4 coil folds every 30 mins.\n3. Preshape, bench rest 20 mins, shape into banneton proofing baskets.\n4. Retard overnight in cold room at 4°C for 14 hours.\n5. Score with razor lame, bake in deck oven with high steam at 235°C for 20m, vent 20m.\n6. Check internal temp reaches 96°C, cool 2 hours.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 1800, unit: 'g', is_liquid: false },
      { raw_material_id: 2, name: 'Whole Wheat Stone-Ground Flour', quantity: 200, unit: 'g', is_liquid: false },
      { raw_material_id: 5, name: 'Active Sourdough Starter Culture', quantity: 400, unit: 'g', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 44, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 2,
    product_id: 2,
    product_name: 'Multigrain Seeded Sourdough',
    category: 'Artisan Breads',
    yield_quantity: 4,
    yield_unit: 'loaves',
    prep_time_minutes: 240,
    bake_time_minutes: 42,
    oven_temp_c: 230,
    instructions: '1. Soak toasted pumpkin, sunflower, and flax seeds for 30m.\n2. Autolyse flour with starter, fold in seeds during folds.\n3. Banneton proof, roll in roasted sesame, deck steam bake at 230°C for 42 mins.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 1400, unit: 'g', is_liquid: false },
      { raw_material_id: 2, name: 'Whole Wheat Stone-Ground Flour', quantity: 600, unit: 'g', is_liquid: false },
      { raw_material_id: 5, name: 'Active Sourdough Starter Culture', quantity: 400, unit: 'g', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 45, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 3,
    product_id: 3,
    product_name: 'French Rustic Baguette',
    category: 'Artisan Breads',
    yield_quantity: 8,
    yield_unit: 'baguettes',
    prep_time_minutes: 150,
    bake_time_minutes: 24,
    oven_temp_c: 240,
    instructions: '1. Direct mix T65 flour, fresh yeast, sea salt, and cold water.\n2. Bulk ferment 2 hours, shape into long tapered batons.\n3. Couche proof 45 mins, score 5 diagonal cuts, bake with steam at 240°C for 24 mins.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 1800, unit: 'g', is_liquid: false },
      { raw_material_id: 6, name: 'Fresh Compressed Baker Yeast', quantity: 15, unit: 'g', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 36, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 4,
    product_id: 4,
    product_name: 'Olive & Rosemary Focaccia',
    category: 'Artisan Breads',
    yield_quantity: 6,
    yield_unit: 'portions',
    prep_time_mins: 180,
    bake_time_mins: 28,
    oven_temp_c: 220,
    instructions: '1. Mix 82% hydration dough with extra virgin olive oil.\n2. Pan ferment in olive-oil slicked deep pans for 3 hours.\n3. Dimple thoroughly with fingers; press Kalamata olives and fresh rosemary sprigs.\n4. Drizzle generous olive oil and bake at 220°C for 28 mins.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 1200, unit: 'g', is_liquid: false },
      { raw_material_id: 28, name: 'Extra Virgin Olive Oil', quantity: 150, unit: 'ml', is_liquid: true },
      { raw_material_id: 29, name: 'Kalamata Olives & Fresh Rosemary', quantity: 200, unit: 'g', is_liquid: false },
      { raw_material_id: 6, name: 'Fresh Compressed Baker Yeast', quantity: 12, unit: 'g', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 24, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 5,
    product_id: 5,
    product_name: 'Butter Croissant',
    category: 'Viennoiserie & Pastries',
    yield_quantity: 12,
    yield_unit: 'croissants',
    prep_time_minutes: 180,
    bake_time_minutes: 22,
    oven_temp_c: 210,
    instructions: '1. Prepare détrempe dough, chill overnight.\n2. Lock in 84% Normandy butter block; perform 3 single folds.\n3. Roll to 3.5mm thickness, cut triangles and roll tight into crescents.\n4. Proof at 26°C (80% humidity) for 90m.\n5. Egg wash twice and steam bake at 210°C for 22 mins.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 500, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 250, unit: 'g', is_liquid: false },
      { raw_material_id: 11, name: 'Full Cream Milk (A2 Farm Fresh)', quantity: 180, unit: 'ml', is_liquid: true },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 45, unit: 'g', is_liquid: false },
      { raw_material_id: 6, name: 'Fresh Compressed Baker Yeast', quantity: 12, unit: 'g', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 10, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 6,
    product_id: 6,
    product_name: 'Pain au Chocolat',
    category: 'Viennoiserie & Pastries',
    yield_quantity: 12,
    yield_unit: 'pastries',
    prep_time_minutes: 180,
    bake_time_minutes: 22,
    oven_temp_c: 205,
    instructions: '1. Roll laminated croissant dough to 3.5mm thickness.\n2. Cut rectangles, place two Callebaut chocolate batons.\n3. Roll snug, proof at 26°C for 2 hours, double egg wash, and bake at 205°C for 22 mins.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 500, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 240, unit: 'g', is_liquid: false },
      { raw_material_id: 4, name: 'Callebaut 70.5% Belgian Dark Chocolate', quantity: 180, unit: 'g', is_liquid: false },
      { raw_material_id: 11, name: 'Full Cream Milk (A2 Farm Fresh)', quantity: 180, unit: 'ml', is_liquid: true },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 40, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 7,
    product_id: 7,
    product_name: 'Almond Frangipane Croissant',
    category: 'Viennoiserie & Pastries',
    yield_quantity: 8,
    yield_unit: 'pastries',
    prep_time_minutes: 60,
    bake_time_minutes: 18,
    oven_temp_c: 190,
    instructions: '1. Whisk butter, caster sugar, almond flour, and eggs into rich almond frangipane cream.\n2. Slice day-baked croissants horizontally, dip lightly in vanilla syrup.\n3. Pipe frangipane inside and on top; crust with toasted sliced almonds.\n4. Bake at 190°C for 18 mins until almond cream is golden set.',
    ingredients: [
      { raw_material_id: 22, name: 'Almond Flour (Extra Fine)', quantity: 200, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 150, unit: 'g', is_liquid: false },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 150, unit: 'g', is_liquid: false },
      { raw_material_id: 10, name: 'Farm Fresh Organic Eggs', quantity: 2, unit: 'pcs', is_liquid: false },
      { raw_material_id: 8, name: 'Madagascar Bourbon Vanilla Extract', quantity: 10, unit: 'ml', is_liquid: true }
    ]
  },
  {
    id: 8,
    product_id: 8,
    product_name: 'Fresh Blueberry Danish',
    category: 'Viennoiserie & Pastries',
    yield_quantity: 10,
    yield_unit: 'danish',
    prep_time_minutes: 90,
    bake_time_minutes: 20,
    oven_temp_c: 200,
    instructions: '1. Sheet laminated Danish pastry into 10x10cm squares, fold corners inward.\n2. Pipe 30g vanilla custard into centre, top with fresh blueberries.\n3. Proof 45 mins, egg wash rim, bake at 200°C for 20 mins until crisp.\n4. Brush fruit with warm apricot pectin glaze.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 400, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 200, unit: 'g', is_liquid: false },
      { raw_material_id: 23, name: 'Fresh Blueberries', quantity: 200, unit: 'g', is_liquid: false },
      { raw_material_id: 26, name: 'Heavy Whipping Cream 35%', quantity: 150, unit: 'ml', is_liquid: true },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 60, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 9,
    product_id: 9,
    product_name: 'Belgian Chocolate Truffle Cake',
    category: 'Artisanal Cakes',
    yield_quantity: 2,
    yield_unit: 'cakes (1kg)',
    prep_time_minutes: 60,
    bake_time_minutes: 35,
    oven_temp_c: 175,
    instructions: '1. Sift flour, imported cocoa powder, and baking powder.\n2. Melt Belgian chocolate with unsalted butter; fold with sugar, milk, and eggs.\n3. Bake in silicone parchment lined 8-inch cake tins at 175°C for 35 mins.\n4. Cool sponge completely, slice into 3 tiers, fill and mask with warm 70% dark chocolate ganache.\n5. Chill in display cooler at 4°C, seal with gold ribbon cake box.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 450, unit: 'g', is_liquid: false },
      { raw_material_id: 4, name: 'Callebaut 70.5% Belgian Dark Chocolate', quantity: 400, unit: 'g', is_liquid: false },
      { raw_material_id: 27, name: 'Dutch-Processed Cocoa Powder', quantity: 180, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 200, unit: 'g', is_liquid: false },
      { raw_material_id: 26, name: 'Heavy Whipping Cream 35%', quantity: 400, unit: 'ml', is_liquid: true },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 350, unit: 'g', is_liquid: false },
      { raw_material_id: 10, name: 'Farm Fresh Organic Eggs', quantity: 6, unit: 'pcs', is_liquid: false }
    ]
  },
  {
    id: 10,
    product_id: 10,
    product_name: 'Classic Red Velvet Cake',
    category: 'Artisanal Cakes',
    yield_quantity: 2,
    yield_unit: 'cakes (1kg)',
    prep_time_minutes: 60,
    bake_time_minutes: 32,
    oven_temp_c: 175,
    instructions: '1. Sift fine cake flour, cocoa powder, and sea salt.\n2. Cream unsalted butter and caster sugar until pale and fluffy.\n3. Whisk in eggs with pure vanilla extract, alternate folding dry ingredients with buttermilk.\n4. Bake at 175°C for 32 mins. Cool completely.\n5. Layer and frost with whipped Philadelphia cream cheese buttercream.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 500, unit: 'g', is_liquid: false },
      { raw_material_id: 13, name: 'Philadelphia Cream Cheese', quantity: 600, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 240, unit: 'g', is_liquid: false },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 500, unit: 'g', is_liquid: false },
      { raw_material_id: 11, name: 'Full Cream Milk (A2 Farm Fresh)', quantity: 350, unit: 'ml', is_liquid: true },
      { raw_material_id: 27, name: 'Dutch-Processed Cocoa Powder', quantity: 40, unit: 'g', is_liquid: false },
      { raw_material_id: 10, name: 'Farm Fresh Organic Eggs', quantity: 4, unit: 'pcs', is_liquid: false }
    ]
  },
  {
    id: 11,
    product_id: 11,
    product_name: 'New York Baked Cheesecake',
    category: 'Artisanal Cakes',
    yield_quantity: 1,
    yield_unit: 'whole cake (1.2kg)',
    prep_time_minutes: 45,
    bake_time_minutes: 65,
    oven_temp_c: 160,
    instructions: '1. Press buttery biscuit crumb into 9-inch springform pan; blind bake 10 mins.\n2. Beat Philadelphia cream cheese, caster sugar, and sour cream on low speed until velvety.\n3. Blend in farm eggs one at a time with Madagascar vanilla.\n4. Bake in water bath (bain-marie) at 160°C for 65 mins until edges set and center slightly wobbles.\n5. Chill 8 hours in refrigerator before slicing.',
    ingredients: [
      { raw_material_id: 13, name: 'Philadelphia Cream Cheese', quantity: 750, unit: 'g', is_liquid: false },
      { raw_material_id: 26, name: 'Heavy Whipping Cream 35%', quantity: 200, unit: 'ml', is_liquid: true },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 220, unit: 'g', is_liquid: false },
      { raw_material_id: 10, name: 'Farm Fresh Organic Eggs', quantity: 4, unit: 'pcs', is_liquid: false },
      { raw_material_id: 8, name: 'Madagascar Bourbon Vanilla Extract', quantity: 15, unit: 'ml', is_liquid: true },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 80, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 12,
    product_id: 12,
    product_name: 'Traditional Parsi Mawa Cake',
    category: 'Artisanal Cakes',
    yield_quantity: 6,
    yield_unit: 'loaves',
    prep_time_minutes: 45,
    bake_time_minutes: 35,
    oven_temp_c: 180,
    instructions: '1. Crumble fresh mawa/khoya and gently warm with milk.\n2. Cream pure cow ghee and sugar until light and airy.\n3. Sift flour with fresh green cardamom and nutmeg.\n4. Top with sliced pistachio and cashew halves, bake at 180°C for 35 mins.',
    ingredients: [
      { raw_material_id: 21, name: 'Fresh Mawa / Khoya', quantity: 500, unit: 'g', is_liquid: false },
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 500, unit: 'g', is_liquid: false },
      { raw_material_id: 15, name: 'Pure Cow Ghee', quantity: 250, unit: 'g', is_liquid: false },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 400, unit: 'g', is_liquid: false },
      { raw_material_id: 11, name: 'Full Cream Milk (A2 Farm Fresh)', quantity: 250, unit: 'ml', is_liquid: true },
      { raw_material_id: 19, name: 'Fresh Green Cardamom (Elaichi)', quantity: 15, unit: 'g', is_liquid: false },
      { raw_material_id: 10, name: 'Farm Fresh Organic Eggs', quantity: 4, unit: 'pcs', is_liquid: false }
    ]
  },
  {
    id: 13,
    product_id: 13,
    product_name: 'Alphonso Mango Mousse Cake',
    category: 'Artisanal Cakes',
    yield_quantity: 2,
    yield_unit: 'cakes (800g)',
    prep_time_minutes: 75,
    bake_time_minutes: 15,
    oven_temp_c: 180,
    instructions: '1. Bake delicate thin genoise sponge base.\n2. Warm Ratnagiri Alphonso mango pulp with white chocolate until incorporated.\n3. Whip heavy cream to soft peaks, fold into mango puree.\n4. Pour mango mousse into entremet rings over sponge base.\n5. Freeze 4 hours; glaze with high-shine mango mirror glaze.',
    ingredients: [
      { raw_material_id: 14, name: 'Fresh Alphonso Mango Pulp', quantity: 600, unit: 'g', is_liquid: false },
      { raw_material_id: 26, name: 'Heavy Whipping Cream 35%', quantity: 500, unit: 'ml', is_liquid: true },
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 150, unit: 'g', is_liquid: false },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 120, unit: 'g', is_liquid: false },
      { raw_material_id: 10, name: 'Farm Fresh Organic Eggs', quantity: 3, unit: 'pcs', is_liquid: false }
    ]
  },
  {
    id: 14,
    product_id: 14,
    product_name: 'Spiced Masala Potato Puff',
    category: 'Savory Delights & Puffs',
    yield_quantity: 20,
    yield_unit: 'puffs',
    prep_time_minutes: 90,
    bake_time_minutes: 25,
    oven_temp_c: 220,
    instructions: '1. Prepare flaky laminated puff pastry dough with butter & ghee layers.\n2. Sauté potato and green peas filling with cumin, ginger, and aromatic garam masala.\n3. Portion 40g spiced filling per square, fold diagonally and crimp edges.\n4. Steam bake in deck oven at 220°C for 25 mins until golden and deeply puffed.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 800, unit: 'g', is_liquid: false },
      { raw_material_id: 15, name: 'Pure Cow Ghee', quantity: 250, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 200, unit: 'g', is_liquid: false },
      { raw_material_id: 16, name: 'Spiced Potato Masala Mix', quantity: 900, unit: 'g', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 18, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 15,
    product_id: 15,
    product_name: 'Paneer Tikka Puff Roll',
    category: 'Savory Delights & Puffs',
    yield_quantity: 16,
    yield_unit: 'rolls',
    prep_time_minutes: 90,
    bake_time_minutes: 25,
    oven_temp_c: 215,
    instructions: '1. Prepare laminated pastry dough, roll to 3.5mm thickness.\n2. Marinate fresh paneer tikka cubes with tandoori spices and capsicum.\n3. Roll paneer filling tightly into elongated pastry logs, score surface diagonal slits.\n4. Bake in deck oven at 215°C for 25 minutes until crisp and flaky.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 700, unit: 'g', is_liquid: false },
      { raw_material_id: 17, name: 'Fresh Paneer Tikka Filling', quantity: 800, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 300, unit: 'g', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 15, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 16,
    product_id: 16,
    product_name: 'Mushroom & Thyme Quiche Tart',
    category: 'Savory Delights & Puffs',
    yield_quantity: 8,
    yield_unit: 'tarts',
    prep_time_minutes: 60,
    bake_time_minutes: 30,
    oven_temp_c: 195,
    instructions: '1. Roll buttery pâte brisée shortcrust pastry, line fluted tart pans, blind bake 12 mins.\n2. Sauté sliced fresh button mushrooms in butter with minced garlic and fresh thyme leaves.\n3. Whisk heavy whipping cream, farm eggs, sea salt, cracked black pepper, and grated cheese.\n4. Fill parbaked shells with mushrooms, pour custard, bake at 195°C for 28-30 mins.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 400, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 200, unit: 'g', is_liquid: false },
      { raw_material_id: 18, name: 'Fresh Button Mushrooms', quantity: 500, unit: 'g', is_liquid: false },
      { raw_material_id: 26, name: 'Heavy Whipping Cream 35%', quantity: 300, unit: 'ml', is_liquid: true },
      { raw_material_id: 10, name: 'Farm Fresh Organic Eggs', quantity: 4, unit: 'pcs', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 12, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 17,
    product_id: 17,
    product_name: 'Hand-Rolled Butter Khari Pack',
    category: 'Cookies, Biscuits & Khari',
    yield_quantity: 4,
    yield_unit: 'packs (250g)',
    prep_time_minutes: 90,
    bake_time_minutes: 28,
    oven_temp_c: 210,
    instructions: '1. Knead refined flour dough with ice cold water and salt until supple. Bench rest 30m.\n2. Lock in chilled bakery butter & pure cow ghee block; perform 4 single turns with resting.\n3. Roll dough sheet out to 5mm thickness, sprinkle fragrant carom seeds (ajwain).\n4. Cut into rectangular batons.\n5. Deck steam bake at 210°C for 18 mins, reduce oven to 160°C for 10 mins to dry out layers.\n6. Inspect for crisp hollow flake resonance, cool on racks, pack in moisture-barrier bags.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 800, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 350, unit: 'g', is_liquid: false },
      { raw_material_id: 15, name: 'Pure Cow Ghee', quantity: 150, unit: 'g', is_liquid: false },
      { raw_material_id: 30, name: 'Carom Seeds (Ajwain)', quantity: 15, unit: 'g', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 20, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 18,
    product_id: 18,
    product_name: 'Traditional Cardamom Nankhatai Pack',
    category: 'Cookies, Biscuits & Khari',
    yield_quantity: 4,
    yield_unit: 'packs (12 pcs)',
    prep_time_minutes: 45,
    bake_time_minutes: 20,
    oven_temp_c: 165,
    instructions: '1. Beat pure cow ghee and powdered cane sugar until pale and airy.\n2. Sift flour with fresh green cardamom powder.\n3. Portion into 22g rounds, press pistachio sliver in center.\n4. Bake at 165°C for 18-20 mins until crumbly and lightly golden beneath.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 600, unit: 'g', is_liquid: false },
      { raw_material_id: 15, name: 'Pure Cow Ghee', quantity: 320, unit: 'g', is_liquid: false },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 300, unit: 'g', is_liquid: false },
      { raw_material_id: 19, name: 'Fresh Green Cardamom (Elaichi)', quantity: 20, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 19,
    product_id: 19,
    product_name: 'Double Dark Chocolate Sea Salt Cookies',
    category: 'Cookies, Biscuits & Khari',
    yield_quantity: 16,
    yield_unit: 'cookies',
    prep_time_minutes: 40,
    bake_time_minutes: 14,
    oven_temp_c: 180,
    instructions: '1. Whisk melted butter, cane sugar, and egg until glossy.\n2. Sift flour and dark Dutch cocoa powder; fold in generous Callebaut chocolate chunks.\n3. Scoop 60g portions, sprinkle coarse Guerande sea salt flakes on top.\n4. Bake at 180°C for 12-14 mins until edges set and center stays fudgy soft.',
    ingredients: [
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 350, unit: 'g', is_liquid: false },
      { raw_material_id: 4, name: 'Callebaut 70.5% Belgian Dark Chocolate', quantity: 280, unit: 'g', is_liquid: false },
      { raw_material_id: 27, name: 'Dutch-Processed Cocoa Powder', quantity: 80, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 180, unit: 'g', is_liquid: false },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 220, unit: 'g', is_liquid: false },
      { raw_material_id: 10, name: 'Farm Fresh Organic Eggs', quantity: 2, unit: 'pcs', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 12, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 20,
    product_id: 20,
    product_name: 'Fudgy Belgian Walnut Brownie',
    category: 'Brownies & Teacakes',
    yield_quantity: 16,
    yield_unit: 'brownie squares',
    prep_time_minutes: 40,
    bake_time_minutes: 28,
    oven_temp_c: 170,
    instructions: '1. Melt Callebaut dark chocolate with unsalted butter over bain-marie.\n2. Whisk eggs and sugar until ribbon stage, fold chocolate mixture.\n3. Sift flour and cocoa; fold toasted Kashmiri walnut halves.\n4. Bake in 9x13 pan at 170°C for 28 mins for shiny crinkle top.',
    ingredients: [
      { raw_material_id: 4, name: 'Callebaut 70.5% Belgian Dark Chocolate', quantity: 400, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 220, unit: 'g', is_liquid: false },
      { raw_material_id: 20, name: 'Kashmiri Walnut Halves', quantity: 200, unit: 'g', is_liquid: false },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 300, unit: 'g', is_liquid: false },
      { raw_material_id: 10, name: 'Farm Fresh Organic Eggs', quantity: 4, unit: 'pcs', is_liquid: false },
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 150, unit: 'g', is_liquid: false },
      { raw_material_id: 27, name: 'Dutch-Processed Cocoa Powder', quantity: 50, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 21,
    product_id: 21,
    product_name: 'Salted Caramel Fudge Brownie',
    category: 'Brownies & Teacakes',
    yield_quantity: 16,
    yield_unit: 'brownie squares',
    prep_time_minutes: 45,
    bake_time_minutes: 30,
    oven_temp_c: 170,
    instructions: '1. Melt dark chocolate and butter; whisk with sugar and eggs.\n2. Pour batter into pan, spoon ribbons of salted caramel swirl.\n3. Sprinkle sea salt flakes, bake at 170°C for 30 mins.',
    ingredients: [
      { raw_material_id: 4, name: 'Callebaut 70.5% Belgian Dark Chocolate', quantity: 380, unit: 'g', is_liquid: false },
      { raw_material_id: 3, name: 'Unsalted Normandy Butter 84%', quantity: 220, unit: 'g', is_liquid: false },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 280, unit: 'g', is_liquid: false },
      { raw_material_id: 10, name: 'Farm Fresh Organic Eggs', quantity: 4, unit: 'pcs', is_liquid: false },
      { raw_material_id: 1, name: 'Organic French T65 Wheat Flour', quantity: 150, unit: 'g', is_liquid: false },
      { raw_material_id: 9, name: 'Guerande Grey Sea Salt', quantity: 10, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 22,
    product_id: 22,
    product_name: 'Artisan Cold Brew Vanilla Latte',
    category: 'Cold Brews & Beverages',
    yield_quantity: 4,
    yield_unit: 'bottles (300ml)',
    prep_time_minutes: 15,
    bake_time_minutes: 0,
    oven_temp_c: 0,
    instructions: '1. Steep coarse coffee grounds in cold water for 18 hours.\n2. Blend cold brew concentrate with chilled whole milk and Madagascar vanilla syrup.\n3. Bottle in sanitized glass flasks with vacuum tamper seal.',
    ingredients: [
      { raw_material_id: 24, name: 'Single Origin Cold Brew Coffee', quantity: 600, unit: 'ml', is_liquid: true },
      { raw_material_id: 11, name: 'Full Cream Milk (A2 Farm Fresh)', quantity: 500, unit: 'ml', is_liquid: true },
      { raw_material_id: 8, name: 'Madagascar Bourbon Vanilla Extract', quantity: 40, unit: 'ml', is_liquid: true },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 40, unit: 'g', is_liquid: false }
    ]
  },
  {
    id: 23,
    product_id: 23,
    product_name: 'Spiced Masala Cutting Chai Flask',
    category: 'Cold Brews & Beverages',
    yield_quantity: 2,
    yield_unit: 'flasks (500ml)',
    prep_time_minutes: 20,
    bake_time_minutes: 0,
    oven_temp_c: 0,
    instructions: '1. Crush cardamom, ginger, and cinnamon bark in mortar.\n2. Simmer spices in water for 7 mins; add Assam CTC tea and boil 3 mins.\n3. Pour in rich full cream milk and sugar; boil up twice to caramelize milk fats.\n4. Strain into insulated stainless delivery flasks.',
    ingredients: [
      { raw_material_id: 25, name: 'Assam CTC Whole Leaf Tea', quantity: 50, unit: 'g', is_liquid: false },
      { raw_material_id: 11, name: 'Full Cream Milk (A2 Farm Fresh)', quantity: 600, unit: 'ml', is_liquid: true },
      { raw_material_id: 19, name: 'Fresh Green Cardamom (Elaichi)', quantity: 15, unit: 'g', is_liquid: false },
      { raw_material_id: 12, name: 'Crushed Ceylon Cinnamon Bark', quantity: 10, unit: 'g', is_liquid: false },
      { raw_material_id: 7, name: 'Refined Fine Cane Sugar', quantity: 60, unit: 'g', is_liquid: false }
    ]
  }
];

const StaffProductionStationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Query parameters from Today's Tasks
  const queryOrderId = searchParams.get('orderId');
  const queryProductId = searchParams.get('productId');
  const queryOrderQty = searchParams.get('orderQty');
  const queryOrderNo = searchParams.get('orderNo');

  // Source selection: 'ORDERS' or 'BATCHES'
  const [activeSourceType, setActiveSourceType] = useState('ORDERS');

  // Live data
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [recipes, setRecipes] = useState(MASTER_RECIPES_FALLBACK);
  const [loading, setLoading] = useState(true);

  // Active selection
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [showAggregateRawMaterials, setShowAggregateRawMaterials] = useState(false);
  const [completedOrderItems, setCompletedOrderItems] = useState({});
  const [orderQueueFilter, setOrderQueueFilter] = useState('ALL'); // 'ACTIVE' | 'ALL' | 'COMPLETED'

  // Derive reactive activeOrder and activeBatch synced with latest live data
  const activeOrder = React.useMemo(() => {
    if (!selectedOrder) return orders[0] || null;
    return orders.find(o => String(o.id) === String(selectedOrder.id)) || selectedOrder;
  }, [orders, selectedOrder]);

  const activeBatch = React.useMemo(() => {
    if (!selectedBatch) return batches[0] || null;
    return batches.find(b => String(b.id) === String(selectedBatch.id)) || selectedBatch;
  }, [batches, selectedBatch]);

  // SOP & Ingredients Checklist
  const [checkedSOPSteps, setCheckedSOPSteps] = useState({});

  // Floor Ingredients & Replenishment Modal
  const [rawMaterials, setRawMaterials] = useState([]);
  const [showReplenishModal, setShowReplenishModal] = useState(false);
  const [repMaterialId, setRepMaterialId] = useState('');
  const [repQuantity, setRepQuantity] = useState('10');
  const [repNotes, setRepNotes] = useState('');
  const [isSubmittingReplenish, setIsSubmittingReplenish] = useState(false);

  // Modals
  const [modalMode, setModalMode] = useState(null); // 'UPDATE_BAKING' | 'QC' | 'PACKAGING'
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modal Form Inputs
  const [completedQty, setCompletedQty] = useState('');
  const [packedQty, setPackedQty] = useState('');
  const [notes, setNotes] = useState('');
  const [qcResult, setQcResult] = useState('PASSED');
  const [qcInternalTemp, setQcInternalTemp] = useState('96');
  const [qcCrustScore, setQcCrustScore] = useState('Excellent');
  const [qcNotes, setQcNotes] = useState('Golden blistered crust, uniform crumb elasticity, hollow acoustic resonance.');

  // Fetch all live orders, batches, recipes, and raw ingredients
  const loadData = async () => {
    setLoading(true);
    try {
      const [orderRes, batchRes, recipeRes, ingRes] = await Promise.all([
        staffService.getAllOrders().catch(() => ({ data: [] })),
        staffService.getBatches().catch(() => []),
        api.get('/api/recipes').catch(() => ({ data: { data: [] } })),
        staffService.getIngredients().catch(() => [])
      ]);

      const rawOrdList = orderRes.data || orderRes || [];
      const ordList = (Array.isArray(rawOrdList) ? rawOrdList : []).filter(o => {
        const rawStatus = (o.order_status || o.status || '').trim();
        const pStatus = (o.payment_status || '').trim();
        if (rawStatus === 'Rejected' || pStatus === 'Rejected' || rawStatus === 'Cancelled') return false;
        if (rawStatus === 'Order Placed' || pStatus === 'Pending Verification') return false;
        if (o.is_ready_for_baker === false) return false;

        // AUTOMATIC NEXT-DAY REMOVAL: When work is completed, automatically remove on next day
        const isCompleted = ['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed', 'Product Completed & Packed', 'Completed', 'Delivered'].includes(rawStatus);
        if (isCompleted) {
          const compTimestamp = o.updated_at || o.completed_at || o.delivery_date || o.created_at;
          if (compTimestamp) {
            const compDate = new Date(String(compTimestamp).replace(' ', 'T'));
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (compDate < todayStart) {
              return false; // Auto-removed on next day!
            }
          }
        }
        return true;
      });

      const rawBatchList = batchRes.data || batchRes || [];
      const batchList = (Array.isArray(rawBatchList) ? rawBatchList : []).filter(b => {
        const bStatus = (b.status || '').trim();
        if (['Completed', 'Packaged', 'Rejected', 'Cancelled'].includes(bStatus)) {
          const compTimestamp = b.updated_at || b.completed_at || b.created_at;
          if (compTimestamp) {
            const compDate = new Date(String(compTimestamp).replace(' ', 'T'));
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (compDate < todayStart) {
              return false; // Auto-removed on next day!
            }
          }
        }
        return true;
      });
      const recList = recipeRes.data?.data || recipeRes.data || [];
      const ings = Array.isArray(ingRes) ? ingRes : ingRes?.data || [];

      setOrders(ordList);
      setBatches(batchList);
      setRawMaterials(ings);
      if (ings.length > 0 && !repMaterialId) {
        setRepMaterialId(String(ings[0].id));
      }

      if (Array.isArray(recList) && recList.length > 0) {
        setRecipes(recList);
      }

      // Handle Query Params or default selection
      setSelectedOrder(prev => {
        if (!prev) {
          if (queryOrderId) {
            const matched = ordList.find(o => String(o.id) === String(queryOrderId));
            if (matched) return matched;
          }
          const activeOrd = ordList.find(o => ['Accepted', 'Preparation', 'Proofing', 'Baking', 'In Production', 'Cooling', 'Product Completed'].includes(o.order_status || o.status)) || ordList[0] || null;
          return activeOrd;
        }
        const refreshed = ordList.find(o => String(o.id) === String(prev.id));
        return refreshed || prev;
      });

      setSelectedBatch(prev => {
        if (!prev) {
          const activeB = batchList.find(b => ['In Production', 'Accepted', 'Quality Check', 'Planned'].includes(b.status)) || batchList[0] || null;
          return activeB;
        }
        const refreshed = batchList.find(b => String(b.id) === String(prev.id));
        return refreshed || prev;
      });
    } catch (err) {
      console.error('Failed to load station data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('crumbco:staff-refresh', handleRefresh);
    return () => window.removeEventListener('crumbco:staff-refresh', handleRefresh);
  }, [queryOrderId, queryProductId]);

  // Find active item and recipe formula
  let activeItemName = 'Butter Croissant';
  let activeItemQty = 1;
  let activeProductId = 2;

  if (activeSourceType === 'ORDERS' && activeOrder) {
    const items = activeOrder.items || [];
    const currentItem = items[selectedItemIndex] || items[0] || {};
    activeItemName = currentItem.product_name || currentItem.name || 'Artisanal Baked Item';
    activeItemQty = parseInt(currentItem.quantity, 10) || 1;
    activeProductId = currentItem.product_id || currentItem.id || 2;
  } else if (activeSourceType === 'BATCHES' && activeBatch) {
    activeItemName = activeBatch.product_name || 'Artisanal Baked Item';
    activeItemQty = activeBatch.planned_quantity || 12;
    activeProductId = activeBatch.product_id || 2;
  }

  // Find matching recipe across live database recipes and master fallbacks
  const matchedRecipe = recipes.find(r =>
    (r.product_id && String(r.product_id) === String(activeProductId)) ||
    (r.product_name && r.product_name.toLowerCase().includes(activeItemName.toLowerCase())) ||
    (r.recipe_name && r.recipe_name.toLowerCase().includes(activeItemName.toLowerCase())) ||
    (activeItemName && r.product_name && activeItemName.toLowerCase().includes(r.product_name.toLowerCase()))
  ) || MASTER_RECIPES_FALLBACK.find(r =>
    (r.product_id && String(r.product_id) === String(activeProductId)) ||
    (r.product_name && r.product_name.toLowerCase().includes(activeItemName.toLowerCase())) ||
    (activeItemName && r.product_name && activeItemName.toLowerCase().includes(r.product_name.toLowerCase()))
  ) || MASTER_RECIPES_FALLBACK[0];

  // Base batch yield and dynamic scaling multiplier
  const baseYield = matchedRecipe.yield_quantity || matchedRecipe.batch_yield_units || 12;
  const scaleMultiplier = Math.max(0.1, parseFloat((activeItemQty / baseYield).toFixed(2)));

  // Active status and baking stage calculation
  const currentStatus = activeSourceType === 'ORDERS'
    ? (activeOrder?.order_status || activeOrder?.status || 'Accepted')
    : (activeBatch?.status || 'In Production');

  const isAtLeastBaking = ['Baking', 'In Production', 'Cooling', 'Product Completed', 'Product Completed & Packed', 'Packaging', 'Packaged', 'Completed', 'Delivered'].includes(currentStatus);

  // Parse SOP steps from recipe instructions
  const sopStepsList = matchedRecipe.instructions
    ? matchedRecipe.instructions.split('\n').filter(s => s.trim().length > 0)
    : [
        '1. Measure and weigh all raw ingredients precisely in grams and milliliters.',
        '2. Autolyse flour and hydration liquids, knead to optimal dough gluten windowpane.',
        '3. Stage shaped dough in proofing box until volume expansion reaches target.',
        '4. Score and deck steam bake in oven at designated temperature.',
        '5. Conduct core temperature probe check (>= 96°C) and cool on wire racks.',
        '6. Box into food-grade bakery packaging with tamper-evident seal.'
      ];

  // Toggle checklist states (scoped per item and entity with auto-tick when baking)
  const toggleSOPStep = (idx) => {
    const key = `${activeSourceType}-${selectedOrder?.id || selectedBatch?.id}-${selectedItemIndex}-${idx}`;
    const curVal = checkedSOPSteps[key] !== undefined ? checkedSOPSteps[key] : isAtLeastBaking;
    setCheckedSOPSteps(prev => ({ ...prev, [key]: !curVal }));
  };

  // Toggle item-level completion
  const toggleOrderItemCompleted = async (itemIdx) => {
    if (!selectedOrder) return;
    const key = `${selectedOrder.id}-item-${itemIdx}`;
    const nextVal = !completedOrderItems[key];
    setCompletedOrderItems(prev => ({
      ...prev,
      [key]: nextVal
    }));

    // If marking an item as completed and order is still in Accepted/Order Placed, move order to Baking
    if (nextVal && activeSourceType === 'ORDERS' && activeOrder) {
      const cur = activeOrder.order_status || activeOrder.status;
      if (['Order Placed', 'Accepted', 'Preparation', 'Proofing'].includes(cur)) {
        await handleUpdateOrderStatus(activeOrder.id, 'Baking');
      }
    }
  };

  const orderItemsList = selectedOrder?.items || [];
  const areAllOrderItemsCompleted = orderItemsList.length > 0 && orderItemsList.every((_, idx) => Boolean(completedOrderItems[`${selectedOrder?.id}-item-${idx}`]));

  // Aggregate Raw Materials Calculation across all items of selected order
  const aggregateRawMaterials = React.useMemo(() => {
    if (activeSourceType !== 'ORDERS' || !selectedOrder || !selectedOrder.items) return [];
    const totalsMap = {}; // raw_material_id -> { name, quantity, unit, is_liquid, current_stock, shortage, product_sources }

    for (const item of selectedOrder.items) {
      const pName = item.product_name || item.name || '';
      const pId = item.product_id || item.id;
      const iQty = parseInt(item.quantity, 10) || 1;

      // Find recipe for this item
      const rec = recipes.find(r =>
        (r.product_id && String(r.product_id) === String(pId)) ||
        (r.product_name && r.product_name.toLowerCase().includes(pName.toLowerCase())) ||
        (r.recipe_name && r.recipe_name.toLowerCase().includes(pName.toLowerCase())) ||
        (pName && r.product_name && pName.toLowerCase().includes(r.product_name.toLowerCase()))
      ) || MASTER_RECIPES_FALLBACK.find(r =>
        (r.product_id && String(r.product_id) === String(pId)) ||
        (r.product_name && r.product_name.toLowerCase().includes(pName.toLowerCase())) ||
        (pName && r.product_name && pName.toLowerCase().includes(r.product_name.toLowerCase()))
      ) || MASTER_RECIPES_FALLBACK[0];

      const rYield = rec.yield_quantity || rec.batch_yield_units || 12;
      const rMultiplier = iQty / rYield;
      const rIngredients = rec.ingredients || [];

      for (const ing of rIngredients) {
        const matId = ing.raw_material_id || ing.id || ing.name;
        const scaledQty = parseFloat(((parseFloat(ing.quantity) || 0) * rMultiplier).toFixed(1));
        const matchedStock = rawMaterials.find(m => String(m.id) === String(matId) || m.name?.toLowerCase() === ing.name?.toLowerCase());

        const isLiquid = Boolean(ing.is_liquid || ['ml', 'l', 'liter', 'litres', 'milliliters'].includes((ing.unit || '').toLowerCase()) || (matchedStock && ['l', 'ml'].includes((matchedStock.unit || '').toLowerCase())));

        if (!totalsMap[matId]) {
          totalsMap[matId] = {
            raw_material_id: matId,
            name: ing.name,
            quantity: scaledQty,
            unit: ing.unit || (isLiquid ? 'ml' : 'g'),
            is_liquid: isLiquid,
            current_stock: matchedStock ? parseFloat(matchedStock.current_stock) : null,
            stock_unit: matchedStock ? matchedStock.unit : (ing.unit || 'g'),
            product_sources: [`${pName} (×${iQty})`]
          };
        } else {
          totalsMap[matId].quantity = parseFloat((totalsMap[matId].quantity + scaledQty).toFixed(1));
          totalsMap[matId].product_sources.push(`${pName} (×${iQty})`);
        }
      }
    }

    return Object.values(totalsMap);
  }, [activeSourceType, selectedOrder, recipes, rawMaterials]);

  // Order status actions with optimistic state sync
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      setSelectedOrder(prev => (prev && String(prev.id) === String(orderId) ? { ...prev, order_status: newStatus, status: newStatus } : prev));
      setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, order_status: newStatus, status: newStatus } : o));

      await staffService.updateOrderStatus(orderId, newStatus, `Baking station updated stage to ${newStatus}`);
      setSuccessMsg(`Order #${orderId} stage updated to "${newStatus}"!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadData();
    } catch (err) {
      alert(`Failed to update order status: ${err.message}`);
    }
  };

  // Start baking stage
  const handleStartBaking = async () => {
    if (activeSourceType === 'ORDERS' && activeOrder) {
      const cur = activeOrder.order_status || activeOrder.status;
      if (cur !== 'Baking') {
        await handleUpdateOrderStatus(activeOrder.id, 'Baking');
      }
    } else if (activeSourceType === 'BATCHES' && activeBatch) {
      try {
        await staffService.updateBatchStatus(activeBatch.id, {
          status: 'In Production',
          notes: 'Deck oven baking started by baker'
        });
        setSuccessMsg(`Batch #${activeBatch.batch_no || activeBatch.batch_code} moved to "In Production"!`);
        setTimeout(() => setSuccessMsg(''), 4000);
        await loadData();
      } catch (e) {
        console.warn('Batch update note:', e.message);
      }
    }
  };

  // Mark product completed (baking finished)
  const handleMarkProductCompleted = async () => {
    setSubmitting(true);
    try {
      if (activeSourceType === 'BATCHES' && activeBatch) {
        await staffService.updateBatchStatus(activeBatch.id, {
          status: 'In Production',
          notes: `Baking completed for ${activeItemQty} units.`
        });
      } else if (activeSourceType === 'ORDERS' && activeOrder) {
        await handleUpdateOrderStatus(activeOrder.id, 'Product Completed');
      }
      setSuccessMsg('Status updated: Product is baked & completed!');
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadData();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Pack product and mark status as Product Completed & Packed
  const handleMarkProductPacked = async () => {
    setSubmitting(true);
    try {
      const qty = activeItemQty;
      if (activeSourceType === 'BATCHES' && activeBatch) {
        await staffService.updateBatchStatus(activeBatch.id, {
          status: 'Packaged',
          completedQuantity: qty,
          notes: `Product completed and packed (${qty} units). Ready for delivery dispatch.`
        });
      } else if (activeSourceType === 'ORDERS' && activeOrder) {
        await handleUpdateOrderStatus(activeOrder.id, 'Product Completed & Packed');
      }
      setSuccessMsg('Status updated: Product Completed and Packed!');
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadData();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Replenishment Request Submission
  const handleReplenishmentSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingReplenish(true);
    try {
      await staffService.createRequisition({
        raw_material_id: repMaterialId,
        requested_quantity: repQuantity,
        notes: repNotes || `Floor replenishment requested for ${activeItemName}`
      });
      setShowReplenishModal(false);
      setSuccessMsg(`Replenishment request for ${repQuantity} units submitted to bakery owner!`);
      setTimeout(() => setSuccessMsg(''), 5000);
      setRepNotes('');
    } catch (err) {
      alert(`Failed to submit replenishment: ${err.message}`);
    } finally {
      setIsSubmittingReplenish(false);
    }
  };

  // Submit Modal Actions
  const handleSubmitBaking = async (advanceToQC = false) => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      // Advance directly to Packaging (Quality Check step removed from active flow)
      if (advanceToQC && activeSourceType === 'ORDERS' && selectedOrder && !areAllOrderItemsCompleted) {
        const confirmAll = window.confirm(
          `Order #${selectedOrder.order_no || selectedOrder.id} has ${selectedOrder.items?.length || 1} items and not all have been marked finished.\n\nMark all items completed and advance directly to Packaging?`
        );
        if (!confirmAll) {
          setSubmitting(false);
          return;
        }
        const updatedCompleted = { ...completedOrderItems };
        (selectedOrder.items || []).forEach((_, idx) => {
          updatedCompleted[`${selectedOrder.id}-item-${idx}`] = true;
        });
        setCompletedOrderItems(updatedCompleted);
      }

      const qty = parseInt(completedQty, 10) || activeItemQty;
      if (activeSourceType === 'BATCHES' && (activeBatch || selectedBatch)) {
        const targetB = activeBatch || selectedBatch;
        const nextStatus = advanceToQC ? 'Product Completed & Packed' : 'In Production';
        await staffService.updateBatchStatus(targetB.id, {
          status: nextStatus,
          completedQuantity: qty,
          notes: notes || `Baking quantity logged: ${qty} units. Transferred directly to packaging.`
        });
      } else if (activeSourceType === 'ORDERS' && (activeOrder || selectedOrder)) {
        const targetO = activeOrder || selectedOrder;
        await handleUpdateOrderStatus(targetO.id, advanceToQC ? 'Product Completed & Packed' : 'Baking');
      }
      setSuccessMsg(advanceToQC ? 'Production complete! Product Completed & Packed!' : 'Baking stage updated!');
      setTimeout(() => setSuccessMsg(''), 4000);
      setModalMode(null);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Error updating baking stage.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitQC = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      if (activeSourceType === 'BATCHES' && (activeBatch || selectedBatch)) {
        const targetB = activeBatch || selectedBatch;
        await staffService.submitQualityCheck({
          batchId: targetB.id,
          result: qcResult,
          notes: `Temp: ${qcInternalTemp}°C • Crust: ${qcCrustScore}. ${qcNotes}`
        });
        if (qcResult === 'PASSED') {
          await staffService.updateBatchStatus(targetB.id, {
            status: 'Product Completed & Packed',
            notes: 'Passed Quality Check. Transferred to packaging table.'
          });
        }
      } else if (activeSourceType === 'ORDERS' && (activeOrder || selectedOrder)) {
        const targetO = activeOrder || selectedOrder;
        await handleUpdateOrderStatus(targetO.id, 'Product Completed & Packed');
      }
      setSuccessMsg('Packaging completed! Product Completed & Packed.');
      setTimeout(() => setSuccessMsg(''), 4000);
      setModalMode(null);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Error logging QC.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPackaging = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const qty = parseInt(packedQty, 10) || activeItemQty;
      if (activeSourceType === 'BATCHES' && selectedBatch) {
        await staffService.updateBatchStatus(selectedBatch.id, {
          status: 'Completed',
          packedQuantity: qty,
          notes: notes || `Packaged ${qty} units with food-grade freshness seal. Ready for delivery.`
        });
      } else if (activeSourceType === 'ORDERS' && selectedOrder) {
        await handleUpdateOrderStatus(selectedOrder.id, 'Completed');
      }
      setSuccessMsg('Packaging completed! Marked Ready for Dispatch.');
      setTimeout(() => setSuccessMsg(''), 4000);
      setModalMode(null);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Error finalizing packaging.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="owner-workspace" style={{ paddingBottom: '32px' }}>
      
      {/* Toast Notification */}
      {successMsg && (
        <div style={{
          backgroundColor: '#F0FDF4',
          border: '1px solid #86EFAC',
          color: '#166534',
          padding: '12px 18px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Module 2 Top Header (Owner UI Style) */}
      <PageHeader
        eyebrow="Kitchen Floor Operations • Module 2"
        title="Order Recipes, Ingredients & Baking Station"
        description="Precision-scaled formulas (g / ml / batch), step-by-step preparation, and packaging tracking."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            backgroundColor: 'var(--ow-wash, #f5f0e9)',
            padding: '3px',
            borderRadius: '6px',
            border: '1px solid var(--ow-line, #e8e0d7)'
          }}>
            <button
              type="button"
              onClick={() => setActiveSourceType('ORDERS')}
              className={`ow-button ${activeSourceType === 'ORDERS' ? 'ow-button-primary' : 'ow-button-light'}`}
              style={{ padding: '6px 12px', minHeight: '32px', fontSize: '11px' }}
            >
              <ShoppingBag size={13} />
              <span>Accepted Orders ({orders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSourceType('BATCHES')}
              className={`ow-button ${activeSourceType === 'BATCHES' ? 'ow-button-primary' : 'ow-button-light'}`}
              style={{ padding: '6px 12px', minHeight: '32px', fontSize: '11px' }}
            >
              <Layers size={13} />
              <span>Floor Batches ({batches.length})</span>
            </button>
          </div>
          <RefreshButton loading={loading} onClick={loadData} />
        </div>
      </PageHeader>

      {/* Floor Overview Metric Strip (Owner UI Design System) */}
      <MetricStrip items={[
        {
          icon: ShoppingBag,
          label: 'Orders to bake',
          value: orders.filter(o => !['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered'].includes(o.order_status || o.status)).length,
          note: 'Awaiting baking or in oven'
        },
        {
          icon: Flame,
          label: 'In production / oven',
          value: orders.filter(o => ['Baking', 'In Production', 'Cooling'].includes(o.order_status || o.status)).length,
          note: 'Active on deck oven'
        },
        {
          icon: PackageCheck,
          label: 'Packed today',
          value: orders.filter(o => ['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered'].includes(o.order_status || o.status)).length,
          note: 'Sealed & ready for handover'
        },
        {
          icon: Layers,
          label: 'Floor batches',
          value: batches.length,
          note: 'Active production batches'
        }
      ]} />

      {/* Production Stepper: From Order Accepted -> Recipe Scaled -> Baking -> Product Completed & Packed */}
      <div className="ow-panel" style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {[
          { num: '1', title: 'Order Accepted', desc: 'Owner Approved', active: true, done: true },
          {
            num: '2',
            title: 'Recipe & Ingredients',
            desc: 'Weighed in g / ml',
            active: true,
            done: ['Baking', 'In Production', 'Cooling', 'Product Completed', 'Product Completed & Packed', 'Product Packed', 'Packaging', 'Packaged', 'Completed', 'Delivered'].includes(currentStatus)
          },
          {
            num: '3',
            title: 'Baking',
            desc: 'In Oven',
            active: ['Baking', 'In Production', 'Cooling'].includes(currentStatus),
            done: ['Product Completed', 'Product Completed & Packed', 'Product Packed', 'Packaging', 'Packaged', 'Completed', 'Delivered'].includes(currentStatus)
          },
          {
            num: '4',
            title: 'Product Completed & Packed',
            desc: 'Boxed & Ready',
            active: ['Product Completed', 'Product Completed & Packed', 'Product Packed', 'Packaging', 'Packaged'].includes(currentStatus),
            done: ['Product Completed & Packed', 'Product Packed', 'Packaging', 'Packaged', 'Completed', 'Delivered'].includes(currentStatus)
          }
        ].map((step, sIdx) => (
          <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: step.done ? '#226344' : step.active ? 'var(--ow-accent, #ad642e)' : '#e8e0d7',
              color: step.done || step.active ? '#FFFFFF' : '#86766a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700
            }}>
              {step.done ? <Check size={14} /> : step.num}
            </div>
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: step.active ? 'var(--ow-ink, #30251f)' : 'var(--ow-muted, #86766a)'
              }}>
                {step.title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ow-muted, #86766a)' }}>
                {step.desc}
              </div>
            </div>
            {sIdx < 3 && <ArrowRight size={13} color="#d6c7b7" style={{ marginLeft: '8px' }} />}
          </div>
        ))}
      </div>

      {/* Main Grid: Left Selector List & Right Full Station Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 2.8fr)', gap: '20px' }}>
        
        {/* Left Column: Orders / Batches Queue Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ow-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {activeSourceType === 'ORDERS' ? 'Received Orders Queue' : 'Production Batches Queue'}
            </span>
            <button
              onClick={loadData}
              className="ow-button ow-button-light"
              title="Refresh queue"
              style={{ minHeight: '28px', padding: '4px 10px', fontSize: '11px' }}
            >
              <RefreshCw size={12} className={loading ? 'ow-spinning' : ''} />
              <span>Sync</span>
            </button>
          </div>

          {activeSourceType === 'ORDERS' ? (
            /* Orders Queue Cards */
            <>
              {/* Queue Filter Tabs & Daily Purge Notice */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setOrderQueueFilter('ACTIVE')}
                    className={`ow-button ${orderQueueFilter === 'ACTIVE' ? 'ow-button-primary' : 'ow-button-light'}`}
                    style={{ padding: '6px 12px', minHeight: '30px', fontSize: '11px' }}
                  >
                    Active to Bake ({orders.filter(o => !['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered'].includes(o.order_status || o.status)).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderQueueFilter('ALL')}
                    className={`ow-button ${orderQueueFilter === 'ALL' ? 'ow-button-primary' : 'ow-button-light'}`}
                    style={{ padding: '6px 12px', minHeight: '30px', fontSize: '11px' }}
                  >
                    All Today ({orders.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderQueueFilter('COMPLETED')}
                    className={`ow-button ${orderQueueFilter === 'COMPLETED' ? 'ow-button-primary' : 'ow-button-light'}`}
                    style={{ padding: '6px 12px', minHeight: '30px', fontSize: '11px' }}
                  >
                    Today's Packed ({orders.filter(o => ['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered'].includes(o.order_status || o.status)).length})
                  </button>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--ow-muted)', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>🛡️ Completed orders auto-cleared daily</span>
                </div>
              </div>

              {(() => {
                const displayedOrders = orders.filter(ord => {
                  const st = ord.order_status || ord.status || '';
                  const isPacked = ['Packaging', 'Packaged', 'Packed', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered'].includes(st);
                  if (orderQueueFilter === 'ACTIVE') return !isPacked;
                  if (orderQueueFilter === 'COMPLETED') return isPacked;
                  return true;
                });

                if (displayedOrders.length === 0) {
                  return (
                    <div style={{ backgroundColor: '#FFFFFF', padding: '30px 16px', borderRadius: '12px', border: '1px dashed #EFE6DC', textAlign: 'center', color: '#8E7C72' }}>
                      <ShoppingBag size={24} style={{ margin: '0 auto 8px', color: '#C25E00' }} />
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#2E221D' }}>
                        {orderQueueFilter === 'ACTIVE' ? 'No active orders awaiting baking' : 'No orders in this queue filter'}
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        {orderQueueFilter === 'ACTIVE' ? 'All received orders have been completed and packed!' : 'Select "All Today" or "Active to Bake".'}
                      </div>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '2px' }}>
                    {displayedOrders.map(ord => {
                  const isSelected = activeOrder && String(activeOrder.id) === String(ord.id);
                  const status = ord.order_status || ord.status || 'Accepted';
                  const orderItems = ord.items || [];
                  const itemsCount = orderItems.reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 1), 0);

                  return (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrder(ord);
                        setSelectedItemIndex(0);
                        setShowAggregateRawMaterials(false);
                      }}
                      className="ow-panel"
                      style={{
                        padding: '14px 16px',
                        borderColor: isSelected ? 'var(--ow-accent, #ad642e)' : 'var(--ow-line, #e8e0d7)',
                        boxShadow: isSelected ? '0 4px 14px rgba(173, 100, 46, 0.12)' : 'none',
                        backgroundColor: isSelected ? '#fffdfb' : 'var(--ow-paper, #fffefa)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="ow-order-id" style={{ fontWeight: 700, fontSize: '13px' }}>
                          #{ord.order_no || ord.id}
                        </span>
                        <span className={`ow-badge ow-badge-${
                          ['Baking', 'In Production'].includes(status)
                            ? 'amber'
                            : ['Packaging', 'Packaged', 'Product Packed', 'Product Completed & Packed', 'Completed'].includes(status)
                            ? 'success'
                            : 'neutral'
                        }`}>
                          <span />
                          {['Packaging', 'Packaged', 'Product Packed', 'Product Completed & Packed'].includes(status)
                            ? 'Product Completed & Packed'
                            : status}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--ow-muted)' }}>
                        Customer: <strong style={{ color: 'var(--ow-ink)' }}>{ord.guest_name || ord.customer_name || 'Guest Customer'}</strong>
                        {ord.table_tag && ` • (${ord.table_tag})`}
                      </div>

                      {/* Products Scheduled One by One from this Received Order */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px', borderTop: '1px solid var(--ow-line-subtle, #f0eae1)', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ow-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} style={{ color: 'var(--ow-accent)' }} /> Scheduled Products ({orderItems.length}):
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--ow-muted)' }}>
                            Click product for recipe
                          </span>
                        </div>

                        {orderItems.map((it, itIdx) => {
                          const isThisItemSelected = isSelected && selectedItemIndex === itIdx && !showAggregateRawMaterials;
                          const itName = it.product_name || it.name || 'Artisanal Baked Item';
                          const itQty = it.quantity || 1;
                          const isDone = Boolean(completedOrderItems[`${ord.id}-item-${itIdx}`]) || ['Product Completed & Packed', 'Completed'].includes(status);

                          return (
                            <div
                              key={itIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(ord);
                                setSelectedItemIndex(itIdx);
                                setShowAggregateRawMaterials(false);
                              }}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 9px',
                                borderRadius: '6px',
                                backgroundColor: isThisItemSelected ? 'var(--ow-wash, #f5f0e9)' : isDone ? '#edf3eb' : 'transparent',
                                border: isThisItemSelected ? '1px solid var(--ow-accent, #ad642e)' : isDone ? '1px solid #c6e6d4' : '1px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              title={`Schedule & view recipe for ${itName}`}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: isDone ? '#226344' : isThisItemSelected ? 'var(--ow-accent, #ad642e)' : 'var(--ow-muted, #86766a)',
                                  flexShrink: 0
                                }} />
                                <span style={{
                                  fontWeight: isThisItemSelected ? 600 : 500,
                                  fontSize: '12px',
                                  color: isThisItemSelected ? 'var(--ow-accent, #ad642e)' : 'var(--ow-ink, #30251f)',
                                  whiteSpace: 'nowrap',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden'
                                }}>
                                  {itName}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--ow-muted)', fontWeight: 600, flexShrink: 0 }}>
                                  ×{itQty}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <span className={`ow-badge ow-badge-${isDone ? 'success' : isThisItemSelected ? 'amber' : 'neutral'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                                  <span />
                                  {isDone ? 'Packed' : isThisItemSelected ? 'In Recipe' : 'Scheduled'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
            </>
          ) : (
            /* Batches Queue Cards */
            batches.length === 0 ? (
              <div className="ow-panel" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ow-muted)' }}>
                <Layers size={24} style={{ margin: '0 auto 8px', color: 'var(--ow-accent)' }} />
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ow-ink)' }}>No scheduled batches</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '2px' }}>
                {batches.map(batch => {
                  const isSelected = selectedBatch && String(selectedBatch.id) === String(batch.id);
                  return (
                    <div
                      key={batch.id}
                      onClick={() => setSelectedBatch(batch)}
                      className="ow-panel"
                      style={{
                        padding: '14px 16px',
                        borderColor: isSelected ? 'var(--ow-accent, #ad642e)' : 'var(--ow-line, #e8e0d7)',
                        boxShadow: isSelected ? '0 4px 14px rgba(173, 100, 46, 0.12)' : 'none',
                        backgroundColor: isSelected ? '#fffdfb' : 'var(--ow-paper, #fffefa)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="ow-order-id" style={{ fontWeight: 700, fontSize: '13px' }}>
                          #{batch.batch_no || batch.batch_code}
                        </span>
                        <span className={`ow-badge ow-badge-${
                          ['In Production', 'Baking'].includes(batch.status) ? 'amber' : batch.status === 'Completed' ? 'success' : 'neutral'
                        }`}>
                          <span />
                          {batch.status}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ow-ink)' }}>
                        {batch.product_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--ow-muted)' }}>
                        Planned: <strong>{batch.planned_quantity} pcs</strong> • Done: <strong>{batch.completed_quantity || 0} pcs</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Master Recipe Method & Production SOP Card (Positioned directly below Order/Batch Queue for instant visibility) */}
          <div id="station-sop" className="ow-panel" style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ChefHat size={17} style={{ color: 'var(--ow-accent)' }} />
                <h3 style={{ fontFamily: 'var(--ow-serif, Georgia, serif)', fontSize: '16px', fontWeight: 600, color: 'var(--ow-ink, #30251f)', margin: 0 }}>
                  Master Recipe Method &amp; Production SOP — {activeItemName}
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--ow-muted)' }}>Baking sequence to packaging reference</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sopStepsList.map((step, idx) => {
                const cleanStep = step.replace(/^\d+[\.\)]\s*/, '').trim();
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--ow-wash, #f5f0e9)',
                      border: '1px solid var(--ow-line, #e8e0d7)'
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--ow-accent, #ad642e)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: '1px'
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      lineHeight: 1.45,
                      color: 'var(--ow-ink, #30251f)',
                      fontWeight: 400
                    }}>
                      {cleanStep}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Active Order Recipe, Ingredients in g/ml, & Station Timer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Active Work Order Banner & Product Detail Card (Owner UI Module Structure) */}
          <div className="ow-panel">
            {/* Header with Eyebrow, Customer Metadata, and Single StatusBadge */}
            <div className="ow-section-header">
              <div>
                <div className="ow-eyebrow" style={{ marginBottom: '2px' }}>
                  {activeSourceType === 'ORDERS' ? 'Live Customer Order' : 'Scheduled Production Batch'} • #{activeSourceType === 'ORDERS' ? (activeOrder?.order_no || activeOrder?.id || 'ORD-4112') : (activeBatch?.batch_no || activeBatch?.batch_code || '101')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ow-muted)', flexWrap: 'wrap' }}>
                  {activeSourceType === 'ORDERS' && (activeOrder?.customer_name || activeOrder?.guest_name) && (
                    <span style={{ fontWeight: 600, color: 'var(--ow-ink)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} style={{ color: 'var(--ow-accent)' }} />
                      {activeOrder.customer_name || activeOrder.guest_name}
                    </span>
                  )}
                  {activeSourceType === 'BATCHES' && (
                    (activeBatch?.is_internal_production || !activeBatch?.customer_name) ? (
                      <span style={{ fontWeight: 600, color: '#475569', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                        Internal Production (Buffer / Shelf Stock)
                      </span>
                    ) : (
                      <span style={{ fontWeight: 600, color: 'var(--ow-ink)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <User size={13} style={{ color: 'var(--ow-accent)' }} />
                        {activeBatch.customer_name}
                      </span>
                    )
                  )}
                  <span>•</span>
                  <span>Owner Accepted &amp; Scheduled</span>
                  {activeOrder?.order_type && (
                    <>
                      <span>•</span>
                      <span style={{ textTransform: 'capitalize' }}>{activeOrder.order_type.replace('_', ' ')}</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge value={['Packaging', 'Packaged', 'Product Packed', 'Product Completed & Packed'].includes(currentStatus) ? 'Product Completed & Packed' : currentStatus} />
              </div>
            </div>

            {/* Card Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{
                    fontFamily: 'var(--ow-serif, Georgia, serif)',
                    fontSize: '24px',
                    fontWeight: 400,
                    color: 'var(--ow-ink, #30251f)',
                    margin: 0,
                    letterSpacing: '-0.3px',
                    lineHeight: 1.25
                  }}>
                    {activeItemName}
                  </h2>
                  {activeOrder?.special_instructions && (
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--ow-accent)', fontStyle: 'italic' }}>
                      Note: "{activeOrder.special_instructions}"
                    </p>
                  )}
                </div>

                {/* Structured Micro-Stat Stat Box */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'var(--ow-wash, #f5f0e9)',
                  border: '1px solid var(--ow-line, #e8e0d7)',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '8px 14px', borderRight: '1px solid var(--ow-line, #e8e0d7)' }}>
                    <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ow-muted)', fontWeight: 600 }}>Quantity</span>
                    <strong style={{ fontSize: '14px', color: 'var(--ow-ink)' }}>{activeItemQty} units</strong>
                  </div>
                  <div style={{ padding: '8px 14px', borderRight: '1px solid var(--ow-line, #e8e0d7)' }}>
                    <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ow-muted)', fontWeight: 600 }}>Base Yield</span>
                    <strong style={{ fontSize: '14px', color: 'var(--ow-ink)' }}>{baseYield} pcs</strong>
                  </div>
                  <div style={{ padding: '8px 14px' }}>
                    <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ow-muted)', fontWeight: 600 }}>Scale Factor</span>
                    <strong style={{ fontSize: '14px', color: 'var(--ow-accent)' }}>{scaleMultiplier}×</strong>
                  </div>
                </div>
              </div>

              {/* Order Items Tabs (Rendered cleanly when there are items) */}
              {activeSourceType === 'ORDERS' && selectedOrder?.items && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: 'var(--ow-wash, #f5f0e9)',
                  borderRadius: '8px',
                  border: '1px solid var(--ow-line, #e8e0d7)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ow-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Items ({selectedOrder.items.length}):
                    </span>
                    {selectedOrder.items.map((it, idx) => {
                      const isSelected = selectedItemIndex === idx && !showAggregateRawMaterials;
                      const itName = it.product_name || it.name || `Item #${idx + 1}`;
                      const isDone = Boolean(completedOrderItems[`${selectedOrder.id}-item-${idx}`]) || ['Packaging', 'Packaged', 'Product Packed', 'Product Completed & Packed', 'Completed'].includes(currentStatus);

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedItemIndex(idx);
                            setShowAggregateRawMaterials(false);
                          }}
                          className={`ow-button ${isSelected ? 'ow-button-primary' : 'ow-button-light'}`}
                          style={{
                            minHeight: '28px',
                            padding: '4px 10px',
                            fontSize: '11px'
                          }}
                        >
                          <span>{itName} (×{it.quantity})</span>
                          {isDone && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAggregateRawMaterials(!showAggregateRawMaterials)}
                    className={`ow-button ${showAggregateRawMaterials ? 'ow-button-primary' : 'ow-button-light'}`}
                    style={{ minHeight: '28px', padding: '4px 10px', fontSize: '11px' }}
                  >
                    <Scale size={12} />
                    <span>{showAggregateRawMaterials ? 'Item Recipe Steps' : 'All Items Aggregate'}</span>
                  </button>
                </div>
              )}

              {/* Action Toolbar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                borderTop: '1px solid var(--ow-line-subtle, #f0eae1)',
                paddingTop: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--ow-muted)' }}>Floor Action:</span>
                </div>

                <div className="ow-actions">
                  {['Accepted', 'Preparation', 'Proofing', 'Order Placed'].includes(currentStatus) && (
                    <button
                      type="button"
                      onClick={handleStartBaking}
                      disabled={submitting}
                      className="ow-button ow-button-primary"
                    >
                      <Flame size={15} />
                      <span>{submitting ? 'Updating...' : 'Move to Baking (Deck Oven)'}</span>
                    </button>
                  )}

                  {['Baking', 'In Production', 'Cooling'].includes(currentStatus) && (
                    <>
                      <button
                        type="button"
                        onClick={handleMarkProductCompleted}
                        disabled={submitting}
                        className="ow-button"
                        style={{
                          backgroundColor: '#fffbeb',
                          borderColor: '#fde68a',
                          color: '#92400e'
                        }}
                      >
                        <Check size={15} />
                        <span>{submitting ? 'Updating...' : 'Mark Bake Completed'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleMarkProductPacked}
                        disabled={submitting}
                        className="ow-button ow-button-primary"
                      >
                        <PackageCheck size={16} />
                        <span>{submitting ? 'Updating...' : 'Product Completed & Packed'}</span>
                      </button>
                    </>
                  )}

                  {currentStatus === 'Product Completed' && (
                    <>
                      <span className="ow-badge ow-badge-amber">Baking Completed</span>
                      <button
                        type="button"
                        onClick={handleMarkProductPacked}
                        disabled={submitting}
                        className="ow-button ow-button-primary"
                      >
                        <PackageCheck size={16} />
                        <span>{submitting ? 'Updating...' : 'Pack Product (Product Completed & Packed)'}</span>
                      </button>
                    </>
                  )}

                  {['Packaging', 'Packaged', 'Product Packed', 'Product Completed & Packed', 'Completed', 'Delivered'].includes(currentStatus) && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#edf3eb',
                      border: '1px solid #c6e6d4',
                      borderRadius: '6px',
                      padding: '7px 14px',
                      color: '#164e32',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      <CheckCircle2 size={15} style={{ color: '#226344' }} />
                      <span>Product Completed &amp; Packed — Ready for Handover</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {showAggregateRawMaterials ? (
            /* ================= ALL ITEMS CONSOLIDATED RAW MATERIALS VIEW ================= */
            <div className="ow-panel" style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--ow-wash, #f5f0e9)',
                    color: 'var(--ow-accent, #ad642e)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Scale size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--ow-serif, Georgia, serif)', fontSize: '18px', fontWeight: 500, color: 'var(--ow-ink, #30251f)', margin: 0 }}>
                      All Items — Total Consolidated Raw Materials
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--ow-muted, #86766a)', marginTop: '2px' }}>
                      Summed across all {selectedOrder?.items?.length || 0} items for Order #{selectedOrder?.order_no || selectedOrder?.id}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowReplenishModal(true)}
                    className="ow-button"
                    style={{
                      minHeight: '34px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      backgroundColor: '#fffbeb',
                      borderColor: '#fde68a',
                      color: '#92400e'
                    }}
                  >
                    <ShieldCheck size={14} />
                    <span>Request Replenishment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAggregateRawMaterials(false)}
                    className="ow-button ow-button-primary"
                    style={{
                      minHeight: '34px',
                      padding: '6px 14px',
                      fontSize: '12px'
                    }}
                  >
                    ← Back to Item Steps
                  </button>
                </div>
              </div>

              {aggregateRawMaterials.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--ow-muted)' }}>
                  No recipe materials mapped for items in this order.
                </div>
              ) : (
                <div className="ow-table-wrap">
                  <table className="ow-table">
                    <thead>
                      <tr>
                        <th>Raw Material</th>
                        <th>Source Items</th>
                        <th style={{ color: 'var(--ow-accent)' }}>Total Required (Order)</th>
                        <th>Unit Type</th>
                        <th>Current Floor Stock</th>
                        <th style={{ textAlign: 'right' }}>Stock Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregateRawMaterials.map((mat, mIdx) => {
                        const fmt = formatKitchenMeasurement(mat.quantity, mat.unit);
                        const normalizedStock = normalizeStockToUnit(mat.current_stock, mat.stock_unit, mat.unit);
                        const isShort = normalizedStock !== null && normalizedStock < mat.quantity;
                        const isLiquid = Boolean(mat.is_liquid || ['ml', 'l', 'liter', 'litres', 'milliliters'].includes((mat.unit || '').toLowerCase()) || ['l', 'ml'].includes((mat.stock_unit || '').toLowerCase()));
                        const isCount = ['pcs', 'pc', 'piece', 'pieces', 'nos', 'unit', 'units'].includes((mat.unit || '').toLowerCase()) || ['pcs', 'pc', 'piece', 'pieces'].includes((mat.stock_unit || '').toLowerCase());

                        return (
                          <tr key={mIdx} style={{ backgroundColor: isShort ? '#fcf0eb' : 'transparent' }}>
                            <td style={{ fontWeight: 600, color: 'var(--ow-ink)' }}>
                              {mat.name}
                            </td>
                            <td style={{ color: 'var(--ow-muted)', fontSize: '12px' }}>
                              {mat.product_sources.join(' + ')}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--ow-accent)', fontSize: '13px' }}>
                              {fmt.main} {fmt.sub && <span style={{ fontSize: '11px', color: 'var(--ow-muted)', fontWeight: 400 }}>{fmt.sub}</span>}
                            </td>
                            <td>
                              <span className="ow-badge ow-badge-neutral" style={{ fontSize: '11px' }}>
                                {isLiquid ? '💧 Liquid (ml)' : isCount ? '🔢 Count (pcs)' : '⚖️ Solid (g)'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 500, color: isShort ? '#9c4641' : 'var(--ow-ink)' }}>
                              {mat.current_stock !== null ? `${mat.current_stock} ${mat.stock_unit}` : '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isShort ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (mat.raw_material_id) setRepMaterialId(String(mat.raw_material_id));
                                    setShowReplenishModal(true);
                                  }}
                                  className="ow-badge ow-badge-danger"
                                  style={{ cursor: 'pointer', border: 'none' }}
                                  title="Click to ask for replenishment"
                                >
                                  ⚠️ Shortage
                                </button>
                              ) : (
                                <span className="ow-badge ow-badge-success">
                                  <span /> In Stock
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* INGREDIENTS REQUIRED TABLE: Reference table without checkboxes */}
              <div className="ow-panel" style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {/* Header with Title, Formula Pill, and Request Replenishment Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--ow-wash, #f5f0e9)',
                      color: 'var(--ow-accent, #ad642e)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Scale size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontFamily: 'var(--ow-serif, Georgia, serif)', fontSize: '18px', fontWeight: 500, color: 'var(--ow-ink, #30251f)', margin: 0 }}>
                          Ingredients Required — {activeItemName}
                        </h3>
                        <span className="ow-badge ow-badge-accent" style={{ fontSize: '11px', fontWeight: 600 }}>
                          Formula: {activeItemQty} units ({scaleMultiplier}x batch)
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--ow-muted, #86766a)', margin: '4px 0 0' }}>
                        Precision measurements for bakery kitchen scale. Solids measured in grams (g), liquids in milliliters (ml).
                      </p>
                    </div>
                  </div>

                  {/* Ask for raw materials button */}
                  <button
                    type="button"
                    onClick={() => setShowReplenishModal(true)}
                    className="ow-button"
                    style={{
                      minHeight: '34px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      backgroundColor: '#fffbeb',
                      borderColor: '#fde68a',
                      color: '#92400e'
                    }}
                  >
                    <ShieldCheck size={14} />
                    <span>Request Replenishment</span>
                  </button>
                </div>

                {/* Table of ingredients with NO checkboxes */}
                <div className="ow-table-wrap">
                  <table className="ow-table">
                    <thead>
                      <tr>
                        <th>Ingredient Name</th>
                        <th>Per Batch (Base)</th>
                        <th style={{ color: 'var(--ow-accent)' }}>Quantity for this Order ({scaleMultiplier}x)</th>
                        <th>Kitchen Unit</th>
                        <th style={{ textAlign: 'right' }}>Floor Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(matchedRecipe.ingredients || []).map((ing, idx) => {
                        const scaledQty = parseFloat((Number(ing.quantity) * scaleMultiplier).toFixed(1));
                        const fmtBase = formatKitchenMeasurement(ing.quantity, ing.unit);
                        const fmtScaled = formatKitchenMeasurement(scaledQty, ing.unit);

                        const matchedStock = rawMaterials.find(m =>
                          String(m.id) === String(ing.raw_material_id || ing.id) ||
                          m.name?.toLowerCase() === ing.name?.toLowerCase()
                        );
                        const normalizedStock = matchedStock
                          ? normalizeStockToUnit(matchedStock.current_stock, matchedStock.unit, ing.unit)
                          : null;
                        const isShort = normalizedStock !== null && normalizedStock < scaledQty;

                        const isLiquid = Boolean(ing.is_liquid || ['ml', 'l', 'liter', 'litres', 'milliliters'].includes((ing.unit || '').toLowerCase()) || (matchedStock && ['l', 'ml'].includes((matchedStock.unit || '').toLowerCase())));
                        const isCount = ['pcs', 'pc', 'piece', 'pieces', 'nos', 'unit', 'units'].includes((ing.unit || '').toLowerCase()) || (matchedStock && ['pcs', 'pc', 'piece', 'pieces'].includes((matchedStock.unit || '').toLowerCase()));

                        return (
                          <tr key={idx} style={{ backgroundColor: isShort ? '#fcf0eb' : 'transparent' }}>
                            <td style={{ fontWeight: 600, color: 'var(--ow-ink)' }}>
                              {ing.name}
                            </td>
                            <td style={{ color: 'var(--ow-muted)', fontSize: '12px' }}>
                              {fmtBase.main}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--ow-accent)', fontSize: '13px' }}>
                              {fmtScaled.main}
                            </td>
                            <td>
                              <span className="ow-badge ow-badge-neutral" style={{ fontSize: '11px' }}>
                                {isLiquid ? '💧 Liquid (ml)' : isCount ? '🔢 Count (pcs)' : '⚖️ Solid (g)'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isShort ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (ing.raw_material_id) setRepMaterialId(String(ing.raw_material_id));
                                    setShowReplenishModal(true);
                                  }}
                                  className="ow-badge ow-badge-danger"
                                  style={{ cursor: 'pointer', border: 'none' }}
                                  title="Click to ask for replenishment"
                                >
                                  ⚠️ Shortage
                                </button>
                              ) : (
                                <span className="ow-badge ow-badge-success">
                                  <span /> Available
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Ingredients Verification Action Bar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--ow-line-subtle, #f0eae1)',
                  fontSize: '12px',
                  color: 'var(--ow-muted)',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <span>⚖️ Calibrated kitchen scale. All ingredient measurements scaled to active order quantity.</span>
                  <button
                    type="button"
                    onClick={() => setShowReplenishModal(true)}
                    className="ow-button ow-button-light"
                    style={{ minHeight: '30px', padding: '4px 10px', fontSize: '11px' }}
                  >
                    <ShieldCheck size={13} />
                    <span>Report Floor Shortage</span>
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ===================== MODAL: CONDUCT QC CHECK (Owner UI Dialog) ===================== */}
      {modalMode === 'QC' && (
        <Dialog
          title="Quality Inspection & Crust Check"
          description="Confirm internal bake core temperature, crumb structure, and crust golden score."
          onClose={() => setModalMode(null)}
          footer={
            <>
              <button className="ow-button" type="button" onClick={() => setModalMode(null)}>Cancel</button>
              <button
                type="submit"
                form="qc-inspection-form"
                disabled={submitting}
                className="ow-button ow-button-primary"
              >
                {submitting ? 'Saving...' : 'Confirm QC & Advance to Packaging'}
              </button>
            </>
          }
        >
          <form id="qc-inspection-form" className="ow-form" onSubmit={(e) => { e.preventDefault(); handleSubmitQC(); }}>
            <label className="ow-field">
              Inspection Result
              <select value={qcResult} onChange={(e) => setQcResult(e.target.value)}>
                <option value="PASSED">✓ PASSED (Ready for Packaging)</option>
                <option value="FAILED">✕ FAILED / REJECTED (Move to Wastage)</option>
              </select>
            </label>

            <div className="ow-form-grid">
              <label className="ow-field">
                Core Temp (°C)
                <input
                  type="number"
                  step="0.1"
                  value={qcInternalTemp}
                  onChange={(e) => setQcInternalTemp(e.target.value)}
                />
              </label>
              <label className="ow-field">
                Crust Score
                <select value={qcCrustScore} onChange={(e) => setQcCrustScore(e.target.value)}>
                  <option value="Excellent">Golden Brown / Excellent</option>
                  <option value="Good">Satisfactory</option>
                  <option value="Pale">Pale / Needs Color</option>
                  <option value="Dark">Over-caramelized</option>
                </select>
              </label>
            </div>

            <label className="ow-field">
              QA Observations & Notes
              <textarea
                rows={2}
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                placeholder="Optional crumb structure and sensory observations"
              />
            </label>
          </form>
        </Dialog>
      )}

      {/* ===================== MODAL: PACKAGING CONFIRMATION (Owner UI Dialog) ===================== */}
      {modalMode === 'PACKAGING' && (
        <Dialog
          title="Final Packaging & Dispatch Seal"
          description="Record boxed item count and apply food-grade quality seal for fulfillment dispatch."
          onClose={() => setModalMode(null)}
          footer={
            <>
              <button className="ow-button" type="button" onClick={() => setModalMode(null)}>Cancel</button>
              <button
                type="submit"
                form="packaging-form"
                disabled={submitting}
                className="ow-button ow-button-primary"
              >
                {submitting ? 'Saving...' : 'Mark Packaged & Ready for Dispatch'}
              </button>
            </>
          }
        >
          <form id="packaging-form" className="ow-form" onSubmit={(e) => { e.preventDefault(); handleSubmitPackaging(); }}>
            <label className="ow-field">
              Packed & Boxed Quantity
              <input
                type="number"
                min="1"
                value={packedQty}
                onChange={(e) => setPackedQty(e.target.value)}
                required
              />
            </label>

            <label className="ow-field">
              Packaging Notes / Box ID
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g. Sealed in biodegradable pastry window box with QR tracker"
              />
            </label>
          </form>
        </Dialog>
      )}

      {/* ===================== MODAL: REPLENISHMENT REQUEST (Owner UI Dialog) ===================== */}
      {showReplenishModal && (
        <Dialog
          title="Floor Stock Replenishment Request"
          description="Submit a formal raw ingredient requisition for owner review. Bakers cannot silently override stock availability."
          onClose={() => setShowReplenishModal(false)}
          footer={
            <>
              <button className="ow-button" type="button" onClick={() => setShowReplenishModal(false)}>Cancel</button>
              <button
                type="submit"
                form="replenish-form"
                disabled={isSubmittingReplenish}
                className="ow-button ow-button-primary"
              >
                {isSubmittingReplenish ? 'Submitting...' : 'Submit to Owner Review'}
              </button>
            </>
          }
        >
          <form id="replenish-form" className="ow-form" onSubmit={handleReplenishmentSubmit}>
            <label className="ow-field">
              Select Raw Ingredient
              <select
                value={repMaterialId}
                onChange={(e) => setRepMaterialId(e.target.value)}
                required
              >
                {rawMaterials.map(mat => (
                  <option key={mat.id} value={mat.id}>
                    {mat.name} (Current Stock: {mat.current_stock} {mat.unit})
                  </option>
                ))}
              </select>
            </label>

            <label className="ow-field">
              Requested Quantity
              <input
                type="number"
                step="any"
                min="0.1"
                value={repQuantity}
                onChange={(e) => setRepQuantity(e.target.value)}
                required
              />
            </label>

            <label className="ow-field">
              Reason / Floor Notes
              <textarea
                rows={2}
                value={repNotes}
                onChange={(e) => setRepNotes(e.target.value)}
                placeholder="E.g. Deck oven station requires additional butter for afternoon croissant bake"
              />
            </label>
          </form>
        </Dialog>
      )}

    </div>
  );
};

export default StaffProductionStationPage;
