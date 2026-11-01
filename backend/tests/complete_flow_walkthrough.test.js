/**
 * Complete End-to-End Walkthrough Script: Order -> Owner -> Worker -> Tracking -> Feedback
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_jwt_crumbco_2026';

const assert = require('assert');
const authService = require('../src/services/authService');
const orderService = require('../src/services/orderService');
const feedbackService = require('../src/services/feedbackService');
const db = require('../src/config/db');

async function testCompleteLifecycle() {
  console.log('\n================================================================');
  console.log(' COMPLETE END-TO-END FLOW: ORDER -> OWNER -> WORKER -> FEEDBACK ');
  console.log('================================================================\n');

  // STEP 1: Customer Authentication & Order Placement
  console.log('--- Step 1: Customer Places an Artisanal Bakery Order ---');
  const custAuth = await authService.loginUser({
    identifier: 'customer@crumbco.com',
    password: 'Password@123'
  });
  assert.ok(custAuth.token, 'Customer must log in successfully');
  console.log(`✅ Customer Authenticated: ${custAuth.user.name} (${custAuth.user.email})`);

  // Generate unique 12-digit UTR
  const uniqueUtr = '9' + String(Date.now()).slice(-11);

  const orderRes = await orderService.createCustomerOrder({
    businessId: 1,
    customerId: custAuth.user.id,
    orderData: {
      order_type: 'delivery',
      delivery_address: 'Flat 402, Sea Green Apts, Perry Cross Road, Bandra West, Mumbai',
      payment_method: 'QR_UPI',
      transaction_id: uniqueUtr,
      special_instructions: 'Please slice the sourdough loaf into medium slices.',
      items: [
        { product_id: 1, quantity: 2 }, // Sourdough Loaf
        { product_id: 2, quantity: 3 }  // Butter Croissant
      ]
    }
  });

  assert.ok(orderRes.id, 'Order must be created with ID');
  const orderId = orderRes.id;
  const trackingToken = orderRes.tracking_token;
  console.log(`✅ Order Placed: #${orderRes.order_no || orderId} (Total: ₹${orderRes.total_amount})`);
  console.log(`   Payment Status: ${orderRes.payment_status} (Pending Verification)`);
  console.log(`   UTR / Transaction ID: ${uniqueUtr}`);
  console.log(`   Tracking Token: ${trackingToken}`);

  // STEP 2: Owner Verification & Payment Approval
  console.log('\n--- Step 2: Owner Verifies Payment & Approves Order ---');
  const ownerAuth = await authService.loginUser({
    identifier: 'owner@crumbco.com',
    password: 'Password@123'
  });
  assert.strictEqual(ownerAuth.user.role, 'owner');
  console.log(`✅ Owner Authenticated: ${ownerAuth.user.name}`);

  // Verify the order requires payment approval in owner queue
  const ownerOrders = await orderService.getAllOrdersForBusiness(1, {}, 'owner');
  const pendingInOwnerQueue = ownerOrders.find(o => o.id === orderId);
  assert.ok(pendingInOwnerQueue, 'Order must appear in owner orders');
  assert.strictEqual(pendingInOwnerQueue.needs_payment_approval, true);
  console.log(`✅ Order #${orderId} flagged for owner verification with UTR ${pendingInOwnerQueue.transaction_id}`);

  // Owner approves payment
  const approval = await orderService.approveOrderPayment(orderId, ownerAuth.user.id, 1);
  assert.strictEqual(approval.payment_status, 'Paid');
  assert.strictEqual(approval.order_status, 'Accepted');
  console.log(`✅ Payment Approved by Owner: Order Status is now "${approval.order_status}", Payment is "${approval.payment_status}"`);

  // STEP 3: Baker Receives Order in Queue & Progresses Production
  console.log('\n--- Step 3: Baker Picks Up Order & Bakes in Kitchen ---');
  const bakerAuth = await authService.loginUser({
    identifier: 'rajesh.kumar@crumbco.com',
    password: 'Password@123'
  });
  assert.strictEqual(bakerAuth.user.role, 'baker');
  console.log(`✅ Baker Authenticated: ${bakerAuth.user.name} (Shift: ${bakerAuth.user.shift_name} ${bakerAuth.user.shift_start}-${bakerAuth.user.shift_end})`);

  // Verify order is now ready for baker queue
  const bakerOrders = await orderService.getAllOrdersForBusiness(1, { role: 'baker' }, 'baker');
  const inQueue = bakerOrders.find(o => o.id === orderId);
  assert.ok(inQueue, 'Approved order must appear in baker queue');
  console.log(`✅ Order #${orderId} is visible in Baker Floor Queue (is_ready_for_baker = true)`);

  // Baker advances order to In Production / Baking
  await orderService.updateOrderStatus(orderId, 'Baking', 'Baking sourdough loaves in deck oven at 240°C', bakerAuth.user.id, 1);
  console.log(`✅ Order Status updated by Baker: "Baking"`);

  // Baker completes baking
  await orderService.updateOrderStatus(orderId, 'Completed', 'Freshly baked and packaged for delivery', bakerAuth.user.id, 1);
  console.log(`✅ Order Status updated by Baker: "Completed"`);

  // STEP 4: Customer Live Tracking Update
  console.log('\n--- Step 4: Customer Tracking Verification ---');
  const trackingDetails = await orderService.getOrderDetails(orderId, null, 1, 'customer', trackingToken);
  assert.strictEqual(trackingDetails.order_status, 'Completed');
  console.log(`✅ Live Order Tracking Confirmed: Status is "${trackingDetails.order_status}"`);
  console.log(`   Tracking Timeline events recorded: ${trackingDetails.trackingHistory?.length || 0}`);

  // STEP 5: Customer Feedback Submission
  console.log('\n--- Step 5: Customer Leaves 5-Star Feedback ---');
  const feedbackRes = await feedbackService.submitFeedback({
    businessId: 1,
    customerId: custAuth.user.id,
    orderId,
    ratingData: {
      rating_overall: 5,
      rating_taste: 5,
      rating_freshness: 5,
      rating_delivery: 5,
      comment: 'The sourdough crust was extraordinarily crisp and crumb was light and airy! Best bakery in Bandra!',
      tags: ['Freshness', 'Flavour', 'Artisanal Quality']
    }
  });

  assert.ok(feedbackRes, 'Feedback must be saved');
  console.log(`✅ Feedback Submitted: 5 Stars ★★★★★`);
  console.log(`   Comment: "${feedbackRes.comment || feedbackRes.feedback?.comment}"`);

  console.log('\n================================================================');
  console.log(' 🎉 COMPLETE END-TO-END FLOW VERIFIED SUCCESSFULLY!');
  console.log('================================================================\n');

  return {
    orderId,
    trackingToken,
    uniqueUtr
  };
}

testCompleteLifecycle()
  .then(res => {
    console.log(`Summary of Created Test Order:`);
    console.log(`  Order ID: ${res.orderId}`);
    console.log(`  Customer Tracking URL: http://localhost:5173/orders/${res.orderId}?t=${res.trackingToken}`);
    console.log(`  Customer Feedback URL: http://localhost:5173/feedback/${res.orderId}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Flow failed:', err);
    process.exit(1);
  });
