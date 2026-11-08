process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_jwt_crumbco_2026';

const assert = require('assert');
const orderService = require('../src/services/orderService');
const paymentService = require('../src/services/paymentService');
const authService = require('../src/services/authService');
const orderRepository = require('../src/models/orderRepository');
const paymentRepository = require('../src/models/paymentRepository');

async function runPromptATests() {
  console.log('\n======================================================');
  console.log(' PROMPT A: PAYMENT APPROVE & REJECT LIFECYCLE TESTS');
  console.log('======================================================\n');

  let passed = 0;
  const total = 6;

  const testRunId = Math.floor(100000 + Math.random() * 900000).toString();
  const createPendingOrder = async (orderSuffix) => {
    const rawDigits = `${testRunId}${orderSuffix}`.replace(/\D/g, '');
    const utr = rawDigits.slice(-12).padStart(12, '9');
    return await orderService.createCustomerOrder({
      customerId: 9,
      businessId: 1,
      orderData: {
        order_type: 'pickup',
        payment_method: 'QR_UPI',
        transaction_id: utr,
        items: [{ product_id: 1, quantity: 1 }],
      },
    });
  };

  // TEST 1: Approve pending payment OK -> moves to Accepted and Paid
  try {
    const testOrder = await createPendingOrder('11');
    const updated = await orderService.approveOrderPayment(testOrder.id, 1, 1);
    assert.strictEqual(updated.payment_status, 'Paid', 'Order payment_status should be Paid');
    assert.strictEqual(updated.order_status, 'Accepted', 'Order order_status should be Accepted');
    console.log('✓ TEST 1 PASSED: Approve pending payment successfully advances to Accepted & Paid');
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // TEST 2: Approve twice -> returns 409 Conflict
  try {
    const testOrder = await createPendingOrder('22');
    await orderService.approveOrderPayment(testOrder.id, 1, 1);

    let threw = false;
    try {
      await orderService.approveOrderPayment(testOrder.id, 1, 1);
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 409, 'Should return status code 409');
      assert.strictEqual(err.code, 'PAYMENT_ALREADY_VERIFIED', 'Code should be PAYMENT_ALREADY_VERIFIED');
    }
    assert(threw, 'Should throw 409 on second approval');
    console.log('✓ TEST 2 PASSED: Double approval correctly blocked with 409 Conflict');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // TEST 3: Approve rejected order -> returns 409 Conflict
  try {
    const testOrder = await createPendingOrder('33');
    await orderService.rejectOrderPayment(testOrder.id, 'UTR not found', 1, 1);

    let threw = false;
    try {
      await orderService.approveOrderPayment(testOrder.id, 1, 1);
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 409, 'Should return status code 409');
      assert.strictEqual(err.code, 'PAYMENT_ALREADY_REJECTED', 'Code should be PAYMENT_ALREADY_REJECTED');
    }
    assert(threw, 'Should throw 409 on approving rejected order');
    console.log('✓ TEST 3 PASSED: Approving rejected order correctly blocked with 409 Conflict');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // TEST 4: Reject after approve -> returns 409 Conflict
  try {
    const testOrder = await createPendingOrder('44');
    await orderService.approveOrderPayment(testOrder.id, 1, 1);

    let threw = false;
    try {
      await orderService.rejectOrderPayment(testOrder.id, 'Changed mind', 1, 1);
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 409, 'Should return status code 409');
      assert.strictEqual(err.code, 'PAYMENT_ALREADY_VERIFIED', 'Code should be PAYMENT_ALREADY_VERIFIED');
    }
    assert(threw, 'Should throw 409 on rejecting approved order');
    console.log('✓ TEST 4 PASSED: Rejecting already approved order correctly blocked with 409 Conflict');
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  // TEST 5: Rejected order is NOT visible to baker
  try {
    const testOrder = await createPendingOrder('55');
    await orderService.rejectOrderPayment(testOrder.id, 'Invalid UTR test', 1, 1);

    const bakerOrders = await orderService.getAllOrdersForBusiness(1, {}, 'baker');
    const found = bakerOrders.find((o) => o.id === testOrder.id);
    assert.strictEqual(found, undefined, 'Baker must never see rejected orders');
    console.log('✓ TEST 5 PASSED: Rejected order is strictly invisible to baker');
    passed++;
  } catch (err) {
    console.error('✗ TEST 5 FAILED:', err.message);
  }

  // TEST 6: Single code path: paymentService.verifyPayment & rejectPayment route to orderService
  try {
    const testOrder = await createPendingOrder('66');
    const payments = await paymentRepository.getByOrderId(testOrder.id, 1);
    assert(payments.length > 0, 'Payment record must exist');
    const paymentId = payments[0].id;

    // Reject via paymentService
    await paymentService.rejectPayment(paymentId, 'Unverified bank credit', 1, 1);
    const refreshedOrder = await orderService.getOrderDetails(testOrder.id, null, 1, 'owner');
    assert.strictEqual(refreshedOrder.payment_status, 'Rejected');
    assert.strictEqual(refreshedOrder.order_status, 'Rejected');
    assert(refreshedOrder.rejection_reason.includes('Unverified bank credit'));

    // Attempting to verify via paymentService should now fail with 409
    let threw = false;
    try {
      await paymentService.verifyPayment(paymentId, 1, 1);
    } catch (e) {
      threw = true;
      assert.strictEqual(e.statusCode, 409);
    }
    assert(threw, 'Single code path: paymentService respects 409 on rejected payment');
    console.log('✓ TEST 6 PASSED: paymentService uses unified single code path and enforces 409 rules');
    passed++;
  } catch (err) {
    console.error('✗ TEST 6 FAILED:', err.message);
  }

  console.log(`\n======================================================`);
  console.log(` PROMPT A RESULTS: ${passed}/${total} PASSED`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runPromptATests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
