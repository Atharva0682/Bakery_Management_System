const path = require('node:path');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'verification-only-secret-not-for-production';

  const source = new Database(path.join(__dirname, '..', '..', 'backend', 'bakery.pre-audit.sqlite'), { readonly: true });
  const destination = path.join(__dirname, '..', `verification-thresholds-${Date.now()}.sqlite`);
  await source.backup(destination);
  source.close();
  process.env.SQLITE_DB_PATH = destination;

  const db = require('../../backend/src/config/db');
  const catalog = require('../../backend/src/models/catalogRepository');
  const inventory = require('../../backend/src/models/inventoryRepository');
  const orderService = require('../../backend/src/services/orderService');
  const production = require('../../backend/src/services/productionInventoryService');
  const ingredientController = require('../../backend/src/controllers/ingredientController');

  console.log('--- Starting Ingredient Threshold & Inventory Verification ---');

  // Test 1: Automatic Reorder Point (ROP) & 3-Level Inventory metadata
  console.log('Test 1: 3-Level Inventory System and Reorder Point (ROP) calculations');
  const allStock = await inventory.getAllIngredients({ businessId: 1 });
  assert.ok(allStock.length > 0);
  for (const item of allStock) {
    assert.ok(['green', 'yellow', 'red'].includes(item.stock_level), `Invalid stock level: ${item.stock_level}`);
    assert.ok(item.reorder_point >= item.minimum_stock, 'ROP should include safety stock threshold');
    assert.ok(Number.isFinite(item.average_daily_usage));
    assert.ok(Number.isFinite(item.lead_time_days));
    if (item.available_stock <= 0) {
      assert.equal(item.stock_level, 'red');
      assert.equal(item.stock_status, 'Out of Stock');
    } else if (item.available_stock <= item.minimum_stock) {
      assert.equal(item.stock_level, 'yellow');
      assert.equal(item.stock_status, 'Low Stock');
    }
  }
  console.log('PASS: 3-Level Inventory and ROP calculation verified');

  // Test 2: Product-Level Availability (depleting milk disables milk-products while keeping non-milk products available)
  console.log('Test 2: Selective Product-Level Availability on raw material depletion');
  // Find milk
  const milk = allStock.find(i => i.name.toLowerCase().includes('milk'));
  assert.ok(milk, 'Milk raw material should exist');
  
  // Set milk current_stock to 0 (deplete milk)
  await db.query('UPDATE raw_materials SET current_stock = 0 WHERE id = $1', [milk.id]);
  
  const products = await catalog.getProducts({ businessId: 1 });
  const latte = products.find(p => p.name.toLowerCase().includes('latte') || p.name.toLowerCase().includes('chai'));
  const sourdough = products.find(p => p.name.toLowerCase().includes('sourdough') || p.name.toLowerCase().includes('baguette'));
  
  assert.ok(latte, 'Latte/Chai product should exist in test catalog');
  assert.ok(sourdough, 'Sourdough/Baguette product should exist');
  
  assert.equal(latte.is_available, false, 'Product requiring depleted milk must be unavailable');
  assert.ok(latte.shortage_reason.toLowerCase().includes('milk'), 'Shortage reason should mention milk');
  assert.equal(sourdough.is_available, true, 'Product not requiring milk must remain available');
  console.log(`PASS: Latte is_available=${latte.is_available} (Shortage: ${latte.shortage_reason}), Sourdough is_available=${sourdough.is_available}`);

  // Test 3: Attempting to order the unavailable product is rejected
  console.log('Test 3: Rejecting order confirmation for unavailable product');
  const customer = (await db.query("SELECT * FROM users WHERE business_id = 1 AND role = 'customer' LIMIT 1")).rows[0];
  await assert.rejects(
    orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'pickup',
        payment_method: 'CASH_ON_DELIVERY',
        items: [{ product_id: latte.id, quantity: 1 }]
      }
    }),
    err => {
      assert.equal(err.code, 'PRODUCT_UNAVAILABLE');
      return true;
    }
  );
  console.log('PASS: Unavailable product order successfully rejected');

  // Test 4: Ordering available product succeeds even when another ingredient is depleted
  console.log('Test 4: Available product orders succeed despite unrelated ingredient depletion');
  const validOrder = await orderService.createCustomerOrder({
    customerId: customer.id,
    businessId: 1,
    orderData: {
      order_type: 'pickup',
      payment_method: 'CASH_ON_DELIVERY',
      items: [{ product_id: sourdough.id, quantity: 1 }]
    }
  });
  assert.ok(validOrder.id);
  console.log(`PASS: Valid order placed with ID ${validOrder.id}`);

  // Test 5: Low stock (Yellow) does NOT reject orders if quantity is sufficient
  console.log('Test 5: Low stock (Yellow) alert does not reject orders with sufficient ingredients');
  // Flour is raw_material_id 1. Let's set current_stock = 3 kg, threshold = 5 kg (so it is in Yellow / Low Stock)
  await db.query("UPDATE raw_materials SET current_stock = 3, min_reorder_level = 5, threshold_mode = 'absolute' WHERE id = 1");
  const flourStock = await inventory.getIngredientById(1, 1);
  assert.equal(flourStock.stock_level, 'yellow', 'Flour must be in yellow low-stock level');
  assert.equal(flourStock.stock_status, 'Low Stock');

  // Place an order for 1 sourdough (needs ~1.8 kg flour). 1.8 <= 3 kg available, so it MUST succeed!
  const yellowOrder = await orderService.createCustomerOrder({
    customerId: customer.id,
    businessId: 1,
    orderData: {
      order_type: 'pickup',
      payment_method: 'CASH_ON_DELIVERY',
      items: [{ product_id: sourdough.id, quantity: 1 }]
    }
  });
  assert.ok(yellowOrder.id, 'Order under low stock must be accepted if quantity is sufficient');
  console.log('PASS: Low stock (Yellow) accepted order as expected');

  // Test 6: Ordering quantity exceeding available stock is rejected with INSUFFICIENT_STOCK
  console.log('Test 6: Rejecting order exceeding available stock (409 INSUFFICIENT_STOCK)');
  await assert.rejects(
    orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'pickup',
        payment_method: 'CASH_ON_DELIVERY',
        items: [{ product_id: sourdough.id, quantity: 10 }] // Needs 18 kg, only 3 kg available
      }
    }),
    err => {
      assert.equal(err.code, 'INSUFFICIENT_STOCK');
      assert.equal(err.statusCode, 409);
      assert.ok(err.message.includes('Insufficient stock'));
      return true;
    }
  );
  console.log('PASS: Excess quantity rejected with 409 INSUFFICIENT_STOCK');

  // Test 7: Automatic Restock Unit Conversion (owner enters 5 kg for flour, or 500 mL for vanilla)
  console.log('Test 7: Automatic unit conversion on restocking');
  const flourBefore = await inventory.getIngredientById(1, 1);
  // Restock 2 kg with unit 'kg' when item unit is 'kg'
  let mockRes = { status(c) { this.statusCode = c; return this; }, json(d) { this.data = d; return this; } };
  await ingredientController.restockIngredient({
    params: { id: 1 },
    user: { business_id: 1 },
    body: { amount: 2, unit: 'kg', unit_price: 60 }
  }, mockRes);
  const flourAfterKg = await inventory.getIngredientById(1, 1);
  assert.ok(Math.abs(Number(flourAfterKg.current_stock) - (Number(flourBefore.current_stock) + 2)) < 1e-6);

  // Now restock 500 g with unit 'g'. Should add 0.5 kg to current_stock!
  await ingredientController.restockIngredient({
    params: { id: 1 },
    user: { business_id: 1 },
    body: { amount: 500, unit: 'g', unit_price: 30 }
  }, mockRes);
  const flourAfterG = await inventory.getIngredientById(1, 1);
  assert.ok(Math.abs(Number(flourAfterG.current_stock) - (Number(flourAfterKg.current_stock) + 0.5)) < 1e-6);
  console.log(`PASS: Auto-conversion verified: 500 g restock added exactly 0.5 kg (Stock: ${flourAfterG.current_stock} kg)`);

  // Test 8: Stock reservation on acceptance
  console.log('Test 8: Immediate stock reservation upon order acceptance');
  const owner = (await db.query("SELECT * FROM users WHERE business_id = 1 AND role = 'owner' LIMIT 1")).rows[0];
  const beforeReserve = await inventory.getIngredientById(1, 1);
  await orderService.updateOrderStatus(yellowOrder.id, 'Accepted', 'Confirm order', owner.id, 1);
  const afterReserve = await inventory.getIngredientById(1, 1);
  assert.equal(Number(afterReserve.current_stock), Number(beforeReserve.current_stock));
  assert.ok(Number(afterReserve.reserved_stock) > Number(beforeReserve.reserved_stock));
  assert.ok(Number(afterReserve.available_stock) < Number(beforeReserve.available_stock));
  console.log(`PASS: Stock reserved immediately on confirmation. Reserved: ${afterReserve.reserved_stock} kg, Available: ${afterReserve.available_stock} kg`);

  console.log('\n--- ALL INGREDIENT THRESHOLD & INVENTORY TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
