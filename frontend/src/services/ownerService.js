import api from './api';

export const ownerService = {
  async getAnalytics(params = {}) {
    const res = await api.get('/owner/analytics', { params });
    return res.data;
  },

  async getDashboardSummary() {
    const res = await api.get('/owner/dashboard-summary');
    return res.data;
  },

  async getTraceability(query = '') {
    if (query) {
      const res = await api.get(`/owner/traceability/${encodeURIComponent(query)}`);
      return res.data;
    }
    const res = await api.get('/owner/traceability/dashboard');
    return res.data;
  },

  async getTraceabilityDashboard(params = {}) {
    const res = await api.get('/owner/traceability/dashboard', { params });
    return res.data;
  },

  async getBatchTraceabilityDetail(batchId) {
    const res = await api.get(`/owner/traceability/batch/${encodeURIComponent(batchId)}`);
    return res.data;
  },

  async confirmReplenishment(requisitionId, data = {}) {
    try {
      const res = await api.post(`/ingredients/requisitions/${requisitionId}/confirm`, data);
      return res?.data !== undefined ? res : { success: true, data: res };
    } catch (err) {
      if (err.response?.status === 404) {
        const fallback = await api.post(`/owner/replenishment/${requisitionId}/confirm`, data);
        return fallback?.data !== undefined ? fallback : { success: true, data: fallback };
      }
      throw err;
    }
  },

  async createReplacementRequest(data) {
    const res = await api.post('/ingredients/replacement-request', data);
    return res.data;
  },

  async getActiveStockNotifications() {
    const res = await api.get('/ingredients/notifications/active');
    return res.data;
  },

  async downloadRecallReportCsv(lotQuery) {
    const res = await api.get(`/owner/traceability/recall-csv/${encodeURIComponent(lotQuery)}`, {
      responseType: 'blob',
    });
    return res.data;
  },

  async getProductionPlanning() {
    const res = await api.get('/owner/production-planning');
    return res.data;
  },

  async getCostingAndMargins() {
    const res = await api.get('/owner/costing');
    return res.data;
  },

  async getVendors() {
    const res = await api.get('/owner/vendors');
    return res.data;
  },

  async createVendor(data) {
    const res = await api.post('/owner/vendors', data);
    return res.data;
  },

  async getWorkers() {
    const res = await api.get('/owner/workers');
    return res.data;
  },

  async onboardWorker(data) {
    const res = await api.post('/owner/workers', data);
    return res.data;
  },

  async getRecipes() {
    const res = await api.get('/owner/recipes');
    return res.data;
  },

  async getAllOrders(params = {}) {
    const res = await api.get('/orders/business/all', { params });
    return res.data;
  },

  async updateOrderStatus(orderId, status, notes = '') {
    const res = await api.patch(`/orders/${orderId}/status`, { status, notes });
    return res.data;
  },

  async getProducts() {
    const res = await api.get('/products');
    return res.data;
  },

  async getInventory() {
    const res = await api.get('/ingredients');
    return res.data;
  },

  async getBatches() {
    const res = await api.get('/batches');
    return res.data;
  },

  async getWastageSummary() {
    const res = await api.get('/wastage/today-summary');
    return res.data;
  },

  async updateWorker(id, data) {
    const res = await api.put(`/owner/workers/${id}`, data);
    return res.data;
  },

  async dismissWorker(id, reason) {
    const res = await api.post(`/owner/workers/${id}/dismiss`, { reason });
    return res.data;
  },

  async reactivateWorker(id) {
    const res = await api.post(`/owner/workers/${id}/reactivate`);
    return res.data;
  },

  async getShiftPolicy() {
    const res = await api.get('/owner/settings/shift-policy');
    return res.data;
  },

  async updateShiftPolicy(blockOutOfShiftLogin) {
    const res = await api.put('/owner/settings/shift-policy', { block_out_of_shift_login: blockOutOfShiftLogin });
    return res.data;
  },

  async getWastageHistory() {
    const res = await api.get('/wastage');
    return res.data;
  },

  async getVendorComparisons() {
    const res = await api.get('/owner/vendor-comparisons');
    return res.data;
  },

  async placeVendorOrder(orderData) {
    const res = await api.post('/owner/vendor-order', orderData);
    return res.data;
  },

  async createProductWithRecipe(payload) {
    const res = await api.post('/products', payload);
    return res.data;
  },

  async updateRecipe(recipeId, payload) {
    const res = await api.put(`/owner/recipes/${recipeId}`, payload);
    return res.data;
  },

  async updateProduct(productId, payload) {
    const res = await api.put(`/products/${productId}`, payload);
    return res.data;
  },

  async deleteProduct(productId) {
    const res = await api.delete(`/products/${productId}`);
    return res.data;
  },

  async deleteRecipe(recipeId) {
    const res = await api.delete(`/recipes/${recipeId}`);
    return res.data;
  },

  async getStockMovements() {
    const res = await api.get('/ingredients/movements/history');
    return res.data;
  }
};

export default ownerService;
