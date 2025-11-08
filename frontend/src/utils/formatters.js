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

  // Handle zero-baseline portfolios by re-basing on first non-zero value
  if (start === 0 || start < 0.01) {
    // Find the first data point with a non-zero value
    let baselineIndex = -1;
    let baselineValue = 0;
    let baselineDate = null;

    for (let i = 0; i < data.length; i++) {
      const currentValue = data[i].close || data[i].portfolio_value || 0;
      if (currentValue > 0.01) {
        baselineIndex = i;
        baselineValue = currentValue;
        baselineDate = data[i].date || data[i].timestamp;
        break;
      }
    }

    // If no non-zero value found, return all zeros
    if (baselineIndex === -1) {
      console.warn('Portfolio has no non-zero values. Showing 0% for all data points.');
      return data.map(point => {
        const currentValue = point.close || point.portfolio_value || 0;
        const { price, ...pointWithoutPrice } = point;

        return {
          ...pointWithoutPrice,
          close: 0,
          originalValue: currentValue,
          isZeroBaseline: true,
          hasNoInvestments: true
        };
      });
    }

    // Re-base on first non-zero value
    console.log(`Re-basing percentage returns on first non-zero value: $${baselineValue.toFixed(2)} on ${baselineDate}`);

    return data.map((point, index) => {
      const currentValue = point.close || point.portfolio_value || 0;
      const { price, ...pointWithoutPrice } = point;

      // Points before baseline: show as null (will create gap in chart)
      if (index < baselineIndex) {
        return {
          ...pointWithoutPrice,
          close: null,
          originalValue: currentValue,
          isZeroBaseline: true,
          isPreBaseline: true,
          baselineValue,
          baselineDate
        };
      }

      // Points at or after baseline: calculate percentage return from baseline
      const percentReturn = ((currentValue - baselineValue) / baselineValue) * 100;

      return {
        ...pointWithoutPrice,
        close: percentReturn,
        originalValue: currentValue,
        isZeroBaseline: true,  // Keep flag for UI info banner
        baselineValue,
        baselineDate
      };
    });
  }

  // Normal calculation for non-zero starting values
  return data.map(point => {
    const currentValue = point.close || point.portfolio_value || 0;
    const percentReturn = ((currentValue - start) / start) * 100;

    // Remove 'price' field to prevent fallback contamination in chart helpers
    const { price, ...pointWithoutPrice } = point;

    return {
      ...pointWithoutPrice,
      close: percentReturn,  // Standardize to 'close' field
      originalValue: currentValue,  // Keep original value for reference
      isZeroBaseline: false
    };
  });
}

/**
 * Normalize portfolio data to percentage return with capital flow adjustment.
 *
 * This function properly accounts for deposits and withdrawals when calculating
 * percentage returns, preventing capital injections from appearing as investment gains.
 *
 * Algorithm:
 * 1. Start with initial portfolio value as baseline
 * 2. For each data point:
 *    - If capital flow occurred, adjust baseline by adding the flow amount
 *    - Calculate return = (current value - adjusted baseline) / adjusted baseline
 *
 * Example:
 * - Day 1: Portfolio = $100k (baseline = $100k)
 * - Day 2: Deposit $50k, Portfolio = $150k (baseline = $150k, return = 0%)
 * - Day 3: Portfolio = $157.5k (baseline = $150k, return = +5%)
 *
 * @param {Array} data - Array of data points with portfolio_value and capital_flow fields
 * @param {number|null} startValue - Optional starting value override
 * @returns {Array} Normalized data with percentage returns
 */
