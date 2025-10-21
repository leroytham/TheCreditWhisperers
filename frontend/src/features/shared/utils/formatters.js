/**
 * Shared Formatting Utilities
 *
 * Consolidated functions for formatting prices, dates, percentages, and other data
 * Used by both Entity and Sector features
 */

/**
 * Format price/number with optional currency
 * @param {number} price - Price value to format
 * @param {string} currency - Currency code (default 'USD')
 * @param {number} decimals - Number of decimal places (default 2)
 * @returns {string} Formatted price string
 */
export const formatPrice = (price, currency = 'USD', decimals = 2) => {
  if (price === null || price === undefined) return '--';

  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Alias for formatPrice for currency-specific formatting
 * @param {number} value - Number to format
 * @param {string} currency - Currency code (default 'USD')
 * @param {number} decimals - Number of decimal places (default 2)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, currency = 'USD', decimals = 2) => {
  return formatPrice(value, currency, decimals);
};

/**
 * Format percentage change
 * @param {number} value - Percentage value
 * @param {number} decimals - Number of decimal places (default 2)
 * @param {boolean} includeSign - Whether to include + sign for positive values (default true)
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 2, includeSign = true) => {
  if (value === null || value === undefined) return '--';

  const sign = includeSign && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
};

/**
 * Format date and time for display
 * @param {string} dateString - Date string to format
 * @param {boolean} includeTime - Whether to include time (default true)
 * @returns {string} Formatted date/time string
 */
export const formatDateTime = (dateString, includeTime = true) => {
  if (!dateString) return 'Loading...';

  const date = new Date(dateString);
  const options = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime && {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    })
  };

  return date.toLocaleString('en-US', options);
};

/**
 * Format date for chart labels
 * @param {string} dateString - Date string to format
 * @param {Object} options - Intl.DateTimeFormat options (default: month: 'short', day: 'numeric')
 * @returns {string} Formatted date string
 */
export const formatChartDate = (dateString, options = { month: 'short', day: 'numeric' }) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', options);
};

/**
 * Alias for formatChartDate for consistency
 * @param {string} dateString - Date string to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString, options = { month: 'short', day: 'numeric' }) => {
  return formatChartDate(dateString, options);
};

/**
 * Format full timestamp for data retrieval
 * @param {Date|string} date - Date object or string
 * @returns {string} Formatted timestamp string
 */
export const formatFullTimestamp = (date) => {
  if (!date) return '';

  const dateObj = date instanceof Date ? date : new Date(date);

  return dateObj.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });
};

/**
 * Get sentiment text color class
 * @param {number} score - Sentiment score
 * @returns {string} Tailwind CSS color class
 */
export const getSentimentColor = (score) => {
  if (score > 0) return 'text-green-600';
  if (score < 0) return 'text-red-600';
  return 'text-gray-600';
};

/**
 * Get sentiment background color class
 * @param {number} score - Sentiment score
 * @returns {string} Tailwind CSS background and border color classes
 */
export const getSentimentBgColor = (score) => {
  if (score > 0) return 'bg-green-50 border-green-600';
  if (score < 0) return 'bg-red-50 border-red-600';
  return 'bg-gray-50 border-gray-600';
};

/**
 * Get price change color class
 * @param {number} change - Price change value
 * @returns {string} Tailwind CSS color class
 */
export const getPriceChangeColor = (change) => {
  return change >= 0 ? 'text-green-600' : 'text-red-600';
};

/**
 * Get price change arrow symbol
 * @param {number} change - Price change value
 * @returns {string} Arrow symbol (▲ or ▼)
 */
export const getPriceChangeArrow = (change) => {
  return change >= 0 ? '▲' : '▼';
};

/**
 * Get chart line color (hex value)
 * @param {number} change - Price change value
 * @returns {string} Hex color code
 */
export const getChartLineColor = (change) => {
  return change >= 0 ? '#16a34a' : '#dc2626';
};

/**
 * Get bar color for sentiment chart (hex value)
 * @param {number} score - Sentiment score
 * @returns {string} Hex color code
 */
export const getBarColor = (score) => {
  if (score > 0) return '#22c55e';
  if (score < 0) return '#ef4444';
  return '#9ca3af';
};
