/**
 * Customer API Test Suite
 * Tests all 14 Customer API and security scenarios
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_super_secret_jwt_key_2026_bakery';

const assert = require('assert');
const catalogService = require('../src/services/catalogService');
const customerService = require('../src/services/customerService');
const orderService = require('../src/services/orderService');
const feedbackService = require('../src/services/feedbackService');
const addressRepository = require('../src/models/addressRepository');
const orderRepository = require('../src/models/orderRepository');

async function runCustomerApiTests() {
  console.log('\n======================================================');
  console.log('       RUNNING CUSTOMER API FOUNDATION TEST SUITE      ');
  console.log('======================================================\n');

  let passed = 0;
  let total = 14;

  // --------------------------------------------------------------------------
  // TEST 1: Business lookup (Safe public attributes only)
  // --------------------------------------------------------------------------
  try {
    const business = await catalogService.getPublicBusiness('crumbandco');
    assert.strictEqual(business.name, 'Crumb & Co.');
    assert.strictEqual(business.slug, 'crumbandco');
    assert(business.branding.primaryColor, 'Must return primary branding color');
    assert.strictEqual(business.currency, 'INR');
    assert.strictEqual(business.password_hash, undefined, 'Must NEVER return password hashes');
    assert.strictEqual(business.upi_vpa, undefined, 'Must not expose internal UPI private data in public profile');
    console.log('✓ TEST 1 PASSED: Public business lookup by slug');
    passed++;
  } catch (err) {
    console.error('✗ TEST 1 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Product listing
  // --------------------------------------------------------------------------
  try {
    const products = await catalogService.getProducts({ businessId: 1 });
    assert(Array.isArray(products), 'Products must be an array');
    assert(products.length > 0, 'Business 1 must have products');
    assert(products.every((p) => p.business_id === 1), 'All products must belong to Business 1');
    console.log('✓ TEST 2 PASSED: Product listing for active business');
    passed++;
  } catch (err) {
    console.error('✗ TEST 2 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Category listing
  // --------------------------------------------------------------------------
  try {
    const categories = await catalogService.getCategories(1);
    assert(Array.isArray(categories), 'Categories must be an array');
    assert(categories.some((c) => c.slug === 'artisan-breads'), 'Must contain Artisan Breads');
    assert(categories.every((c) => c.business_id === 1), 'All categories must belong to Business 1');
    console.log('✓ TEST 3 PASSED: Category listing for active business');
    passed++;
  } catch (err) {
    console.error('✗ TEST 3 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Cross-business product isolation
  // --------------------------------------------------------------------------
  try {
    const business1Prods = await catalogService.getProducts({ businessId: 1 });
    const business2Prods = await catalogService.getProducts({ businessId: 2 });

    const b1Ids = business1Prods.map((p) => p.id);
    const b2Ids = business2Prods.map((p) => p.id);

    // Assert intersection is completely empty
    const overlap = b1Ids.filter((id) => b2Ids.includes(id));
    assert.strictEqual(overlap.length, 0, 'No products may leak between Business 1 and Business 2');
    console.log('✓ TEST 4 PASSED: Cross-business product isolation verified');
    passed++;
  } catch (err) {
    console.error('✗ TEST 4 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Customer profile access
  // --------------------------------------------------------------------------
  try {
    const profile = await customerService.getProfile(4); // Ananya Nair
    assert.strictEqual(profile.name, 'Ananya Nair');
    assert.strictEqual(profile.email, 'ananya.customer@gmail.com');
    assert.strictEqual(profile.password_hash, undefined, 'Must not return password hash');
    console.log('✓ TEST 5 PASSED: Customer profile access returns sanitized data');
    passed++;
  } catch (err) {
    console.error('✗ TEST 5 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Customer address self-access
  // --------------------------------------------------------------------------
  try {
    const addresses = await customerService.getAddresses(4, 1);
    assert(Array.isArray(addresses), 'Addresses must be array');
    assert(addresses.length > 0, 'Customer 4 must have saved addresses');
    assert(addresses.every((a) => a.user_id === 4 && a.business_id === 1));
    console.log('✓ TEST 6 PASSED: Customer address self-access');
    passed++;
  } catch (err) {
    console.error('✗ TEST 6 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Customer A cannot access Customer B address
  // --------------------------------------------------------------------------
  try {
    // Customer 4 (Ananya, Business 1) tries to fetch address 2 (Vikram, Business 2)
    const unauthorizedAddress = await addressRepository.getById(2, 4, 1);
    assert.strictEqual(unauthorizedAddress, null, 'Customer 4 must not access Customer 13 address');

    // Customer 4 tries to delete Customer 13 address
    let deleteFailed = false;
    try {
      await customerService.deleteAddress(4, 1, 2);
    } catch (err) {
      assert.strictEqual(err.code, 'ADDRESS_NOT_FOUND');
      deleteFailed = true;
    }
    assert(deleteFailed, 'Deleting another customer address must throw 404 ADDRESS_NOT_FOUND');
    console.log('✓ TEST 7 PASSED: Customer A blocked from accessing Customer B address');
    passed++;
  } catch (err) {
    console.error('✗ TEST 7 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Customer order creation
  // --------------------------------------------------------------------------
  try {
    const newOrder = await orderService.createCustomerOrder({
      customerId: 4,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        delivery_time_slot: 'Now (30-45 mins)',
        items: [
          { product_id: 2, quantity: 2 }, // 2x Butter Croissant @ ₹180 = ₹360
        ],
        special_instructions: 'Extra napkins please',
      },
    });

    assert(newOrder.id, 'Must generate order id');
    assert.strictEqual(newOrder.customer_id, 4);
    assert.strictEqual(newOrder.business_id, 1);
    assert.strictEqual(newOrder.order_status, 'Order Placed', 'Initial status must be Order Placed');
    console.log('✓ TEST 8 PASSED: Customer order creation succeeds with initial status Order Placed');
    passed++;
  } catch (err) {
    console.error('✗ TEST 8 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Customer cannot access another customer's order
  // --------------------------------------------------------------------------
  try {
    let accessBlocked = false;
    try {
      // Customer 4 (Ananya) attempting to read Order 10 (belonging to customer 13 in Business 2)
      await orderService.getOrderDetails(10, 4, 1, 'customer');
    } catch (err) {
      assert(err.code === 'ORDER_NOT_FOUND' || err.code === 'FORBIDDEN_RESOURCE');
      accessBlocked = true;
    }
    assert(accessBlocked, 'Customer 4 must not access Order 10');
    console.log('✓ TEST 9 PASSED: Customer blocked from accessing another customer order');
    passed++;
  } catch (err) {
    console.error('✗ TEST 9 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Customer cannot order a product from another business
  // --------------------------------------------------------------------------
  try {
    let crossTenantBlocked = false;
    try {
      // Customer at Business 1 tries to order Product 10 (Tradition Baguette from Business 2)
      await orderService.createCustomerOrder({
        customerId: 4,
        businessId: 1, // At Business 1
        orderData: {
          items: [{ product_id: 10, quantity: 1 }], // Product from Business 2!
        },
      });
    } catch (err) {
      assert.strictEqual(err.code, 'CROSS_TENANT_PRODUCT');
      assert.strictEqual(err.statusCode, 403);
      crossTenantBlocked = true;
    }
    assert(crossTenantBlocked, 'Cross-tenant product ordering must be rejected');
    console.log('✓ TEST 10 PASSED: Customer blocked from ordering products from another business (403 CROSS_TENANT_PRODUCT)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 10 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Server calculates trusted order total
  // --------------------------------------------------------------------------
  try {
    // Client sends tampered fake total: ₹1.00
    const fakeClientTotal = 1.00;
    const order = await orderService.createCustomerOrder({
      customerId: 4,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        total_amount: fakeClientTotal, // Tampered client value
        items: [
          { product_id: 2, quantity: 2 }, // 2x Butter Croissant @ ₹180 = ₹360
        ],
      },
    });

    // Server must compute: subtotal=360, deliveryFee=40, tax=18.00 (5%), total=418.00
    assert.strictEqual(order.subtotal, 360.00, 'Server must calculate subtotal from product price');
    assert.strictEqual(order.delivery_fee, 40.00, 'Server must calculate delivery fee');
    assert.strictEqual(order.total_amount, 418.00, 'Server must ignore client fake total and use trusted total');
    console.log('✓ TEST 11 PASSED: Server computes trusted order total (client fake price ignored)');
    passed++;
  } catch (err) {
    console.error('✗ TEST 11 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Invalid product rejected
  // --------------------------------------------------------------------------
  try {
    let invalidProductBlocked = false;
    try {
      await orderService.createCustomerOrder({
        customerId: 4,
        businessId: 1,
        orderData: {
          items: [{ product_id: 99999, quantity: 1 }],
        },
      });
    } catch (err) {
      assert.strictEqual(err.code, 'PRODUCT_NOT_FOUND');
      invalidProductBlocked = true;
    }
    assert(invalidProductBlocked, 'Non-existent product ID must be rejected');
    console.log('✓ TEST 12 PASSED: Non-existent product rejected with 404');
    passed++;
  } catch (err) {
    console.error('✗ TEST 12 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 13: Invalid quantity rejected
  // --------------------------------------------------------------------------
  try {
    let invalidQtyBlocked = false;
    try {
      await orderService.createCustomerOrder({
        customerId: 4,
        businessId: 1,
        orderData: {
          items: [{ product_id: 2, quantity: -5 }], // Negative quantity
        },
      });
    } catch (err) {
      assert.strictEqual(err.code, 'INVALID_QUANTITY');
      invalidQtyBlocked = true;
    }
    assert(invalidQtyBlocked, 'Negative or zero quantity must be rejected');
    console.log('✓ TEST 13 PASSED: Negative/invalid quantity rejected with 400');
    passed++;
  } catch (err) {
    console.error('✗ TEST 13 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 14: Feedback ownership validation
  // --------------------------------------------------------------------------
  try {
    let feedbackBlocked = false;
    try {
      // Customer 4 tries to review Order 10 (placed by Customer 13)
      await feedbackService.submitFeedback({
        customerId: 4,
        businessId: 1,
        orderId: 10,
        ratingData: { rating_overall: 5 },
      });
    } catch (err) {
      assert(err.code === 'FORBIDDEN_RESOURCE' || err.code === 'FORBIDDEN_TENANT');
      feedbackBlocked = true;
    }
    assert(feedbackBlocked, 'Customer cannot review another customer order');
    console.log('✓ TEST 14 PASSED: Feedback ownership validated; cross-customer review blocked');
    passed++;
  } catch (err) {
    console.error('✗ TEST 14 FAILED:', err.message);
  }

  console.log('\n======================================================');
  console.log(`CUSTOMER API TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runCustomerApiTests().catch((err) => {
  console.error('Customer API test suite failed:', err);
  process.exit(1);
});
