const assert = require('assert');
const {
  getRevenueSqlCondition,
  isRevenueOrder,
  getKolkataDateString,
  getKolkataTodayBounds,
  getKolkataThisWeekBounds,
  getDateRangeBounds
} = require('../src/utils/revenueRules');
const ownerRepository = require('../src/models/ownerRepository');
const { db } = require('../src/config/sqliteDb');

async function runTests() {
  console.log('--- Running Prompt C & D Tests: Revenue & Analytics P&L ---');

  // Test 1: Shared Revenue Rule - isRevenueOrder unit checks
  assert.strictEqual(
    isRevenueOrder({ payment_status: 'Paid', order_status: 'Completed' }),
    true,
    'Paid and Completed should qualify as revenue'
  );
  assert.strictEqual(
    isRevenueOrder({ payment_status: 'Paid', order_status: 'Order Placed' }),
    true,
    'Paid and Order Placed should qualify as revenue'
  );
  assert.strictEqual(
    isRevenueOrder({ payment_status: 'Pending Verification', order_status: 'Order Placed' }),
    false,
    'Pending Verification must NOT count as revenue'
  );
  assert.strictEqual(
    isRevenueOrder({ payment_status: 'Rejected', order_status: 'Completed' }),
    false,
    'Rejected payment must NOT count as revenue'
  );
  assert.strictEqual(
    isRevenueOrder({ payment_status: 'Payment Rejected', order_status: 'Rejected' }),
    false,
    'Payment Rejected must NOT count as revenue'
  );
  assert.strictEqual(
    isRevenueOrder({ payment_status: 'Paid', order_status: 'Cancelled' }),
    false,
    'Cancelled order must NOT count as revenue'
  );
  assert.strictEqual(
    isRevenueOrder({ payment_status: 'Paid', order_status: 'Refunded' }),
    false,
    'Refunded order must NOT count as revenue'
  );
  console.log('✓ Test 1 Passed: Shared revenue condition logic verified.');

  // Test 2: Database SQL Revenue condition matches isRevenueOrder
  const sqlCond = getRevenueSqlCondition('o');
  assert.ok(sqlCond.includes("payment_status = 'Paid'"), 'SQL condition must check payment_status = Paid');
  assert.ok(sqlCond.includes("order_status NOT IN ('Rejected', 'Cancelled', 'Refunded')"), 'SQL condition must exclude Rejected, Cancelled, Refunded');
  console.log('✓ Test 2 Passed: SQL condition syntax verified.');

  // Test 3: Date range bounds produce correct Monday start for Asia/Kolkata
  const thisWeek = getKolkataThisWeekBounds();
  assert.strictEqual(thisWeek.days.length, 7, 'This week must span 7 days');
  assert.strictEqual(thisWeek.days[0].dayName, 'Mon', 'First day of week in Kolkata must be Monday');
  assert.strictEqual(thisWeek.days[6].dayName, 'Sun', 'Last day of week in Kolkata must be Sunday');
  console.log('✓ Test 3 Passed: Asia/Kolkata week bounds Monday-Sunday verified.');

  // Test 4: Query live getAnalytics for this_week and verify real calculations
  const analytics = await ownerRepository.getAnalytics(1, 'this_week');
  assert.ok(analytics, 'Analytics result must exist');
  assert.ok(analytics.summary, 'Summary object must exist');
  assert.strictEqual(typeof analytics.summary.revenue, 'number', 'Revenue must be a number');
  assert.strictEqual(typeof analytics.summary.material_cost, 'number', 'Material cost must be a number');
  assert.strictEqual(typeof analytics.summary.labor_cost, 'number', 'Labor cost must be a number');
  assert.strictEqual(typeof analytics.summary.wastage_loss, 'number', 'Wastage loss must be a number');
  assert.ok(analytics.summary.net_profit === null || typeof analytics.summary.net_profit === 'number', 'Net profit must be a number or null if historical costs incomplete');

  // Verify Profit & Loss formula
  if (analytics.summary.costs_complete && analytics.summary.net_profit !== null) {
    const expectedGrossProfit = Math.round((analytics.summary.revenue - analytics.summary.material_cost) * 100) / 100;
    const expectedNetProfit = Math.round((analytics.summary.revenue - analytics.summary.material_cost - analytics.summary.labor_cost - analytics.summary.wastage_loss) * 100) / 100;
    assert.strictEqual(analytics.summary.gross_profit, Math.round(expectedGrossProfit), 'Gross profit formula verified');
    assert.strictEqual(analytics.summary.net_profit, Math.round(expectedNetProfit), 'Net profit formula verified');
  }
  console.log(`✓ Test 4 Passed: Real P&L calculations verified (Rev: ₹${analytics.summary.revenue}, COGS: ₹${analytics.summary.material_cost}, Net: ${analytics.summary.net_profit !== null ? `₹${analytics.summary.net_profit}` : 'Incomplete Historical Costs'}).`);

  // Test 5: Verify zero hardcoded numbers
  const dailyTrend = analytics.daily_trend;
  assert.ok(Array.isArray(dailyTrend), 'daily_trend must be array');
  assert.strictEqual(dailyTrend.length, 7, 'daily_trend for this_week must have 7 days');
  // Check that the fake array [22400, 29100, 18500, 24800, 31200, 35000, 28450] is NOT returned
  const fakeValues = [22400, 29100, 18500, 24800, 31200, 35000, 28450];
  const isFake = dailyTrend.every((d, i) => d.revenue === fakeValues[i]);
  assert.strictEqual(isFake, false, 'Daily trend must NOT be the hardcoded fake array');
  console.log('✓ Test 5 Passed: Zero hardcoded arrays verified in live response.');

  // Test 6: Verify rejected orders in SQLite are strictly excluded from revenue
  const testOrderId = 999991;
  const testOrderNo = 'ORD-TEST-REJ-REV';
  // Insert a test rejected order with ₹5000 into orders table
  db.prepare(`
    INSERT OR REPLACE INTO orders (id, business_id, order_no, customer_id, total_amount, subtotal, payment_status, order_status, created_at)
    VALUES (?, 1, ?, 1, 5000, 5000, 'Rejected', 'Rejected', CURRENT_TIMESTAMP)
  `).run(testOrderId, testOrderNo);

  const analyticsWithRej = await ownerRepository.getAnalytics(1, 'this_week');
  // Clean up test order
  db.prepare('DELETE FROM orders WHERE id = ?').run(testOrderId);

  // The rejected order must not have added ₹5000 to revenue
  assert.strictEqual(
    analyticsWithRej.summary.revenue,
    analytics.summary.revenue,
    'Rejected order must contribute ₹0.00 to revenue'
  );
  console.log('✓ Test 6 Passed: Rejected order strictly contributed ₹0.00 to revenue in database query.');

  console.log('\nALL 6 PROMPT C & D TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
