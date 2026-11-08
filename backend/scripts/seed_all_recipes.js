const db = require('../src/config/sqliteDb');

const run = () => {
  console.log('[Recipe Seeder] Starting synchronization of all 23 products...');

  // 1. Raw Materials
  const rawMaterials = [
    { id: 1, name: 'Organic French T65 Wheat Flour', category: 'Key Flours & Powders', unit: 'kg', current_stock: 120.0, min_reorder_level: 50.0, cost_per_unit: 45.0 },
    { id: 2, name: 'Whole Wheat Stone-Ground Flour', category: 'Key Flours & Powders', unit: 'kg', current_stock: 80.0, min_reorder_level: 30.0, cost_per_unit: 48.0 },
    { id: 3, name: 'Unsalted Normandy Butter 84%', category: 'Dairy & Fats', unit: 'kg', current_stock: 45.0, min_reorder_level: 20.0, cost_per_unit: 440.0 },
    { id: 4, name: 'Callebaut 70.5% Belgian Dark Chocolate', category: 'Chocolates & Cocoa', unit: 'kg', current_stock: 25.0, min_reorder_level: 10.0, cost_per_unit: 780.0 },
    { id: 5, name: 'Active Sourdough Starter Culture', category: 'Leavening & Additives', unit: 'kg', current_stock: 15.0, min_reorder_level: 5.0, cost_per_unit: 60.0 },
    { id: 6, name: 'Fresh Compressed Baker Yeast', category: 'Leavening & Additives', unit: 'kg', current_stock: 8.0, min_reorder_level: 4.0, cost_per_unit: 340.0 },
    { id: 7, name: 'Refined Fine Cane Sugar', category: 'Sweeteners', unit: 'kg', current_stock: 60.0, min_reorder_level: 25.0, cost_per_unit: 44.0 },
    { id: 8, name: 'Madagascar Bourbon Vanilla Extract', category: 'Spices & Flavors', unit: 'L', current_stock: 5.0, min_reorder_level: 2.0, cost_per_unit: 4200.0 },
    { id: 9, name: 'Guerande Grey Sea Salt', category: 'Spices & Flavors', unit: 'kg', current_stock: 22.0, min_reorder_level: 8.0, cost_per_unit: 180.0 },
    { id: 10, name: 'Farm Fresh Organic Eggs', category: 'Dairy & Fats', unit: 'pcs', current_stock: 200.0, min_reorder_level: 60.0, cost_per_unit: 7.5 },
    { id: 11, name: 'Full Cream Milk (A2 Farm Fresh)', category: 'Dairy & Fats', unit: 'L', current_stock: 40.0, min_reorder_level: 15.0, cost_per_unit: 65.0 },
    { id: 12, name: 'Crushed Ceylon Cinnamon Bark', category: 'Spices & Flavors', unit: 'kg', current_stock: 4.0, min_reorder_level: 1.5, cost_per_unit: 650.0 },
    { id: 13, name: 'Philadelphia Cream Cheese', category: 'Dairy & Fats', unit: 'kg', current_stock: 25.0, min_reorder_level: 5.0, cost_per_unit: 850.0 },
    { id: 14, name: 'Fresh Alphonso Mango Pulp', category: 'Fruits & Fillings', unit: 'kg', current_stock: 35.0, min_reorder_level: 10.0, cost_per_unit: 220.0 },
    { id: 15, name: 'Pure Cow Ghee', category: 'Dairy & Fats', unit: 'kg', current_stock: 40.0, min_reorder_level: 10.0, cost_per_unit: 580.0 },
    { id: 16, name: 'Spiced Potato Masala Mix', category: 'Savory Fillings', unit: 'kg', current_stock: 25.0, min_reorder_level: 10.0, cost_per_unit: 90.0 },
    { id: 17, name: 'Fresh Paneer Tikka Filling', category: 'Savory Fillings', unit: 'kg', current_stock: 18.0, min_reorder_level: 6.0, cost_per_unit: 320.0 },
    { id: 18, name: 'Fresh Button Mushrooms', category: 'Savory Fillings', unit: 'kg', current_stock: 15.0, min_reorder_level: 5.0, cost_per_unit: 200.0 },
    { id: 19, name: 'Fresh Green Cardamom (Elaichi)', category: 'Spices & Flavors', unit: 'kg', current_stock: 3.0, min_reorder_level: 1.0, cost_per_unit: 2800.0 },
    { id: 20, name: 'Kashmiri Walnut Halves', category: 'Nuts & Seeds', unit: 'kg', current_stock: 14.0, min_reorder_level: 4.0, cost_per_unit: 950.0 },
    { id: 21, name: 'Fresh Mawa / Khoya', category: 'Dairy & Fats', unit: 'kg', current_stock: 20.0, min_reorder_level: 5.0, cost_per_unit: 360.0 },
    { id: 22, name: 'Almond Flour (Extra Fine)', category: 'Key Flours & Powders', unit: 'kg', current_stock: 12.0, min_reorder_level: 4.0, cost_per_unit: 980.0 },
    { id: 23, name: 'Fresh Blueberries', category: 'Fruits & Fillings', unit: 'kg', current_stock: 8.0, min_reorder_level: 3.0, cost_per_unit: 1200.0 },
    { id: 24, name: 'Single Origin Cold Brew Coffee', category: 'Cold Brews & Beverages', unit: 'L', current_stock: 30.0, min_reorder_level: 10.0, cost_per_unit: 180.0 },
    { id: 25, name: 'Assam CTC Whole Leaf Tea', category: 'Cold Brews & Beverages', unit: 'kg', current_stock: 20.0, min_reorder_level: 5.0, cost_per_unit: 420.0 },
    { id: 26, name: 'Heavy Whipping Cream 35%', category: 'Dairy & Fats', unit: 'L', current_stock: 45.0, min_reorder_level: 15.0, cost_per_unit: 240.0 },
    { id: 27, name: 'Dutch-Processed Cocoa Powder', category: 'Chocolates & Cocoa', unit: 'kg', current_stock: 15.0, min_reorder_level: 5.0, cost_per_unit: 380.0 },
    { id: 28, name: 'Extra Virgin Olive Oil', category: 'Dairy & Fats', unit: 'L', current_stock: 25.0, min_reorder_level: 8.0, cost_per_unit: 720.0 },
    { id: 29, name: 'Kalamata Olives & Fresh Rosemary', category: 'Savory Fillings', unit: 'kg', current_stock: 10.0, min_reorder_level: 3.0, cost_per_unit: 650.0 },
    { id: 30, name: 'Carom Seeds (Ajwain)', category: 'Spices & Flavors', unit: 'kg', current_stock: 5.0, min_reorder_level: 1.0, cost_per_unit: 350.0 }
  ];

  for (const rm of rawMaterials) {
    const existing = db.query('SELECT id FROM raw_materials WHERE id = $1', [rm.id]);
    if (!existing.rows || existing.rows.length === 0) {
      db.query(
        'INSERT INTO raw_materials (id, business_id, name, category, unit, current_stock, min_reorder_level, cost_per_unit) VALUES ($1, 1, $2, $3, $4, $5, $6, $7)',
        [rm.id, rm.name, rm.category, rm.unit, rm.current_stock, rm.min_reorder_level, rm.cost_per_unit]
      );
    }
  }

  // 2. Clear old recipes & recipe_ingredients to ensure pristine 1-to-1 sync for all 23 products
  db.query('DELETE FROM recipe_ingredients');
  db.query('DELETE FROM recipes');

  // Master definitions for ALL 23 products
  const masterFormulas = [
    {
      id: 1,
      product_id: 1, // San Francisco Sourdough Loaf
      recipe_name: 'San Francisco Sourdough Loaf Master Formula',
      batch_yield_units: 4,
      yield_unit: 'loaves',
      prep_time_mins: 240,
      bake_time_mins: 40,
      oven_temp_c: 235,
      instructions: '1. Autolyse French T65 flour with 78% hydration filtered water for 45 mins.\n2. Inoculate 20% ripe levain starter culture, perform 4 coil folds every 30 mins.\n3. Preshape, bench rest 20 mins, shape into oval banneton proofing baskets.\n4. Retard overnight in cold room at 4°C for 14 hours.\n5. Score with razor lame, bake in deck oven with high steam at 235°C for 20m, vent 20m.\n6. Check internal temp reaches 96°C, cool on wire racks for 2 hours.',
      ingredients: [
        { raw_material_id: 1, quantity: 1800, unit: 'g' }, // T65 Flour
        { raw_material_id: 2, quantity: 200, unit: 'g' },  // Whole Wheat Flour
        { raw_material_id: 5, quantity: 400, unit: 'g' },  // Active Starter
        { raw_material_id: 9, quantity: 44, unit: 'g' }    // Guerande Sea Salt
      ]
    },
    {
      id: 2,
      product_id: 2, // Multigrain Seeded Sourdough
      recipe_name: 'Multigrain Seeded Sourdough Master Formula',
      batch_yield_units: 4,
      yield_unit: 'loaves',
      prep_time_mins: 240,
      bake_time_mins: 42,
      oven_temp_c: 230,
      instructions: '1. Toast pumpkin, sunflower, and flax seeds lightly and soak in hot water for 30m.\n2. Autolyse stoneground whole wheat and T65 flour with starter for 1 hour.\n3. Fold in seed soaker during stretch-and-fold cycle 2 and 3.\n4. Banneton proof at 24°C, roll exterior in roasted sesame seeds.\n5. Deck bake with steam injection at 230°C for 42 minutes.',
      ingredients: [
        { raw_material_id: 1, quantity: 1400, unit: 'g' }, // T65 Flour
        { raw_material_id: 2, quantity: 600, unit: 'g' },  // Whole Wheat
        { raw_material_id: 5, quantity: 400, unit: 'g' },  // Starter
        { raw_material_id: 9, quantity: 45, unit: 'g' }    // Sea Salt
      ]
    },
    {
      id: 3,
      product_id: 3, // French Rustic Baguette
      recipe_name: 'French Rustic Baguette Tradition Formula',
      batch_yield_units: 8,
      yield_unit: 'baguettes',
      prep_time_mins: 150,
      bake_time_mins: 24,
      oven_temp_c: 240,
      instructions: '1. Direct mix T65 flour, fresh yeast, sea salt, and cold water for 8 mins.\n2. Bulk ferment with 2 gentle folds over 2 hours.\n3. Divide into 350g batons, rest 15m, roll into traditional tapered points.\n4. Couche proofing for 45 mins. Score with 5 parallel cuts.\n5. Steam bake on baking stones at 240°C for 22-24 mins until crackling crust.',
      ingredients: [
        { raw_material_id: 1, quantity: 1800, unit: 'g' }, // T65 Flour
        { raw_material_id: 6, quantity: 15, unit: 'g' },   // Fresh Yeast
        { raw_material_id: 9, quantity: 36, unit: 'g' }    // Sea Salt
      ]
    },
    {
      id: 4,
      product_id: 4, // Olive & Rosemary Focaccia
      recipe_name: 'Olive & Rosemary Focaccia Master Sheet',
      batch_yield_units: 6,
      yield_unit: 'portions',
      prep_time_mins: 180,
      bake_time_mins: 28,
      oven_temp_c: 220,
      instructions: '1. Prepare 82% high-hydration dough with extra virgin olive oil.\n2. Pan ferment in olive-oil slicked deep rectangular pans for 3 hours.\n3. Dimple thoroughly with fingers; press Kalamata olives and fresh rosemary sprigs.\n4. Drizzle generous olive oil and sprinkle coarse flaky salt.\n5. Deck bake at 220°C for 28 mins until golden blistered crust.',
      ingredients: [
        { raw_material_id: 1, quantity: 1200, unit: 'g' },  // T65 Flour
        { raw_material_id: 28, quantity: 150, unit: 'ml' }, // Olive Oil
        { raw_material_id: 29, quantity: 200, unit: 'g' },  // Olives & Rosemary
        { raw_material_id: 6, quantity: 12, unit: 'g' },    // Yeast
        { raw_material_id: 9, quantity: 24, unit: 'g' }     // Sea Salt
      ]
    },
    {
      id: 5,
      product_id: 5, // Butter Croissant
      recipe_name: 'Classic French Butter Croissant Formula',
      batch_yield_units: 12,
      yield_unit: 'croissants',
      prep_time_mins: 180,
      bake_time_mins: 22,
      oven_temp_c: 210,
      instructions: '1. Prepare détrempe dough with flour, yeast, milk, and sugar. Chill overnight.\n2. Lock in 84% Normandy butter block; perform 3 single book folds with 30m chilling between turns.\n3. Sheet to 3.5mm, cut precision triangles and roll into tight crescents.\n4. Proof at 26°C (80% humidity) for 90m until visibly jiggly.\n5. Double egg wash and steam bake at 210°C for 22 mins until deep honeycomb golden.',
      ingredients: [
        { raw_material_id: 1, quantity: 500, unit: 'g' },  // T65 Flour
        { raw_material_id: 3, quantity: 250, unit: 'g' },  // Normandy Butter
        { raw_material_id: 11, quantity: 180, unit: 'ml' },// Full Cream Milk
        { raw_material_id: 7, quantity: 45, unit: 'g' },   // Cane Sugar
        { raw_material_id: 6, quantity: 12, unit: 'g' },   // Yeast
        { raw_material_id: 9, quantity: 10, unit: 'g' }    // Sea Salt
      ]
    },
    {
      id: 6,
      product_id: 6, // Pain au Chocolat
      recipe_name: 'Pain au Chocolat Master Formula',
      batch_yield_units: 12,
      yield_unit: 'pastries',
      prep_time_mins: 180,
      bake_time_mins: 22,
      oven_temp_c: 205,
      instructions: '1. Roll laminated croissant dough to 3.5mm thickness.\n2. Cut 8x12cm rectangles, place two Callebaut chocolate batons.\n3. Roll snug, proof at 26°C for 2 hours.\n4. Egg wash twice and bake at 205°C for 22 mins.',
      ingredients: [
        { raw_material_id: 1, quantity: 500, unit: 'g' },  // Flour
        { raw_material_id: 3, quantity: 240, unit: 'g' },  // Butter
        { raw_material_id: 4, quantity: 180, unit: 'g' },  // Chocolate
        { raw_material_id: 11, quantity: 180, unit: 'ml' },// Milk
        { raw_material_id: 7, quantity: 40, unit: 'g' }    // Sugar
      ]
    },
    {
      id: 7,
      product_id: 7, // Almond Frangipane Croissant
      recipe_name: 'Almond Frangipane Croissant Master Formula',
      batch_yield_units: 8,
      yield_unit: 'pastries',
      prep_time_mins: 60,
      bake_time_mins: 18,
      oven_temp_c: 190,
      instructions: '1. Whisk butter, caster sugar, almond flour, and eggs into rich almond frangipane cream.\n2. Slice day-baked croissants horizontally, dip lightly in vanilla bean syrup.\n3. Pipe 40g frangipane inside, sandwich and pipe 20g frangipane on top.\n4. Generously crust with toasted sliced almonds.\n5. Bake at 190°C for 18 mins until almond cream is golden set. Dust with powdered sugar.',
      ingredients: [
        { raw_material_id: 22, quantity: 200, unit: 'g' }, // Almond Flour
        { raw_material_id: 3, quantity: 150, unit: 'g' },  // Butter
        { raw_material_id: 7, quantity: 150, unit: 'g' },  // Sugar
        { raw_material_id: 10, quantity: 2, unit: 'pcs' }, // Eggs
        { raw_material_id: 8, quantity: 10, unit: 'ml' }   // Vanilla
      ]
    },
    {
      id: 8,
      product_id: 8, // Fresh Blueberry Danish
      recipe_name: 'Fresh Blueberry Custard Danish Formula',
      batch_yield_units: 10,
      yield_unit: 'danish',
      prep_time_mins: 90,
      bake_time_mins: 20,
      oven_temp_c: 200,
      instructions: '1. Sheet laminated Danish pastry into 10x10cm squares, fold corners inward.\n2. Pipe 30g vanilla custard into centre recess.\n3. Top with fresh plump blueberries.\n4. Proof 45 mins, egg wash rim, bake at 200°C for 20 mins until crisp.\n5. Brush fruit with warm apricot pectin glaze.',
      ingredients: [
        { raw_material_id: 1, quantity: 400, unit: 'g' },  // Flour
        { raw_material_id: 3, quantity: 200, unit: 'g' },  // Butter
        { raw_material_id: 23, quantity: 200, unit: 'g' }, // Blueberries
        { raw_material_id: 26, quantity: 150, unit: 'ml' },// Cream
        { raw_material_id: 7, quantity: 60, unit: 'g' }    // Sugar
      ]
    },
    {
      id: 9,
      product_id: 9, // Belgian Chocolate Truffle Cake
      recipe_name: '70% Belgian Dark Chocolate Truffle Cake Formula',
      batch_yield_units: 2,
      yield_unit: 'cakes (1kg)',
      prep_time_mins: 60,
      bake_time_mins: 35,
      oven_temp_c: 175,
      instructions: '1. Sift flour, imported cocoa powder, and baking powder.\n2. Melt Belgian chocolate with unsalted butter; fold with sugar, milk, and eggs.\n3. Bake in silicone parchment lined 8-inch cake tins at 175°C for 35 mins.\n4. Cool sponge completely, slice into 3 tiers, fill and mask with warm 70% dark chocolate ganache.\n5. Chill in display cooler at 4°C, seal with gold ribbon cake box.',
      ingredients: [
        { raw_material_id: 1, quantity: 450, unit: 'g' },  // Flour
        { raw_material_id: 4, quantity: 400, unit: 'g' },  // Callebaut Chocolate
        { raw_material_id: 27, quantity: 180, unit: 'g' }, // Cocoa Powder
        { raw_material_id: 3, quantity: 200, unit: 'g' },  // Butter
        { raw_material_id: 26, quantity: 400, unit: 'ml' },// Heavy Cream
        { raw_material_id: 7, quantity: 350, unit: 'g' },  // Sugar
        { raw_material_id: 10, quantity: 6, unit: 'pcs' }  // Eggs
      ]
    },
    {
      id: 10,
      product_id: 10, // Classic Red Velvet Cake
      recipe_name: 'Classic Red Velvet & Cream Cheese Cake Master Formula',
      batch_yield_units: 2,
      yield_unit: 'cakes (1kg)',
      prep_time_mins: 60,
      bake_time_mins: 32,
      oven_temp_c: 175,
      instructions: '1. Sift fine cake flour, cocoa powder, and sea salt.\n2. Cream unsalted butter and caster sugar until pale and fluffy.\n3. Whisk in farm eggs one by one with pure vanilla extract.\n4. Alternate folding dry ingredients and cultured buttermilk.\n5. Pour into round 8-inch cake tins, bake at 175°C for 32 mins.\n6. Cool sponges completely; layer and frost with whipped Philadelphia cream cheese buttercream.',
      ingredients: [
        { raw_material_id: 1, quantity: 500, unit: 'g' },  // Cake Flour
        { raw_material_id: 13, quantity: 600, unit: 'g' }, // Philadelphia Cream Cheese
        { raw_material_id: 3, quantity: 240, unit: 'g' },  // Unsalted Butter
        { raw_material_id: 7, quantity: 500, unit: 'g' },  // Caster Sugar
        { raw_material_id: 11, quantity: 350, unit: 'ml' },// Buttermilk / Milk
        { raw_material_id: 27, quantity: 40, unit: 'g' },  // Cocoa Powder
        { raw_material_id: 10, quantity: 4, unit: 'pcs' }  // Eggs
      ]
    },
    {
      id: 11,
      product_id: 11, // New York Baked Cheesecake
      recipe_name: 'New York Baked Cheesecake Master Formulation',
      batch_yield_units: 1,
      yield_unit: 'whole cake (1.2kg)',
      prep_time_mins: 45,
      bake_time_mins: 65,
      oven_temp_c: 160,
      instructions: '1. Press buttery biscuit crumb into 9-inch springform pan; blind bake 10 mins.\n2. Beat Philadelphia cream cheese, caster sugar, and sour cream on low speed until velvety.\n3. Gently blend in farm eggs one at a time with Madagascar vanilla.\n4. Pour into pan, bake in water bath (bain-marie) at 160°C for 65 mins until edges set and center slightly wobbles.\n5. Leave in turned-off oven with door ajar for 1 hour, then chill 8 hours in refrigerator.',
      ingredients: [
        { raw_material_id: 13, quantity: 750, unit: 'g' }, // Philadelphia Cream Cheese
        { raw_material_id: 26, quantity: 200, unit: 'ml' },// Heavy Cream
        { raw_material_id: 7, quantity: 220, unit: 'g' },  // Sugar
        { raw_material_id: 10, quantity: 4, unit: 'pcs' }, // Farm Eggs
        { raw_material_id: 8, quantity: 15, unit: 'ml' },  // Bourbon Vanilla
        { raw_material_id: 3, quantity: 80, unit: 'g' }    // Butter (crust)
      ]
    },
    {
      id: 12,
      product_id: 12, // Traditional Parsi Mawa Cake
      recipe_name: 'Authentic Irani / Parsi Mawa Cake Master Formula',
      batch_yield_units: 6,
      yield_unit: 'loaves',
      prep_time_mins: 45,
      bake_time_mins: 35,
      oven_temp_c: 180,
      instructions: '1. Crumble fresh mawa/khoya and gently warm with milk until smooth.\n2. Cream pure cow ghee and sugar until light and airy.\n3. Sift flour with freshly ground green cardamom powder and grated nutmeg.\n4. Fold batter gently into lined traditional loaf tins.\n5. Top with sliced pistachio nuts and cashew halves.\n6. Bake at 180°C for 35 mins until fragrant golden brown with hollow crumb sound.',
      ingredients: [
        { raw_material_id: 21, quantity: 500, unit: 'g' }, // Fresh Mawa / Khoya
        { raw_material_id: 1, quantity: 500, unit: 'g' },  // Fine Flour
        { raw_material_id: 15, quantity: 250, unit: 'g' }, // Pure Cow Ghee
        { raw_material_id: 7, quantity: 400, unit: 'g' },  // Cane Sugar
        { raw_material_id: 11, quantity: 250, unit: 'ml' },// Whole Milk
        { raw_material_id: 19, quantity: 15, unit: 'g' },  // Green Cardamom
        { raw_material_id: 10, quantity: 4, unit: 'pcs' }  // Farm Eggs
      ]
    },
    {
      id: 13,
      product_id: 13, // Alphonso Mango Mousse Cake
      recipe_name: 'Alphonso Mango Mousse Cake Formula',
      batch_yield_units: 2,
      yield_unit: 'cakes (800g)',
      prep_time_mins: 75,
      bake_time_mins: 15,
      oven_temp_c: 180,
      instructions: '1. Bake delicate thin genoise vanilla sponge base in silicone molds.\n2. Warm Ratnagiri Alphonso mango pulp with white chocolate until completely incorporated.\n3. Whip cold heavy cream to soft ribbons, gently fold into mango puree.\n4. Pour mango mousse into entremet rings over sponge base.\n5. Freeze 4 hours; glaze with high-shine mango mirror glaze and white chocolate curls.',
      ingredients: [
        { raw_material_id: 14, quantity: 600, unit: 'g' }, // Alphonso Mango Pulp
        { raw_material_id: 26, quantity: 500, unit: 'ml' },// Whipping Cream
        { raw_material_id: 1, quantity: 150, unit: 'g' },  // Flour (sponge base)
        { raw_material_id: 7, quantity: 120, unit: 'g' },  // Sugar
        { raw_material_id: 10, quantity: 3, unit: 'pcs' }  // Eggs
      ]
    },
    {
      id: 14,
      product_id: 14, // Spiced Masala Potato Puff
      recipe_name: 'Bandra Spiced Masala Potato Puff Formula',
      batch_yield_units: 20,
      yield_unit: 'puffs',
      prep_time_mins: 90,
      bake_time_mins: 25,
      oven_temp_c: 220,
      instructions: '1. Prepare flaky laminated puff pastry dough with butter & ghee layers.\n2. Sauté potato and green peas filling with cumin, ginger, and aromatic garam masala.\n3. Cool filling completely; portion 40g spiced filling per square, fold diagonally and crimp edges.\n4. Light milk wash, steam bake in deck oven at 220°C for 25 mins until golden and deeply puffed.',
      ingredients: [
        { raw_material_id: 1, quantity: 800, unit: 'g' },  // Puff Flour
        { raw_material_id: 15, quantity: 250, unit: 'g' }, // Pure Cow Ghee
        { raw_material_id: 3, quantity: 200, unit: 'g' },  // Butter
        { raw_material_id: 16, quantity: 900, unit: 'g' }, // Spiced Potato Filling
        { raw_material_id: 9, quantity: 18, unit: 'g' }    // Sea Salt
      ]
    },
    {
      id: 15,
      product_id: 15, // Paneer Tikka Puff Roll
      recipe_name: 'Artisanal Paneer Tikka Puff Roll Formula',
      batch_yield_units: 16,
      yield_unit: 'rolls',
      prep_time_mins: 90,
      bake_time_mins: 25,
      oven_temp_c: 215,
      instructions: '1. Prepare laminated pastry dough, roll to 3.5mm thickness.\n2. Marinate fresh paneer tikka cubes with tandoori spices, capsicum, and roasted gram flour.\n3. Roll paneer filling tightly into elongated pastry logs, score surface diagonal slits.\n4. Bake in deck oven at 215°C for 25 minutes until crisp and flaky.',
      ingredients: [
        { raw_material_id: 1, quantity: 700, unit: 'g' },  // Flour
        { raw_material_id: 17, quantity: 800, unit: 'g' }, // Paneer Tikka Filling
        { raw_material_id: 3, quantity: 300, unit: 'g' },  // Butter
        { raw_material_id: 9, quantity: 15, unit: 'g' }    // Salt
      ]
    },
    {
      id: 16,
      product_id: 16, // Mushroom & Thyme Quiche Tart
      recipe_name: 'Wild Mushroom & Fresh Thyme Quiche Tart Formula',
      batch_yield_units: 8,
      yield_unit: 'tarts',
      prep_time_mins: 60,
      bake_time_mins: 30,
      oven_temp_c: 195,
      instructions: '1. Roll buttery pâte brisée shortcrust pastry, line fluted tart pans, blind bake 12 mins.\n2. Sauté sliced fresh button mushrooms in butter with minced garlic and fresh thyme leaves.\n3. Whisk heavy whipping cream, farm eggs, sea salt, cracked black pepper, and grated cheese.\n4. Fill parbaked shells with sautéed mushrooms, pour savory custard filling.\n5. Bake at 195°C for 28-30 mins until quiche custard is softly set and top lightly browned.',
      ingredients: [
        { raw_material_id: 1, quantity: 400, unit: 'g' },  // Flour (pastry)
        { raw_material_id: 3, quantity: 200, unit: 'g' },  // Butter
        { raw_material_id: 18, quantity: 500, unit: 'g' }, // Fresh Mushrooms
        { raw_material_id: 26, quantity: 300, unit: 'ml' },// Heavy Cream
        { raw_material_id: 10, quantity: 4, unit: 'pcs' }, // Farm Eggs
        { raw_material_id: 9, quantity: 12, unit: 'g' }    // Sea Salt
      ]
    },
    {
      id: 17,
      product_id: 17, // Hand-Rolled Butter Khari Pack
      recipe_name: 'Hand-Rolled Butter Khari Puff Biscuits Master Formula',
      batch_yield_units: 4,
      yield_unit: 'packs (250g)',
      prep_time_mins: 90,
      bake_time_mins: 28,
      oven_temp_c: 210,
      instructions: '1. Knead refined flour dough with ice cold water and salt until supple. Bench rest 30m.\n2. Lock in chilled bakery butter & pure cow ghee block; perform 4 single turns with resting.\n3. Roll dough sheet out to 5mm thickness, sprinkle fragrant carom seeds (ajwain).\n4. Cut with fluted wheel into rectangular batons.\n5. Deck steam bake at 210°C for 18 mins, reduce oven to 160°C for 10 mins to dry out layers.\n6. Inspect for crisp hollow flake resonance, cool on racks, pack in moisture-barrier bags.',
      ingredients: [
        { raw_material_id: 1, quantity: 800, unit: 'g' },  // Refined Wheat Flour
        { raw_material_id: 3, quantity: 350, unit: 'g' },  // Unsalted Bakery Butter
        { raw_material_id: 15, quantity: 150, unit: 'g' }, // Pure Cow Ghee
        { raw_material_id: 30, quantity: 15, unit: 'g' },  // Carom Seeds (Ajwain)
        { raw_material_id: 9, quantity: 20, unit: 'g' }    // Fine Sea Salt
      ]
    },
    {
      id: 18,
      product_id: 18, // Traditional Cardamom Nankhatai Pack
      recipe_name: 'Traditional Cardamom & Semolina Nankhatai Formula',
      batch_yield_units: 4,
      yield_unit: 'packs (12 pcs)',
      prep_time_mins: 45,
      bake_time_mins: 20,
      oven_temp_c: 165,
      instructions: '1. Beat pure cow ghee and powdered cane sugar in mixer bowl until pale, glossy, and airy.\n2. Sift maida flour with fresh green cardamom powder.\n3. Gently bring dough together without overworking.\n4. Portion into 22g rounds, press light indentation in center.\n5. Press pistachio sliver in center; arrange on parchment lined baking sheets.\n6. Bake at 165°C for 18-20 mins until crumbly and lightly golden beneath.',
      ingredients: [
        { raw_material_id: 1, quantity: 600, unit: 'g' },  // Fine Maida Flour
        { raw_material_id: 15, quantity: 320, unit: 'g' }, // Pure Cow Ghee
        { raw_material_id: 7, quantity: 300, unit: 'g' },  // Cane Sugar
        { raw_material_id: 19, quantity: 20, unit: 'g' }   // Cardamom (Elaichi)
      ]
    },
    {
      id: 19,
      product_id: 19, // Double Dark Chocolate Sea Salt Cookies
      recipe_name: 'Double Dark Chocolate & Sea Salt Cookies Formula',
      batch_yield_units: 16,
      yield_unit: 'cookies',
      prep_time_mins: 40,
      bake_time_mins: 14,
      oven_temp_c: 180,
      instructions: '1. Whisk melted butter, cane sugar, and egg until glossy and emulsified.\n2. Sift flour and dark Dutch cocoa powder; fold in generous Callebaut chocolate chunks.\n3. Chill cookie dough pucks at 4°C for 1 hour.\n4. Scoop 60g portions, sprinkle coarse Guerande sea salt flakes on top.\n5. Bake at 180°C for 12-14 mins until edges set and center stays fudgy soft.',
      ingredients: [
        { raw_material_id: 1, quantity: 350, unit: 'g' },  // Flour
        { raw_material_id: 4, quantity: 280, unit: 'g' },  // Callebaut Chocolate Chunks
        { raw_material_id: 27, quantity: 80, unit: 'g' },  // Cocoa Powder
        { raw_material_id: 3, quantity: 180, unit: 'g' },  // Butter
        { raw_material_id: 7, quantity: 220, unit: 'g' },  // Sugar
        { raw_material_id: 10, quantity: 2, unit: 'pcs' }, // Eggs
        { raw_material_id: 9, quantity: 12, unit: 'g' }    // Guerande Sea Salt
      ]
    },
    {
      id: 20,
      product_id: 20, // Fudgy Belgian Walnut Brownie
      recipe_name: 'Fudgy Belgian Dark Chocolate Walnut Brownie Formula',
      batch_yield_units: 16,
      yield_unit: 'brownie squares',
      prep_time_mins: 40,
      bake_time_mins: 28,
      oven_temp_c: 170,
      instructions: '1. Melt 70.5% Callebaut dark chocolate with unsalted butter over bain-marie.\n2. Whisk eggs and cane sugar until ribbon stage.\n3. Fold melted chocolate mixture into egg emulsion.\n4. Sift in flour and cocoa; fold toasted Kashmiri walnut halves.\n5. Bake in 9x13 parchment-lined pan at 170°C for 28 mins for signature shiny crinkle paper top.',
      ingredients: [
        { raw_material_id: 4, quantity: 400, unit: 'g' },  // Callebaut Dark Chocolate
        { raw_material_id: 3, quantity: 220, unit: 'g' },  // Unsalted Butter
        { raw_material_id: 20, quantity: 200, unit: 'g' }, // Kashmiri Walnuts
        { raw_material_id: 7, quantity: 300, unit: 'g' },  // Sugar
        { raw_material_id: 10, quantity: 4, unit: 'pcs' }, // Eggs
        { raw_material_id: 1, quantity: 150, unit: 'g' },  // Flour
        { raw_material_id: 27, quantity: 50, unit: 'g' }   // Cocoa Powder
      ]
    },
    {
      id: 21,
      product_id: 21, // Salted Caramel Fudge Brownie
      recipe_name: 'Salted Caramel Fudge Brownie Master Formula',
      batch_yield_units: 16,
      yield_unit: 'brownie squares',
      prep_time_mins: 45,
      bake_time_mins: 30,
      oven_temp_c: 170,
      instructions: '1. Melt Callebaut dark chocolate and butter; whisk with sugar and eggs into glossy batter.\n2. Pour 2/3 of dark chocolate batter into parchment-lined baking pan.\n3. Spoon homemade salted butter caramel across surface in ribbons.\n4. Top with remaining batter, swirl with skewer, sprinkle sea salt flakes.\n5. Bake at 170°C for 28-30 mins.',
      ingredients: [
        { raw_material_id: 4, quantity: 380, unit: 'g' },  // Dark Chocolate
        { raw_material_id: 3, quantity: 220, unit: 'g' },  // Butter
        { raw_material_id: 7, quantity: 280, unit: 'g' },  // Sugar
        { raw_material_id: 10, quantity: 4, unit: 'pcs' }, // Eggs
        { raw_material_id: 1, quantity: 150, unit: 'g' },  // Flour
        { raw_material_id: 9, quantity: 10, unit: 'g' }    // Sea Salt
      ]
    },
    {
      id: 22,
      product_id: 22, // Artisan Cold Brew Vanilla Latte
      recipe_name: 'Artisan Cold Brew Vanilla Latte Formulation',
      batch_yield_units: 4,
      yield_unit: 'bottles (300ml)',
      prep_time_mins: 15,
      bake_time_mins: 0,
      oven_temp_c: 0,
      instructions: '1. Steep coarse single-origin coffee grounds in triple-filtered cold water for 18 hours.\n2. Filter through fine paper membrane to extract bright, low-acid cold brew concentrate.\n3. Blend cold brew concentrate with chilled farm whole milk and Madagascar vanilla syrup.\n4. Bottle in sanitized glass flasks with vacuum tamper seal.\n5. Store in refrigerated beverage case at 3°C.',
      ingredients: [
        { raw_material_id: 24, quantity: 600, unit: 'ml' },// Cold Brew Coffee
        { raw_material_id: 11, quantity: 500, unit: 'ml' },// Full Cream Milk
        { raw_material_id: 8, quantity: 40, unit: 'ml' },  // Vanilla Extract
        { raw_material_id: 7, quantity: 40, unit: 'g' }    // Cane Sugar
      ]
    },
    {
      id: 23,
      product_id: 23, // Spiced Masala Cutting Chai Flask
      recipe_name: 'Spiced Masala Cutting Chai Brew Formulation',
      batch_yield_units: 2,
      yield_unit: 'flasks (500ml)',
      prep_time_mins: 20,
      bake_time_mins: 0,
      oven_temp_c: 0,
      instructions: '1. Crush fresh green cardamom pods, fresh ginger, and cinnamon bark in mortar.\n2. Simmer spices in filtered water for 7 mins to release essential oils.\n3. Add robust whole leaf Assam CTC tea, bring to rolling boil for 3 mins.\n4. Pour in rich full cream A2 milk and cane sugar; boil up twice to caramelize milk fats.\n5. Strain through fine brass sieve into insulated stainless delivery flasks.',
      ingredients: [
        { raw_material_id: 25, quantity: 50, unit: 'g' },  // Assam Tea
        { raw_material_id: 11, quantity: 600, unit: 'ml' },// Full Cream Milk
        { raw_material_id: 19, quantity: 15, unit: 'g' },  // Cardamom
        { raw_material_id: 12, quantity: 10, unit: 'g' },  // Cinnamon
        { raw_material_id: 7, quantity: 60, unit: 'g' }    // Cane Sugar
      ]
    }
  ];

  // Insert all 23 recipes into database
  for (const f of masterFormulas) {
    db.query(
      `INSERT INTO recipes (id, business_id, product_id, recipe_name, batch_yield_units, yield_unit, prep_time_mins, bake_time_mins, total_time_mins, oven_temp_c, instructions)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        f.id,
        f.product_id,
        f.recipe_name,
        f.batch_yield_units,
        f.yield_unit,
        f.prep_time_mins,
        f.bake_time_mins,
        f.prep_time_mins + f.bake_time_mins,
        f.oven_temp_c,
        f.instructions
      ]
    );

    for (const ing of f.ingredients) {
      db.query(
        `INSERT INTO recipe_ingredients (recipe_id, raw_material_id, quantity, unit)
         VALUES ($1, $2, $3, $4)`,
        [f.id, ing.raw_material_id, ing.quantity, ing.unit]
      );
    }
  }

  console.log(`[Recipe Seeder] Successfully seeded all ${masterFormulas.length} recipes and formulations into SQLite database!`);
};

run();
