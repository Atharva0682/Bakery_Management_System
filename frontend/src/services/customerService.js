import api from './api';

/**
 * Customer Service API client.
 * Connects frontend components to the backend Express Customer endpoints.
 */

// ==========================================
// 1. BUSINESS PUBLIC PROFILE
const defaultSlug = import.meta.env.VITE_DEFAULT_BUSINESS_SLUG || 'crumbandco';

export const getBusinessBySlug = async (slug = defaultSlug) => {
  return await api.get(`/business/${slug}`);
};

// ==========================================
// 2. CATALOG (CATEGORIES & PRODUCTS)
// ==========================================
export const getCategories = async (params = {}) => {
  return await api.get('/categories', { params });
};

export const getProducts = async (params = {}) => {
  return await api.get('/products', { params });
};

export const getProductById = async (id) => {
  return await api.get(`/products/${id}`);
};

// ==========================================
// 3. CUSTOMER PROFILE
// ==========================================
export const getCustomerProfile = async () => {
  return await api.get('/customers/me');
};

export const updateCustomerProfile = async (profileData) => {
  return await api.put('/customers/me', profileData);
};

// ==========================================
// 4. CUSTOMER ADDRESSES
// ==========================================
export const getCustomerAddresses = async () => {
  return await api.get('/customers/me/addresses');
};

export const createCustomerAddress = async (addressData) => {
  return await api.post('/customers/me/addresses', addressData);
};

export const updateCustomerAddress = async (id, addressData) => {
  return await api.put(`/customers/me/addresses/${id}`, addressData);
};

export const setDefaultCustomerAddress = async (id) => {
  return await api.put(`/customers/me/addresses/${id}/default`);
};

export const deleteCustomerAddress = async (id) => {
  return await api.delete(`/customers/me/addresses/${id}`);
};

// ==========================================
// 5. ORDERS & TRACKING
// ==========================================
export const createOrder = async (orderPayload) => {
  return await api.post('/orders', orderPayload);
};

export const getCustomerOrders = async (params = {}) => {
  return await api.get('/orders', { params });
};

export const getOrderById = async (id, params = {}) => {
  return await api.get(`/orders/${id}`, { params });
};

// ==========================================
// 5.1 PAYMENTS & UPI CONFIRMATION
// ==========================================
export const confirmPayment = async (paymentPayload) => {
  return await api.post('/payments/confirm', paymentPayload);
};

export const getOrderPayments = async (orderId) => {
  return await api.get(`/payments/order/${orderId}`);
};

// ==========================================
// 6. FEEDBACK
// ==========================================
export const submitOrderFeedback = async (feedbackPayload) => {
  return await api.post('/feedback', feedbackPayload);
};

export const getMyFeedback = async () => {
  return await api.get('/feedback/mine');
};

// ==========================================
// 7. QR CODE RESOLUTION
// ==========================================
export const resolveQrCode = async (uniqueCode) => {
  return await api.get(`/qr/${uniqueCode}`);
};

export const uploadReplacementScreenshot = async (orderId, screenshotData, trackingToken = null) => {
  return await api.post(`/orders/${orderId}/replacement-screenshot`, {
    screenshot: screenshotData,
    tracking_token: trackingToken,
  });
};

export const getDeliverySlots = async (date, businessId = 1) => {
  return await api.get('/orders/delivery-slots', { params: { date, business_id: businessId } });
};

export const checkDeliveryAvailability = async (payload) => {
  return await api.post('/orders/check-delivery-availability', payload);
};

const customerService = {
  getBusinessBySlug,
  getCategories,
  getProducts,
  getProductById,
  getCustomerProfile,
  updateCustomerProfile,
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  setDefaultCustomerAddress,
  deleteCustomerAddress,
  createOrder,
  getCustomerOrders,
  getOrderById,
  confirmPayment,
  getOrderPayments,
  uploadReplacementScreenshot,
  getDeliverySlots,
  checkDeliveryAvailability,
  submitOrderFeedback,
  submitFeedback: submitOrderFeedback,
  getMyFeedback,
  resolveQrCode,
};

export default customerService;
