/**
 * Comprehensive Authentication & Authorization Test Suite
 * Tests all 14 required security scenarios in isolation
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_super_secret_jwt_key_2026_bakery';

const assert = require('assert');
const jwt = require('jsonwebtoken');
const { hashPassword, comparePassword, generateToken, sanitizeUser } = require('../src/utils/security');
const authService = require('../src/services/authService');
const { requireAuth, requireRole, requireTenantScope, requireSelfOrStaff } = require('../src/middleware/authMiddleware');
const userRepository = require('../src/models/userRepository');

// Mock Express response generator
function createMockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('   RUNNING AUTHENTICATION & AUTHORIZATION TEST SUITE   ');
  console.log('======================================================\n');

  let passed = 0;
  let total = 14;

  // --------------------------------------------------------------------------
  // TEST 1: Password hashing
  // --------------------------------------------------------------------------
  try {
    const rawPass = 'Secret@1234';
    const hash = await hashPassword(rawPass);
    assert(hash !== rawPass, 'Hash must not equal plain text');
    assert(hash.startsWith('$2a$') || hash.startsWith('$2b$'), 'Must be valid bcrypt hash');
    const isMatch = await comparePassword(rawPass, hash);
    assert.strictEqual(isMatch, true, 'Matching password must return true');
    const isMismatch = await comparePassword('WrongPassword', hash);
    assert.strictEqual(isMismatch, false, 'Non-matching password must return false');
    console.log('✓ TEST 1 PASSED: Password hashing & verification');
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Valid login
  // --------------------------------------------------------------------------
  try {
    const db = require('../src/config/db');
    await db.query("DELETE FROM users WHERE email = 'rohan.test@gmail.com'");

    // Setup test user with hashed password
    const testHash = await hashPassword('Bakery@2026');
    const user = await userRepository.create({
      business_id: 1,
      name: 'Rohan Sharma',
      email: 'rohan.test@gmail.com',
      phone: '+91-99999-00001',
      password_hash: testHash,
      role: 'customer',
    });

    const loginRes = await authService.loginUser({
      businessSlug: 'crumbandco',
      identifier: 'rohan.test@gmail.com',
      password: 'Bakery@2026',
    });

    assert(loginRes.token, 'Must return signed token');
    assert.strictEqual(loginRes.user.email, 'rohan.test@gmail.com');
    assert.strictEqual(loginRes.user.password_hash, undefined, 'Must not return password_hash');
    assert.strictEqual(loginRes.business.slug, 'crumbandco');
    console.log('✓ TEST 2 PASSED: Valid login succeeds and returns sanitized payload');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Invalid password
  // --------------------------------------------------------------------------
  try {
    let failed = false;
    try {
      await authService.loginUser({
        businessSlug: 'crumbandco',
        identifier: 'rohan.test@gmail.com',
        password: 'IncorrectPassword',
      });
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_CREDENTIALS');
      assert.strictEqual(err.statusCode, 401);
      failed = true;
    }
    assert(failed, 'Login with incorrect password must throw 401 INVALID_CREDENTIALS');
    console.log('✓ TEST 3 PASSED: Invalid password rejected with 401');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Invalid token
  // --------------------------------------------------------------------------
  try {
    const req = { headers: { authorization: 'Bearer this.is.an.invalid.token' } };
    const res = createMockRes();
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Next must not be called on invalid token');
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error.code, 'INVALID_TOKEN');
    console.log('✓ TEST 4 PASSED: Invalid token rejected with 401');
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Expired token
  // --------------------------------------------------------------------------
  try {
    // Generate an expired token (-10 seconds)
    const expiredToken = jwt.sign(
      { sub: 1, business_id: 1, role: 'owner', exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = createMockRes();
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error.code, 'TOKEN_EXPIRED');
    console.log('✓ TEST 5 PASSED: Expired token rejected with 401 TOKEN_EXPIRED');
    passed++;
  } catch (err) {
    console.error('✗ TEST 5 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Missing token
  // --------------------------------------------------------------------------
  try {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error.code, 'AUTH_REQUIRED');
    console.log('✓ TEST 6 PASSED: Missing token rejected with 401 AUTH_REQUIRED');
    passed++;
  } catch (err) {
    console.error('✗ TEST 6 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Customer role authorization
  // --------------------------------------------------------------------------
  try {
    const req = { user: { id: 4, business_id: 1, role: 'customer' } };
    const res = createMockRes();
    let nextCalled = false;

    requireRole('customer')(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Customer role must pass requireRole("customer")');
    console.log('✓ TEST 7 PASSED: Customer role authorized');
    passed++;
  } catch (err) {
    console.error('✗ TEST 7 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Staff role authorization
  // --------------------------------------------------------------------------
  try {
    const bakerReq = { user: { id: 3, business_id: 1, role: 'baker' } };
    const res1 = createMockRes();
    let next1 = false;
    requireRole('staff', 'baker', 'manager')(bakerReq, res1, () => { next1 = true; });
    assert.strictEqual(next1, true, 'Baker must pass staff/baker/manager check');

    const staffReq = { user: { id: 12, business_id: 2, role: 'staff' } };
    const res2 = createMockRes();
    let next2 = false;
    requireRole('staff', 'baker', 'manager')(staffReq, res2, () => { next2 = true; });
    assert.strictEqual(next2, true, 'Staff must pass staff/baker/manager check');

    console.log('✓ TEST 8 PASSED: Staff/Baker role authorized');
    passed++;
  } catch (err) {
    console.error('✗ TEST 8 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Owner role authorization
  // --------------------------------------------------------------------------
  try {
    const req = { user: { id: 1, business_id: 1, role: 'owner' } };
    const res = createMockRes();
    let nextCalled = false;

    requireRole('owner')(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Owner role must pass requireRole("owner")');
    console.log('✓ TEST 9 PASSED: Owner role authorized');
    passed++;
  } catch (err) {
    console.error('✗ TEST 9 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Customer cannot access owner-only route
  // --------------------------------------------------------------------------
  try {
    const req = { user: { id: 4, business_id: 1, role: 'customer' } };
    const res = createMockRes();
    let nextCalled = false;

    requireRole('owner')(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Customer must not access owner route');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN_ROLE');
    console.log('✓ TEST 10 PASSED: Customer blocked from owner route with 403 FORBIDDEN_ROLE');
    passed++;
  } catch (err) {
    console.error('✗ TEST 10 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Staff cannot access owner-only route
  // --------------------------------------------------------------------------
  try {
    const req = { user: { id: 3, business_id: 1, role: 'baker' } };
    const res = createMockRes();
    let nextCalled = false;

    requireRole('owner')(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Staff/baker must not access owner route');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN_ROLE');
    console.log('✓ TEST 11 PASSED: Staff blocked from owner route with 403 FORBIDDEN_ROLE');
    passed++;
  } catch (err) {
    console.error('✗ TEST 11 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Business A user cannot access Business B resource
  // --------------------------------------------------------------------------
  try {
    // User belongs to Business 1 (Crumb & Co.)
    const req = {
      user: { id: 4, business_id: 1, role: 'customer' },
      params: { businessId: 2 }, // Attempting to access Business 2 (The French Loaf) resource
    };
    const res = createMockRes();
    let nextCalled = false;

    requireTenantScope('businessId')(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Cross-tenant access must be rejected');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN_TENANT');
    console.log('✓ TEST 12 PASSED: Cross-tenant access blocked with 403 FORBIDDEN_TENANT');
    passed++;
  } catch (err) {
    console.error('✗ TEST 12 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 13: Customer cannot access another customer's resource
  // --------------------------------------------------------------------------
  try {
    // Customer 4 (Ananya) attempting to access Customer 13 (Vikram)'s private order
    const req = {
      user: { id: 4, business_id: 1, role: 'customer' },
      params: { userId: 13 },
    };
    const res = createMockRes();
    let nextCalled = false;

    requireSelfOrStaff('userId')(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Customer cannot access another customer private resource');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN_RESOURCE');

    // Verify self-access succeeds
    const selfReq = { user: { id: 4, business_id: 1, role: 'customer' }, params: { userId: 4 } };
    let selfNext = false;
    requireSelfOrStaff('userId')(selfReq, createMockRes(), () => { selfNext = true; });
    assert.strictEqual(selfNext, true, 'Self-access must be permitted');

    console.log('✓ TEST 13 PASSED: Customer self-access enforced; access to another customer blocked');
    passed++;
  } catch (err) {
    console.error('✗ TEST 13 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 14: Owner cannot access another business
  // --------------------------------------------------------------------------
  try {
    // Owner of Business 1 (Elena) attempting to access Business 2 analytics
    const req = {
      user: { id: 1, business_id: 1, role: 'owner' },
      params: { businessId: 2 },
    };
    const res = createMockRes();
    let nextCalled = false;

    requireTenantScope('businessId')(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Owner of Business 1 cannot access Business 2');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN_TENANT');
    console.log('✓ TEST 14 PASSED: Owner blocked from accessing another business (403 FORBIDDEN_TENANT)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 14 FAILED:', err.message);
  }

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
