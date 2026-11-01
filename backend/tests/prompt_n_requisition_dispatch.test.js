process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_jwt_crumbco_2026';

const assert = require('assert');
const db = require('../src/config/db');
const inventoryRepository = require('../src/models/inventoryRepository');
const vendorRepository = require('../src/models/vendorRepository');

async function runPromptNTests() {
  console.log('\n======================================================');
  console.log(' PROMPT N: REQUISITION DISPATCH & REAL PRICE TRENDS TESTS');
  console.log('======================================================\n');

  let passed = 0;
  const total = 4;

  // TEST 1: Requisition approval succeeds, deducts store stock, and marks Dispatched
  try {
    const initStockRes = await db.query('SELECT current_stock FROM raw_materials WHERE id = 1');
    const initialStock = Number(initStockRes.rows[0].current_stock);
    assert.ok(initialStock > 10, 'Initial stock should be > 10');

    const reqInsert = await db.query(`
      INSERT INTO stock_requisitions (business_id, raw_material_id, requested_by, quantity, unit, status, notes)
      VALUES (1, 1, 4, 5.0, 'kg', 'Pending', 'Test Morning Shift Floor Need')
      RETURNING id
    `);
    const reqId = reqInsert.rows[0].id;

    const result = await inventoryRepository.approveRequisition(reqId, 1, 1);
    assert.strictEqual(result.status, 'Dispatched', 'Status must be updated to Dispatched');

    const finalStockRes = await db.query('SELECT current_stock FROM raw_materials WHERE id = 1');
    const finalStock = Number(finalStockRes.rows[0].current_stock);
    assert.strictEqual(Math.round(finalStock * 10) / 10, Math.round((initialStock - 5.0) * 10) / 10, 'Stock must be deducted by exactly 5.0');

    console.log('✓ TEST 1 PASSED: Requisition approved, stock deducted, status marked Dispatched');
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // TEST 2: Requisition approval blocks when store stock is insufficient
  try {
    const initStockRes = await db.query('SELECT current_stock FROM raw_materials WHERE id = 1');
    const initialStock = Number(initStockRes.rows[0].current_stock);

    const excessiveQty = initialStock + 500;
    const reqInsert = await db.query(`
      INSERT INTO stock_requisitions (business_id, raw_material_id, requested_by, quantity, unit, status, notes)
      VALUES (1, 1, 4, $1, 'kg', 'Pending', 'Excessive requisition')
      RETURNING id
    `, [excessiveQty]);
    const reqId = reqInsert.rows[0].id;

    let threw = false;
    try {
      await inventoryRepository.approveRequisition(reqId, 1, 1);
    } catch (e) {
      threw = true;
      assert.ok(e.message.toLowerCase().includes('insufficient'), 'Error message should indicate insufficient stock');
    }
    assert.strictEqual(threw, true, 'Approval must throw when stock is insufficient');

    const checkRes = await db.query('SELECT status FROM stock_requisitions WHERE id = $1', [reqId]);
    assert.strictEqual(checkRes.rows[0].status, 'Pending', 'Status must remain Pending');

    console.log('✓ TEST 2 PASSED: Requisition approval strictly blocked on insufficient store stock');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // TEST 3: Requisition rejection marks status as Rejected without stock deduction
  try {
    const initStockRes = await db.query('SELECT current_stock FROM raw_materials WHERE id = 1');
    const initialStock = Number(initStockRes.rows[0].current_stock);

    const reqInsert = await db.query(`
      INSERT INTO stock_requisitions (business_id, raw_material_id, requested_by, quantity, unit, status, notes)
      VALUES (1, 1, 4, 2.0, 'kg', 'Pending', 'Test rejection')
      RETURNING id
    `);
    const reqId = reqInsert.rows[0].id;

    const rejectRes = await inventoryRepository.rejectRequisition(reqId, 1, 1);
    assert.strictEqual(rejectRes.status, 'Rejected', 'Status must be Rejected');

    const finalStockRes = await db.query('SELECT current_stock FROM raw_materials WHERE id = 1');
    const finalStock = Number(finalStockRes.rows[0].current_stock);
    assert.strictEqual(Math.round(finalStock * 10) / 10, Math.round(initialStock * 10) / 10, 'Stock must remain unchanged on rejection');

    console.log('✓ TEST 3 PASSED: Requisition rejected without deducting stock');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // TEST 4: getVendorPriceHistory returns calculated trends from real lots and suppliers
  try {
    const history = await vendorRepository.getVendorPriceHistory('', 1);
    assert.ok(Array.isArray(history), 'History must be an array');
    assert.ok(history.length > 0, 'History should return items from real suppliers/materials');

    const first = history[0];
    assert.ok(first.supplier, 'Must have supplier name');
    assert.ok(first.material, 'Must have material name');
    assert.ok(first.cost, 'Must have cost formatted');
    assert.ok(first.trend, 'Must have calculated trend');
    assert.ok(first.leadTime, 'Must have leadTime');
    assert.ok(first.reliability, 'Must have reliability');

    console.log('✓ TEST 4 PASSED: Vendor price history calculated dynamically from real lots/materials');
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  console.log(`\nPROMPT N TEST SUMMARY: ${passed}/${total} passed\n`);
  if (passed !== total) process.exit(1);
}

runPromptNTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
