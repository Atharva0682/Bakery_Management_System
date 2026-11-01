const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const db = require('../src/config/db');
const authService = require('../src/services/authService');
const batchRepository = require('../src/models/batchRepository');
const inventoryRepository = require('../src/models/inventoryRepository');
const orderService = require('../src/services/orderService');
const recipeRepository = require('../src/models/recipeRepository');

async function run() {
  console.log('\n======================================================');
  console.log('   END-TO-END VERIFICATION: BATCHES, INVENTORY & FLOWS   ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function pass(title, detail = '') {
    passed++;
    console.log(`✓ PASS: ${title} ${detail ? '(' + detail + ')' : ''}`);
  }

  function fail(title, err) {
    failed++;
    console.error(`✗ FAIL: ${title}\n  Error:`, err.message || err);
  }

  // TEST 1: Baker batch visibility & classification
  try {
    const bakerBatches = await batchRepository.getAllBatches({
      businessId: 1,
      bakerId: null // Baker floor visibility
    });
    assert(bakerBatches.length > 0, 'Baker floor must see available batches');
    
    const internalBatches = bakerBatches.filter(b => b.is_internal_production === 1 || b.task_type === 'batch_production');
    assert(internalBatches.length > 0, 'Must have internal production batches');
    assert(internalBatches.every(b => !b.customer_name && !b.linked_customer_name), 'Internal production batches must NEVER display customer names');
    pass('TEST 1: Baker Batch Floor Visibility & Internal Production Classification', `Found ${bakerBatches.length} total floor batches (${internalBatches.length} internal batches with no customer name leakage)`);
  } catch (err) {
    fail('TEST 1: Baker Batch Floor Visibility', err);
  }

  // TEST 2: San Francisco Sourdough Loaf Inventory Deduction Flow
  try {
    const product = (await db.query("SELECT * FROM products WHERE name LIKE '%San Francisco%' AND business_id = 1")).rows[0];
    assert(product, 'San Francisco Sourdough product must exist');
    
    const recipe = await recipeRepository.getRecipeByProductId(product.id, 1);
    assert(recipe && recipe.ingredients.length > 0, 'San Francisco Sourdough must have recipe ingredients');
    const flourIngredient = recipe.ingredients.find(i => i.name.includes('T65') || i.name.includes('Flour'));
    assert(flourIngredient, 'Recipe must include T65 Flour');

    // Get initial stock
    const initialRaw = (await db.query('SELECT * FROM raw_materials WHERE id = $1', [flourIngredient.raw_material_id])).rows[0];
    const initialStock = Number(initialRaw.current_stock);

    // Create a new test order for 2 units
    const orderQty = 2;
    const testOrder = await orderService.createCustomerOrder({
      customerId: null,
      businessId: 1,
      orderData: {
        order_type: 'pickup',
        payment_method: 'CASH_ON_DELIVERY',
        guest_name: 'Test Customer',
        guest_phone: '+919876543210',
        items: [{ product_id: product.id, quantity: orderQty }]
      }
    });

    // Advance through status pipeline: Accepted -> In Production -> Product Completed & Packed -> Delivered
    await orderService.updateOrderStatus(testOrder.id, 'Accepted', 'Order accepted', 1, 1);
    await orderService.updateOrderStatus(testOrder.id, 'In Production', 'Baking started', 1, 1);
    await orderService.updateOrderStatus(testOrder.id, 'Product Completed & Packed', 'Packaging complete', 1, 1);
    await orderService.updateOrderStatus(testOrder.id, 'Delivered', 'Delivered to customer', 1, 1);

    // Get final stock
    const finalRaw = (await db.query('SELECT * FROM raw_materials WHERE id = $1', [flourIngredient.raw_material_id])).rows[0];
    const finalStock = Number(finalRaw.current_stock);
    const expectedDeduction = (flourIngredient.inventory_quantity * orderQty) / recipe.yield_quantity;

    assert(finalStock < initialStock, `Flour stock must decrease. Initial: ${initialStock}, Final: ${finalStock}`);
    const actualDeduction = initialStock - finalStock;
    assert(Math.abs(actualDeduction - expectedDeduction) < 0.001, `Deduction must match recipe formula (${expectedDeduction}). Actual: ${actualDeduction}`);

    // Verify idempotency: repeated Delivered call does not deduct again
    await orderService.updateOrderStatus(testOrder.id, 'Delivered', 'Re-confirmed delivery', 1, 1);
    const idempotentRaw = (await db.query('SELECT * FROM raw_materials WHERE id = $1', [flourIngredient.raw_material_id])).rows[0];
    assert.strictEqual(Number(idempotentRaw.current_stock), finalStock, 'Re-updating order status must not re-deduct ingredients');

    pass('TEST 2: Accurate Recipe Inventory Deduction on Order Flow', `Stock decreased from ${initialStock.toFixed(3)} to ${finalStock.toFixed(3)} (deducted ${actualDeduction.toFixed(3)} ${flourIngredient.raw_unit})`);
  } catch (err) {
    fail('TEST 2: Accurate Recipe Inventory Deduction', err);
  }

  // TEST 3: Stock Movements Audit Trail
  try {
    const movements = (await db.query(`
      SELECT sm.*, rm.name as ingredient_name
      FROM stock_movements sm
      JOIN raw_materials rm ON sm.raw_material_id = rm.id
      WHERE sm.business_id = 1
      ORDER BY sm.id DESC
      LIMIT 10
    `)).rows;
    assert(movements.length > 0, 'Stock movements audit records must exist');
    const latest = movements[0];
    const isDeduction = latest.movement_type.toLowerCase() === 'deduction' || Number(latest.quantity) < 0;
    assert(isDeduction, 'Latest movement should record deduction');
    pass('TEST 3: Stock Movements Audit Log', `Found ${movements.length} recent stock movements. Latest: ${latest.ingredient_name} (${latest.quantity} ${latest.unit || ''})`);
  } catch (err) {
    fail('TEST 3: Stock Movements Audit Log', err);
  }

  // TEST 4: Guest Order Tracking Access Without 403
  try {
    const guestOrder = await orderService.createCustomerOrder({
      customerId: null,
      businessId: 1,
      orderData: {
        order_type: 'pickup',
        payment_method: 'CASH_ON_DELIVERY',
        guest_name: 'Anaya Nair',
        guest_phone: '+919876543219',
        items: [{ product_id: 1, quantity: 1 }]
      }
    });

    assert(guestOrder.tracking_token, 'Guest order must have tracking_token');

    // Access via getOrderDetails with tracking token
    const fetchedWithToken = await orderService.getOrderDetails(guestOrder.id, null, 1, 'guest', guestOrder.tracking_token);
    assert.strictEqual(fetchedWithToken.id, guestOrder.id, 'Order details must be returned with tracking token');

    // Access via getOrderDetails without tracking token (resilient guest lookup)
    const fetchedWithoutToken = await orderService.getOrderDetails(guestOrder.id, null, 1, 'guest', null);
    assert.strictEqual(fetchedWithoutToken.id, guestOrder.id, 'Guest order details must be accessible without 403');

    pass('TEST 4: Guest Order Tracking Resiliency', `Successfully retrieved order #${guestOrder.order_no} without 403 Forbidden`);
  } catch (err) {
    fail('TEST 4: Guest Order Tracking Resiliency', err);
  }

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch(console.error);
