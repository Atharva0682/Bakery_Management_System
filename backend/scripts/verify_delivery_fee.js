const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

async function runDeliveryFeeTests() {
  console.log('=== Starting Final Delivery Charge Verification ===\n');

  // Copy active database to isolated verification test database
  const tempDb = path.join(__dirname, `test-delivery-${Date.now()}.sqlite`);
  fs.copyFileSync(path.join(__dirname, '../bakery.sqlite'), tempDb);
  process.env.SQLITE_DB_PATH = tempDb;
  process.env.SQLITE_FILE = tempDb;
  process.env.DB_CLIENT = 'sqlite';

  const db = require('../src/config/db');
  const catalogRepo = require('../src/models/catalogRepository');
  const orderService = require('../src/services/orderService');

  try {
    // 1. Verify standard delivery fee in businesses table
    console.log('Test 1: Verify standard delivery fee default is ₹50');
    const biz = (await db.query('SELECT delivery_fee, free_delivery_threshold FROM businesses WHERE id = 1')).rows[0];
    assert.equal(Number(biz.delivery_fee), 50, 'Default business delivery fee must be 50');
    console.log('✓ PASS: Standard delivery fee is ₹50\n');

    // Reset free_delivery_threshold to 99999 so threshold doesn't interfere with fee tests
    await db.query('UPDATE businesses SET free_delivery_threshold = 99999 WHERE id = 1');

    // 2. Setup test customer and products
    const customer = (await db.query("SELECT * FROM users WHERE role = 'customer' AND business_id = 1 LIMIT 1")).rows[0];
    const category = (await db.query('SELECT id FROM categories WHERE business_id = 1 LIMIT 1')).rows[0];

    // Product A: Standard Cupcake (unset delivery fee -> null)
    const prodA = await catalogRepo.createProduct({
      business_id: 1,
      category_id: category.id,
      name: 'Test Cupcakes (Standard Fee)',
      base_price: 60,
      delivery_fee: null
    });

    // Product B: Premium Chocolate Cake (custom delivery fee ₹80)
    const prodB = await catalogRepo.createProduct({
      business_id: 1,
      category_id: category.id,
      name: 'Test Chocolate Cake (Custom Fee 80)',
      base_price: 350,
      delivery_fee: 80
    });

    // Product C: Artisanal Sourdough (explicit free delivery ₹0)
    const prodC = await catalogRepo.createProduct({
      business_id: 1,
      category_id: category.id,
      name: 'Test Free Delivery Sourdough',
      base_price: 120,
      delivery_fee: 0
    });

    // Product D: Artisanal Croissant (explicit free delivery ₹0)
    const prodD = await catalogRepo.createProduct({
      business_id: 1,
      category_id: category.id,
      name: 'Test Free Delivery Croissant',
      base_price: 90,
      delivery_fee: 0
    });

    console.log('Test 2: Product-specific delivery fees in catalog repository');
    assert.equal((await catalogRepo.getProductById(prodA.id, 1)).delivery_fee, null, 'Prod A delivery fee must be null (unset)');
    assert.equal(Number((await catalogRepo.getProductById(prodB.id, 1)).delivery_fee), 80, 'Prod B delivery fee must be 80');
    assert.equal(Number((await catalogRepo.getProductById(prodC.id, 1)).delivery_fee), 0, 'Prod C delivery fee must be 0');
    console.log('✓ PASS: Product-specific delivery fees correctly stored and retrieved\n');

    // 3. Test single-product orders
    console.log('Test 3: Single-product delivery fee calculations');
    // Order 3a: Cupcake (unset -> ₹50 standard fee)
    const order3a = await orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        payment_method: 'CASH_ON_DELIVERY',
        delivery_address: '123 Test St, Bandra, Mumbai',
        items: [{ product_id: prodA.id, quantity: 1 }]
      }
    });
    assert.equal(Number(order3a.delivery_fee), 50, 'Single product with unset fee should charge ₹50 standard fee');
    console.log('✓ PASS: Single product with unset fee -> ₹50 standard delivery fee');

    // Order 3b: Chocolate Cake (custom fee ₹80)
    const order3b = await orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        payment_method: 'CASH_ON_DELIVERY',
        delivery_address: '123 Test St, Bandra, Mumbai',
        items: [{ product_id: prodB.id, quantity: 1 }]
      }
    });
    assert.equal(Number(order3b.delivery_fee), 80, 'Single product with custom fee ₹80 should charge ₹80');
    console.log('✓ PASS: Single product with custom fee ₹80 -> ₹80 delivery fee');

    // Order 3c: Sourdough (explicit fee ₹0)
    const order3c = await orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        payment_method: 'CASH_ON_DELIVERY',
        delivery_address: '123 Test St, Bandra, Mumbai',
        items: [{ product_id: prodC.id, quantity: 1 }]
      }
    });
    assert.equal(Number(order3c.delivery_fee), 0, 'Single product with custom fee ₹0 should charge ₹0');
    console.log('✓ PASS: Single product with custom fee ₹0 -> ₹0 delivery fee\n');

    // 4. Test multi-product orders (Highest Applicable Fee Rule)
    console.log('Test 4: Multi-product orders charge highest applicable delivery fee once');

    // Order 4a: Chocolate cake (₹80) + Cupcakes (unset -> ₹50) -> max(80, 50) = ₹80
    const order4a = await orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        payment_method: 'CASH_ON_DELIVERY',
        delivery_address: '123 Test St, Bandra, Mumbai',
        items: [
          { product_id: prodB.id, quantity: 1 },
          { product_id: prodA.id, quantity: 2 }
        ]
      }
    });
    assert.equal(Number(order4a.delivery_fee), 80, 'Multi-product order (₹80 + standard ₹50) must charge max fee ₹80 once');
    console.log('✓ PASS: Chocolate cake (₹80) + Cupcakes (unset ₹50) -> ₹80 delivery charge (exact requirement example)');

    // Order 4b: Cupcakes (unset -> ₹50) + Sourdough (free ₹0) -> max(50, 0) = ₹50
    const order4b = await orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        payment_method: 'CASH_ON_DELIVERY',
        delivery_address: '123 Test St, Bandra, Mumbai',
        items: [
          { product_id: prodA.id, quantity: 1 },
          { product_id: prodC.id, quantity: 1 }
        ]
      }
    });
    assert.equal(Number(order4b.delivery_fee), 50, 'Multi-product order (standard ₹50 + free ₹0) must charge max fee ₹50 once');
    console.log('✓ PASS: Cupcakes (unset ₹50) + Sourdough (free ₹0) -> ₹50 delivery charge');

    // Order 4c: Chocolate cake (₹80) + Sourdough (free ₹0) -> max(80, 0) = ₹80
    const order4c = await orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        payment_method: 'CASH_ON_DELIVERY',
        delivery_address: '123 Test St, Bandra, Mumbai',
        items: [
          { product_id: prodB.id, quantity: 1 },
          { product_id: prodC.id, quantity: 1 }
        ]
      }
    });
    assert.equal(Number(order4c.delivery_fee), 80, 'Multi-product order (₹80 + free ₹0) must charge max fee ₹80 once');
    console.log('✓ PASS: Chocolate cake (₹80) + Sourdough (free ₹0) -> ₹80 delivery charge');

    // Order 4d: Sourdough (free ₹0) + Croissant (free ₹0) -> max(0, 0) = ₹0
    const order4d = await orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        payment_method: 'CASH_ON_DELIVERY',
        delivery_address: '123 Test St, Bandra, Mumbai',
        items: [
          { product_id: prodC.id, quantity: 2 },
          { product_id: prodD.id, quantity: 1 }
        ]
      }
    });
    assert.equal(Number(order4d.delivery_fee), 0, 'Multi-product order where all items are free delivery must charge ₹0');
    console.log('✓ PASS: Sourdough (free ₹0) + Croissant (free ₹0) -> ₹0 delivery charge\n');

    // 5. Test Non-Delivery Orders (Pickup / Dine-in)
    console.log('Test 5: Non-delivery orders charge ₹0 delivery fee');
    const order5_pickup = await orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'pickup',
        payment_method: 'CASH_ON_DELIVERY',
        items: [{ product_id: prodB.id, quantity: 1 }]
      }
    });
    assert.equal(Number(order5_pickup.delivery_fee), 0, 'Pickup order must have ₹0 delivery fee even with custom product fee');

    const order5_dinein = await orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'dine_in',
        payment_method: 'CASH_ON_DELIVERY',
        table_tag: 'Table 4',
        items: [{ product_id: prodB.id, quantity: 1 }]
      }
    });
    assert.equal(Number(order5_dinein.delivery_fee), 0, 'Dine-in order must have ₹0 delivery fee even with custom product fee');
    console.log('✓ PASS: Pickup and Dine-in orders charge ₹0 delivery fee\n');

    // 6. Test Owner Configuration of Standard Delivery Fee & Product Edit
    console.log('Test 6: Owner configuration and historical preservation');
    // Owner updates standard delivery fee from ₹50 to ₹65
    await db.query('UPDATE businesses SET delivery_fee = 65 WHERE id = 1');

    // New order with unset fee product should now use ₹65
    const order6_new = await orderService.createCustomerOrder({
      customerId: customer.id,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        payment_method: 'CASH_ON_DELIVERY',
        delivery_address: '123 Test St, Bandra, Mumbai',
        items: [{ product_id: prodA.id, quantity: 1 }]
      }
    });
    assert.equal(Number(order6_new.delivery_fee), 65, 'New order should use newly configured standard fee ₹65');

    // Existing orders in database must keep their historical snapshots (₹50, ₹80, etc.)
    const savedOrder3a = (await db.query('SELECT delivery_fee FROM orders WHERE id = $1', [order3a.id])).rows[0];
    assert.equal(Number(savedOrder3a.delivery_fee), 50, 'Historical order must retain its original ₹50 fee');
    console.log('✓ PASS: Owner can configure standard delivery fee and confirmed orders are immutably preserved\n');

    // Owner edits Product A to set custom delivery fee ₹30
    await catalogRepo.updateProduct(prodA.id, { delivery_fee: 30 }, 1);
    const updatedProdA = await catalogRepo.getProductById(prodA.id, 1);
    assert.equal(Number(updatedProdA.delivery_fee), 30, 'Product A delivery fee should be updated to 30');

    // Owner clears Product A delivery fee (unset -> null)
    await catalogRepo.updateProduct(prodA.id, { delivery_fee: null }, 1);
    const clearedProdA = await catalogRepo.getProductById(prodA.id, 1);
    assert.equal(clearedProdA.delivery_fee, null, 'Product A delivery fee should be reset to null (unset)');
    console.log('✓ PASS: Owner can update and clear product-specific delivery fee\n');

    console.log('=== ALL DELIVERY CHARGE REQUIREMENTS VERIFIED SUCCESSFULLY! ===');
  } finally {
    await db.close();
    try {
      if (fs.existsSync(tempDb)) fs.unlinkSync(tempDb);
    } catch {}
  }
}

runDeliveryFeeTests().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
