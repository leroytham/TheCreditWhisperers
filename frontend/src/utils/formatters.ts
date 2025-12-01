/**
 * Formatting Utilities
 *
 * Centralized formatting functions to ensure consistency across the app
 * Replaces duplicate formatting logic scattered across components
 */

// Import normalization functions for re-export and default export
import {
  normalizeToPercentageReturn,
  normalizeToPercentageReturnWithCapitalFlows,
  normalizeToTWR,
  normalizeToHybridReturn
} from './normalization';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface CurrencyOptions {
  compact?: boolean;
  decimals?: number;
  currency?: string;
  locale?: string;
}

export interface PercentageOptions {
  decimals?: number;
  showSign?: boolean;
  showSymbol?: boolean;
}

export interface DateOptions {
  format?: 'short' | 'long' | 'relative';
  includeTime?: boolean;
  locale?: string;
}

export interface SentimentColorOptions {
  tailwind?: boolean;
}

export interface SentimentColorResult {
  text: string;
  bg: string;
}

export interface ChangeColorOptions {
  inverse?: boolean;
}

// Re-export normalization types for backwards compatibility
export type {
  DataPoint,
  LotBreakdown,
  TWRData,
  TWRSubPeriod,
  NormalizedDataPoint
} from './normalization';

// =============================================================================
// CURRENCY FORMATTING
// =============================================================================

/**
 * Format currency values
 *
 * @param value - The numeric value to format
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | null | undefined, options: CurrencyOptions = {}): string {
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
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted compact currency string
 */
export function formatCompactCurrency(value: number | null | undefined, decimals: number = 1): string {
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

// =============================================================================
// PERCENTAGE FORMATTING
// =============================================================================

/**
 * Format percentage values
 *
 * @param value - The numeric value to format as percentage
 * @param options - Formatting options
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number | null | undefined, options: PercentageOptions = {}): string {
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

// =============================================================================
// NUMBER FORMATTING
// =============================================================================

/**
 * Format large numbers with thousand separators
 *
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 0)
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted number string
 */
export function formatNumber(value: number | null | undefined, decimals: number = 0, locale: string = 'en-US'): string {
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
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted compact number string
 */
export function formatCompactNumber(value: number | null | undefined, decimals: number = 1): string {
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

// =============================================================================
// DATE FORMATTING
// =============================================================================

/**
 * Format date/time
 *
 * @param date - The date to format
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | number | null | undefined, options: DateOptions = {}): string {
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

  const dateOptions: Intl.DateTimeFormatOptions = {
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
 * @param date - The date to format
 * @returns Relative date string
 */
export function formatRelativeDate(date: Date | string | number): string {
  const now = new Date();
  const dateObj = date instanceof Date ? date : new Date(date);
  const diffMs = now.getTime() - dateObj.getTime();
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

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Get color class for sentiment values
 *
 * @param value - Sentiment value
 * @param options - Options
 * @returns Color classes or RGB values
 */
export function getSentimentColor(value: number | null | undefined, options: SentimentColorOptions = {}): string | SentimentColorResult {
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
 * @param value - The value to evaluate
 * @param options - Options
 * @returns Tailwind color class
 */
export function getChangeColor(value: number | null | undefined, options: ChangeColorOptions = {}): string {
  const { inverse = false } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return 'text-gray-500';
  }

  const num = Number(value);

  if (num > 0) return inverse ? 'text-red-600' : 'text-green-600';
  if (num < 0) return inverse ? 'text-green-600' : 'text-red-600';
  return 'text-gray-500';
}

// =============================================================================
// TEXT UTILITIES
// =============================================================================

/**
 * Truncate text with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to append (default: '...')
 * @returns Truncated text
 */
export function truncateText(text: string | null | undefined, maxLength: number, suffix: string = '...'): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Parse numeric string with commas
 *
 * @param value - Value to parse
 * @returns Parsed numeric value
 */
export function parseNumericString(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const cleaned = String(value).replace(/,/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
}

// =============================================================================
// PORTFOLIO NORMALIZATION UTILITIES
// =============================================================================

// Re-export normalization functions for backwards compatibility
export {
  normalizeToPercentageReturn,
  normalizeToPercentageReturnWithCapitalFlows,
  normalizeToTWR,
  normalizeToHybridReturn
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

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
  normalizeToPercentageReturnWithCapitalFlows,
  normalizeToTWR,
  normalizeToHybridReturn,
};
