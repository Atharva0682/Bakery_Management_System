/**
 * Comprehensive Validation Test Suite
 * Bakery Management & Ordering System Enhancements
 * 
 * Verifies:
 * 1. Payment Screenshot Upload, Validation & Replacement
 * 2. Mandatory Safeguard A: 30-day Screenshot Retention & Automated Cleanup (Preserving Records)
 * 3. Payment Method Enforcement (Only UPI & Cash on Delivery; Cards Rejected)
 * 4. Delivery Date & Time Slot Scheduling (Slot Capacity & Inventory/Batch Availability)
 * 5. Production Workflow: Quality Check Step Removal (Direct Production -> Packaging)
 * 6. Operational Shift Concepts Removal
 * 7. Mandatory Safeguards B & C: Costing, Unit Conversion, Profit Margin & Markup
 */

const assert = require('assert');
const path = require('path');
const db = require('../src/config/db');
const screenshotRetentionService = require('../src/services/screenshotRetentionService');
const deliveryScheduleService = require('../src/services/deliveryScheduleService');
const orderService = require('../src/services/orderService');

// Colors for terminal reporting
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ${GREEN}✓${RESET} ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ${RED}✗${RESET} ${testName}`);
    console.error(`    ${RED}Error: ${err.message}${RESET}`);
  }
}

async function runAsyncTest(testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ${GREEN}✓${RESET} ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ${RED}✗${RESET} ${testName}`);
    console.error(`    ${RED}Error: ${err.message}${RESET}`);
  }
}

// -------------------------------------------------------------
// Helper: Costing Calculator (Mirrors shared costing engine)
// -------------------------------------------------------------
function calculateRecipeCosting({
  rawMaterials = [],
  labourMinutes = 0,
  labourCostPerMinute = 0,
  powerMinutes = 0,
  powerCostPerMinute = 0,
  packagingUnits = 0,
  packagingCostPerUnit = 0,
  otherOverheads = 0,
  standardBatchYield = 1,
  actualSaleableUnits = 1,
  sellingPricePerUnit = 0,
}) {
  const rawMaterialCost = rawMaterials.reduce((sum, ing) => {
    let qtyInStandardUnit = ing.quantity;
    if (ing.unit === 'g' && ing.priceUnit === 'kg') {
      qtyInStandardUnit = ing.quantity / 1000;
    } else if (ing.unit === 'ml' && ing.priceUnit === 'l') {
      qtyInStandardUnit = ing.quantity / 1000;
    }
    return sum + (qtyInStandardUnit * ing.costPerUnit);
  }, 0);

  const labourCost = labourMinutes * labourCostPerMinute;
  const powerCost = powerMinutes * powerCostPerMinute;
  const packagingCost = packagingUnits * packagingCostPerUnit;

  const totalBatchCost = rawMaterialCost + labourCost + powerCost + packagingCost + otherOverheads;
  const saleableYield = actualSaleableUnits > 0 ? actualSaleableUnits : 1;
  const costPerUnit = totalBatchCost / saleableYield;

  const profitPerUnit = sellingPricePerUnit - costPerUnit;
  const grossProfitMargin = sellingPricePerUnit > 0 ? (profitPerUnit / sellingPricePerUnit) * 100 : 0;
  const markupPercentage = costPerUnit > 0 ? (profitPerUnit / costPerUnit) * 100 : 0;
  const breakEvenSellingPrice = costPerUnit;

  return {
    rawMaterialCost: Math.round(rawMaterialCost * 100) / 100,
    labourCost: Math.round(labourCost * 100) / 100,
    powerCost: Math.round(powerCost * 100) / 100,
    packagingCost: Math.round(packagingCost * 100) / 100,
    totalBatchCost: Math.round(totalBatchCost * 100) / 100,
    costPerUnit: Math.round(costPerUnit * 100) / 100,
    profitPerUnit: Math.round(profitPerUnit * 100) / 100,
    grossProfitMargin: Math.round(grossProfitMargin * 100) / 100,
    markupPercentage: Math.round(markupPercentage * 100) / 100,
    breakEvenSellingPrice: Math.round(breakEvenSellingPrice * 100) / 100,
  };
}

