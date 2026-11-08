const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/models/batchRepository.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetMethod = `  async getAllBatches(filters = {}) {`;
const newGetAllBatches = `  async getAllBatches(filters = {}) {
    const { businessId = 1, status, search, bakerId, taskType } = filters;
    try {
      let query = \`
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
        WHERE pb.business_id = $1
      \`;
      const params = [businessId];

      if (bakerId) {
        query += \` AND (pb.baker_id = $\${params.length + 1} OR pb.baker_id IS NULL)\`;
        params.push(bakerId);
      }

      if (taskType === 'batch_production') {
        query += \` AND bo.order_id IS NULL\`;
      } else if (taskType === 'customer_order') {
        query += \` AND bo.order_id IS NOT NULL\`;
      }

      if (search && search.trim()) {
        query += \` AND (LOWER(p.name) LIKE $\${params.length + 1} OR LOWER(pb.batch_no) LIKE $\${params.length + 1})\`;
        params.push(\`%\${search.trim().toLowerCase()}%\`);
      }

      if (status && status !== 'All') {
        const norm = normalizeStatus(status);
        query += \` AND pb.status = $\${params.length + 1}\`;
        params.push(norm);
      }

      query += \` ORDER BY pb.id DESC\`;
      const res = await db.query(query, params);
      return res.rows;
    } catch (err) {
      throw err;
    }
  }

  async getBatchById(id, businessId = 1) {
    try {
      const res = await db.query(
        \`SELECT pb.*,
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
         WHERE pb.id = $1 AND pb.business_id = $2\`,
        [id, businessId]
      );
      return res.rows[0] || null;
    } catch (err) {
      throw err;
    }
  }`;

// Replace getAllBatches and getBatchById
const startIndex = content.indexOf(targetMethod);
const createBatchIndex = content.indexOf('async createBatch(data)');
if (startIndex !== -1 && createBatchIndex !== -1) {
  content = content.slice(0, startIndex) + newGetAllBatches + '\n\n  ' + content.slice(createBatchIndex);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated batchRepository.js');
} else {
  console.error('Could not find slice indices', { startIndex, createBatchIndex });
}

