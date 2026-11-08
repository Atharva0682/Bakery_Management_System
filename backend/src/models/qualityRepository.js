const db = require('../config/db');

class QualityRepository {
  async submitQualityCheck(data) {
    const {
      business_id = 1,
      batch_id,
      inspector_id,
      inspector_name = 'Inspector',
      result = 'PASSED',
      accepted_quantity,
      rejected_quantity,
      rejection_reason = '',
      quality_notes = '',
      remarks = '',
      internal_temp = null
    } = data;

    const bId = Number(batch_id);
    const normResult = String(result).toUpperCase().trim() === 'FAILED' ? 'FAILED' : 'PASSED';

    return db.transaction(async () => {
      // Find batch
      const batchRes = await db.query('SELECT * FROM production_batches WHERE id = $1 AND business_id = $2', [bId, business_id]);
      const batch = batchRes.rows[0];
      if (!batch) throw new Error('Batch not found in this bakery');

      const bakedQty = Number(batch.completed_quantity || batch.actual_baked_qty || batch.planned_quantity || 1);
      let accepted = accepted_quantity !== undefined && accepted_quantity !== null && accepted_quantity !== ''
        ? Number(accepted_quantity)
        : (normResult === 'PASSED' ? bakedQty : 0);
      let rejected = rejected_quantity !== undefined && rejected_quantity !== null && rejected_quantity !== ''
        ? Number(rejected_quantity)
        : (normResult === 'FAILED' ? bakedQty : Math.max(0, bakedQty - accepted));

      const finalRejectionReason = normResult === 'FAILED'
        ? (rejection_reason || remarks || quality_notes || 'Failed quality parameters')
        : (rejected > 0 ? (rejection_reason || 'Minor defects') : null);

      // Record quality check in database
      const qcRes = await db.query(`
        INSERT INTO quality_checks (
          business_id, batch_id, inspector_id, inspector_name, result,
          accepted_quantity, rejected_quantity, rejection_reason, quality_notes, remarks, internal_temp, inspected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        RETURNING *
      `, [
        business_id, bId, inspector_id || null, inspector_name, normResult,
        accepted, rejected, finalRejectionReason, quality_notes || remarks, remarks || quality_notes,
        internal_temp ? Number(internal_temp) : null
      ]);

      const qcRecord = qcRes.rows[0];

      if (normResult === 'PASSED') {
        await db.query(`
          UPDATE production_batches
          SET status = 'Quality Checked',
              accepted_quantity = $1,
              rejected_quantity = $2,
              actual_usable_qty = $1,
              wastage_quantity = wastage_quantity + $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3 AND business_id = $4
        `, [accepted, rejected, bId, business_id]);

        await db.query(`
          INSERT INTO production_logs (batch_id, baker_id, previous_status, new_status, completed_quantity, notes)
          VALUES ($1, $2, $3, 'Quality Checked', $4, $5)
        `, [bId, inspector_id || null, batch.status, accepted, `Quality Inspection PASSED: ${accepted} units accepted, ${rejected} units rejected. ${quality_notes || remarks}`]);
      } else {
        await db.query(`
          UPDATE production_batches
          SET status = 'Quality Failed',
              accepted_quantity = 0,
              rejected_quantity = $1,
              actual_usable_qty = 0,
              wastage_quantity = wastage_quantity + $1,
              rejection_reason = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3 AND business_id = $4
        `, [rejected, finalRejectionReason, bId, business_id]);

        await db.query(`
          INSERT INTO production_logs (batch_id, baker_id, previous_status, new_status, completed_quantity, notes)
          VALUES ($1, $2, $3, 'Quality Failed', 0, $4)
        `, [bId, inspector_id || null, batch.status, `Quality Inspection FAILED: ${finalRejectionReason}`]);
      }

      return {
        ...qcRecord,
        batch_no: batch.batch_no,
        product_name: batch.product_name,
      };
    });
  }

  async getChecksByBatch(batchId, businessId = 1) {
    const res = await db.query(`
      SELECT qc.*, u.name as inspector_name_user
      FROM quality_checks qc
      LEFT JOIN users u ON qc.inspector_id = u.id
      WHERE qc.batch_id = $1 AND qc.business_id = $2
      ORDER BY qc.id DESC
    `, [batchId, businessId]);
    return res.rows;
  }

  async getAllChecks(businessId = 1) {
    const res = await db.query(`
      SELECT qc.*, pb.batch_no, p.name as product_name, u.name as inspector_name_user
      FROM quality_checks qc
      JOIN production_batches pb ON qc.batch_id = pb.id
      LEFT JOIN products p ON pb.product_id = p.id
      LEFT JOIN users u ON qc.inspector_id = u.id
      WHERE qc.business_id = $1
      ORDER BY qc.id DESC
    `, [businessId]);
    return res.rows;
  }
}

module.exports = new QualityRepository();
