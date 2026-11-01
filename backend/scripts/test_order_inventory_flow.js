const db = require('../src/config/db');
const orderService = require('../src/services/orderService');
const inventoryRepo = require('../src/models/inventoryRepository');
const batchRepo = require('../src/models/batchRepository');

async function testFlow() {
  try {
    console.log('--- Checking Initial Flour Stock ---');
    const flourBefore = await inventoryRepo.getIngredientById(1, 1);
    console.log('Flour Before:', {
      name: flourBefore.name,
      current_stock: flourBefore.current_stock,
      reserved_stock: flourBefore.reserved_stock,
      available_stock: flourBefore.available_stock,
      unit: flourBefore.unit
    });

    console.log('\n--- 1. Placing Test Order for San Francisco Sourdough Loaf (Product ID 1, Qty 2) ---');
    const orderRes = await orderService.createCustomerOrder({
      customerId: 2,
      businessId: 1,
      orderData: {
        order_type: 'delivery',
        delivery_address: '123 Test St, Bandra, Mumbai',
        delivery_phone: '9876543210',
        payment_method: 'CASH_ON_DELIVERY',
        items: [
          {
            product_id: 1,
            quantity: 2
          }
        ]
      }
    });

    console.log('Order Created:', { id: orderRes.id, order_no: orderRes.order_no, status: orderRes.order_status });

    const flourAfterCreate = await inventoryRepo.getIngredientById(1, 1);
    console.log('Flour After Order Creation:', {
      current_stock: flourAfterCreate.current_stock,
      reserved_stock: flourAfterCreate.reserved_stock,
      available_stock: flourAfterCreate.available_stock
    });

    console.log('\n--- 2. Approving / Accepting Order ---');
    await orderService.updateOrderStatus(orderRes.id, 'Accepted', 'Accepted by owner', 1, 1);
    const orderRepo = require('../src/models/orderRepository');
    const orderAfterAccept = await orderRepo.getById(orderRes.id, 1);
    console.log('Order Status After Accept:', orderAfterAccept.order_status);

    const flourAfterAccept = await inventoryRepo.getIngredientById(1, 1);
    console.log('Flour After Accept:', {
      current_stock: flourAfterAccept.current_stock,
      reserved_stock: flourAfterAccept.reserved_stock,
      available_stock: flourAfterAccept.available_stock
    });

    console.log('\n--- 3. Moving to In Production ---');
    await orderService.updateOrderStatus(orderRes.id, 'In Production', 'Baking started', 1, 1);

    const flourAfterProd = await inventoryRepo.getIngredientById(1, 1);
    console.log('Flour After In Production:', {
      current_stock: flourAfterProd.current_stock,
      reserved_stock: flourAfterProd.reserved_stock,
      available_stock: flourAfterProd.available_stock
    });

    console.log('\n--- 4. Moving to Product Completed & Packed ---');
    await orderService.updateOrderStatus(orderRes.id, 'Product Completed & Packed', 'Finished baking and packing', 1, 1);

    const flourAfterPacked = await inventoryRepo.getIngredientById(1, 1);
    console.log('Flour After Product Completed & Packed:', {
      current_stock: flourAfterPacked.current_stock,
      reserved_stock: flourAfterPacked.reserved_stock,
      available_stock: flourAfterPacked.available_stock
    });

    console.log('\n--- 5. Delivering Order ---');
    // First record actual_usable_qty so delivery check passes
    const batches = (await db.query('SELECT pb.* FROM batch_orders bo JOIN production_batches pb ON bo.batch_id = pb.id WHERE bo.order_id = $1', [orderRes.id])).rows;
    console.log('Associated Batches:', batches.map(b => ({ id: b.id, batch_no: b.batch_no, planned: b.planned_quantity, usable: b.actual_usable_qty })));
    for (const b of batches) {
      await db.query('UPDATE production_batches SET actual_usable_qty = planned_quantity WHERE id = $1', [b.id]);
    }

    await orderService.updateOrderStatus(orderRes.id, 'Delivered', 'Order handed to customer', 1, 1);

    const flourAfterDelivery = await inventoryRepo.getIngredientById(1, 1);
    console.log('Flour After Delivered:', {
      current_stock: flourAfterDelivery.current_stock,
      reserved_stock: flourAfterDelivery.reserved_stock,
      available_stock: flourAfterDelivery.available_stock
    });

    const movements = (await db.query('SELECT * FROM stock_movements WHERE reference_id = $1 AND raw_material_id = 1', [orderRes.id])).rows;
    console.log('\nStock Movements for Order:', movements);

  } catch (err) {
    console.error('Error in testFlow:', err);
  } finally {
    process.exit(0);
  }
}

testFlow();
