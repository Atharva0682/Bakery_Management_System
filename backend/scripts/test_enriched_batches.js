const db = require('../src/config/db');

async function main() {
  const query = `
    SELECT pb.*,
           p.name as product_name,
           p.slug as product_slug,
           u.name as baker_name,
           bo.order_id,
           bo.order_reference,
           COALESCE(u_cust.name, o.guest_name) as linked_customer_name,
           CASE WHEN bo.order_id IS NOT NULL THEN 'customer_order' ELSE 'batch_production' END as task_type,
           CASE WHEN bo.order_id IS NULL THEN 1 ELSE 0 END as is_internal_production
    FROM production_batches pb
    LEFT JOIN products p ON pb.product_id = p.id
    LEFT JOIN users u ON pb.baker_id = u.id
    LEFT JOIN batch_orders bo ON pb.id = bo.batch_id
    LEFT JOIN orders o ON bo.order_id = o.id
    LEFT JOIN users u_cust ON o.customer_id = u_cust.id
    WHERE pb.business_id = 1
    ORDER BY pb.id DESC
    LIMIT 10
  `;
  const rows = (await db.query(query)).rows;
  console.log('Sample enriched batches:', rows.map(r => ({
    id: r.id,
    batch_no: r.batch_no,
    product: r.product_name,
    task_type: r.task_type,
    is_internal: r.is_internal_production,
    customer: r.linked_customer_name,
    order_ref: r.order_reference
  })));
  process.exit(0);
}

main();