export function normalizeToPercentageReturnWithCapitalFlows(data, startValue = null) {
  if (!data || data.length === 0) {
    return [];
  }

  // Determine the starting value
  const firstPoint = data[0];
  let baseline = startValue !== null
    ? startValue
    : (firstPoint.close || firstPoint.portfolio_value || 0);

  // Handle zero-baseline portfolios
  if (baseline === 0 || baseline < 0.01) {
    console.warn('Portfolio starts at $0. Using first non-zero value as baseline.');

    // Find first non-zero value
    for (let i = 0; i < data.length; i++) {
      const currentValue = data[i].close || data[i].portfolio_value || 0;
      if (currentValue > 0.01) {
        baseline = currentValue;
        break;
      }
    }

    // If still zero, return zeros
    if (baseline === 0 || baseline < 0.01) {
      return data.map(point => ({
        ...point,
        close: 0,
        originalValue: point.close || point.portfolio_value || 0,
        isZeroBaseline: true,
        hasNoInvestments: true
      }));
    }
  }

  // Track running adjusted baseline
  let adjustedBaseline = baseline;
  let cumulativeCapitalFlow = 0;

  return data.map((point, index) => {
    const currentValue = point.close || point.portfolio_value || 0;
    const capitalFlow = point.capital_flow || 0;

    // If there's a capital flow at this point, adjust the baseline
    if (capitalFlow !== 0) {
      cumulativeCapitalFlow += capitalFlow;
      // Adjust baseline: new baseline = previous baseline + capital flow
      // This prevents the capital injection from appearing as a gain
      adjustedBaseline = baseline + cumulativeCapitalFlow;
    }

    // Calculate percentage return from adjusted baseline
    const percentReturn = adjustedBaseline > 0
      ? ((currentValue - adjustedBaseline) / adjustedBaseline) * 100
      : 0;

    // Remove 'price' field to prevent fallback contamination
    const { price, ...pointWithoutPrice } = point;

    return {
      ...pointWithoutPrice,
      close: percentReturn,
      originalValue: currentValue,
      adjustedBaseline,
      capitalFlow,
      cumulativeCapitalFlow,
      isCapitalAdjusted: true
    };
  });
}

/**
 * Normalize data using Time-Weighted Return (TWR) from backend.
 *
 * This is the most accurate method for portfolios with cash flows,
 * as it uses the Modified Dietz method to isolate investment performance
 * from capital contributions/withdrawals.
 *
 * @param {Array} data - Array of data points
 * @param {Object} twrData - TWR calculation result from backend
 * @returns {Array} Normalized data with TWR-based returns
 */
export function normalizeToTWR(data, twrData) {
  if (!data || data.length === 0 || !twrData) {
    return normalizeToPercentageReturn(data);
  }

  // If TWR calculation failed, fall back to regular normalization
  if (twrData.error || twrData.twr_return === null) {
    console.warn('TWR calculation unavailable, falling back to simple return');
    return normalizeToPercentageReturn(data);
  }

  // If no sub-periods, use simple approach with final TWR
  const subPeriods = twrData.sub_periods || [];

  if (subPeriods.length === 0) {
    // No sub-periods data, apply final TWR uniformly (scaled by position in timeline)
    const totalPoints = data.length;
    const finalTWR = twrData.twr_return || 0;

    return data.map((point, index) => {
      const { price, ...pointWithoutPrice } = point;
      // Linear interpolation from 0 to final TWR
      const progressRatio = totalPoints > 1 ? (index / (totalPoints - 1)) : 0;
      const interpolatedTWR = finalTWR * progressRatio;

      return {
        ...pointWithoutPrice,
        close: interpolatedTWR,
        originalValue: point.close || point.portfolio_value || 0,
        hasTWR: true,
        twrReturn: interpolatedTWR,
        isTWRCalculated: true
      };
    });
  }

  // Enhanced: Interpolate TWR across sub-periods for smooth visualization
  // Create a map of date -> cumulative TWR by chaining sub-period returns
  const twrByDate = new Map();
  let cumulativeTWR = 0;

  // Build cumulative TWR at each sub-period end date
  for (const period of subPeriods) {
    const periodReturn = period.return || 0;
    // Chain this period's return with previous cumulative
    // Formula: (1 + cumulative) * (1 + period) - 1
    cumulativeTWR = ((1 + cumulativeTWR / 100) * (1 + periodReturn / 100) - 1) * 100;
    twrByDate.set(period.end_date, cumulativeTWR);

    // Also set the start date if it's the first period
    if (twrByDate.size === 1 && period.start_date) {
      twrByDate.set(period.start_date, 0); // Start at 0% return
    }
  }

  // Convert to sorted array for interpolation
  const twrPoints = Array.from(twrByDate.entries())
    .sort((a, b) => new Date(a[0]) - new Date(b[0]));

  // Map each data point to its interpolated TWR value
  return data.map(point => {
    const { price, ...pointWithoutPrice } = point;
    const pointDate = new Date(point.date);

    let interpolatedTWR = 0;

    // Find where this date falls in the TWR points
    for (let i = 0; i < twrPoints.length; i++) {
      const [twrDate, twrValue] = twrPoints[i];
      const twrDateTime = new Date(twrDate);

      if (pointDate <= twrDateTime) {
        if (i === 0) {
          // Before first TWR point, use 0
          interpolatedTWR = 0;
        } else {
          // Interpolate between previous and current TWR points
          const [prevDate, prevTWR] = twrPoints[i - 1];
          const prevDateTime = new Date(prevDate);

          // Linear interpolation
          const totalDays = (twrDateTime - prevDateTime) / (1000 * 60 * 60 * 24);
          const daysFromPrev = (pointDate - prevDateTime) / (1000 * 60 * 60 * 24);

          if (totalDays > 0) {
            const ratio = daysFromPrev / totalDays;
            interpolatedTWR = prevTWR + (twrValue - prevTWR) * ratio;
          } else {
            interpolatedTWR = twrValue;
          }
        }
        break;
      } else if (i === twrPoints.length - 1) {
        // After last TWR point, use final value
        interpolatedTWR = twrValue;
      }
    }

    return {
      ...pointWithoutPrice,
      close: interpolatedTWR,
      originalValue: point.close || point.portfolio_value || 0,
      hasTWR: true,
      twrReturn: interpolatedTWR,
      isTWRCalculated: true,
      capital_flow: point.capital_flow || 0
    };
  });
}

