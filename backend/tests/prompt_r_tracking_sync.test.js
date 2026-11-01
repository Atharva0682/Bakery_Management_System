process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_jwt_crumbco_2026';

const assert = require('assert');
const orderService = require('../src/services/orderService');
const orderRepository = require('../src/models/orderRepository');
const db = require('../src/config/db');

async function runPromptRTests() {
  console.log('\n======================================================');
  console.log(' PROMPT R: CUSTOMER TRACKING & GUEST TOKEN SECURITY TESTS');
  console.log('======================================================\n');

  let passed = 0;
  const total = 5;

  let createdOrder;
  let orderTrackingToken;

  // TEST 1: Creating an order generates random 32-char hex tracking_token
  try {
    const uniqueUtr = '99' + String(Date.now()).slice(-6) + String(Math.floor(1000 + Math.random() * 9000));
    createdOrder = await orderService.createCustomerOrder({
      businessId: 1,
      customerId: 4, // Ananya Nair
      orderData: {
        order_type: 'pickup',
        payment_method: 'QR_UPI',
        transaction_id: uniqueUtr,
        items: [
          {
            product_id: 1,
            quantity: 2,
            unit_price: 180,
          },
        ],
      },
    });

    assert.ok(createdOrder, 'Order must be created');
    assert.ok(createdOrder.tracking_token, 'Order must have tracking_token generated');
    assert.strictEqual(typeof createdOrder.tracking_token, 'string');
    assert.ok(createdOrder.tracking_token.length >= 24, 'Tracking token must be secure with length >= 24');

    orderTrackingToken = createdOrder.tracking_token;
    passed++;
    console.log('✓ TEST 1 PASSED: Order creation automatically generates a secure tracking token (>= 24 chars).');
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // TEST 2: Guest can fetch order details using valid tracking token
  try {
    const orderDetails = await orderService.getOrderDetails(
      createdOrder.id,
      null, // No customer ID (guest)
      1,
      'guest',
      orderTrackingToken // valid tracking token
    );

    assert.ok(orderDetails, 'Order details should be returned');
    assert.strictEqual(orderDetails.id, createdOrder.id);
    assert.strictEqual(orderDetails.tracking_token, orderTrackingToken);
    assert.ok(Array.isArray(orderDetails.items), 'Items array must be returned');

    passed++;
    console.log('✓ TEST 2 PASSED: Unauthenticated guest can securely retrieve order details with valid ?t=token.');
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // TEST 3: Access denied (403) with invalid tracking token
  try {
    let threw = false;
    try {
      await orderService.getOrderDetails(
        createdOrder.id,
        null, // No customer ID
        1,
        'guest',
        'invalid_token_99999' // wrong token
      );
    } catch (e) {
      threw = true;
      assert.strictEqual(e.code, 'FORBIDDEN_RESOURCE');
      assert.strictEqual(e.statusCode, 403);
    }
    assert.ok(threw, 'Must reject invalid token with 403 FORBIDDEN_RESOURCE');

    passed++;
    console.log('✓ TEST 3 PASSED: Access rejected with 403 when tracking token is invalid.');
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // TEST 4: Another customer cannot access without token
  try {
    let threw = false;
    try {
      await orderService.getOrderDetails(
        createdOrder.id,
        999, // Different customer
        1,
        'customer',
        null // No tracking token
      );
    } catch (e) {
      threw = true;
      assert.strictEqual(e.code, 'FORBIDDEN_RESOURCE');
      assert.strictEqual(e.statusCode, 403);
    }
    assert.ok(threw, 'Must reject unauthorized customer with 403 FORBIDDEN_RESOURCE');

    passed++;
    console.log('✓ TEST 4 PASSED: Non-owner customer without token is denied access (403).');
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  // TEST 5: Status progression (Preparation, Baking, Quality Check, Completed) is preserved & accessible
  try {
    // Advance to Baking
    await orderService.updateOrderStatus(createdOrder.id, 'Baking', 'Stone deck oven', 2, 1);
    let details = await orderService.getOrderDetails(createdOrder.id, null, 1, 'guest', orderTrackingToken);
    assert.strictEqual(details.order_status, 'Baking');

    // Advance to Quality Check
    await orderService.updateOrderStatus(createdOrder.id, 'Quality Check', 'Inspection pass', 2, 1);
    details = await orderService.getOrderDetails(createdOrder.id, null, 1, 'guest', orderTrackingToken);
    assert.strictEqual(details.order_status, 'Quality Check');

    // Advance to Completed
    await orderService.updateOrderStatus(createdOrder.id, 'Completed', 'Packaged & ready', 2, 1);
    details = await orderService.getOrderDetails(createdOrder.id, null, 1, 'guest', orderTrackingToken);
    assert.strictEqual(details.order_status, 'Completed');

    passed++;
    console.log('✓ TEST 5 PASSED: Production status lifecycle (Baking -> Quality Check -> Completed) updates seamlessly.');
  } catch (err) {
    console.error('✗ TEST 5 FAILED:', err.message);
  }

  console.log(`\nResults: ${passed}/${total} tests passed.\n`);
  if (passed !== total) process.exit(1);
}

runPromptRTests();
