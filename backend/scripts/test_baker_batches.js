const batchRepository = require('../src/models/batchRepository');

async function main() {
  const batches = await batchRepository.getAllBatches({
    businessId: 1,
  });
  console.log(`Total batches for kitchen floor: ${batches.length}`);
  const internal = batches.filter(b => b.is_internal_production);
  const fromOrders = batches.filter(b => !b.is_internal_production);
  console.log(`Internal Planned Batches: ${internal.length}`);
  console.log(`Customer Order Batches: ${fromOrders.length}`);
  console.log('Sample batch:', {
    id: batches[0].id,
    batch_no: batches[0].batch_no,
    product: batches[0].product_name,
    task_type: batches[0].task_type,
    is_internal: batches[0].is_internal_production,
    customer: batches[0].linked_customer_name,
    baker: batches[0].baker_name
  });
  process.exit(0);
}

main();

