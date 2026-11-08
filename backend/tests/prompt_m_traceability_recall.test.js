process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_jwt_crumbco_2026';

const assert = require('assert');
const ownerRepository = require('../src/models/ownerRepository');
const db = require('../src/config/db');

async function runPromptMTests() {
  console.log('\n======================================================');
  console.log(' PROMPT M: BATCH & LOT TRACEABILITY + RECALL REPORT TESTS');
  console.log('======================================================\n');

  let passed = 0;
  const total = 4;

  // TEST 1: Trace by Batch Code (e.g. BC-241)
  try {
    const trace = await ownerRepository.getTraceability('BC-241', 1);
    assert.ok(trace, 'Trace result must be returned');
    assert.ok(trace.trace, 'Trace chain must exist');
    assert.ok(trace.trace.batch, 'Batch details must exist');
    assert.ok(trace.trace.supplier, 'Supplier details must exist');
    assert.ok(Array.isArray(trace.trace.workers), 'Workers must be an array');
    assert.ok(trace.trace.quality_check, 'Quality check must exist');

    passed++;
    console.log('✓ TEST 1 PASSED: Successfully audited complete chain by Batch Code (BC-241).');
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // TEST 2: Trace by Raw Material Lot Number (e.g. LOT-FLR-2026-092)
  try {
    const trace = await ownerRepository.getTraceability('LOT-FLR-2026-092', 1);
    assert.ok(trace, 'Trace result must be returned');
    assert.strictEqual(trace.matched_type, 'Raw Material Lot');
    assert.ok(trace.trace.supplier, 'Supplier details must be loaded for lot');
    assert.strictEqual(trace.trace.supplier.lot_number, 'LOT-FLR-2026-092');

    passed++;
    console.log('✓ TEST 2 PASSED: Successfully audited chain by Raw Material Lot Number (LOT-FLR-2026-092).');
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // TEST 3: Generate Food Safety Recall Data for Lot
  try {
    const recallData = await ownerRepository.getRecallReportData('LOT-FLR-2026-092', 1);
    assert.ok(recallData, 'Recall data must be returned');
    assert.ok(recallData.lot, 'Lot details must be present');
    assert.strictEqual(recallData.lot.lot_number, 'LOT-FLR-2026-092');
    assert.ok(Array.isArray(recallData.batches), 'Batches array must be returned');
    assert.ok(Array.isArray(recallData.orders), 'Orders array must be returned');

    passed++;
    console.log('✓ TEST 3 PASSED: Food Safety Recall data generated with affected batches and customer contacts.');
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // TEST 4: Invalid lot number throws LOT_NOT_FOUND
  try {
    let threw = false;
    try {
      await ownerRepository.getRecallReportData('LOT-NONEXISTENT-99999', 1);
    } catch (e) {
      threw = true;
      assert.strictEqual(e.code, 'LOT_NOT_FOUND');
    }
    assert.ok(threw, 'Must throw LOT_NOT_FOUND for invalid lot');

    passed++;
    console.log('✓ TEST 4 PASSED: Gracefully rejects invalid lot lookup with LOT_NOT_FOUND.');
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  console.log(`\nResults: ${passed}/${total} tests passed.\n`);
  if (passed !== total) process.exit(1);
}

runPromptMTests();
