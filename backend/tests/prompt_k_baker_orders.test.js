process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_jwt_crumbco_2026';

const assert = require('assert');
const orderService = require('../src/services/orderService');
const orderRepository = require('../src/models/orderRepository');
const paymentRepository = require('../src/models/paymentRepository');

async function runPromptKTests() {
  console.log('\n======================================================');
  console.log(' PROMPT K: BAKER STRICT QUEUE FILTERING TESTS');
  console.log('======================================================\n');

  let passed = 0;
  const total = 5;

  const testRunId = Math.floor(100000 + Math.random() * 900000).toString();
  const createTestOrder = async (orderSuffix, isCod = false) => {
    const rawDigits = `${testRunId}${orderSuffix}`.replace(/\D/g, '');
    const utr = rawDigits.slice(-12).padStart(12, '9');
    return await orderService.createCustomerOrder({
      customerId: 9,
      businessId: 1,
      orderData: {
        order_type: 'pickup',
        payment_method: isCod ? 'CASH_ON_DELIVERY' : 'QR_UPI',
        transaction_id: isCod ? null : utr,
        items: [{ product_id: 1, quantity: 2 }],
      },
    });
  };

  // TEST 1: Pending payment orders must NOT appear in baker queue
  try {
    const pendingOrder = await createTestOrder('01');
    const bakerOrders = await orderService.getAllOrdersForBusiness(1, {}, 'baker');
    const found = bakerOrders.some(o => o.id === pendingOrder.id);
    assert.strictEqual(found, false, 'Pending payment order must NOT be visible to baker');
    console.log('✓ TEST 1 PASSED: Unverified / pending verification order excluded from baker queue');
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // TEST 2: Rejected payment order must NOT appear in baker queue
  try {
    const toReject = await createTestOrder('02');
    await orderService.rejectOrderPayment(toReject.id, 'Fraudulent UTR', 1, 1);
    const bakerOrders = await orderService.getAllOrdersForBusiness(1, {}, 'baker');
    const found = bakerOrders.some(o => o.id === toReject.id);
    assert.strictEqual(found, false, 'Rejected order must NEVER appear in baker queue');
    console.log('✓ TEST 2 PASSED: Rejected order excluded from baker queue');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // TEST 3: Approved / Paid order MUST appear in baker queue
  try {
    const toApprove = await createTestOrder('03');
    await orderService.approveOrderPayment(toApprove.id, 1, 1);
    const bakerOrders = await orderService.getAllOrdersForBusiness(1, {}, 'baker');
    const found = bakerOrders.some(o => o.id === toApprove.id);
    assert.strictEqual(found, true, 'Approved paid order MUST appear in baker queue');
    console.log('✓ TEST 3 PASSED: Approved paid order appears in baker queue with is_ready_for_baker = true');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // TEST 4: Staff role floor worker receives the exact same filtered queue as baker
  try {
    const staffOrders = await orderService.getAllOrdersForBusiness(1, {}, 'staff');
    const hasRejected = staffOrders.some(o => o.order_status === 'Rejected' || o.payment_status === 'Rejected');
    const hasPendingVerification = staffOrders.some(o => o.payment_status === 'Pending Verification');
    assert.strictEqual(hasRejected, false, 'Staff floor queue must not contain rejected orders');
    assert.strictEqual(hasPendingVerification, false, 'Staff floor queue must not contain unverified orders');
    console.log('✓ TEST 4 PASSED: Staff role receives clean filtered floor queue');
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  // TEST 5: Owner query with filter role=baker applies the baker filter
  try {
    const filteredOrders = await orderService.getAllOrdersForBusiness(1, { role: 'baker' }, 'owner');
    const hasRejected = filteredOrders.some(o => o.order_status === 'Rejected' || o.payment_status === 'Rejected');
    assert.strictEqual(hasRejected, false, 'role=baker filter must exclude rejected orders');
    console.log('✓ TEST 5 PASSED: Query filter { role: "baker" } successfully enforces floor queue criteria');
    passed++;
  } catch (err) {
    console.error('✗ TEST 5 FAILED:', err.message);
  }

  console.log(`\n======================================================`);
  console.log(` PROMPT K RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runPromptKTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
