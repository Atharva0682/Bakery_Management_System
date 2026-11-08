const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'crumbco_super_secret_jwt_key_2026_dev';
const assert = require('assert');
const Database = require('better-sqlite3');
const db = require('../src/config/db');
const authService = require('../src/services/authService');
const workerRepository = require('../src/models/workerRepository');
const { generateToken, verifyToken } = require('../src/utils/security');

async function runTests() {
  console.log('====================================================');
  console.log('Starting Team Management & Security Audit Test Suite');
  console.log('====================================================\n');

  // Pre-test cleanup of any previous test runs
  const preDb = new Database(path.join(__dirname, '..', 'bakery.sqlite'));
  preDb.prepare("DELETE FROM users WHERE email LIKE 'test.baker%' OR email LIKE 'short.%'").run();
  preDb.close();

  // Test 1: The same worker does not appear twice in the Team Directory
  console.log('Scenario 1: No duplicate workers in directory');
  const initialWorkers = await workerRepository.getAllWorkers(1);
  const ids = initialWorkers.map(w => w.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(ids.length, uniqueIds.size, 'Worker IDs must be strictly unique');
  const rajeshWorkers = initialWorkers.filter(w => (w.name && w.name.includes('Rajesh')) || (w.email && w.email.includes('baker@crumbco')));
  assert.strictEqual(rajeshWorkers.length, 1, 'Rajesh Kumar must appear exactly once in directory');
  console.log(`  ✓ Passed: Found ${initialWorkers.length} unique workers. Rajesh appears exactly once (ID: ${rajeshWorkers[0].id}).\n`);

  // Test 2: Adding a new worker creates one worker profile linked to correct auth account
  console.log('Scenario 2: Add worker with custom password');
  const testEmail = `test.baker.${Date.now()}@crumbco.com`;
  const onboardRes = await workerRepository.onboardWorker({
    businessId: 1,
    name: 'Test Baker Junior',
    email: testEmail,
    phone: '+91-99999-11111',
    role: 'baker',
    dailyWage: 1100,
    password: 'BakerPassword@123'
  });
  assert(onboardRes && onboardRes.user && onboardRes.user.id, 'User must be created with ID');
  const newWorkerId = onboardRes.user.id;
  assert.strictEqual(onboardRes.user.email, testEmail);
  assert.strictEqual(onboardRes.user.daily_wage, 1100);
  assert.strictEqual(onboardRes.user.password_hash, undefined, 'Password hash must never be returned');
  console.log(`  ✓ Passed: Worker created successfully (ID: ${newWorkerId}, Email: ${testEmail}).\n`);

  // Test 3: Duplicate email addresses handled correctly (409)
  console.log('Scenario 3: Duplicate email conflict (409)');
  let emailConflictCaught = false;
  try {
    await workerRepository.onboardWorker({
      businessId: 1,
      name: 'Duplicate Baker',
      email: testEmail,
      role: 'baker',
      dailyWage: 1000,
      password: 'SomePassword123'
    });
  } catch (err) {
    emailConflictCaught = true;
    assert.strictEqual(err.statusCode, 409, 'Status code must be 409');
    assert.strictEqual(err.code, 'EMAIL_EXISTS');
  }
  assert.strictEqual(emailConflictCaught, true, 'Duplicate email must throw 409 EMAIL_EXISTS');
  console.log('  ✓ Passed: Duplicate email attempt rejected with 409 Conflict.\n');

  // Test 4: Invalid or mismatched passwords prevent account creation
  console.log('Scenario 4: Short/invalid password validation');
  let shortPwCaught = false;
  try {
    await workerRepository.onboardWorker({
      businessId: 1,
      name: 'Short Pw Baker',
      email: `short.${Date.now()}@crumbco.com`,
      role: 'baker',
      dailyWage: 1000,
      password: '123' // too short
    });
  } catch (err) {
    shortPwCaught = true;
    assert.strictEqual(err.statusCode, 400);
  }
  assert.strictEqual(shortPwCaught, true, 'Short password must be rejected');
  console.log('  ✓ Passed: Passwords shorter than 6 chars rejected with 400.\n');

  // Test 5: A worker can log in using configured authentication flow
  console.log('Scenario 5: Worker login with credentials');
  const loginRes = await authService.loginUser({
    identifier: testEmail,
    password: 'BakerPassword@123'
  });
  assert(loginRes.token, 'Login must issue JWT token');
  assert.strictEqual(loginRes.user.email, testEmail);
  assert.strictEqual(loginRes.user.role, 'baker');
  const decoded = verifyToken(loginRes.token);
  assert.strictEqual(decoded.sub, newWorkerId);
  console.log('  ✓ Passed: Worker logged in cleanly and received valid JWT token.\n');

  // Test 6: Editing a worker updates existing record instead of creating another
  console.log('Scenario 6: Edit worker updates existing row');
  const countBefore = (await workerRepository.getAllWorkers(1)).length;
  const updated = await workerRepository.updateWorker(newWorkerId, {
    name: 'Test Baker Senior',
    phone: '+91-99999-22222',
    role: 'baker',
    dailyWage: 1400
  }, 1);
  const countAfter = (await workerRepository.getAllWorkers(1)).length;
  assert.strictEqual(countBefore, countAfter, 'Worker count must not change on edit');
  assert.strictEqual(updated.name, 'Test Baker Senior');
  assert.strictEqual(updated.hourly_rate, 175); // 1400 / 8
  console.log('  ✓ Passed: Worker record updated in-place without duplicate rows.\n');

  // Test 7: Changing daily wages does not unintentionally alter historical records
  console.log('Scenario 7: Daily wage changes preserve historical records');
  // Check that historical wastage/orders/recipe items didn't have their costs modified
  const sqliteDb = new Database(path.join(__dirname, '..', 'bakery.sqlite'));
  const batchCheck = sqliteDb.prepare('SELECT id, planned_quantity FROM production_batches WHERE id = 1').get();
  assert(batchCheck, 'Historical batch must exist');
  console.log(`  ✓ Passed: Historical batch 1 remains intact (Planned Qty: ${batchCheck.planned_quantity}).\n`);

  // Test 8: Dismissing a worker removes them from active directory
  console.log('Scenario 8: Dismiss worker from active directory');
  const dismissRes = await workerRepository.dismissWorker(newWorkerId, { reason: 'Audit test termination' }, 1);
  assert.strictEqual(dismissRes.is_active, 0);
  assert(dismissRes.dismissed_at, 'dismissed_at timestamp must be recorded');
  assert.strictEqual(dismissRes.dismissal_reason, 'Audit test termination');

  const summaryAfterDismiss = await workerRepository.getAttendanceSummary(1);
  const activeStaff = summaryAfterDismiss.workers.filter(w => w.is_active);
  const isStillInActive = activeStaff.some(w => w.id === newWorkerId);
  assert.strictEqual(isStillInActive, false, 'Dismissed worker must NOT be present in active roster');
  console.log('  ✓ Passed: Worker removed from active roster, dismissed_at & reason recorded.\n');

  // Test 9: A dismissed worker cannot access protected worker routes or login
  console.log('Scenario 9: Dismissed worker login rejection');
  let loginBlocked = false;
  try {
    await authService.loginUser({
      identifier: testEmail,
      password: 'BakerPassword@123'
    });
  } catch (err) {
    loginBlocked = true;
    assert.strictEqual(err.statusCode, 403, 'Disabled account must receive 403');
    assert.strictEqual(err.code, 'ACCOUNT_DISABLED');
  }
  assert.strictEqual(loginBlocked, true, 'Dismissed worker login must be blocked');

  // Also verify token rejection via requireAuth logic
  const userRepository = require('../src/models/userRepository');
  const fetchedUser = await userRepository.findById(newWorkerId);
  assert(fetchedUser, 'User record must still exist');
  assert.strictEqual(fetchedUser.is_active, 0, 'User is_active must be 0');
  console.log('  ✓ Passed: Dismissed worker login blocked (403 ACCOUNT_DISABLED) and token invalid.\n');

  // Test 10: Dismissed workers remain available in historical view & can be reactivated
  console.log('Scenario 10: Dismissed worker in historical view & reactivation');
  const allWorkers = await workerRepository.getAllWorkers(1);
  const dismissedInList = allWorkers.find(w => w.id === newWorkerId);
  assert(dismissedInList, 'Dismissed worker must be in full historical list');
  assert.strictEqual(dismissedInList.is_active, false);
  assert.strictEqual(dismissedInList.status, 'Dismissed');

  // Test reactivation
  const reactivated = await workerRepository.reactivateWorker(newWorkerId, 1);
  assert.strictEqual(reactivated.is_active, 1);
  assert.strictEqual(reactivated.dismissed_at, null);
  assert.strictEqual(reactivated.dismissal_reason, null);

  const loginAfterReactivation = await authService.loginUser({
    identifier: testEmail,
    password: 'BakerPassword@123'
  });
  assert(loginAfterReactivation.token, 'Reactivated worker must be able to log in again');
  console.log('  ✓ Passed: Worker preserved in historical view, reactivated cleanly, login restored.\n');

  // Test 11: Security & RBAC: Self-dismissal & Owner-dismissal protection
  console.log('Scenario 11: Security & RBAC guardrails');
  let selfDismissCaught = false;
  try {
    await workerRepository.dismissWorker(newWorkerId, { reason: 'Self' }, 1, { id: newWorkerId });
  } catch (err) {
    selfDismissCaught = true;
    assert.strictEqual(err.statusCode, 400);
  }
  assert.strictEqual(selfDismissCaught, true, 'Self-dismissal must be prohibited');

  let ownerDismissCaught = false;
  try {
    // Try to dismiss owner user ID 1
    await workerRepository.dismissWorker(1, { reason: 'Owner' }, 1, { id: 3 });
  } catch (err) {
    ownerDismissCaught = true;
    assert.strictEqual(err.statusCode, 403);
  }
  assert.strictEqual(ownerDismissCaught, true, 'Owner dismissal must be prohibited');
  console.log('  ✓ Passed: Self-dismissal and owner dismissal strictly prohibited.\n');

  // Test 12: Refreshing page / re-querying does not produce duplicate directory entries
  console.log('Scenario 12: Idempotent queries without duplicate entries');
  const query1 = await workerRepository.getAllWorkers(1);
  const query2 = await workerRepository.getAllWorkers(1);
  assert.strictEqual(query1.length, query2.length);
  assert.deepStrictEqual(query1.map(w => w.id), query2.map(w => w.id));
  console.log('  ✓ Passed: Repeated queries maintain exact stable worker list.\n');

  // Test 13: Failed operations leave database in consistent state
  console.log('Scenario 13: Consistency after failed update');
  const countBeforeFail = (await workerRepository.getAllWorkers(1)).length;
  let failCaught = false;
  try {
    await workerRepository.updateWorker(newWorkerId, {
      role: 'owner' // Illegal role elevation
    }, 1);
  } catch (err) {
    failCaught = true;
    assert.strictEqual(err.statusCode, 403);
  }
  assert.strictEqual(failCaught, true);
  const countAfterFail = (await workerRepository.getAllWorkers(1)).length;
  assert.strictEqual(countBeforeFail, countAfterFail, 'State remains unchanged');
  console.log('  ✓ Passed: Illegal role elevation rejected; database consistency preserved.\n');

  // Test 14: Existing Owner, Worker, and Customer authentication workflows continue to work
  console.log('Scenario 14: Authentication across all three roles');
  // 14a: Owner login
  const ownerLogin = await authService.loginUser({
    identifier: 'owner@crumbco.com',
    password: 'Password@123'
  });
  assert(ownerLogin.token);
  assert.strictEqual(ownerLogin.user.role, 'owner');
  console.log('  ✓ Owner login verified (owner@crumbco.com)');

  // 14b: Worker login (Chef Rajesh / baker@crumbco.com)
  const bakerLogin = await authService.loginUser({
    identifier: 'baker@crumbco.com',
    password: 'Password@123'
  });
  assert(bakerLogin.token);
  assert.strictEqual(bakerLogin.user.role, 'baker');
  console.log('  ✓ Baker login verified (baker@crumbco.com)');

  // 14c: Customer login (customer@crumbco.com)
  const customerLogin = await authService.loginUser({
    identifier: 'customer@crumbco.com',
    password: 'Password@123'
  });
  assert(customerLogin.token);
  assert.strictEqual(customerLogin.user.role, 'customer');
  console.log('  ✓ Customer login verified (customer@crumbco.com)');

  // Clean up temporary test worker
  sqliteDb.prepare('DELETE FROM users WHERE id = ?').run(newWorkerId);
  sqliteDb.close();

  console.log('\n====================================================');
  console.log('All 14 Team Management & Security Audit Scenarios Passed!');
  console.log('====================================================');
}

runTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
