import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { startOfWeek, startOfMonth, addDays, getYear, getMonth, format } from 'date-fns';

/**
 * Get timezone for a stock exchange
 * @param {string} exchange - Exchange code (e.g., 'NASDAQ', 'NYSE', 'LSE', 'HKEX')
 * @returns {string} IANA timezone identifier
 */
export const getExchangeTimezone = (exchange) => {
  const timezones = {
    // US Exchanges
    'NASDAQ': 'America/New_York',
    'NYSE': 'America/New_York',
    'NYSEARCA': 'America/New_York',
    'AMEX': 'America/New_York',
    'BATS': 'America/New_York',
    
    // European Exchanges
    'LSE': 'Europe/London',
    'LON': 'Europe/London',
    'FRA': 'Europe/Berlin',
    'PAR': 'Europe/Paris',
    'AMS': 'Europe/Amsterdam',
    'SWX': 'Europe/Zurich',
    
    // Asian Exchanges
    'HKEX': 'Asia/Hong_Kong',
    'HKG': 'Asia/Hong_Kong',
    'TSE': 'Asia/Tokyo',
    'TYO': 'Asia/Tokyo',
    'SSE': 'Asia/Shanghai',
    'SHH': 'Asia/Shanghai',
    'KRX': 'Asia/Seoul',
    'NSE': 'Asia/Kolkata',
    'BOM': 'Asia/Kolkata',
    
    // Other Exchanges
    'ASX': 'Australia/Sydney',
    'TSX': 'America/Toronto',
    'BMV': 'America/Mexico_City',
    'BOVESPA': 'America/Sao_Paulo',
  };
  
  return timezones[exchange?.toUpperCase()] || 'America/New_York'; // Default to ET
};

/**
 * Format timestamp with exchange timezone
 * @param {string|Date} timestamp - Timestamp to format
 * @param {string} exchange - Exchange code
 * @param {Object} options - Additional formatting options
 * @returns {string} Formatted timestamp string
 */
export const formatTimestampWithTimezone = (timestamp, exchange, options = {}) => {
  if (!timestamp) return '';
  
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const timezone = getExchangeTimezone(exchange);
  
  const defaultOptions = {
    month: 'short' as const,
    day: 'numeric' as const,
    year: 'numeric' as const,
    hour: 'numeric' as const,
    minute: '2-digit' as const,
    second: '2-digit' as const,
    hour12: true,
    timeZone: timezone,
    timeZoneName: 'short' as const
  };

  return date.toLocaleString('en-US', { ...defaultOptions, ...options } as any);
};

/**
 * Get short timezone abbreviation
 * @param {string} exchange - Exchange code
 * @returns {string} Timezone abbreviation (e.g., 'ET', 'GMT', 'HKT')
 */
export const getTimezoneAbbreviation = (exchange) => {
  const date = new Date();
  const timezone = getExchangeTimezone(exchange);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short'
  });

  const parts = formatter.formatToParts(date);
  const timezonePart = parts.find(part => part.type === 'timeZoneName');

  return timezonePart?.value || 'UTC';
};

/**
 * Parse a date string as midnight in the exchange's timezone
 *
 * This fixes the timezone shift issue where backend sends date strings like "2024-11-01"
 * representing midnight in the exchange timezone, but JavaScript's new Date() interprets
 * them incorrectly (as midnight UTC or local time), causing dates to shift by a day.
 *
 * @param {string|Date} dateString - Date string to parse (e.g., "2024-11-01" or "2024-11-01T00:00:00")
 * @param {string} exchange - Exchange code (e.g., 'NASDAQ', 'NYSE')
 * @returns {Date} Date object properly parsed in the exchange's timezone
 *
 * @example
 * // Without this function (WRONG):
 * new Date("2024-11-01") // Parses as midnight local time, displays Oct 31 when formatted in America/New_York
 *
 * // With this function (CORRECT):
 * parseExchangeDate("2024-11-01", "NASDAQ") // Parses as midnight America/New_York, displays Nov 1 correctly
 */
