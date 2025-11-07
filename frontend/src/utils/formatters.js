/**
 * Formatting Utilities
 *
 * Centralized formatting functions to ensure consistency across the app
 * Replaces duplicate formatting logic scattered across components
 */

/**
 * Format currency values
 *
 * @param {number} value - The numeric value to format
 * @param {Object} options - Formatting options
 * @param {boolean} options.compact - Use compact notation (K, M, B)
 * @param {number} options.decimals - Number of decimal places
 * @param {string} options.currency - Currency code (default: 'USD')
 * @param {string} options.locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value, options = {}) {
  const {
    compact = false,
    decimals,
    currency = 'USD',
    locale = 'en-US',
  } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return '$0.00';
  }

  const numValue = Number(value);

  if (compact) {
    return formatCompactCurrency(numValue, decimals);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals !== undefined ? decimals : 2,
    maximumFractionDigits: decimals !== undefined ? decimals : 2,
  }).format(numValue);
}

/**
 * Format currency in compact notation (e.g., $1.2M, $500K)
 *
 * @param {number} value - The numeric value to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted compact currency string
 */
export function formatCompactCurrency(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0';
  }

  const num = Number(value);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1e9) {
    return `${sign}$${(abs / 1e9).toFixed(decimals)}B`;
  }
  if (abs >= 1e6) {
    return `${sign}$${(abs / 1e6).toFixed(decimals)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}$${(abs / 1e3).toFixed(decimals)}K`;
  }

  return `${sign}$${abs.toFixed(decimals)}`;
}

/**
 * Format percentage values
 *
 * @param {number} value - The numeric value to format as percentage
 * @param {Object} options - Formatting options
 * @param {number} options.decimals - Number of decimal places (default: 2)
 * @param {boolean} options.showSign - Always show + sign for positive values
 * @param {boolean} options.showSymbol - Show % symbol (default: true)
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value, options = {}) {
  const {
    decimals = 2,
    showSign = false,
    showSymbol = true,
  } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }

  const num = Number(value);
  const sign = num > 0 && showSign ? '+' : '';
  const formatted = num.toFixed(decimals);
  const symbol = showSymbol ? '%' : '';

  return `${sign}${formatted}${symbol}`;
}

/**
 * Format large numbers with thousand separators
 *
 * @param {number} value - The numeric value to format
 * @param {number} decimals - Number of decimal places (default: 0)
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted number string
 */
export function formatNumber(value, decimals = 0, locale = 'en-US') {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value));
}

/**
 * Format compact numbers (e.g., 1.2M, 500K)
 *
 * @param {number} value - The numeric value to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted compact number string
 */
export function formatCompactNumber(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  const num = Number(value);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1e9) {
    return `${sign}${(abs / 1e9).toFixed(decimals)}B`;
  }
  if (abs >= 1e6) {
    return `${sign}${(abs / 1e6).toFixed(decimals)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}${(abs / 1e3).toFixed(decimals)}K`;
  }

  return `${sign}${abs.toFixed(decimals)}`;
}

/**
 * Format date/time
 *
 * @param {Date|string|number} date - The date to format
 * @param {Object} options - Formatting options
 * @param {string} options.format - Format type: 'short', 'long', 'relative' (default: 'short')
 * @param {boolean} options.includeTime - Include time in output
 * @param {string} options.locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  const {
    format = 'short',
    includeTime = false,
    locale = 'en-US',
  } = options;

  if (!date) return '';

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  if (format === 'relative') {
    return formatRelativeDate(dateObj);
  }

  const dateOptions = {
    year: 'numeric',
    month: format === 'long' ? 'long' : 'short',
    day: 'numeric',
  };

  if (includeTime) {
    dateOptions.hour = '2-digit';
    dateOptions.minute = '2-digit';
  }

  return new Intl.DateTimeFormat(locale, dateOptions).format(dateObj);
}

/**
 * Format relative date (e.g., "2 hours ago", "3 days ago")
 *
 * @param {Date} date - The date to format
 * @returns {string} Relative date string
 */
export function formatRelativeDate(date) {
  const now = new Date();
  const dateObj = date instanceof Date ? date : new Date(date);
  const diffMs = now - dateObj;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffWeek < 4) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
}

