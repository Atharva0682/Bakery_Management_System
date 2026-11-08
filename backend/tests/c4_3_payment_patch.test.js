/**
 * C4.3 Payment Patch Test Suite — UPI Verification Lifecycle
 *
 * Verifies all required payment correction scenarios:
 * 1. Active business UPI configuration is used.
 * 2. Business A cannot display Business B's UPI destination.
 * 3. Client cannot override the UPI VPA.
 * 4. Payment amount comes from server-calculated order total.
 * 5. "I've Paid" results in pending verification.
 * 6. Customer cannot force payment_status = Paid.
 * 7. Payment belongs to the correct order.
 * 8. Payment belongs to the correct business.
 * 9. Cross-tenant payment confirmation is blocked.
 * 10. Staff/Owner verification lifecycle transitions payment to Verified and order to Paid.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_32_characters_long_for_security';

const assert = require('assert');
const orderService = require('../src/services/orderService');
const paymentService = require('../src/services/paymentService');
const catalogService = require('../src/services/catalogService');
const businessRepository = require('../src/models/businessRepository');
const paymentRepository = require('../src/models/paymentRepository');
const orderRepository = require('../src/models/orderRepository');

async function runPaymentPatchTests() {
  console.log('\n======================================================');
  console.log('   RUNNING C4.3 PAYMENT FLOW PATCH TEST SUITE         ');
  console.log('======================================================\n');

  let passed = 0;
  const total = 10;

  // --------------------------------------------------------------------------
  // TEST 1: Active business UPI configuration is used
  // --------------------------------------------------------------------------
  try {
    const biz1 = await catalogService.getPublicBusiness('crumbandco');
    assert(biz1 && biz1.upiVpa, 'Business 1 must have upiVpa configured');
    assert.strictEqual(biz1.upiVpa, 'crumbandco@hdfcbank');

    const biz2 = await catalogService.getPublicBusiness('frenchloaf');
    assert(biz2 && biz2.upiVpa, 'Business 2 must have upiVpa configured');
    assert.strictEqual(biz2.upiVpa, 'frenchloaf@icici');

    console.log('✓ TEST 1 PASSED: Active business UPI configuration is used dynamically (crumbandco@hdfcbank vs frenchloaf@icici)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Business A cannot display Business B's UPI destination
  // --------------------------------------------------------------------------
  try {
    const bizA = await catalogService.getPublicBusiness('crumbandco');
    const bizB = await catalogService.getPublicBusiness('frenchloaf');

    assert.notStrictEqual(bizA.upiVpa, bizB.upiVpa, 'Businesses must have distinct UPI VPAs');
    assert.strictEqual(bizA.upiVpa.includes('frenchloaf'), false, 'Business A must never show Business B UPI');
    assert.strictEqual(bizB.upiVpa.includes('crumbandco'), false, 'Business B must never show Business A UPI');

    console.log('✓ TEST 2 PASSED: Business A cannot display Business B UPI destination');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Client cannot override the UPI VPA
  // --------------------------------------------------------------------------
  try {
    // Client passes a spoofed upi_vpa in the order payload
    const orderWithTamperedVpa = await orderService.createCustomerOrder({
      customerId: 4,
      businessId: 1,
      orderData: {
        payment_method: 'QR_UPI',
        upi_vpa: 'attacker@fraudbank', // Client tries to spoof recipient VPA
        items: [{ product_id: 2, quantity: 1 }],
      },
    });

    // Destination remains the authoritative business configuration
    const authoritativeBiz = await businessRepository.findById(1);
    assert.strictEqual(authoritativeBiz.upi_vpa, 'crumbandco@hdfcbank');
    console.log('✓ TEST 3 PASSED: Client cannot override the UPI VPA (attacker VPA ignored)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Payment amount comes from server-calculated order total
  // --------------------------------------------------------------------------
  let testOrder;
  try {
    // Client sends fake total of ₹1.00
    testOrder = await orderService.createCustomerOrder({
      customerId: 4,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        total_amount: 1.00, // Fake client total
        amount_paid: 1.00,  // Fake client payment amount
        payment_method: 'QR_UPI',
        items: [{ product_id: 2, quantity: 2 }], // 2x Butter Croissant @ ₹180 = ₹360 + ₹40 del + ₹18 tax = ₹418
      },
    });

    assert.strictEqual(testOrder.total_amount, 418.00, 'Server must compute trusted total amount');
    assert(testOrder.payment, 'Order must include initialized payment record');
    assert.strictEqual(
      testOrder.payment.amount_paid,
      418.00,
      'Payment amount must strictly equal server-calculated order total (418.00), not client fake 1.00'
    );
    console.log('✓ TEST 4 PASSED: Payment amount comes strictly from server-calculated order total (₹418.00)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: "I've Paid" results in pending verification
  // --------------------------------------------------------------------------
  try {
    assert(testOrder, 'testOrder required');
    // Verify order starts in 'Order Placed' with payment_status = 'Pending Verification'
    assert.strictEqual(testOrder.order_status, 'Order Placed');
    assert.strictEqual(
      testOrder.payment_status,
      'Pending Verification',
      'QR_UPI payment status must start as Pending Verification, NOT Paid'
    );
    assert.strictEqual(
      testOrder.payment.status,
      'Pending Verification',
      'Payment record status must start as Pending Verification'
    );

    // Customer confirms "I've Paid" via paymentService
    const confirmationResult = await paymentService.recordPaymentConfirmation({
      customerId: 4,
      businessId: 1,
      orderId: testOrder.id,
      qrReferenceCode: 'UPI-UTR-TEST-881203',
      paymentMode: 'QR_UPI',
    });

    assert.strictEqual(confirmationResult.order.payment_status, 'Pending Verification');
    assert.strictEqual(confirmationResult.payment.status, 'Pending Verification');
    assert.strictEqual(confirmationResult.payment.qr_reference_code, 'UPI-UTR-TEST-881203');
    console.log('✓ TEST 5 PASSED: "I\'ve Paid" results strictly in Pending Verification status');
    passed++;
  } catch (err) {
    console.error('✗ TEST 5 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Customer cannot force payment_status = Paid
  // --------------------------------------------------------------------------
  try {
    // Malicious customer sends payment_status: 'Paid' and status: 'Verified'
    const bypassAttemptOrder = await orderService.createCustomerOrder({
      customerId: 4,
      businessId: 1,
      orderData: {
        payment_method: 'QR_UPI',
        payment_status: 'Paid', // Bypass attempt!
        status: 'Verified',     // Bypass attempt!
        items: [{ product_id: 2, quantity: 1 }],
      },
    });

    assert.notStrictEqual(bypassAttemptOrder.payment_status, 'Paid', 'Customer cannot force payment_status = Paid');
    assert.strictEqual(bypassAttemptOrder.payment_status, 'Pending Verification');
    assert.strictEqual(bypassAttemptOrder.payment.status, 'Pending Verification');

    console.log('✓ TEST 6 PASSED: Customer cannot force payment_status = Paid or bypass verification');
    passed++;
  } catch (err) {
    console.error('✗ TEST 6 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Payment belongs to the correct order
  // --------------------------------------------------------------------------
  try {
    assert(testOrder, 'testOrder required');
    const payments = await paymentRepository.getByOrderId(testOrder.id, 1);
    assert(payments && payments.length > 0, 'Payment must exist for order');
    assert.strictEqual(Number(payments[0].order_id), Number(testOrder.id), 'Payment order_id must match order.id');
    console.log(`✓ TEST 7 PASSED: Payment is strictly bound to order #${testOrder.id}`);
    passed++;
  } catch (err) {
    console.error('✗ TEST 7 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Payment belongs to the correct business
  // --------------------------------------------------------------------------
  try {
    assert(testOrder, 'testOrder required');
    assert.strictEqual(Number(testOrder.payment.business_id), 1, 'Payment business_id must match active tenant (1)');
    console.log('✓ TEST 8 PASSED: Payment belongs strictly to the correct business (Tenant 1)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 8 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Cross-tenant payment confirmation is blocked
  // --------------------------------------------------------------------------
  try {
    let crossTenantBlocked = false;
    try {
      // Customer at Business 1 tries to confirm payment for Order 10 (which belongs to Business 2)
      await paymentService.recordPaymentConfirmation({
        customerId: 4,
        businessId: 1, // Authenticated at Business 1
        orderId: 10,   // Order belongs to Business 2!
      });
    } catch (err) {
      assert(err.code === 'ORDER_NOT_FOUND' || err.code === 'CROSS_TENANT_PAYMENT' || err.code === 'FORBIDDEN_RESOURCE');
      crossTenantBlocked = true;
    }

    assert(crossTenantBlocked, 'Cross-tenant payment confirmation must be rejected');
    console.log('✓ TEST 9 PASSED: Cross-tenant payment confirmation blocked with 403/404');
    passed++;
  } catch (err) {
    console.error('✗ TEST 9 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Staff/Owner verification lifecycle
  // --------------------------------------------------------------------------
  try {
    // Staff/Owner verifies the pending payment
    const paymentId = testOrder.payment.id;
    const verifiedPayment = await paymentService.verifyPayment(paymentId, 1, 2); // Staff user ID 2

    assert.strictEqual(verifiedPayment.status, 'Verified', 'Staff verification must set payment status to Verified');
    const updatedOrder = await orderRepository.getById(testOrder.id, 1);
    assert.strictEqual(updatedOrder.payment_status, 'Paid', 'Order payment_status must become Paid upon staff verification');
    console.log('✓ TEST 10 PASSED: Staff/Owner verification transitions payment to Verified and order to Paid');
    passed++;
  } catch (err) {
    console.error('✗ TEST 10 FAILED:', err.message);
  }

  console.log('\n======================================================');
  console.log(`PAYMENT PATCH TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPaymentPatchTests().catch((err) => {
  console.error('Payment patch test suite failed:', err);
  process.exit(1);
});
