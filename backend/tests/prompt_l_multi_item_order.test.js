process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_jwt_crumbco_2026';

const assert = require('assert');
const orderService = require('../src/services/orderService');
const orderRepository = require('../src/models/orderRepository');

async function runPromptLTests() {
  console.log('\n======================================================');
  console.log(' PROMPT L: MULTI-ITEM ORDER & PRODUCT NAMES TESTS');
  console.log('======================================================\n');

  let passed = 0;
  const total = 4;

  const testRunId = Math.floor(100000 + Math.random() * 900000).toString();
  const utr = `${testRunId}8877`.slice(-12).padStart(12, '8');

  // TEST 1: Create an order with 2 different items -> items are faithfully snapshotted
  let createdOrder = null;
  try {
    createdOrder = await orderService.createCustomerOrder({
      customerId: 9,
      businessId: 1,
      orderData: {
        order_type: 'pickup',
        payment_method: 'QR_UPI',
        transaction_id: utr,
        items: [
          { product_id: 1, quantity: 2 },
          { product_id: 2, quantity: 4 },
        ],
      },
    });

    assert.strictEqual(createdOrder.items.length, 2, 'Should have 2 items');
    assert(createdOrder.items[0].product_name, 'First item must have a product_name');
    assert(createdOrder.items[1].product_name, 'Second item must have a product_name');
    assert.notStrictEqual(createdOrder.items[0].product_name, 'Bakery Item', 'Must not be default Bakery Item');
    console.log(`✓ TEST 1 PASSED: Created multi-item order with items: "${createdOrder.items[0].product_name}" and "${createdOrder.items[1].product_name}"`);
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // TEST 2: Retrieve order items from database -> verify no "Bakery Item" fallback
  try {
    const fetchedItems = await orderRepository.getOrderItems(createdOrder.id);
    assert.strictEqual(fetchedItems.length, 2, 'Must retrieve 2 order items');
    for (const it of fetchedItems) {
      assert(it.product_name, 'Item must have product_name');
      assert.notStrictEqual(it.product_name, 'Bakery Item', 'Item product_name must not be Bakery Item');
      assert(it.name, 'Item must have name field populated');
      assert.notStrictEqual(it.name, 'Bakery Item', 'Item name field must not be Bakery Item');
    }
    console.log('✓ TEST 2 PASSED: getOrderItems returns authentic product names with zero Bakery Item placeholders');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // TEST 3: Order details endpoint returns complete item list with product_id and variant
  try {
    const details = await orderService.getOrderDetails(createdOrder.id, 9, 1, 'customer');
    assert.strictEqual(details.items.length, 2, 'Should return 2 items');
    assert(details.items[0].product_id, 'Should include product_id');
    console.log('✓ TEST 3 PASSED: getOrderDetails provides product_id for recipe matching');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // TEST 4: Secure guest tracking token is generated on order creation
  try {
    assert(createdOrder.tracking_token, 'Order must have a tracking_token generated');
    assert.strictEqual(createdOrder.tracking_token.length >= 24, true, 'Tracking token must be 24+ characters hex');
    console.log(`✓ TEST 4 PASSED: Secure tracking token generated: ${createdOrder.tracking_token.slice(0, 8)}... (${createdOrder.tracking_token.length} chars)`);
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  console.log(`\n======================================================`);
  console.log(` PROMPT L RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log(`======================================================\n`);

  if (passed !== total) process.exit(1);
}

runPromptLTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
