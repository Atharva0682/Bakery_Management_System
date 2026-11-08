const qualityRepository = require('../models/qualityRepository');
const { successResponse, errorResponse } = require('../utils/response');

class QualityController {
  async submitQualityCheck(req, res) {
    try {
      const batch_id = req.body.batch_id || req.body.batchId;
      const result = req.body.result;
      const quality_notes = req.body.quality_notes || req.body.notes || '';
      const accepted_quantity = req.body.accepted_quantity;
      const rejected_quantity = req.body.rejected_quantity;
      const rejection_reason = req.body.rejection_reason;
      const remarks = req.body.remarks;
      const internal_temp = req.body.internal_temp;

      if (!batch_id || !result) {
        return errorResponse(res, 'MISSING_DATA', 'Batch ID and result (PASSED/FAILED) are required.', 400);
      }

      const record = await qualityRepository.submitQualityCheck({
        business_id: req.user.business_id,
        batch_id,
        inspector_id: req.user.id,
        inspector_name: req.user.name,
        result,
        accepted_quantity,
        rejected_quantity,
        rejection_reason,
        quality_notes,
        remarks,
        internal_temp
      });

      return successResponse(res, record, 201);
    } catch (err) {
      return errorResponse(res, 'QC_SUBMIT_ERROR', err.message, 400);
    }
  }

  async getChecksByBatch(req, res) {
    try {
      const records = await qualityRepository.getChecksByBatch(req.params.batchId, req.user.business_id);
      return successResponse(res, records, 200);
    } catch (err) {
      return errorResponse(res, 'QC_FETCH_ERROR', err.message, 500);
    }
  }

  async getAllChecks(req, res) {
    try {
      const records = await qualityRepository.getAllChecks(req.user.business_id);
      return successResponse(res, records, 200);
    } catch (err) {
      return errorResponse(res, 'QC_FETCH_ERROR', err.message, 500);
    }
  }
}

module.exports = new QualityController();
