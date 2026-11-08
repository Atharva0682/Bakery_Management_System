process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_jwt_crumbco_2026';

const assert = require('assert');
const workerRepository = require('../src/models/workerRepository');
const authService = require('../src/services/authService');
const db = require('../src/config/db');

async function runPromptPTests() {
  console.log('\n======================================================');
  console.log(' PROMPT P: STAFF ONBOARDING & CREDENTIAL GENERATION TESTS');
  console.log('======================================================\n');

  let passed = 0;
  const total = 4;

  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const testEmail = `baker.test${randSuffix}@crumbco.com`;
  let tempPassword = '';

  // TEST 1: Onboard worker creates user with must_change_password = 1
  try {
    const result = await workerRepository.onboardWorker({
      businessId: 1,
      name: `Test Baker ${randSuffix}`,
      email: testEmail,
      phone: `+91 98201 ${randSuffix}`,
      role: 'baker',
      shift: 'Morning Shift',
      dailyWage: 1200
    });

    assert.ok(result.user, 'User object must be returned');
    assert.strictEqual(result.user.email, testEmail);
    assert.strictEqual(result.user.role, 'baker');
    assert.strictEqual(Number(result.user.must_change_password), 1, 'must_change_password must be set to 1');
    assert.ok(result.temporary_password, 'Temporary password must be returned');
    assert.ok(result.temporary_password.length >= 8, 'Temporary password must be strong');

    tempPassword = result.temporary_password;

    console.log('✓ TEST 1 PASSED: Staff member onboarded, temporary password generated, must_change_password=1');
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // TEST 2: Temporary credentials authenticate successfully
  try {
    const authResult = await authService.loginUser({ identifier: testEmail, password: tempPassword });
    assert.strictEqual(authResult.user.email, testEmail);
    assert.strictEqual(authResult.user.role, 'baker');
    assert.ok(authResult.token, 'JWT token must be returned on valid login');

    console.log('✓ TEST 2 PASSED: Generated temporary credentials authenticate successfully');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // TEST 3: Duplicate email onboarding is rejected with 409
  try {
    let threw = false;
    try {
      await workerRepository.onboardWorker({
        businessId: 1,
        name: `Duplicate Baker`,
        email: testEmail,
        phone: '+91 99999 00000',
        role: 'baker',
        shift: 'Morning Shift',
        dailyWage: 1200
      });
    } catch (e) {
      threw = true;
      assert.strictEqual(e.code, 'EMAIL_EXISTS', 'Error code must be EMAIL_EXISTS');
    }
    assert.strictEqual(threw, true, 'Must throw error on duplicate email');

    console.log('✓ TEST 3 PASSED: Duplicate staff email is strictly rejected');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // TEST 4: Onboarded worker appears in getAllWorkers list
  try {
    const list = await workerRepository.getAllWorkers(1);
    const found = list.find(w => w.email === testEmail);
    assert.ok(found, 'Newly onboarded staff must appear in staff directory');
    assert.strictEqual(found.name, `Test Baker ${randSuffix}`);
    assert.strictEqual(found.role, 'Artisanal Deck Baker');

    console.log('✓ TEST 4 PASSED: Onboarded staff immediately appears in team roster');
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  console.log(`\nPROMPT P TEST SUMMARY: ${passed}/${total} passed\n`);
  if (passed !== total) process.exit(1);
}

runPromptPTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
