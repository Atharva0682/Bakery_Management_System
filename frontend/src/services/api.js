import axios from 'axios';

const getBaseUrl = () => import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Returns the active authentication token for a given API request based on:
 * 1. Explicit config.portal ('owner' | 'staff' | 'customer')
 * 2. Explicit config.headers.Authorization
 * 3. Request URL endpoint prefix (/owner/*, /staff/*)
 * 4. Current browser window location pathname (/owner/*, /staff/*, customer storefront)
 */
export const getScopedToken = (config = {}) => {
  // If explicitly passed in headers, don't override
  if (config.headers?.Authorization) {
    return null;
  }

  // 1. Explicit portal parameter
  if (config.portal === 'owner') {
    return localStorage.getItem('crumb_token_owner');
  }
  if (config.portal === 'staff') {
    return localStorage.getItem('crumb_token_staff');
  }
  if (config.portal === 'customer') {
    return localStorage.getItem('crumb_token_customer') || localStorage.getItem('crumb_token');
  }

  const url = (config.url || '').toLowerCase();
  const currentPath = (typeof window !== 'undefined' ? window.location.pathname : '').toLowerCase();

  // 2. Owner API routes or currently on an Owner page
  if (url.startsWith('/owner') || currentPath.startsWith('/owner')) {
    const ownerToken = localStorage.getItem('crumb_token_owner');
    if (ownerToken) return ownerToken;
  }

  // 3. Staff API routes or currently on a Staff page
  if (url.startsWith('/staff') || currentPath.startsWith('/staff')) {
    const staffToken = localStorage.getItem('crumb_token_staff');
    if (staffToken) return staffToken;
  }

  // 4. Shared operational kitchen routes (batches, wastage, ingredients, recipes)
  if (
    url.startsWith('/batches') ||
    url.startsWith('/wastage') ||
    url.startsWith('/ingredients') ||
    url.startsWith('/recipes')
  ) {
    if (currentPath.startsWith('/owner')) {
      const ownerToken = localStorage.getItem('crumb_token_owner');
      if (ownerToken) return ownerToken;
    }
    const staffToken = localStorage.getItem('crumb_token_staff');
    if (staffToken) return staffToken;
    const ownerToken = localStorage.getItem('crumb_token_owner');
    if (ownerToken) return ownerToken;
  }

  // 5. Customer storefront routes & default
  return (
    localStorage.getItem('crumb_token_customer') ||
    localStorage.getItem('crumb_token') ||
    null
  );
};

// Request interceptor to attach JWT token and active business context
api.interceptors.request.use(
  (config) => {
    const token = getScopedToken(config);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach active tenant context header
    const defaultSlug = import.meta.env.VITE_DEFAULT_BUSINESS_SLUG || 'crumbandco';
    const currentBusinessSlug = localStorage.getItem('crumb_business_slug') || defaultSlug;
    config.headers['X-Business-Slug'] = currentBusinessSlug;

    // Prevent double '/api/api' path if a caller specifies '/api/...'
    if (config.url && config.url.startsWith('/api/')) {
      config.url = config.url.substring(4);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for unified error extraction & isolated 401 handling
api.interceptors.response.use(
  (response) => {
    window.dispatchEvent(new Event('crumb-api-available'));
    return response.data;
  },
  (error) => {
    if (!error.response || error.response.status === 503) {
      window.dispatchEvent(new Event('crumb-api-unavailable'));
    }
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected network error occurred.';
    const customError = new Error(message);
    customError.code = error.response?.data?.error?.code || 'NETWORK_ERROR';
    customError.status = error.response?.status;

    // Clear stale session token on 401 Unauthorized strictly for the rejected scope
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/login') &&
      !error.config?.url?.includes('/auth/register')
    ) {
      const url = (error.config?.url || '').toLowerCase();
      const currentPath = (typeof window !== 'undefined' ? window.location.pathname : '').toLowerCase();
      let rejectedScope = 'customer';
      if (url.startsWith('/owner') || currentPath.startsWith('/owner')) {
        rejectedScope = 'owner';
        localStorage.removeItem('crumb_token_owner');
        localStorage.removeItem('crumb_user_owner');
      } else if (url.startsWith('/staff') || currentPath.startsWith('/staff')) {
        rejectedScope = 'staff';
        localStorage.removeItem('crumb_token_staff');
        localStorage.removeItem('crumb_user_staff');
      } else {
        localStorage.removeItem('crumb_token_customer');
        localStorage.removeItem('crumb_user_customer');
        localStorage.removeItem('crumb_token');
      }

      window.dispatchEvent(
        new CustomEvent('crumb-auth-invalid', {
          detail: { scope: rejectedScope, reason: 'UNAUTHORIZED_401' },
        })
      );
    }

    return Promise.reject(customError);
  }
);

export default api;
