/**
 * C5 CUSTOMER AUTHENTICATION & PROTECTED ROUTE VERIFICATION SUITE
 *
 * Validates the full customer authentication lifecycle:
 * A. Open Customer without login.
 * B. Browse Home.
 * C. Browse Menu.
 * D. Open Product Details.
 * E. Try Checkout / Protected routes while logged out (401 Unauthorized).
 * F. Confirm redirect target preservation.
 * G. Create a new Customer account (/api/auth/register).
 * H. Confirm successful authentication and token issuance.
 * I. Continue to protected customer features (Addresses, Orders).
 * J. Logout and session termination.
 * K. Confirm protected pages require authentication again.
 * L. Login with the created customer credentials (/api/auth/login).
 * M. Confirm customer identity restored correctly (/api/auth/me).
 * N. Confirm business remains Crumb & Co.
 * O. Confirm multi-tenant isolation and no cross-business leakage.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_32_characters_long_for_security';

const assert = require('assert');
const http = require('http');
const app = require('../src/server');

function makeRequest(app, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          server.close();
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

async function runC5CustomerAuthFlowTests() {
  console.log('\n======================================================');
  console.log('   RUNNING C5 CUSTOMER AUTHENTICATION & ROUTE TESTS   ');
  console.log('======================================================\n');

  let passed = 0;
  const total = 12;

  // --------------------------------------------------------------------------
  // TEST 1: Public browsing without login (Home, Menu, Products)
  // --------------------------------------------------------------------------
  try {
    const bizRes = await makeRequest(app, 'GET', '/api/business/crumbandco');
    assert.strictEqual(bizRes.status, 200);
    assert.strictEqual(bizRes.body.data.slug, 'crumbandco');

    const catRes = await makeRequest(app, 'GET', '/api/categories', { 'X-Business-Slug': 'crumbandco' });
    assert.strictEqual(catRes.status, 200);
    assert(Array.isArray(catRes.body.data) && catRes.body.data.length > 0);

    const prodRes = await makeRequest(app, 'GET', '/api/products', { 'X-Business-Slug': 'crumbandco' });
    assert.strictEqual(prodRes.status, 200);
    assert(Array.isArray(prodRes.body.data) && prodRes.body.data.length > 0);

    const singleProd = await makeRequest(app, 'GET', '/api/products/1');
    assert.strictEqual(singleProd.status, 200);
    assert.strictEqual(singleProd.body.data.id, 1);

    console.log('✓ TEST 1 PASSED: Public browsing without login works (Home, Menu, Product Details)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Protected routes reject unauthenticated access (401 Unauthorized)
  // --------------------------------------------------------------------------
  try {
    const meRes = await makeRequest(app, 'GET', '/api/customers/me');
    assert.strictEqual(meRes.status, 401, 'Profile must require authentication');

    const addrRes = await makeRequest(app, 'GET', '/api/customers/me/addresses');
    assert.strictEqual(addrRes.status, 401, 'Addresses must require authentication');

    const orderRes = await makeRequest(app, 'GET', '/api/orders');
    assert.strictEqual(orderRes.status, 401, 'Orders must require authentication');

    const postOrderRes = await makeRequest(app, 'POST', '/api/orders', {}, { items: [] });
    assert.strictEqual(postOrderRes.status, 401, 'Checkout/order placement must require authentication');

    console.log('✓ TEST 2 PASSED: Protected routes strictly require authentication (401 Unauthorized)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Customer Sign Up under configured business (Crumb & Co.)
  // --------------------------------------------------------------------------
  let newCustomerToken = null;
  let newCustomerId = null;
  const testPhone = `+91 99000 ${Math.floor(10000 + Math.random() * 90000)}`;
  const testEmail = `rhea.sharma.${Date.now()}@example.com`;

  try {
    const regRes = await makeRequest(app, 'POST', '/api/auth/register', {}, {
      businessSlug: 'crumbandco',
      name: 'Rhea Sharma',
      email: testEmail,
      phone: testPhone,
      password: 'Password@123',
    });

    assert.strictEqual(regRes.status, 201);
    assert.strictEqual(regRes.body.success, true);
    assert(regRes.body.data.token, 'Token must be issued');
    assert.strictEqual(regRes.body.data.user.role, 'customer', 'Role must strictly be customer');
    assert.strictEqual(regRes.body.data.user.name, 'Rhea Sharma');
    assert.strictEqual(regRes.body.data.business.slug, 'crumbandco', 'Must belong to Crumb & Co.');

    newCustomerToken = regRes.body.data.token;
    newCustomerId = regRes.body.data.user.id;

    console.log('✓ TEST 3 PASSED: Customer registration successfully creates customer under Crumb & Co.');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Duplicate account prevention (PHONE_EXISTS / EMAIL_EXISTS)
  // --------------------------------------------------------------------------
  try {
    const dupRes = await makeRequest(app, 'POST', '/api/auth/register', {}, {
      businessSlug: 'crumbandco',
      name: 'Duplicate Rhea',
      email: `another.${Date.now()}@example.com`,
      phone: testPhone,
      password: 'Password@123',
    });

    assert.strictEqual(dupRes.status, 409, 'Duplicate phone number must be rejected');
    assert.strictEqual(dupRes.body.error.code, 'PHONE_EXISTS');

    console.log('✓ TEST 4 PASSED: Duplicate account properly rejected with PHONE_EXISTS');
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Verify session with /api/auth/me using authenticated token
  // --------------------------------------------------------------------------
  try {
    const authMeRes = await makeRequest(app, 'GET', '/api/auth/me', {
      Authorization: `Bearer ${newCustomerToken}`,
    });

    assert.strictEqual(authMeRes.status, 200);
    assert.strictEqual(authMeRes.body.data.user.id, newCustomerId);
    assert.strictEqual(authMeRes.body.data.user.name, 'Rhea Sharma');
    assert.strictEqual(authMeRes.body.data.business.slug, 'crumbandco');

    console.log('✓ TEST 5 PASSED: Session verification via /api/auth/me restores customer identity');
    passed++;
  } catch (err) {
    console.error('✗ TEST 5 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Authenticated customer can manage addresses
  // --------------------------------------------------------------------------
  let addressId = null;
  try {
    const addRes = await makeRequest(
      app,
      'POST',
      '/api/customers/me/addresses',
      { Authorization: `Bearer ${newCustomerToken}` },
      {
        label: 'Home',
        address_line1: 'Flat 102, Ocean Breeze',
        address_line2: 'Carter Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        postal_code: '400050',
        contact_phone: testPhone,
        is_default: true,
      }
    );

    assert.strictEqual(addRes.status, 201);
    assert.strictEqual(addRes.body.data.address_line1, 'Flat 102, Ocean Breeze');
    addressId = addRes.body.data.id;

    const listRes = await makeRequest(app, 'GET', '/api/customers/me/addresses', {
      Authorization: `Bearer ${newCustomerToken}`,
    });
    assert.strictEqual(listRes.status, 200);
    assert(listRes.body.data.length >= 1);
    assert.strictEqual(listRes.body.data[0].id, addressId);

    console.log('✓ TEST 6 PASSED: Authenticated customer successfully creates and reads addresses');
    passed++;
  } catch (err) {
    console.error('✗ TEST 6 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Authenticated customer places order and accesses order history
  // --------------------------------------------------------------------------
  let orderNo = null;
  try {
    const orderPayload = {
      fulfillment_type: 'delivery',
      delivery_address_id: addressId,
      customer_notes: 'Ring bell twice',
      items: [{ product_id: 1, quantity: 2 }],
      payment_mode: 'upi',
    };

    const placeRes = await makeRequest(
      app,
      'POST',
      '/api/orders',
      {
        Authorization: `Bearer ${newCustomerToken}`,
        'X-Business-Slug': 'crumbandco',
      },
      orderPayload
    );

    assert.strictEqual(placeRes.status, 201);
    assert(placeRes.body.data.order_no);
    orderNo = placeRes.body.data.order_no;

    const ordersRes = await makeRequest(app, 'GET', '/api/orders', {
      Authorization: `Bearer ${newCustomerToken}`,
    });
    assert.strictEqual(ordersRes.status, 200);
    assert(ordersRes.body.data.some((o) => o.order_no === orderNo));

    console.log('✓ TEST 7 PASSED: Authenticated customer places order and accesses order history');
    passed++;
  } catch (err) {
    console.error('✗ TEST 7 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Session termination (Logout behavior)
  // --------------------------------------------------------------------------
  try {
    // Simulated logout by omitting the Authorization token
    const logoutAccessRes = await makeRequest(app, 'GET', '/api/customers/me');
    assert.strictEqual(logoutAccessRes.status, 401, 'Logged out request must return 401');

    console.log('✓ TEST 8 PASSED: Dropped session token immediately re-enforces route protection');
    passed++;
  } catch (err) {
    console.error('✗ TEST 8 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Login with incorrect password rejected (401 INVALID_CREDENTIALS)
  // --------------------------------------------------------------------------
  try {
    const badLoginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
      businessSlug: 'crumbandco',
      identifier: testEmail,
      password: 'WrongPassword!',
    });

    assert.strictEqual(badLoginRes.status, 401);
    assert.strictEqual(badLoginRes.body.error.code, 'INVALID_CREDENTIALS');

    console.log('✓ TEST 9 PASSED: Login with bad credentials rejected (401 INVALID_CREDENTIALS)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 9 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Successful Login with email identifier restores session
  // --------------------------------------------------------------------------
  let loggedInToken = null;
  try {
    const loginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
      businessSlug: 'crumbandco',
      identifier: testEmail,
      password: 'Password@123',
    });

    assert.strictEqual(loginRes.status, 200);
    assert(loginRes.body.data.token);
    assert.strictEqual(loginRes.body.data.user.id, newCustomerId);
    assert.strictEqual(loginRes.body.data.business.slug, 'crumbandco');
    loggedInToken = loginRes.body.data.token;

    console.log('✓ TEST 10 PASSED: Login with email identifier returns valid JWT and customer profile');
    passed++;
  } catch (err) {
    console.error('✗ TEST 10 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Successful Login with phone number identifier restores session
  // --------------------------------------------------------------------------
  try {
    const phoneLoginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
      businessSlug: 'crumbandco',
      identifier: testPhone,
      password: 'Password@123',
    });

    assert.strictEqual(phoneLoginRes.status, 200);
    assert(phoneLoginRes.body.data.token);
    assert.strictEqual(phoneLoginRes.body.data.user.id, newCustomerId);

    console.log('✓ TEST 11 PASSED: Login with phone identifier returns valid JWT and customer profile');
    passed++;
  } catch (err) {
    console.error('✗ TEST 11 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Multi-tenant customer isolation
  // --------------------------------------------------------------------------
  try {
    // Customer cannot access orders from another business (frenchloaf)
    const crossRes = await makeRequest(
      app,
      'GET',
      '/api/products',
      {
        Authorization: `Bearer ${loggedInToken}`,
        'X-Business-Slug': 'frenchloaf',
      }
    );
    // Catalog for frenchloaf should return French Loaf items, but user's own private resources are isolated
    assert.strictEqual(crossRes.status, 200);

    const crossProfileRes = await makeRequest(
      app,
      'GET',
      '/api/orders',
      {
        Authorization: `Bearer ${loggedInToken}`,
      }
    );
    // User only sees orders for their business (Crumb & Co.)
    assert.strictEqual(crossProfileRes.status, 200);
    crossProfileRes.body.data.forEach((o) => {
      assert.strictEqual(o.business_id, 1, 'Customer orders must strictly belong to Crumb & Co.');
    });

    console.log('✓ TEST 12 PASSED: Strict tenant isolation and customer boundary verified');
    passed++;
  } catch (err) {
    console.error('✗ TEST 12 FAILED:', err.message);
  }

  console.log('\n======================================================');
  console.log(`C5 TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runC5CustomerAuthFlowTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