export const parseExchangeDate = (dateString, exchange) => {
  if (!dateString) return null;

  // If already a Date object, return it
  if (dateString instanceof Date) return dateString;

  const timezone = getExchangeTimezone(exchange);

  // Extract just the date part (YYYY-MM-DD) from the string
  // This handles both "2024-11-01" and "2024-11-01T00:00:00" formats
  const dateOnlyMatch = String(dateString).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateOnlyMatch) {
    // If no date pattern found, fall back to standard parsing
    console.warn(`Unable to parse date string: ${dateString}`);
    return new Date(dateString);
  }

  const dateOnly = dateOnlyMatch[1]; // e.g., "2024-11-01"

  // Create a date string that explicitly represents midnight in the exchange timezone
  // We use ISO format with explicit time to ensure consistent parsing
  const isoString = `${dateOnly}T00:00:00`;

  // Parse as if the string represents a time in the exchange's timezone
  // toZonedTime treats the input as being in the specified timezone
  const zonedDate = toZonedTime(isoString, timezone);

  return zonedDate;
};

/**
 * Parse timestamp string preserving time information in exchange timezone
 *
 * This function is for intraday data (1D hourly timestamps) where the time component
 * must be preserved. Unlike parseExchangeDate which anchors to midnight, this function
 * keeps the exact hour/minute/second from the timestamp.
 *
 * @param {string|Date} timestampString - ISO timestamp with time (e.g., "2024-11-01T14:30:00")
 * @param {string} exchange - Exchange code (e.g., 'NASDAQ', 'NYSE')
 * @returns {Date} Date object with time preserved in the exchange's timezone
 *
 * @example
 * // Preserves 2:30 PM time
 * parseExchangeTimestamp("2024-11-01T14:30:00", "NASDAQ")
 * // Returns: Date representing 2:30 PM America/New_York on Nov 1, 2024
 *
 * // Compare with parseExchangeDate which would strip time to midnight:
 * parseExchangeDate("2024-11-01T14:30:00", "NASDAQ")
 * // Returns: Date representing 12:00 AM America/New_York on Nov 1, 2024
 */
export const parseExchangeTimestamp = (timestampString, exchange) => {
  if (!timestampString) return null;

  // If already a Date object, return it
  if (timestampString instanceof Date) return timestampString;

  const timezone = getExchangeTimezone(exchange);

  // Parse the full timestamp, preserving the time component
  // toZonedTime interprets the input as being in the specified timezone
  const zonedDate = toZonedTime(timestampString, timezone);

  return zonedDate;
};

/**
 * Get the start of the week (Monday) for a date in the exchange timezone
 *
 * This function ensures week boundaries are calculated based on the exchange timezone,
 * not the viewer's local timezone. Critical for correct weekly aggregation.
 *
 * @param {Date} date - Date object (should be from parseExchangeDate/parseExchangeTimestamp)
 * @param {string} exchange - Exchange code (e.g., 'NASDAQ', 'NYSE')
 * @returns {Date} Date object representing Monday at midnight in the exchange timezone
 *
 * @example
 * const date = parseExchangeDate("2024-11-06", "NASDAQ"); // Wednesday
 * const weekStart = getWeekStartInTimezone(date, "NASDAQ");
 * // Returns: Monday Nov 4, 2024 at midnight ET (not shifted to viewer's timezone)
 */
export const getWeekStartInTimezone = (date, exchange) => {
  if (!date) return null;

  const timezone = getExchangeTimezone(exchange);

  // Convert the date to a plain UTC representation that preserves the "wall clock" time
  // This ensures startOfWeek operates on the exchange timezone's date components
  const utcDate = fromZonedTime(date, timezone);

  // Get start of week (Monday) in UTC
  const weekStart = startOfWeek(utcDate, { weekStartsOn: 1 }); // 1 = Monday

  // Convert back to zoned time to preserve exchange timezone
  return toZonedTime(weekStart, timezone);
};

