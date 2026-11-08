const http = require('http');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runEndToEndTests() {
  console.log('====================================================');
  console.log('RUNNING FULL END-TO-END CRITICAL INTEGRATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. HEALTH TELEMETRY
    console.log('--- 1. Database Health Telemetry ---');
    const health = await request('GET', '/health');
    assert(health.status === 200 && health.data.database, 'Health check reports status and database telemetry');
    console.log(`   Database Mode: ${health.data.database.mode} | Database Name: ${health.data.database.database}\n`);

    // 2. AUTHENTICATION & RBAC
    console.log('--- 2. Central JWT Authentication & RBAC ---');
    // 2.1 Customer Login
    const custLogin = await request('POST', '/auth/login', {
      identifier: 'customer@crumbco.com',
      password: 'Password@123',
      businessSlug: 'crumbandco'
    });
    assert(custLogin.status === 200 && custLogin.data.data?.token, 'Customer login succeeds with JWT');
    const customerToken = custLogin.data.data?.token;

    // 2.2 Baker Login
    const bakerLogin = await request('POST', '/auth/login', {
      identifier: 'rajesh.kumar@crumbco.com',
      password: 'Password@123',
      businessSlug: 'crumbandco'
    });
    assert(bakerLogin.status === 200 && bakerLogin.data.data?.user?.role === 'baker', 'Baker login succeeds with role "baker"');
    const bakerToken = bakerLogin.data.data?.token;

    // 2.3 Owner Login
    const ownerLogin = await request('POST', '/auth/login', {
      identifier: 'priya.sharma@crumbco.com',
      password: 'Password@123',
      businessSlug: 'crumbandco'
    });
    assert(ownerLogin.status === 200 && ownerLogin.data.data?.user?.role === 'owner', 'Owner login succeeds with role "owner"');
    const ownerToken = ownerLogin.data.data?.token;

    // 2.4 RBAC Restrictions
    const unauthTest = await request('GET', '/batches');
    assert(unauthTest.status === 401, 'Unauthenticated request to /batches rejected with HTTP 401');

    const customerAccessStaff = await request('GET', '/batches', null, customerToken);
    assert(customerAccessStaff.status === 403, 'Customer token accessing /batches rejected with HTTP 403 (RBAC)');

    const customerAccessOwner = await request('GET', '/owner/analytics', null, customerToken);
    assert(customerAccessOwner.status === 403, 'Customer token accessing /owner/analytics rejected with HTTP 403 (RBAC)');

    const bakerAccessStaff = await request('GET', '/batches', null, bakerToken);
    assert(bakerAccessStaff.status === 200, 'Baker token authorized to access /batches (HTTP 200)');

    const ownerAccessOwner = await request('GET', '/owner/analytics', null, ownerToken);
    assert(ownerAccessOwner.status === 200, 'Owner token authorized to access /owner/analytics (HTTP 200)\n');

    // 3. CUSTOMER ORDER -> STAFF PRODUCTION -> TRACKING STATUS PROPAGATION
    console.log('--- 3. Customer Order to Staff Production Flow ---');
    // Customer places order
    const orderRes = await request('POST', '/orders', {
      business_id: 1,
      customer_name: 'Ananya Nair',
      customer_email: 'customer@crumbco.com',
      customer_phone: '+91 98201 12345',
      fulfillment_type: 'Delivery',
      delivery_address: '14 Shirley Rajan Road, Bandra West, Mumbai 400050',
      payment_method: 'CASH_ON_DELIVERY',
      total_amount: 640.0,
      items: [
        { product_id: 1, product_name: 'Country Sourdough Loaf', quantity: 2, unit_price: 320.0 }
      ]
    }, customerToken);

    assert(orderRes.status === 201 && orderRes.data.data?.id, 'Customer places order successfully');
    const newOrderId = orderRes.data.data?.id;
    const orderRef = orderRes.data.data?.order_no || `#CC-${newOrderId}`;
    console.log(`   Created Order ID: ${newOrderId} | Ref: ${orderRef}`);

    // Baker creates/links batch with source order
    const batchRes = await request('POST', '/batches', {
      batch_no: `CB-${Date.now().toString().slice(-4)}`,
      product_name: 'San Francisco Sourdough Loaf',
      product_id: 1,
      planned_quantity: 50,
      priority: 'Normal',
      shift: 'Morning Shift',
      source_orders: [orderRef]
    }, bakerToken);

    assert(batchRes.status === 201 && batchRes.data.data?.id, 'Baker creates and links production batch to source order');
    const newBatchId = batchRes.data.data?.id;
    console.log(`   Created Batch ID: ${newBatchId} | Linked Orders: ${orderRef}`);

    // Baker starts baking: updates status to 'In Production'
    const bakeStatusRes = await request('PATCH', `/batches/${newBatchId}/status`, {
      status: 'In Production',
      completedQuantity: 48,
      notes: 'Deck oven loaded at 235°C with steam'
    }, bakerToken);
    assert(bakeStatusRes.status === 200 && bakeStatusRes.data.data?.status === 'In Production', 'Batch status updated to In Production');

    // Verify Customer Order status automatically updated to 'In Production'
    const trackedOrder1 = await request('GET', `/orders/${newOrderId}`, null, customerToken);
    const status1 = trackedOrder1.data.data?.status || trackedOrder1.data.data?.order_status;
    assert(trackedOrder1.status === 200 && status1 === 'In Production',
      'Customer order tracking automatically updated to "In Production" via batch propagation');

    // Baker completes Quality Check -> moves batch to 'Packaged'
    const qcRes = await request('POST', '/quality-checks', {
      batchId: newBatchId,
      result: 'PASSED',
      notes: 'Internal core temp 96°C, deep golden blistered crust'
    }, bakerToken);
    assert(qcRes.status === 201 && qcRes.data.data?.result === 'PASSED', 'Quality check submitted and PASSED');

    // Baker completes batch
    const dispatchRes = await request('PATCH', `/batches/${newBatchId}/status`, {
      status: 'Completed',
      completedQuantity: 48,
      packedQuantity: 48,
      notes: 'Final packaging complete and dispatched'
    }, bakerToken);
    assert(dispatchRes.status === 200, 'Batch marked Completed & Dispatched');

    // Customer tracking verifies Packaged
    const trackedOrder2 = await request('GET', `/orders/${newOrderId}`, null, customerToken);
    const status2 = trackedOrder2.data.data?.status || trackedOrder2.data.data?.order_status;
    assert(trackedOrder2.status === 200 && (status2 === 'Packaged' || status2 === 'Completed' || status2 === 'Product Completed & Packed'),
      'Customer order tracking reflects Packaged status\n');

    // 4. INVENTORY & STOCK REQUISITION
    console.log('--- 4. Inventory & Floor Stock Requisitions ---');
    const ingRes = await request('GET', '/ingredients', null, bakerToken);
    assert(ingRes.status === 200 && Array.isArray(ingRes.data.data), 'Ingredients inventory fetched successfully');
    console.log(`   Total floor inventory items: ${ingRes.data.data?.length}`);

    const reqRes = await request('POST', '/ingredients/requisitions', {
      raw_material_id: 1,
      material_name: 'Organic French T65 Wheat Flour',
      quantity: 50,
      unit: 'kg',
      urgency: 'Normal',
      notes: 'Replenishment for tomorrow morning sourdough proof'
    }, bakerToken);
    assert(reqRes.status === 201 && reqRes.data.data?.id, 'Baker submits stock requisition to database');

    const allReqs = await request('GET', '/ingredients/requisitions/all', null, ownerToken);
    assert(allReqs.status === 200 && allReqs.data.data?.length > 0, 'Owner/Manager reviews submitted requisitions in database\n');

    // 5. WASTAGE & QUALITY LOGGING
    console.log('--- 5. Wastage Logging & Summary ---');
    const wasteRes = await request('POST', '/wastage', {
      batch_id: newBatchId,
      product_id: 1,
      product_name: 'San Francisco Sourdough Loaf',
      quantity: 2,
      unit: 'pcs',
      reason: 'Burnt Product',
      notes: 'Base slightly over-caramelized during deck vent'
    }, bakerToken);
    assert(wasteRes.status === 201 && wasteRes.data.data?.id, 'Wastage recorded with standardized reason code');

    const wasteSummary = await request('GET', '/wastage/today-summary', null, bakerToken);
    const wasteCount = wasteSummary.data.data?.totalWastedUnits || wasteSummary.data.data?.total_scrap_units || 0;
    assert(wasteSummary.status === 200 && wasteCount > 0, 'Today wastage summary calculated\n');

    // Customer submits feedback on completed order
    await request('POST', '/feedback', {
      order_id: newOrderId,
      rating: 5,
      comment: 'Exceptional artisanal quality and crumb structure!'
    }, customerToken);

    // 6. END-TO-END TRACEABILITY AUDIT
    console.log('--- 6. End-to-End Food Safety Traceability Audit ---');
    const traceBatch = await request('GET', `/owner/traceability/${newBatchId}`, null, ownerToken);
    assert(traceBatch.status === 200 && traceBatch.data.data?.trace?.supplier, 'Traceability by Batch Code returns supplier procurement lot');
    assert(traceBatch.data.data?.trace?.batch, 'Traceability returns production batch details');
    assert(traceBatch.data.data?.trace?.workers?.length > 0, 'Traceability returns assigned bakers');
    assert(traceBatch.data.data?.trace?.quality_check?.result === 'PASSED', 'Traceability returns thermal & sensory quality check');
    assert(traceBatch.data.data?.trace?.customer_order, 'Traceability returns linked customer order');
    assert(traceBatch.data.data?.trace?.customer_feedback?.rating === 5, 'Traceability returns verified customer feedback rating & comments\n');

    // 7. SECTION 8 REQUIRED FLOWS: DIRECT VERIFICATION
    console.log('--- 7. Section 8 Five Operational Flows Verification ---');
    
    // TEST 1: Customer opens products loaded from PostgreSQL
    const catalogRes = await request('GET', '/products');
    assert(catalogRes.status === 200 && catalogRes.data.data?.length >= 20, 
      `TEST 1: Customer loads products from PostgreSQL (${catalogRes.data.data?.length} products returned)`);

    // TEST 2: Staff opens orders list and customer order appears
    const staffOrders = await request('GET', '/orders/business/all', null, bakerToken);
    const foundNewOrder = staffOrders.data.data?.find(o => o.id === newOrderId);
    assert(staffOrders.status === 200 && foundNewOrder, 
      `TEST 2: Staff opens orders list and customer order #${newOrderId} is present from PostgreSQL`);

    // TEST 2b: Staff updates order status directly via PATCH /orders/:id/status
    const updateStatusRes = await request('PATCH', `/orders/${newOrderId}/status`, {
      status: 'Delivered',
      notes: 'Hand delivered to customer by Bandra delivery hero'
    }, bakerToken);
    assert(updateStatusRes.status === 200, 'TEST 2b: Staff directly updates order status in PostgreSQL');

    // TEST 3: Customer checks order tracking and retrieves updated status
    const customerTrackRes = await request('GET', `/orders/${newOrderId}`, null, customerToken);
    assert(customerTrackRes.status === 200 && customerTrackRes.data.data?.order_status === 'Delivered',
      'TEST 3: Customer tracking retrieves updated status "Delivered" from PostgreSQL');

    // TEST 4: Staff updates a product -> PostgreSQL product record changes -> Customer refreshes
    const originalProd = await request('GET', '/products/1');
    const originalName = originalProd.data.data?.name;
    const originalPrice = originalProd.data.data?.base_price;

    const updateProdRes = await request('PUT', '/products/1', {
      name: 'San Francisco Sourdough (Reserve Heritage Batch)',
      base_price: 220.00
    }, bakerToken);
    assert(updateProdRes.status === 200, 'TEST 4: Staff updates product record in PostgreSQL');

    const customerRefreshProd = await request('GET', '/products/1');
    assert(
      customerRefreshProd.status === 200 && 
      customerRefreshProd.data.data?.name === 'San Francisco Sourdough (Reserve Heritage Batch)' &&
      parseFloat(customerRefreshProd.data.data?.base_price) === 220.00,
      'TEST 4: Customer refreshes product page and sees updated PostgreSQL data'
    );

    // Revert product back to original state to keep demo data consistent
    await request('PUT', '/products/1', {
      name: originalName,
      base_price: originalPrice
    }, bakerToken);
    console.log('   Product reverted cleanly back to original demo values.');

    // TEST 5: Owner dashboard statistics calculated from PostgreSQL
    const ownerAnalytics = await request('GET', '/owner/analytics', null, ownerToken);
    assert(ownerAnalytics.status === 200, 'TEST 5: Owner fetches analytics from PostgreSQL');
    assert(ownerAnalytics.data.data?.today_revenue > 0, 
      `TEST 5: Real today revenue calculated: ${ownerAnalytics.data.data?.today_revenue_formatted}`);
    assert(ownerAnalytics.data.data?.monthly_revenue > 0, 
      `TEST 5: Real monthly revenue calculated: ${ownerAnalytics.data.data?.monthly_revenue_formatted}`);
    assert(ownerAnalytics.data.data?.top_selling_products?.length > 0, 
      `TEST 5: Top selling products aggregated from real orders (${ownerAnalytics.data.data?.top_selling_products?.length} items)`);
    assert(ownerAnalytics.data.data?.alerts?.length > 0, 
      `TEST 5: Real inventory alerts derived from PostgreSQL raw_materials\n`);

    // 7. SUMMARY
    console.log('====================================================');
    console.log(`TEST EXECUTION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================');

    if (failed === 0) {
      console.log('🎉 ALL INTEGRATION TESTS PASSED PERFECTLY!');
      process.exit(0);
    } else {
      console.error('❌ Some tests failed. Please review the logs.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runEndToEndTests();
