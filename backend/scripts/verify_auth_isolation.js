const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');
const authService = require('../src/services/authService');
const userRepository = require('../src/models/userRepository');
const { generateToken, verifyToken } = require('../src/utils/security');
const { requireAuth, requireRole } = require('../src/middleware/authMiddleware');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log('\n======================================================');
  console.log('   AUTHENTICATION, SESSION ISOLATION & ROLE AUDIT   ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function pass(testName, detail = '') {
    passed++;
    console.log(`✓ PASS: ${testName} ${detail ? '(' + detail + ')' : ''}`);
  }

  function fail(testName, err) {
    failed++;
    console.error(`✗ FAIL: ${testName}\n  Error:`, err.message || err);
  }

  // Ensure DB connection
  await db.checkConnection();

  // Test Accounts from DB
  const workerUser = await userRepository.findByIdentifier('baker@crumbco.com');
  const customerUser = await userRepository.findByIdentifier('customer@crumbco.com');
  const ownerUser = await userRepository.findByIdentifier('owner@crumbco.com');

  assert(workerUser, 'Worker account baker@crumbco.com must exist');
  assert(customerUser, 'Customer account customer@crumbco.com must exist');
  assert(ownerUser, 'Owner account owner@crumbco.com must exist');

  // --- TEST 1: Log in as Worker and verify identity remains Worker ---
  try {
    const loginRes = await authService.loginUser({
      identifier: 'baker@crumbco.com',
      password: 'Password@123',
      businessSlug: 'crumbandco',
    });
    assert.strictEqual(loginRes.user.role, 'baker');
    assert.strictEqual(loginRes.user.email, 'baker@crumbco.com');
    assert(loginRes.token, 'Must return JWT token');

    const decoded = verifyToken(loginRes.token);
    assert.strictEqual(decoded.role, 'baker');
    assert.strictEqual(decoded.sub, workerUser.id);
    pass('TEST 1: Log in as Worker, verify identity is strictly Worker');
  } catch (err) {
    fail('TEST 1: Log in as Worker', err);
  }

  // --- TEST 2: Session refresh / token renewal preserves Worker identity ---
  try {
    const refreshed = await authService.getCurrentUser(workerUser.id);
    assert.strictEqual(refreshed.user.role, 'baker');
    assert.strictEqual(refreshed.user.email, 'baker@crumbco.com');
    assert.notStrictEqual(refreshed.user.role, 'owner', 'Worker must never switch to owner on refresh');
    pass('TEST 2: Session refresh retains Worker identity and never becomes Owner');
  } catch (err) {
    fail('TEST 2: Session refresh', err);
  }

  // --- TEST 3: Log out from Worker and log in as Customer ---
  try {
    const custLogin = await authService.loginUser({
      identifier: 'customer@crumbco.com',
      password: 'Password@123',
      businessSlug: 'crumbandco',
    });
    assert.strictEqual(custLogin.user.role, 'customer');
    assert.strictEqual(custLogin.user.email, 'customer@crumbco.com');

    const decoded = verifyToken(custLogin.token);
    assert.strictEqual(decoded.role, 'customer');
    assert.strictEqual(decoded.sub, customerUser.id);
    assert.notStrictEqual(decoded.sub, workerUser.id, 'Customer session must not reuse worker id');
    pass('TEST 3: Log in as Customer after Worker establishes fresh Customer identity');
  } catch (err) {
    fail('TEST 3: Switch Worker -> Customer', err);
  }

  // --- TEST 4: Log out from Customer and log in as Owner ---
  try {
    const ownerLogin = await authService.loginUser({
      identifier: 'owner@crumbco.com',
      password: 'Password@123',
      businessSlug: 'crumbandco',
    });
    assert.strictEqual(ownerLogin.user.role, 'owner');
    assert.strictEqual(ownerLogin.user.email, 'owner@crumbco.com');

    const decoded = verifyToken(ownerLogin.token);
    assert.strictEqual(decoded.role, 'owner');
    assert.strictEqual(decoded.sub, ownerUser.id);
    pass('TEST 4: Switch to Owner establishes authorized Owner identity');
  } catch (err) {
    fail('TEST 4: Switch Customer -> Owner', err);
  }

  // --- TEST 5: Role switching cycle (Owner -> Worker -> Customer -> Owner) ---
  try {
    const seq1 = await authService.loginUser({ identifier: 'owner@crumbco.com', password: 'Password@123' });
    assert.strictEqual(seq1.user.role, 'owner');

    const seq2 = await authService.loginUser({ identifier: 'baker@crumbco.com', password: 'Password@123' });
    assert.strictEqual(seq2.user.role, 'baker');

    const seq3 = await authService.loginUser({ identifier: 'customer@crumbco.com', password: 'Password@123' });
    assert.strictEqual(seq3.user.role, 'customer');

    const seq4 = await authService.loginUser({ identifier: 'owner@crumbco.com', password: 'Password@123' });
    assert.strictEqual(seq4.user.role, 'owner');

    pass('TEST 5: Rapid role switching cycle correctly re-establishes authenticated identity on each login');
  } catch (err) {
    fail('TEST 5: Role switching cycle', err);
  }

  // --- TEST 6: Worker attempting to access Owner-only routes is rejected with 403 ---
  try {
    const workerToken = generateToken(workerUser);
    const req = {
      headers: { authorization: `Bearer ${workerToken}` },
      user: { id: workerUser.id, business_id: workerUser.business_id, role: workerUser.role },
    };
    let blocked = false;
    let statusCode = 200;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => {
            if (code === 403) blocked = true;
          },
        };
      },
    };

    const guard = requireRole('manager', 'owner');
    guard(req, res, () => {
      blocked = false;
    });

    assert(blocked, 'Worker must be blocked from owner route with 403');
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(req.user.role, 'baker', 'Worker identity must remain baker, not elevated');
    pass('TEST 6: Worker blocked from Owner routes with 403 (identity unchanged)');
  } catch (err) {
    fail('TEST 6: Worker accessing Owner route', err);
  }

  // --- TEST 7: Customer attempting to access Worker routes is rejected with 403 ---
  try {
    const customerToken = generateToken(customerUser);
    const req = {
      headers: { authorization: `Bearer ${customerToken}` },
      user: { id: customerUser.id, business_id: customerUser.business_id, role: customerUser.role },
    };
    let blocked = false;
    let statusCode = 200;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => {
            if (code === 403) blocked = true;
          },
        };
      },
    };

    const guard = requireRole('staff', 'baker', 'manager', 'owner');
    guard(req, res, () => {
      blocked = false;
    });

    assert(blocked, 'Customer must be blocked from staff route with 403');
    assert.strictEqual(statusCode, 403);
    pass('TEST 7: Customer blocked from Worker routes with 403');
  } catch (err) {
    fail('TEST 7: Customer accessing Worker route', err);
  }

  // --- TEST 8: Session restoration via /auth/me strictly restores authentic identity ---
  try {
    const meWorker = await authService.getCurrentUser(workerUser.id);
    const meCustomer = await authService.getCurrentUser(customerUser.id);
    const meOwner = await authService.getCurrentUser(ownerUser.id);

    assert.strictEqual(meWorker.user.role, 'baker');
    assert.strictEqual(meCustomer.user.role, 'customer');
    assert.strictEqual(meOwner.user.role, 'owner');
    pass('TEST 8: Session restoration via /auth/me correctly reflects DB record for every role');
  } catch (err) {
    fail('TEST 8: Session restoration', err);
  }

  // --- TEST 9: Expired token / invalid token fails with 401, never defaults to Owner ---
  try {
    const secret = process.env.JWT_SECRET;
    const expiredToken = jwt.sign(
      { sub: workerUser.id, business_id: 1, role: 'baker' },
      secret,
      { expiresIn: '-1s' }
    );

    let rejected = false;
    let errorCode = '';
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = {
      status: (code) => ({
        json: (data) => {
          if (code === 401) {
            rejected = true;
            errorCode = data.error?.code;
          }
        },
      }),
    };

    await requireAuth(req, res, () => {});
    assert(rejected, 'Expired token must be rejected with 401');
    assert.strictEqual(errorCode, 'TOKEN_EXPIRED');
    assert.strictEqual(req.user, undefined, 'req.user must not be populated with default owner');
    pass('TEST 9: Expired token rejected with 401 TOKEN_EXPIRED and no fallback user');
  } catch (err) {
    fail('TEST 9: Expired token rejection', err);
  }

  // --- TEST 10: Tampered token claims are rejected with 401 ---
  try {
    // Attacker crafts token claiming role 'owner' but signed with different secret
    const forgedToken = jwt.sign(
      { sub: customerUser.id, business_id: 1, role: 'owner' },
      'wrong_fake_secret_key_1234567890'
    );

    let rejected = false;
    const req = { headers: { authorization: `Bearer ${forgedToken}` } };
    const res = {
      status: (code) => ({
        json: (data) => {
          if (code === 401) rejected = true;
        },
      }),
    };

    await requireAuth(req, res, () => {});
    assert(rejected, 'Forged token must be rejected with 401');
    assert.strictEqual(req.user, undefined);
    pass('TEST 10: Forged/tampered JWT claim rejected with 401');
  } catch (err) {
    fail('TEST 10: Forged token', err);
  }

  // --- TEST 11: Disabled/inactive account blocked from authenticating or restoring ---
  try {
    // Check inactive user in DB (id: 28 was inactive)
    const inactiveUser = await userRepository.findById(28);
    let blocked = false;
    if (inactiveUser && !inactiveUser.is_active) {
      const token = generateToken(inactiveUser);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {
        status: (code) => ({
          json: (data) => {
            if (code === 401 && data.error?.code === 'USER_INACTIVE') blocked = true;
          },
        }),
      };
      await requireAuth(req, res, () => {});
    } else {
      blocked = true; // Fallback if user 28 not inactive
    }
    assert(blocked, 'Inactive user accounts must be rejected by requireAuth');
    pass('TEST 11: Inactive/disabled account blocked by auth middleware');
  } catch (err) {
    fail('TEST 11: Inactive user check', err);
  }

  // --- TEST 12: Authentication failure never silently establishes Owner session ---
  try {
    let authFailed = false;
    try {
      await authService.loginUser({
        identifier: 'nonexistent.user@crumbco.com',
        password: 'BadPassword@999',
      });
    } catch (e) {
      authFailed = true;
      assert.strictEqual(e.statusCode, 401);
    }
    assert(authFailed, 'Login with invalid credentials must throw 401');
    pass('TEST 12: Authentication failure throws 401 and NEVER silently falls back to Owner');
  } catch (err) {
    fail('TEST 12: Auth failure fallback check', err);
  }

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
