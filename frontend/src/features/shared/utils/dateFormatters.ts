/**
 * Date & Timezone Formatting Utilities
 *
 * Functions for handling exchange timezones, parsing dates, and formatting timestamps.
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { startOfWeek, addDays, format } from 'date-fns';

/**
 * Get timezone for a stock exchange
 */
export const getExchangeTimezone = (exchange: string | undefined): string => {
  const timezones: Record<string, string> = {
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

  const key = exchange?.toUpperCase();
  return (key ? timezones[key] : undefined) || 'America/New_York';
};

/**
 * Format timestamp with exchange timezone
 */
export const formatTimestampWithTimezone = (
  timestamp: string | Date | null | undefined,
  exchange: string | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string => {
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
 */
export const getTimezoneAbbreviation = (exchange: string | undefined): string => {
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
 */
export const parseExchangeDate = (
  dateString: string | Date | null | undefined,
  exchange: string | undefined
): Date | null => {
  if (!dateString) return null;

  if (dateString instanceof Date) return dateString;

  const timezone = getExchangeTimezone(exchange);

  const dateOnlyMatch = String(dateString).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateOnlyMatch) {
    console.warn(`Unable to parse date string: ${dateString}`);
    return new Date(dateString);
  }

  const dateOnly = dateOnlyMatch[1];
  const isoString = `${dateOnly}T00:00:00`;
  const zonedDate = toZonedTime(isoString, timezone);

  return zonedDate;
};

/**
 * Parse timestamp string preserving time information in exchange timezone
 *
 * This function is for intraday data (1D hourly timestamps) where the time component
 * must be preserved. Unlike parseExchangeDate which anchors to midnight, this function
 * keeps the exact hour/minute/second from the timestamp.
 */
export const parseExchangeTimestamp = (
  timestampString: string | Date | null | undefined,
  exchange: string | undefined
): Date | null => {
  if (!timestampString) return null;

  if (timestampString instanceof Date) return timestampString;

  const timezone = getExchangeTimezone(exchange);
  const zonedDate = toZonedTime(timestampString, timezone);

  return zonedDate;
};

/**
 * Get the start of the week (Monday) for a date in the exchange timezone
 */
export const getWeekStartInTimezone = (
  date: Date | null | undefined,
  exchange: string | undefined
): Date | null => {
  if (!date) return null;

  const timezone = getExchangeTimezone(exchange);
  const utcDate = fromZonedTime(date, timezone);
  const weekStart = startOfWeek(utcDate, { weekStartsOn: 1 });

  return toZonedTime(weekStart, timezone);
};

/**
 * Get YYYY-MM month key for a date in the exchange timezone
 */
export const getMonthKeyInTimezone = (
  date: Date | null | undefined,
  exchange: string | undefined
): string | null => {
  if (!date) return null;

  const timezone = getExchangeTimezone(exchange);
  const utcDate = fromZonedTime(date, timezone);

  return format(utcDate, 'yyyy-MM');
};

/**
 * Get the first day of a month in the exchange timezone
 */
export const getMonthStartInTimezone = (
  year: number,
  month: number,
  exchange: string | undefined
): Date => {
  const timezone = getExchangeTimezone(exchange);
  const monthStr = String(month + 1).padStart(2, '0');
  const dateString = `${year}-${monthStr}-01T00:00:00`;

  return toZonedTime(dateString, timezone);
};

/**
 * Add days to a date while preserving the exchange timezone
 */
export const addDaysInTimezone = (
  date: Date | null | undefined,
  days: number,
  exchange: string | undefined
): Date | null => {
  if (!date) return null;

  const timezone = getExchangeTimezone(exchange);
  const utcDate = fromZonedTime(date, timezone);
  const newDate = addDays(utcDate, days);

  return toZonedTime(newDate, timezone);
};

/**
 * Format date and time for display
 */
export const formatDateTime = (
  dateString: string | null | undefined,
  includeTime: boolean = true
): string => {
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
 */
export const formatChartDate = (
  dateString: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', options);
};

/**
 * Alias for formatChartDate for consistency
 */
export const formatDate = (
  dateString: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string => {
  return formatChartDate(dateString, options);
};

/**
 * Format full timestamp for data retrieval
 */
export const formatFullTimestamp = (date: Date | string | null | undefined): string => {
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
 * Formats an ISO date string into a relative time format (e.g., "2 hours ago").
 * Falls back to a standard date format for dates older than 7 days.
 */
export const formatRelativeTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '';

  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();

  if (isNaN(date.getTime()) || diffMs < 0) {
    return !isNaN(date.getTime()) ? formatDate(date.toISOString()) : '';
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

  return formatDate(date.toISOString());
};
