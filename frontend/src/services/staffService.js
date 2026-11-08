import api from './api';

export const staffService = {
  // Batches & Floor Tasks
  async getBatches(params = {}) {
    const res = await api.get('/batches', { params });
    return res.data;
  },

  async getBatchById(id) {
    const res = await api.get(`/batches/${id}`);
    return res.data;
  },

  async createBatch(batchData) {
    const res = await api.post('/batches', batchData);
    return res.data;
  },

  async updateBatchStatus(id, updateData) {
    const res = await api.patch(`/batches/${id}/status`, updateData);
    return res.data;
  },

  async rejectBatch(id, rejectionData) {
    const res = await api.post(`/batches/${id}/reject`, rejectionData);
    return res.data;
  },

  // Raw Materials Floor Stock & Requisitions
  async getIngredients(params = {}) {
    const res = await api.get('/ingredients', { params });
    return res.data;
  },

  async getIngredientById(id) {
    const res = await api.get(`/ingredients/${id}`);
    return res.data;
  },

  async createRequisition(requisitionData) {
    const res = await api.post('/ingredients/requisitions', requisitionData);
    return res.data;
  },

  async getRequisitions(params = {}) {
    const res = await api.get('/ingredients/requisitions/all', { params });
    return res.data;
  },

  async confirmReplenishment(requisitionId, data = {}) {
    const res = await api.post(`/ingredients/requisitions/${requisitionId}/confirm`, data);
    return res.data;
  },

  async getActiveNotifications() {
    const res = await api.get('/ingredients/notifications/active');
    return res.data;
  },

  // Wastage Tracking & Logging
  async recordWastage(wastageData) {
    const res = await api.post('/wastage', wastageData);
    return res.data;
  },

  async getWastageHistory(params = {}) {
    const res = await api.get('/wastage', { params });
    return res.data;
  },

  async getTodayWastageSummary() {
    const res = await api.get('/wastage/today-summary');
    return res.data;
  },

  // Quality Inspection
  async submitQualityCheck(qcData) {
    const res = await api.post('/quality-checks', qcData);
    return res.data;
  },

  async getQualityChecks(batchId) {
    const res = await api.get(batchId ? `/quality-checks/batch/${batchId}` : '/quality-checks');
    return res.data;
  },

  // Orders & Fulfillment
  async getAllOrders(params = {}) {
    const res = await api.get('/orders/business/all', { params });
    return res.data;
  },

  async updateOrderStatus(orderId, status, notes = '') {
    const res = await api.patch(`/orders/${orderId}/status`, { status, notes });
    return res.data;
  },

  // Product Catalog Updates
  async updateProduct(id, productData) {
    const res = await api.put(`/products/${id}`, productData);
    return res.data;
  },

  // Telemetry Health
  async getHealth() {
    return api.get('/health');
  }
};

export default staffService;