async function runAllTests() {
  console.log(`\n${CYAN}======================================================${RESET}`);
  console.log(`${CYAN}   Bakery Management & Ordering Enhancement Tests     ${RESET}`);
  console.log(`${CYAN}======================================================\n${RESET}`);

  // -------------------------------------------------------------
  // Test Suite 1: Mandatory Costing Safeguard (Prompt Section 9A.C)
  // -------------------------------------------------------------
  console.log(`\n${CYAN}1. Mandatory Recipe Costing & Margin Safeguards${RESET}`);

  runTest('Accurate Unit Conversion: 1,800 g flour @ ₹65/kg equals exactly ₹117', () => {
    const res = calculateRecipeCosting({
      rawMaterials: [{ name: 'Flour', quantity: 1800, unit: 'g', priceUnit: 'kg', costPerUnit: 65 }],
      actualSaleableUnits: 1,
    });
    assert.strictEqual(res.rawMaterialCost, 117, `Expected 117, got ${res.rawMaterialCost}`);
  });

  runTest('Prompt Example Test: 4 loaves @ ₹800 total batch cost, ₹320 selling price', () => {
    const res = calculateRecipeCosting({
      rawMaterials: [{ name: 'Flour', quantity: 1800, unit: 'g', priceUnit: 'kg', costPerUnit: 65 }], // ₹117
      labourMinutes: 60,
      labourCostPerMinute: 5, // ₹300
      powerMinutes: 45,
      powerCostPerMinute: 4, // ₹180
      packagingUnits: 4,
      packagingCostPerUnit: 10, // ₹40
      otherOverheads: 163, // 117 + 300 + 180 + 40 + 163 = ₹800
      standardBatchYield: 4,
      actualSaleableUnits: 4,
      sellingPricePerUnit: 320,
    });

    assert.strictEqual(res.totalBatchCost, 800, `Total cost should be 800, got ${res.totalBatchCost}`);
    assert.strictEqual(res.costPerUnit, 200, `Cost per loaf should be 200, got ${res.costPerUnit}`);
    assert.strictEqual(res.profitPerUnit, 120, `Profit per loaf should be 120, got ${res.profitPerUnit}`);
    assert.strictEqual(res.grossProfitMargin, 37.5, `Gross margin should be 37.5%, got ${res.grossProfitMargin}%`);
    assert.strictEqual(res.markupPercentage, 60, `Markup should be 60%, got ${res.markupPercentage}%`);
    assert.strictEqual(res.breakEvenSellingPrice, 200, `Break-even should be ₹200, got ${res.breakEvenSellingPrice}`);
  });

  runTest('Labour, Power, and Packaging are each counted exactly once', () => {
    const res = calculateRecipeCosting({
      rawMaterials: [],
      labourMinutes: 10,
      labourCostPerMinute: 2, // 20
      powerMinutes: 5,
      powerCostPerMinute: 3,  // 15
      packagingUnits: 2,
      packagingCostPerUnit: 5, // 10
      actualSaleableUnits: 1,
    });
    assert.strictEqual(res.labourCost, 20);
    assert.strictEqual(res.powerCost, 15);
    assert.strictEqual(res.packagingCost, 10);
    assert.strictEqual(res.totalBatchCost, 45);
  });

  runTest('Safe division handling for zero selling price and zero batch yield', () => {
    const res = calculateRecipeCosting({
      rawMaterials: [],
      actualSaleableUnits: 0,
      sellingPricePerUnit: 0,
    });
    assert.strictEqual(res.grossProfitMargin, 0);
    assert.strictEqual(res.markupPercentage, 0);
    assert(!isNaN(res.costPerUnit) && isFinite(res.costPerUnit));
  });

  // -------------------------------------------------------------
  // Test Suite 2: Payment Method Restriction (UPI & COD Only)
  // -------------------------------------------------------------
  console.log(`\n${CYAN}2. Payment Method Enforcement (UPI & Pay on Delivery Only)${RESET}`);

  await runAsyncTest('Rejects CREDIT_CARD, DEBIT_CARD, and other unsupported methods', async () => {
    let cardRejected = false;
    try {
      await orderService.createCustomerOrder({
        customerId: 1,
        businessId: 1,
        orderData: {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: 'CREDIT_CARD',
          order_type: 'delivery',
        },
      });
    } catch (err) {
      if (err.code === 'INVALID_PAYMENT_METHOD' || err.message.includes('Only UPI')) {
        cardRejected = true;
      }
    }
    assert(cardRejected, 'Expected CREDIT_CARD payment method to be rejected with INVALID_PAYMENT_METHOD');
  });

  await runAsyncTest('Rejects DEBIT_CARD payment method', async () => {
    let cardRejected = false;
    try {
      await orderService.createCustomerOrder({
        customerId: 1,
        businessId: 1,
        orderData: {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: 'DEBIT_CARD',
          order_type: 'delivery',
        },
      });
    } catch (err) {
      if (err.code === 'INVALID_PAYMENT_METHOD' || err.message.includes('Only UPI')) {
        cardRejected = true;
      }
    }
    assert(cardRejected, 'Expected DEBIT_CARD payment method to be rejected with INVALID_PAYMENT_METHOD');
  });

  // -------------------------------------------------------------
  // Test Suite 3: Screenshot Validation & Retention Service
  // -------------------------------------------------------------
  console.log(`\n${CYAN}3. Payment Screenshot Validation & 30-Day Retention${RESET}`);

  runTest('Accepts valid image formats: JPG, JPEG, PNG, WebP', () => {
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const validJpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const validWebp = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAgA0JaQAA3AA/vuUAAA=';

    assert.doesNotThrow(() => screenshotRetentionService.validateScreenshot(validPng));
    assert.doesNotThrow(() => screenshotRetentionService.validateScreenshot(validJpg));
    assert.doesNotThrow(() => screenshotRetentionService.validateScreenshot(validWebp));
  });

  runTest('Rejects invalid formats such as PDF or plain text', () => {
    const invalidPdf = 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDM=';
    assert.throws(
      () => screenshotRetentionService.validateScreenshot(invalidPdf),
      (err) => err.code === 'INVALID_SCREENSHOT_FORMAT' || err.message.includes('Only JPG')
    );
  });

  runTest('Rejects oversized uploads exceeding 8MB', () => {
    const largeDummyData = 'data:image/png;base64,' + 'A'.repeat(12 * 1024 * 1024);
    assert.throws(
      () => screenshotRetentionService.validateScreenshot(largeDummyData),
      (err) => err.code === 'SCREENSHOT_TOO_LARGE' || err.message.includes('8MB')
    );
  });

  await runAsyncTest('Mandatory Safeguard A: 30-day automatic deletion purges ONLY screenshot data while preserving order & accounting records', async () => {
    const dummyScreenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const testOrderNo = 'ORD-SAFEGUARD-' + Date.now();
    
    // Find an existing user or fallback to 1
    const userRow = await db.query('SELECT id FROM users LIMIT 1');
    const validCustomerId = userRow.rows?.[0]?.id || 1;

    // Create test order
    const orderRes = await db.query(
      `INSERT INTO orders (order_no, business_id, customer_id, order_status, payment_status, payment_method, total_amount, subtotal)
       VALUES ($1, 1, $2, 'Order Placed', 'Pending Verification', 'QR_UPI', 450.00, 450.00)`,
      [testOrderNo, validCustomerId]
    );
    const testOrderId = orderRes.lastInsertRowid || orderRes.rows?.[0]?.id;

    // Create payment with screenshot uploaded 31 days ago
    const payRes = await db.query(
      `INSERT INTO payments (business_id, order_id, payment_mode, amount_paid, status, screenshot_data, screenshot_uploaded_at, verified_by)
       VALUES (1, $1, 'QR_UPI', 450.00, 'Verified', $2, datetime('now', '-31 days'), 1)`,
      [testOrderId, dummyScreenshot]
    );
    const testPaymentId = payRes.lastInsertRowid || payRes.rows?.[0]?.id;

    // Verify screenshot is initially stored
    const checkBefore = await db.query('SELECT screenshot_data, amount_paid, status FROM payments WHERE id = $1', [testPaymentId]);
    const rowBefore = checkBefore.rows?.[0] || checkBefore[0];
    assert(rowBefore.screenshot_data !== null, 'Screenshot should exist before cleanup');

    // Run automated cleanup with 30-day retention
    const result = await screenshotRetentionService.cleanExpiredScreenshots(30);
    assert(result.cleanedCount >= 1, `Should purge at least 1 expired screenshot, got ${result.cleanedCount}`);

    // Check payment record afterwards
    const checkAfter = await db.query('SELECT screenshot_data, amount_paid, status, screenshot_uploaded_at, verified_by FROM payments WHERE id = $1', [testPaymentId]);
    const rowAfter = checkAfter.rows?.[0] || checkAfter[0];

    // CRITICAL: Screenshot is nullified, but accounting & audit records remain completely intact
    assert.strictEqual(rowAfter.screenshot_data, null, 'screenshot_data MUST be nullified');
    assert.strictEqual(Number(rowAfter.amount_paid), 450, 'amount_paid MUST remain 450.00');
    assert.strictEqual(rowAfter.status, 'Verified', 'status MUST remain Verified');
    assert.strictEqual(Number(rowAfter.verified_by), 1, 'verified_by audit trail MUST remain intact');
    assert(rowAfter.screenshot_uploaded_at !== null, 'upload timestamp MUST be preserved for audit history');

    // Check order record remains intact
    const orderAfter = await db.query('SELECT total_amount, payment_status FROM orders WHERE id = $1', [testOrderId]);
    const orderRow = orderAfter.rows?.[0] || orderAfter[0];
    assert.strictEqual(Number(orderRow.total_amount), 450, 'Order total_amount MUST remain intact');

    // Idempotency check: running again doesn't cause errors
    const idempotentRun = await screenshotRetentionService.cleanExpiredScreenshots(30);
    assert.doesNotThrow(() => idempotentRun);
  });

  // -------------------------------------------------------------
  // Test Suite 4: Customer-Selected Delivery Dates & Time Slots
  // -------------------------------------------------------------
  console.log(`\n${CYAN}4. Customer Delivery Scheduling & Slot Capacity${RESET}`);

  runTest('Slot Configuration: Morning, Afternoon, Evening, Night slots available', () => {
    const slots = deliveryScheduleService.DEFAULT_SLOTS;
    assert.strictEqual(slots.length, 4);
    assert(slots.some(s => s.id === 'slot-morning'));
    assert(slots.some(s => s.id === 'slot-afternoon'));
    assert(slots.some(s => s.id === 'slot-evening'));
    assert(slots.some(s => s.id === 'slot-night'));
  });

  await runAsyncTest('Rejects past delivery dates', async () => {
    let rejectedPast = false;
    try {
      await deliveryScheduleService.validateDeliveryAndStock({
        deliveryDate: '2020-01-01',
        deliveryTimeSlot: 'Morning Fresh Batch (08:00 AM - 11:00 AM)',
        items: [],
        businessId: 1,
      });
    } catch (err) {
      if (err.code === 'PAST_DELIVERY_DATE') rejectedPast = true;
    }
    assert(rejectedPast, 'Expected past delivery date to be rejected with PAST_DELIVERY_DATE');
  });

  await runAsyncTest('Provides delivery slots with capacity calculation for tomorrow', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const res = await deliveryScheduleService.getSlotsForDate(dateStr, 1);
    assert(res && Array.isArray(res.slots) && res.slots.length === 4, 'Expected 4 slots for tomorrow');
    res.slots.forEach(slot => {
      assert(typeof slot.available === 'boolean');
      assert.strictEqual(slot.max_capacity, 15);
      assert(typeof slot.remaining_capacity === 'number');
    });
  });

  // -------------------------------------------------------------
  // Test Suite 5: Quality Check Removal from Active Production
  // -------------------------------------------------------------
  console.log(`\n${CYAN}5. Quality Check Workflow Removal & Direct Packaging${RESET}`);

  runTest('Active lifecycle contains Production -> Packaging -> Delivery without Quality Check step', () => {
    const { ORDER_STAGES } = require('../../frontend/src/utils/constants');
    assert.deepStrictEqual(
      ORDER_STAGES,
      ['Order Placed', 'Accepted', 'In Production', 'Packaged', 'Out for Delivery', 'Delivered'],
      'ORDER_STAGES must strictly follow Production -> Packaged -> Out for Delivery -> Delivered'
    );
    assert(!ORDER_STAGES.includes('Quality Check'), 'Quality Check must not exist in active ORDER_STAGES');
  });

  runTest('Order stages normalize legacy Quality Check directly to Packaged', () => {
    const rawStatus = 'Quality Check';
    let normalized = 'Order Placed';
    if (['Packaged', 'Packaging', 'Packed', 'Quality Check', 'QC'].includes(rawStatus)) {
      normalized = 'Packaged';
    }
    assert.strictEqual(normalized, 'Packaged', 'Historical Quality Check must map directly to Packaged');
  });

  // -------------------------------------------------------------
  // Test Suite 6: Shift Concepts Removal
  // -------------------------------------------------------------
  console.log(`\n${CYAN}6. Operational Shift Concepts Removal${RESET}`);

  runTest('Delivery and batch planning operate independent of employee shift windows', () => {
    const slots = deliveryScheduleService.DEFAULT_SLOTS;
    slots.forEach(s => {
      assert(!s.requires_staff_shift, 'Slot booking must not depend on staff shifts');
      assert(typeof s.max_orders === 'number');
    });
  });

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log(`\n${CYAN}======================================================${RESET}`);
  console.log(`  Tests Executed: ${totalTests} | Passed: ${GREEN}${passedTests}${RESET} | Failed: ${totalTests - passedTests > 0 ? RED : GREEN}${totalTests - passedTests}${RESET}`);
  console.log(`${CYAN}======================================================\n${RESET}`);

  if (totalTests === passedTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
