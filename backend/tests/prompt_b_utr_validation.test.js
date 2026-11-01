process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_jwt_crumbco_2026';

const assert = require('assert');
const orderService = require('../src/services/orderService');
const paymentService = require('../src/services/paymentService');

async function runPromptBTests() {
  console.log('\n======================================================');
  console.log(' PROMPT B: MANDATORY 12-DIGIT UTR VALIDATION TESTS');
  console.log('======================================================\n');

  let passed = 0;
  const total = 6;

  // TEST 1: Missing UTR on QR_UPI -> rejected (400, UTR_REQUIRED)
  try {
    let threw = false;
    try {
      await orderService.createCustomerOrder({
        customerId: 9,
        businessId: 1,
        orderData: {
          order_type: 'pickup',
          payment_method: 'QR_UPI',
          transaction_id: '',
          items: [{ product_id: 1, quantity: 1 }],
        },
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, 'UTR_REQUIRED');
    }
    assert(threw, 'Must reject missing UTR on QR_UPI');
    console.log('✓ TEST 1 PASSED: Missing UTR correctly rejected (400, UTR_REQUIRED)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // TEST 2: Short UTR (less than 12 digits) -> rejected (400, UTR_INVALID)
  try {
    let threw = false;
    try {
      await orderService.createCustomerOrder({
        customerId: 9,
        businessId: 1,
        orderData: {
          order_type: 'pickup',
          payment_method: 'QR_UPI',
          transaction_id: '123456789', // 9 digits
          items: [{ product_id: 1, quantity: 1 }],
        },
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, 'UTR_INVALID');
    }
    assert(threw, 'Must reject short UTR on QR_UPI');
    console.log('✓ TEST 2 PASSED: Short UTR correctly rejected (400, UTR_INVALID)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // TEST 3: Non-numeric UTR -> rejected (400, UTR_INVALID)
  try {
    let threw = false;
    try {
      await orderService.createCustomerOrder({
        customerId: 9,
        businessId: 1,
        orderData: {
          order_type: 'pickup',
          payment_method: 'QR_UPI',
          transaction_id: '12345ABC8901', // 12 chars but contains letters
          items: [{ product_id: 1, quantity: 1 }],
        },
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, 'UTR_INVALID');
    }
    assert(threw, 'Must reject non-numeric UTR on QR_UPI');
    console.log('✓ TEST 3 PASSED: Non-numeric UTR correctly rejected (400, UTR_INVALID)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // TEST 4: Valid 12-digit numeric UTR -> successfully creates order & payment
  let validOrder;
  const uniqueUtr = String(Date.now()).replace(/\D/g, '').slice(-12).padStart(12, '8');
  try {
    validOrder = await orderService.createCustomerOrder({
      customerId: 9,
      businessId: 1,
      orderData: {
        order_type: 'pickup',
        payment_method: 'QR_UPI',
        transaction_id: uniqueUtr,
        items: [{ product_id: 1, quantity: 1 }],
      },
    });
    assert(validOrder && validOrder.id, 'Order must be created');
    assert.strictEqual(validOrder.payment.qr_reference_code, uniqueUtr);
    console.log('✓ TEST 4 PASSED: Valid 12-digit numeric UTR accepted successfully');
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  // TEST 5: Duplicate UTR in the same business -> rejected (409, UTR_DUPLICATE)
  try {
    let threw = false;
    try {
      await orderService.createCustomerOrder({
        customerId: 9,
        businessId: 1,
        orderData: {
          order_type: 'pickup',
          payment_method: 'QR_UPI',
          transaction_id: uniqueUtr, // Re-submitting the exact same UTR
          items: [{ product_id: 1, quantity: 1 }],
        },
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 409);
      assert.strictEqual(err.code, 'UTR_DUPLICATE');
    }
    assert(threw, 'Must reject duplicate UTR');
    console.log('✓ TEST 5 PASSED: Duplicate UTR correctly blocked with 409 Conflict');
    passed++;
  } catch (err) {
    console.error('✗ TEST 5 FAILED:', err.message);
  }

  // TEST 6: Cash on Delivery does not require a UTR
  try {
    const codOrder = await orderService.createCustomerOrder({
      customerId: 9,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        payment_method: 'CASH_ON_DELIVERY',
        items: [{ product_id: 1, quantity: 1 }],
      },
    });
    assert(codOrder && codOrder.id, 'COD order must be created without UTR');
    assert.strictEqual(codOrder.payment_status, 'Unpaid');
    console.log('✓ TEST 6 PASSED: Cash on Delivery creates cleanly without UTR requirement');
    passed++;
  } catch (err) {
    console.error('✗ TEST 6 FAILED:', err.message);
  }

  console.log(`\n======================================================`);
  console.log(` PROMPT B RESULTS: ${passed}/${total} PASSED`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runPromptBTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