/**
 * Normalize data using hybrid denominator calculation.
 *
 * This function implements the documented hybrid logic:
 * - Holdings purchased BEFORE the period start: Use market value at period start as denominator
 * - Holdings purchased WITHIN the period: Use cost basis as denominator
 *
 * This provides the most accurate representation of returns, showing:
 * - Real gains for recent purchases (YOUR money at risk)
 * - Fair performance for older holdings (comparable to benchmarks)
 *
 * @param {Array} data - Array of data points with lot_breakdown field
 * @param {Date|String} periodStartDate - Start date of the period
 * @returns {Array} Normalized data with hybrid percentage returns
 */
export function normalizeToHybridReturn(data, periodStartDate, twrData = null) {
  if (!data || data.length === 0) {
    return [];
  }

  // Initialize baseline and capital flow tracking for fallback calculation
  const firstPoint = data[0];
  let baseline = firstPoint.close || firstPoint.portfolio_value || 0;
  let adjustedBaseline = baseline;
  let cumulativeCapitalFlow = 0;

  return data.map((point, index) => {
    const lotBreakdown = point.lot_breakdown || [];

    if (lotBreakdown.length === 0) {
      // No lot data, fall back to capital-flow-adjusted percentage return
      const currentValue = point.close || point.portfolio_value || 0;
      const capitalFlow = point.capital_flow || 0;

      // Update cumulative capital flow and adjusted baseline
      if (capitalFlow !== 0) {
        cumulativeCapitalFlow += capitalFlow;
        adjustedBaseline = baseline + cumulativeCapitalFlow;
      }

      // Calculate percentage return from adjusted baseline
      const percentReturn = adjustedBaseline > 0
        ? ((currentValue - adjustedBaseline) / adjustedBaseline) * 100
        : 0;

      return {
        ...point,
        close: percentReturn,
        originalValue: currentValue,
        noLotData: true,
        usedFallback: true,
        adjustedBaseline,
        cumulativeCapitalFlow
      };
    }

    // Calculate hybrid denominator and current value from lots
    let hybridDenominator = 0;
    let currentMarketValue = 0;
    let prePeriodValue = 0;
    let inPeriodCost = 0;
    let prePeriodLots = 0;
    let inPeriodLots = 0;

    for (const lot of lotBreakdown) {
      currentMarketValue += lot.market_value || 0;
      hybridDenominator += lot.start_value || 0;  // Pre-period uses start market, in-period uses cost basis

      if (lot.is_pre_period) {
        prePeriodValue += lot.start_value || 0;
        prePeriodLots++;
      } else {
        inPeriodCost += lot.start_value || 0;  // For in-period, start_value = cost basis
        inPeriodLots++;
      }
    }

    // Calculate percentage return using hybrid denominator
    const percentReturn = hybridDenominator > 0
      ? ((currentMarketValue - hybridDenominator) / hybridDenominator) * 100
      : 0;

    // Remove 'price' field to prevent contamination
    const { price, ...pointWithoutPrice } = point;

    return {
      ...pointWithoutPrice,
      close: percentReturn,
      originalValue: currentMarketValue,
      hybridDenominator,
      prePeriodValue,
      inPeriodCost,
      prePeriodLots,
      inPeriodLots,
      isHybridCalculated: true
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
  normalizeToPercentageReturnWithCapitalFlows,
  normalizeToTWR,
  normalizeToHybridReturn,
};
