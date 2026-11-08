const db = require('../src/config/db');

async function main() {
  const orders = (await db.query('SELECT * FROM orders ORDER BY id DESC LIMIT 15')).rows;
  for (const o of orders) {
    const items = (await db.query('SELECT * FROM order_items WHERE order_id = $1', [o.id])).rows;
    const res = (await db.query("SELECT * FROM inventory_reservations WHERE reference_type = 'order' AND reference_id = $1", [o.id])).rows;
    const batches = (await db.query('SELECT pb.* FROM batch_orders bo JOIN production_batches pb ON bo.batch_id = pb.id WHERE bo.order_id = $1', [o.id])).rows;
    console.log(`Order ${o.id} (${o.order_no}): status=${o.order_status}, pstatus=${o.payment_status}, customer=${o.customer_name || o.guest_name}`);
    console.log('  Items:', items.map(i => ({ prod_id: i.product_id, name: i.product_name, qty: i.quantity })));
    console.log('  Reservations:', res.map(r => ({ mat_id: r.raw_material_id, qty: r.quantity, status: r.status })));
    console.log('  Batches:', batches.map(b => ({ id: b.id, batch_no: b.batch_no, status: b.status })));
  }
  process.exit(0);
}

main();

