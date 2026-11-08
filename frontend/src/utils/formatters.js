/**
 * Utility functions for multi-tenant dynamic currency and date formatting
 */

/**
 * Formats a monetary amount dynamically based on business currency
 * @param {number|string} amount - The numeric price/total to format
 * @param {string} currency - The 3-letter ISO currency code (e.g. 'INR', 'USD', 'EUR')
 * @param {string} [currencySymbol] - Optional custom symbol override
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'INR', currencySymbol = null) => {
  const num = Number(amount) || 0;
  const curr = (currency || 'INR').toUpperCase();

  const localeMap = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    AED: 'en-AE',
    SGD: 'en-SG',
    CAD: 'en-CA',
    AUD: 'en-AU',
  };
  const locale = localeMap[curr] || 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: num % 1 === 0 ? 0 : 2,
    }).format(num);
  } catch (err) {
    const symbol = currencySymbol || (curr === 'INR' ? '₹' : curr === 'USD' ? '$' : '€');
    return `${symbol}${num.toFixed(num % 1 === 0 ? 0 : 2)}`;
  }
};

export const formatDate = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatTime = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};
