const db = require('../src/config/db');

async function main() {
  const o = (await db.query("SELECT * FROM orders WHERE order_no LIKE '%8503%'")).rows[0];
  console.log('Order 8503:', o);
  if (o) {
    const items = (await db.query('SELECT * FROM order_items WHERE order_id = $1', [o.id])).rows;
    console.log('Items:', items);
    const reservations = (await db.query('SELECT * FROM inventory_reservations WHERE reference_id = $1', [o.id])).rows;
    console.log('Reservations:', reservations);
    const batches = (await db.query('SELECT pb.* FROM batch_orders bo JOIN production_batches pb ON bo.batch_id = pb.id WHERE bo.order_id = $1', [o.id])).rows;
    console.log('Batches from batch_orders:', batches);
    const allBatches = (await db.query("SELECT * FROM production_batches WHERE batch_no LIKE '%8503%'")).rows;
    console.log('Batches with 8503 in batch_no:', allBatches);
  }
  process.exit(0);
}

main();