/**
 * Get YYYY-MM month key for a date in the exchange timezone
 *
 * Extracts year and month in the exchange timezone (not viewer's local timezone).
 * Critical for correct monthly aggregation.
 *
 * @param {Date} date - Date object (should be from parseExchangeDate/parseExchangeTimestamp)
 * @param {string} exchange - Exchange code (e.g., 'NASDAQ', 'NYSE')
 * @returns {string} Month key in format "YYYY-MM"
 *
 * @example
 * const date = parseExchangeDate("2024-11-01", "NASDAQ");
 * const monthKey = getMonthKeyInTimezone(date, "NASDAQ");
 * // Returns: "2024-11" (even if viewer is in different timezone)
 */
export const getMonthKeyInTimezone = (date, exchange) => {
  if (!date) return null;

  const timezone = getExchangeTimezone(exchange);

  // Format the date in the exchange timezone to extract year and month
  // Using format from date-fns with timezone-aware date
  const utcDate = fromZonedTime(date, timezone);

  return format(utcDate, 'yyyy-MM');
};

/**
 * Get the first day of a month in the exchange timezone
 *
 * Creates a date representing the 1st of the month at midnight in the exchange timezone.
 * Used for monthly aggregation timestamps.
 *
 * @param {number} year - Full year (e.g., 2024)
 * @param {number} month - Month (0-11, JavaScript convention)
 * @param {string} exchange - Exchange code (e.g., 'NASDAQ', 'NYSE')
 * @returns {Date} Date object representing 1st of month at midnight in exchange timezone
 *
 * @example
 * const monthStart = getMonthStartInTimezone(2024, 10, "NASDAQ"); // November 2024
 * // Returns: Nov 1, 2024 at midnight ET
 */
export const getMonthStartInTimezone = (year, month, exchange) => {
  const timezone = getExchangeTimezone(exchange);

  // Create date string for the 1st of the month
  const monthStr = String(month + 1).padStart(2, '0');
  const dateString = `${year}-${monthStr}-01T00:00:00`;

  // Parse in the exchange timezone
  return toZonedTime(dateString, timezone);
};

/**
 * Add days to a date while preserving the exchange timezone
 *
 * Adds the specified number of days without timezone shifting.
 * Used for calculating week end dates in the exchange timezone.
 *
 * @param {Date} date - Starting date (should be from parseExchangeDate/parseExchangeTimestamp)
 * @param {number} days - Number of days to add (can be negative)
 * @param {string} exchange - Exchange code (e.g., 'NASDAQ', 'NYSE')
 * @returns {Date} Date object with days added in the exchange timezone
 *
 * @example
 * const monday = parseExchangeDate("2024-11-04", "NASDAQ");
 * const sunday = addDaysInTimezone(monday, 6, "NASDAQ");
 * // Returns: Sunday Nov 10, 2024 at midnight ET
 */
export const addDaysInTimezone = (date, days, exchange) => {
  if (!date) return null;

  const timezone = getExchangeTimezone(exchange);

  // Convert to UTC representation preserving wall clock time
  const utcDate = fromZonedTime(date, timezone);

  // Add days
  const newDate = addDays(utcDate, days);

  // Convert back to zoned time
  return toZonedTime(newDate, timezone);
};

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
    month: 'short' as const,
    day: 'numeric' as const,
    year: 'numeric' as const,
    ...(includeTime && {
      hour: 'numeric' as const,
      minute: '2-digit' as const,
      hour12: true,
      timeZoneName: 'short' as const
    })
  };

  return date.toLocaleString('en-US', options as any);
};

/**
 * Format date for chart labels
 * @param {string} dateString - Date string to format
 * @param {Object} options - Intl.DateTimeFormat options (default: month: 'short', day: 'numeric')
 * @returns {string} Formatted date string
 */
export const formatChartDate = (dateString, options: any = { month: 'short', day: 'numeric' }) => {
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
export const formatDate = (dateString, options: any = { month: 'short', day: 'numeric' }) => {
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
  if (score >= 0.15) return 'text-green-600';
  if (score <= -0.15) return 'text-red-600';
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
