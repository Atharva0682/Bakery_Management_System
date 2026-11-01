const db = require('../config/db');
const batchRepository = require('./batchRepository');

let memoryQualityChecks = [
  {
    id: 1,
    business_id: 1,
    batch_id: 3,
    batch_code: 'TT-082',
    inspector_id: 4,
    inspector_name: 'Rajesh Kumar (Baker)',
    result: 'PASSED',
    quality_notes: 'Sponge height 6.2cm, moisture optimal, zero crumb collapse.',
    checked_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 2,
    business_id: 1,
    batch_id: 5,
    batch_code: 'NS-055',
    inspector_id: 4,
    inspector_name: 'Rajesh Kumar (Baker)',
    result: 'PASSED',
    quality_notes: 'Ghee aroma authentic, crumbly texture verified against master sample.',
    checked_at: new Date(Date.now() - 7200000).toISOString()
  }
];

let nextQcId = 10;

class QualityRepository {
  async submitQualityCheck(data) { return db.transaction(() => this._submitQualityCheck(data)); }

  async _submitQualityCheck(data) {
    const {
      business_id = 1,
      batch_id,
      inspector_id = 4,
      inspector_name = 'Rajesh Kumar (Baker)',
      result = 'PASSED',
      quality_notes = ''
    } = data;

    const bId = Number(batch_id);
    if (!['PASSED', 'FAILED'].includes(String(result).toUpperCase())) throw new Error('Invalid inspection result');
    if (!await batchRepository.getBatchById(bId, business_id)) throw new Error('Batch not found in this bakery');
    const normResult = result.toUpperCase() === 'FAILED' ? 'FAILED' : 'PASSED';

    try {
      if (db.isConnected()) {
        const res = await db.query(
          `INSERT INTO quality_checks (business_id, batch_id, inspector_id, result, quality_notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [business_id, bId, inspector_id, normResult, quality_notes]
        );

        if (normResult === 'PASSED') {
          await batchRepository.updateStatus(bId, 'Packaged', {
            bakerId: inspector_id,
            notes: `QC Passed: ${quality_notes}`,
            businessId: business_id
          });
        }

        const batch = await batchRepository.getBatchById(bId, business_id);
        return {
          ...res.rows[0],
          batch_code: batch ? (batch.batch_no || batch.batch_code) : `BC-${bId}`,
          inspector_name,
        };
      }
    } catch (err) {
      throw err;
    }

    const batch = await batchRepository.getBatchById(bId, business_id);
    const record = {
      id: nextQcId++,
      business_id: Number(business_id),
      batch_id: bId,
      batch_code: batch ? (batch.batch_no || batch.batch_code) : `BC-${bId}`,
      inspector_id: Number(inspector_id),
      inspector_name,
      result: normResult,
      quality_notes,
      checked_at: new Date().toISOString()
    };

    memoryQualityChecks.unshift(record);

    if (batch && record.result === 'PASSED') {
      await batchRepository.updateStatus(bId, 'Packaged', {
        bakerId: inspector_id,
        notes: `QC Passed: ${quality_notes}`,
        businessId: business_id
      });
    }

    return record;
  }

  async getChecksByBatch(batchId, businessId = 1) {
    try {
      if (db.isConnected()) {
        const res = await db.query(
          `SELECT qc.*, pb.batch_no as batch_code, u.name as inspector_name
           FROM quality_checks qc
           LEFT JOIN production_batches pb ON qc.batch_id = pb.id
           LEFT JOIN users u ON qc.inspector_id = u.id
           WHERE qc.batch_id = $1 AND qc.business_id = $2
           ORDER BY qc.id DESC`,
          [batchId, businessId]
        );
        return res.rows;
      }
    } catch (err) {
      throw err;
    }
    return [];
  }

  async getAllChecks(businessId = 1) {
    try {
      if (db.isConnected()) {
        const res = await db.query(
          `SELECT qc.*, pb.batch_no as batch_code, u.name as inspector_name
           FROM quality_checks qc
           LEFT JOIN production_batches pb ON qc.batch_id = pb.id
           LEFT JOIN users u ON qc.inspector_id = u.id
           WHERE qc.business_id = $1
           ORDER BY qc.id DESC`,
          [businessId]
        );
        return res.rows;
      }
    } catch (err) {
      throw err;
    }
    return [];
  }
}

module.exports = new QualityRepository();