/**
 * Get color class for sentiment values
 *
 * @param {number} value - Sentiment value
 * @param {Object} options - Options
 * @param {boolean} options.tailwind - Return Tailwind classes (default: true)
 * @returns {string|Object} Color classes or RGB values
 */
export function getSentimentColor(value, options = {}) {
  const { tailwind = true } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return tailwind ? 'text-gray-500 bg-gray-100' : { text: '#6B7280', bg: '#F3F4F6' };
  }

  const num = Number(value);

  if (tailwind) {
    if (num > 0.6) return 'text-green-700 bg-green-100';
    if (num > 0.2) return 'text-green-600 bg-green-50';
    if (num > -0.2) return 'text-gray-600 bg-gray-100';
    if (num > -0.6) return 'text-red-600 bg-red-50';
    return 'text-red-700 bg-red-100';
  }

  // RGB values for custom styling
  if (num > 0.6) return { text: '#15803D', bg: '#DCFCE7' };
  if (num > 0.2) return { text: '#16A34A', bg: '#F0FDF4' };
  if (num > -0.2) return { text: '#4B5563', bg: '#F3F4F6' };
  if (num > -0.6) return { text: '#DC2626', bg: '#FEF2F2' };
  return { text: '#B91C1C', bg: '#FEE2E2' };
}

/**
 * Get color class for positive/negative values
 *
 * @param {number} value - The value to evaluate
 * @param {Object} options - Options
 * @param {boolean} options.inverse - Inverse colors (red for positive, green for negative)
 * @returns {string} Tailwind color class
 */
export function getChangeColor(value, options = {}) {
  const { inverse = false } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return 'text-gray-500';
  }

  const num = Number(value);

  if (num > 0) return inverse ? 'text-red-600' : 'text-green-600';
  if (num < 0) return inverse ? 'text-green-600' : 'text-red-600';
  return 'text-gray-500';
}

/**
 * Truncate text with ellipsis
 *
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to append (default: '...')
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Parse numeric string with commas
 *
 * @param {string|number} value - Value to parse
 * @returns {number} Parsed numeric value
 */
export function parseNumericString(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const cleaned = String(value).replace(/,/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Normalize time-series data to percentage returns starting from 0%
 *
 * Converts absolute values to percentage change from the starting value.
 * Useful for comparing portfolio performance against benchmarks.
 *
 * @param {Array} data - Array of data points with 'close' or 'portfolio_value' field
 * @param {number|null} startValue - Optional starting value (uses first data point if not provided)
 * @returns {Array} Array with values normalized to % returns from start
 *
 * @example
 * const portfolio = [
 *   { date: '2024-01-01', close: 100000 },
 *   { date: '2024-01-02', close: 105000 },
 *   { date: '2024-01-03', close: 103000 }
 * ];
 * const normalized = normalizeToPercentageReturn(portfolio);
 * // Returns:
 * // [
 * //   { date: '2024-01-01', close: 0 },      // 0% change from start
 * //   { date: '2024-01-02', close: 5.0 },    // +5% from start
 * //   { date: '2024-01-03', close: 3.0 }     // +3% from start
 * // ]
 */
export function normalizeToPercentageReturn(data, startValue = null) {
  if (!data || data.length === 0) {
    return [];
  }

  // Determine the starting value
  const firstPoint = data[0];
  const start = startValue !== null
    ? startValue
    : (firstPoint.close || firstPoint.portfolio_value || 0);

  if (start === 0) {
    // Can't normalize from zero - return original data
    console.warn('Cannot normalize data starting from zero value');
    return data;
  }

  // Normalize each data point to percentage return from start
  return data.map(point => {
    const currentValue = point.close || point.portfolio_value || 0;
    const percentReturn = ((currentValue - start) / start) * 100;

    return {
      ...point,
      close: percentReturn,  // Standardize to 'close' field
      originalValue: currentValue  // Keep original value for reference
    };
  });
}

export default {
  formatCurrency,
  formatCompactCurrency,
  formatPercentage,
  formatNumber,
  formatCompactNumber,
  formatDate,
  formatRelativeDate,
  getSentimentColor,
  getChangeColor,
  truncateText,
  parseNumericString,
  normalizeToPercentageReturn,
};
