/**
 * Test Suite for Formatter Functions
 *
 * Comprehensive tests for all formatting utilities including:
 * - Currency formatting (standard and compact)
 * - Percentage formatting
 * - Number formatting
 * - Date formatting (standard and relative)
 * - Sentiment/change color utilities
 * - Portfolio normalization functions
 */

import {
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
  normalizeToHybridReturn,
  normalizeToTWR,
  normalizeToPercentageReturnWithCapitalFlows,
} from './formatters';

// =============================================================================
// CURRENCY FORMATTING TESTS
// =============================================================================

describe('formatCurrency', () => {
  it('should format positive numbers correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('should format negative numbers correctly', () => {
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    expect(formatCurrency(-100)).toBe('-$100.00');
  });

  it('should handle null/undefined/NaN values', () => {
    expect(formatCurrency(null)).toBe('$0.00');
    expect(formatCurrency(undefined)).toBe('$0.00');
    expect(formatCurrency(NaN)).toBe('$0.00');
  });

  it('should support custom decimal places', () => {
    expect(formatCurrency(1234.5678, { decimals: 0 })).toBe('$1,235');
    expect(formatCurrency(1234.5678, { decimals: 3 })).toBe('$1,234.568');
    expect(formatCurrency(1234.5678, { decimals: 1 })).toBe('$1,234.6');
  });

  it('should support compact mode', () => {
    expect(formatCurrency(1234567, { compact: true })).toBe('$1.2M');
    expect(formatCurrency(1234, { compact: true })).toBe('$1.2K');
    expect(formatCurrency(123456789, { compact: true })).toBe('$123.5M');
  });
});

describe('formatCompactCurrency', () => {
  it('should format billions correctly', () => {
    expect(formatCompactCurrency(1000000000)).toBe('$1.0B');
    expect(formatCompactCurrency(2500000000)).toBe('$2.5B');
    expect(formatCompactCurrency(1234567890)).toBe('$1.2B');
  });

  it('should format millions correctly', () => {
    expect(formatCompactCurrency(1000000)).toBe('$1.0M');
    expect(formatCompactCurrency(2500000)).toBe('$2.5M');
    expect(formatCompactCurrency(1234567)).toBe('$1.2M');
  });

  it('should format thousands correctly', () => {
    expect(formatCompactCurrency(1000)).toBe('$1.0K');
    expect(formatCompactCurrency(2500)).toBe('$2.5K');
    expect(formatCompactCurrency(12345)).toBe('$12.3K');
  });

  it('should handle small values without suffix', () => {
    expect(formatCompactCurrency(100)).toBe('$100.0');
    expect(formatCompactCurrency(50)).toBe('$50.0');
    expect(formatCompactCurrency(999)).toBe('$999.0');
  });

  it('should handle negative values', () => {
    expect(formatCompactCurrency(-1000000)).toBe('-$1.0M');
    expect(formatCompactCurrency(-2500)).toBe('-$2.5K');
  });

  it('should support custom decimal places', () => {
    expect(formatCompactCurrency(1234567, 2)).toBe('$1.23M');
    expect(formatCompactCurrency(1234567, 0)).toBe('$1M');
  });

  it('should handle null/undefined/NaN values', () => {
    expect(formatCompactCurrency(null)).toBe('$0');
    expect(formatCompactCurrency(undefined)).toBe('$0');
    expect(formatCompactCurrency(NaN)).toBe('$0');
  });
});

// =============================================================================
// PERCENTAGE FORMATTING TESTS
// =============================================================================

describe('formatPercentage', () => {
  it('should format positive percentages correctly', () => {
    expect(formatPercentage(12.34)).toBe('12.34%');
    expect(formatPercentage(100)).toBe('100.00%');
    expect(formatPercentage(0.5)).toBe('0.50%');
  });

  it('should format negative percentages correctly', () => {
    expect(formatPercentage(-12.34)).toBe('-12.34%');
    expect(formatPercentage(-0.5)).toBe('-0.50%');
  });

  it('should format zero correctly', () => {
    expect(formatPercentage(0)).toBe('0.00%');
  });

  it('should handle null/undefined/NaN values', () => {
    expect(formatPercentage(null)).toBe('0%');
    expect(formatPercentage(undefined)).toBe('0%');
    expect(formatPercentage(NaN)).toBe('0%');
  });

  it('should support custom decimal places', () => {
    expect(formatPercentage(12.3456, { decimals: 0 })).toBe('12%');
    expect(formatPercentage(12.3456, { decimals: 1 })).toBe('12.3%');
    expect(formatPercentage(12.3456, { decimals: 3 })).toBe('12.346%');
  });

  it('should support showing positive sign', () => {
    expect(formatPercentage(12.34, { showSign: true })).toBe('+12.34%');
    expect(formatPercentage(-12.34, { showSign: true })).toBe('-12.34%');
    expect(formatPercentage(0, { showSign: true })).toBe('0.00%');
  });

  it('should support hiding the percent symbol', () => {
    expect(formatPercentage(12.34, { showSymbol: false })).toBe('12.34');
    expect(formatPercentage(12.34, { showSign: true, showSymbol: false })).toBe('+12.34');
  });
});

// =============================================================================
// NUMBER FORMATTING TESTS
// =============================================================================

describe('formatNumber', () => {
  it('should format numbers with thousand separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(100)).toBe('100');
  });

  it('should support decimal places', () => {
    expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
    expect(formatNumber(1234.5678, 0)).toBe('1,235');
    expect(formatNumber(1234, 2)).toBe('1,234.00');
  });

  it('should handle null/undefined/NaN values', () => {
    expect(formatNumber(null)).toBe('0');
    expect(formatNumber(undefined)).toBe('0');
    expect(formatNumber(NaN)).toBe('0');
  });

  it('should handle negative numbers', () => {
    expect(formatNumber(-1234567)).toBe('-1,234,567');
    expect(formatNumber(-1234.56, 2)).toBe('-1,234.56');
  });
});

describe('formatCompactNumber', () => {
  it('should format billions correctly', () => {
    expect(formatCompactNumber(1000000000)).toBe('1.0B');
    expect(formatCompactNumber(2500000000)).toBe('2.5B');
  });

  it('should format millions correctly', () => {
    expect(formatCompactNumber(1000000)).toBe('1.0M');
    expect(formatCompactNumber(2500000)).toBe('2.5M');
  });

  it('should format thousands correctly', () => {
    expect(formatCompactNumber(1000)).toBe('1.0K');
    expect(formatCompactNumber(2500)).toBe('2.5K');
  });

  it('should handle small values', () => {
    expect(formatCompactNumber(100)).toBe('100.0');
    expect(formatCompactNumber(999)).toBe('999.0');
  });

  it('should handle null/undefined/NaN values', () => {
    expect(formatCompactNumber(null)).toBe('0');
    expect(formatCompactNumber(undefined)).toBe('0');
    expect(formatCompactNumber(NaN)).toBe('0');
  });
});

// =============================================================================
// DATE FORMATTING TESTS
// =============================================================================

describe('formatDate', () => {
  it('should format dates in short format by default', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date);
    // The exact format may vary by locale, but should contain Jan 15, 2024
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });

  it('should format dates in long format', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date, { format: 'long' });
    expect(result).toMatch(/January/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });

  it('should handle string dates', () => {
    const result = formatDate('2024-01-15');
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });

  it('should handle timestamps', () => {
    const timestamp = new Date('2024-01-15').getTime();
    const result = formatDate(timestamp);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });

  it('should handle null/undefined', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('should handle invalid dates', () => {
    expect(formatDate('invalid-date')).toBe('Invalid date');
  });

  it('should include time when requested', () => {
    const date = new Date('2024-01-15T14:30:00');
    const result = formatDate(date, { includeTime: true });
    // Should contain time portion
    expect(result.length).toBeGreaterThan(15);
  });
});

describe('formatRelativeDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return "just now" for recent times', () => {
    const date = new Date('2024-01-15T11:59:30');
    expect(formatRelativeDate(date)).toBe('just now');
  });

  it('should format minutes ago', () => {
    const date = new Date('2024-01-15T11:55:00');
    expect(formatRelativeDate(date)).toBe('5 minutes ago');
  });

  it('should format hours ago', () => {
    const date = new Date('2024-01-15T09:00:00');
    expect(formatRelativeDate(date)).toBe('3 hours ago');
  });

  it('should format days ago', () => {
    const date = new Date('2024-01-13T12:00:00');
    expect(formatRelativeDate(date)).toBe('2 days ago');
  });

  it('should format weeks ago', () => {
    const date = new Date('2024-01-01T12:00:00');
    expect(formatRelativeDate(date)).toBe('2 weeks ago');
  });

  it('should handle singular vs plural', () => {
    const oneMinute = new Date('2024-01-15T11:59:00');
    expect(formatRelativeDate(oneMinute)).toBe('1 minute ago');

    const oneHour = new Date('2024-01-15T11:00:00');
    expect(formatRelativeDate(oneHour)).toBe('1 hour ago');
  });
});

// =============================================================================
// COLOR UTILITY TESTS
// =============================================================================

describe('getSentimentColor', () => {
  it('should return green for high positive sentiment', () => {
    const result = getSentimentColor(0.8);
    expect(result).toContain('green');
  });

  it('should return green for moderate positive sentiment', () => {
    const result = getSentimentColor(0.4);
    expect(result).toContain('green');
  });

  it('should return gray for neutral sentiment', () => {
    const result = getSentimentColor(0);
    expect(result).toContain('gray');
  });

  it('should return red for moderate negative sentiment', () => {
    const result = getSentimentColor(-0.4);
    expect(result).toContain('red');
  });

  it('should return red for high negative sentiment', () => {
    const result = getSentimentColor(-0.8);
    expect(result).toContain('red');
  });

  it('should handle null/undefined/NaN', () => {
    expect(getSentimentColor(null)).toContain('gray');
    expect(getSentimentColor(undefined)).toContain('gray');
    expect(getSentimentColor(NaN)).toContain('gray');
  });

  it('should return RGB values when tailwind=false', () => {
    const result = getSentimentColor(0.8, { tailwind: false });
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('bg');
  });
});

describe('getChangeColor', () => {
  it('should return green for positive values', () => {
    expect(getChangeColor(10)).toBe('text-green-600');
    expect(getChangeColor(0.1)).toBe('text-green-600');
  });

  it('should return red for negative values', () => {
    expect(getChangeColor(-10)).toBe('text-red-600');
    expect(getChangeColor(-0.1)).toBe('text-red-600');
  });

  it('should return gray for zero', () => {
    expect(getChangeColor(0)).toBe('text-gray-500');
  });

  it('should handle null/undefined/NaN', () => {
    expect(getChangeColor(null)).toBe('text-gray-500');
    expect(getChangeColor(undefined)).toBe('text-gray-500');
    expect(getChangeColor(NaN)).toBe('text-gray-500');
  });

  it('should support inverse colors', () => {
    expect(getChangeColor(10, { inverse: true })).toBe('text-red-600');
    expect(getChangeColor(-10, { inverse: true })).toBe('text-green-600');
  });
});

// =============================================================================
// TEXT UTILITY TESTS
// =============================================================================

describe('truncateText', () => {
  it('should truncate long text', () => {
    expect(truncateText('Hello World Test', 10)).toBe('Hello W...');
    expect(truncateText('This is a very long string', 15)).toBe('This is a ve...');
  });

  it('should not truncate short text', () => {
    expect(truncateText('Hello', 10)).toBe('Hello');
    expect(truncateText('Test', 10)).toBe('Test');
  });

  it('should handle exact length', () => {
    expect(truncateText('Hello', 5)).toBe('Hello');
  });

  it('should handle null/undefined', () => {
    expect(truncateText(null, 10)).toBe('');
    expect(truncateText(undefined, 10)).toBe('');
  });

  it('should support custom suffix', () => {
    expect(truncateText('Hello World Test', 12, '…')).toBe('Hello World…');
  });
});

describe('parseNumericString', () => {
  it('should parse numeric strings with commas', () => {
    expect(parseNumericString('1,234.56')).toBe(1234.56);
    expect(parseNumericString('1,000,000')).toBe(1000000);
  });

  it('should handle numbers directly', () => {
    expect(parseNumericString(1234.56)).toBe(1234.56);
    expect(parseNumericString(1000)).toBe(1000);
  });

  it('should handle null/undefined/empty', () => {
    expect(parseNumericString(null)).toBe(0);
    expect(parseNumericString(undefined)).toBe(0);
    expect(parseNumericString('')).toBe(0);
  });

  it('should handle invalid strings', () => {
    expect(parseNumericString('abc')).toBe(0);
    expect(parseNumericString('not a number')).toBe(0);
  });

  it('should handle mixed strings', () => {
    expect(parseNumericString('$1,234.56')).toBe(0); // Has non-numeric chars
    expect(parseNumericString('1234.56 USD')).toBe(1234.56); // Parses until non-numeric
  });
});

// =============================================================================
// PORTFOLIO NORMALIZATION TESTS
// =============================================================================

describe('normalizeToPercentageReturn', () => {
  it('should normalize data to percentage returns correctly', () => {
    const data = [
      { date: '2024-01-01', close: 100000 },
      { date: '2024-01-02', close: 105000 },
      { date: '2024-01-03', close: 103000 },
    ];

    const result = normalizeToPercentageReturn(data);

    expect(result[0].close).toBe(0); // 0% change from start
    expect(result[1].close).toBe(5); // +5% from start
    expect(result[2].close).toBe(3); // +3% from start
    expect(result[0].originalValue).toBe(100000);
    expect(result[1].originalValue).toBe(105000);
  });

  it('should keep percentage returns at 0% for zero-start portfolios', () => {
    const data = [
      { date: '2024-01-01', close: 0 },
      { date: '2024-01-02', close: 1000 },
      { date: '2024-01-03', close: 2000 },
    ];

    const result = normalizeToPercentageReturn(data);

    // Pre-baseline point (day 1) should have close: null
    expect(result[0].close).toBe(null);
    expect(result[0].isPreBaseline).toBe(true);
    expect(result[0].originalValue).toBe(0);
    expect(result[0].isZeroBaseline).toBe(true);

    // At baseline (day 2): 0%
    expect(result[1].close).toBe(0);
    expect(result[1].originalValue).toBe(1000);
    expect(result[1].isZeroBaseline).toBe(true);
    expect(result[1].baselineValue).toBe(1000);

    // After baseline (day 3): +100%
    expect(result[2].close).toBe(100);
    expect(result[2].originalValue).toBe(2000);
    expect(result[2].isZeroBaseline).toBe(true);
  });

  it('should handle zero percent returns in middle of series', () => {
    const data = [
      { date: '2024-01-01', close: 100000 },
      { date: '2024-01-02', close: 100000 }, // No change = 0%
      { date: '2024-01-03', close: 105000 },
    ];

    const result = normalizeToPercentageReturn(data);

    expect(result[0].close).toBe(0);
    expect(result[1].close).toBe(0); // Should be exactly 0, not fallback
    expect(result[2].close).toBe(5);
    // isZeroBaseline should be false for normal portfolios
    expect(result[0].isZeroBaseline).toBe(false);
    expect(result[1].isZeroBaseline).toBe(false);
    expect(result[2].isZeroBaseline).toBe(false);
  });

  it('should remove price field to prevent fallback contamination', () => {
    const data = [
      { date: '2024-01-01', close: 100000, price: 125000 },
      { date: '2024-01-02', close: 105000, price: 131250 },
    ];

    const result = normalizeToPercentageReturn(data);

    expect((result[0] as any).price).toBeUndefined();
    expect((result[1] as any).price).toBeUndefined();
    expect(result[0].close).toBe(0);
    expect(result[1].close).toBe(5);
  });

  it('should handle negative returns correctly', () => {
    const data = [
      { date: '2024-01-01', close: 100000 },
      { date: '2024-01-02', close: 95000 },
      { date: '2024-01-03', close: 90000 },
    ];

    const result = normalizeToPercentageReturn(data);

    expect(result[0].close).toBe(0);
    expect(result[1].close).toBe(-5);
    expect(result[2].close).toBe(-10);
  });

  it('should use portfolio_value field when close is not available', () => {
    const data = [
      { date: '2024-01-01', portfolio_value: 100000 },
      { date: '2024-01-02', portfolio_value: 105000 },
    ];

    const result = normalizeToPercentageReturn(data);

    expect(result[0].close).toBe(0);
    expect(result[1].close).toBe(5);
    expect(result[0].originalValue).toBe(100000);
  });

  it('should accept custom startValue parameter', () => {
    const data = [
      { date: '2024-01-01', close: 105000 },
      { date: '2024-01-02', close: 110000 },
    ];

    // Normalize from 100000 instead of first data point (105000)
    const result = normalizeToPercentageReturn(data, 100000);

    expect(result[0].close).toBe(5); // (105000 - 100000) / 100000 * 100
    expect(result[1].close).toBe(10); // (110000 - 100000) / 100000 * 100
  });

  it('should rebase from first non-zero value when custom startValue is 0', () => {
    const data = [
      { date: '2024-01-01', close: 1000 },
      { date: '2024-01-02', close: 2000 },
    ];

    const result = normalizeToPercentageReturn(data, 0);

    // Should rebase on first non-zero value ($1000)
    expect(result[0].close).toBe(0);
    expect(result[0].isZeroBaseline).toBe(true);
    expect(result[0].baselineValue).toBe(1000);
    expect(result[0].originalValue).toBe(1000);

    // Day 2: +100%
    expect(result[1].close).toBe(100);
    expect(result[1].isZeroBaseline).toBe(true);
    expect(result[1].originalValue).toBe(2000);
  });

  it('should handle empty data', () => {
    expect(normalizeToPercentageReturn([])).toEqual([]);
    expect(normalizeToPercentageReturn(null as any)).toEqual([]);
    expect(normalizeToPercentageReturn(undefined as any)).toEqual([]);
  });

  it('should preserve all other fields except price', () => {
    const data = [
      {
        date: '2024-01-01',
        close: 100000,
        price: 125000,
        volume: 1000,
        time: '09:30',
        customField: 'test',
      },
    ];

    const result = normalizeToPercentageReturn(data);

    expect(result[0].date).toBe('2024-01-01');
    expect((result[0] as any).volume).toBe(1000);
    expect((result[0] as any).time).toBe('09:30');
    expect((result[0] as any).customField).toBe('test');
    expect(result[0].close).toBe(0);
    expect(result[0].originalValue).toBe(100000);
    expect((result[0] as any).price).toBeUndefined();
  });

  it('should handle very small non-zero starting values as zero-baseline', () => {
    const data = [
      { date: '2024-01-01', close: 0.001 },
      { date: '2024-01-02', close: 0.002 },
    ];

    const result = normalizeToPercentageReturn(data);

    // Values < $0.01 are treated as zero-baseline
    expect(result[0].close).toBe(0);
    expect(result[1].close).toBe(0);
    expect(result[0].isZeroBaseline).toBe(true);
    expect(result[1].isZeroBaseline).toBe(true);
    expect(result[0].originalValue).toBe(0.001);
    expect(result[1].originalValue).toBe(0.002);
  });

  it('should emit close: null for pre-baseline points in zero-baseline portfolios', () => {
    const data = [
      { date: '2024-01-01', close: 0 },
      { date: '2024-01-02', close: 0 },
      { date: '2024-01-03', close: 0 },
      { date: '2024-01-04', close: 10000 }, // First investment
      { date: '2024-01-05', close: 10500 }, // +5%
    ];

    const result = normalizeToPercentageReturn(data);

    // Pre-baseline points (before first investment) should have close: null
    expect(result[0].close).toBe(null);
    expect(result[0].isPreBaseline).toBe(true);
    expect(result[0].isZeroBaseline).toBe(true);

    expect(result[1].close).toBe(null);
    expect(result[1].isPreBaseline).toBe(true);

    expect(result[2].close).toBe(null);
    expect(result[2].isPreBaseline).toBe(true);

    // At baseline: 0%
    expect(result[3].close).toBe(0);
    expect(result[3].isPreBaseline).toBeUndefined();
    expect(result[3].isZeroBaseline).toBe(true);
    expect(result[3].baselineValue).toBe(10000);

    // After baseline: +5%
    expect(result[4].close).toBe(5);
    expect(result[4].isPreBaseline).toBeUndefined();
    expect(result[4].isZeroBaseline).toBe(true);
  });
});

describe('normalizeToHybridReturn', () => {
  it('should calculate hybrid return correctly with full lot coverage', () => {
    const data = [
      {
        date: '2024-01-01',
        close: 17500,
        lot_breakdown: [
          {
            market_value: 17500,
            start_value: 15000, // Pre-period lot: started at $15k
            is_pre_period: true,
          },
        ],
      },
      {
        date: '2024-01-02',
        close: 18000,
        lot_breakdown: [
          {
            market_value: 18000,
            start_value: 15000,
            is_pre_period: true,
          },
        ],
      },
    ];

    const result = normalizeToHybridReturn(data, '2024-01-01');

    // Day 1: (17500 - 15000) / 15000 * 100 = 16.67%
    expect(result[0].close).toBeCloseTo(16.67, 1);
    expect(result[0].isHybridCalculated).toBe(true);
    expect(result[0].noLotData).toBeUndefined();

    // Day 2: (18000 - 15000) / 15000 * 100 = 20%
    expect(result[1].close).toBe(20);
    expect(result[1].isHybridCalculated).toBe(true);
  });

  it('should return close: 0 for points without lot data (partial coverage)', () => {
    const data = [
      {
        date: '2024-01-01',
        close: 10000,
        lot_breakdown: [], // No lot data
      },
      {
        date: '2024-01-02',
        close: 10500,
        lot_breakdown: [], // No lot data
      },
      {
        date: '2024-01-03',
        close: 11000,
        lot_breakdown: [
          {
            market_value: 11000,
            start_value: 10000,
            is_pre_period: false,
          },
        ],
      },
    ];

    const result = normalizeToHybridReturn(data, '2024-01-01');

    // Points without lot data should have close: 0
    expect(result[0].close).toBe(0);
    expect(result[0].noLotData).toBe(true);
    expect(result[0].originalValue).toBe(10000);

    expect(result[1].close).toBe(5);
    expect(result[1].noLotData).toBe(true);
    expect(result[1].originalValue).toBe(10500);

    // Point with lot data should calculate correctly
    // (11000 - 10000) / 10000 * 100 = 10%
    expect(result[2].close).toBe(10);
    expect(result[2].isHybridCalculated).toBe(true);
    expect(result[2].noLotData).toBeUndefined();
  });

  it('should handle mixed pre-period and in-period lots', () => {
    const data = [
      {
        date: '2024-01-15',
        close: 27000,
        lot_breakdown: [
          {
            market_value: 17500,
            start_value: 16000, // Pre-period: market value at period start
            is_pre_period: true,
          },
          {
            market_value: 9500,
            start_value: 8000, // In-period: cost basis
            is_pre_period: false,
          },
        ],
      },
    ];

    const result = normalizeToHybridReturn(data, '2024-01-01');

    // Hybrid denominator: 16000 (pre-period start) + 8000 (in-period cost) = 24000
    // Current value: 17500 + 9500 = 27000
    // Return: (27000 - 24000) / 24000 * 100 = 12.5%
    expect(result[0].close).toBe(12.5);
    expect(result[0].hybridDenominator).toBe(24000);
    expect(result[0].prePeriodValue).toBe(16000);
    expect(result[0].inPeriodCost).toBe(8000);
    expect(result[0].prePeriodLots).toBe(1);
    expect(result[0].inPeriodLots).toBe(1);
  });

  it('should handle empty data', () => {
    expect(normalizeToHybridReturn([], '')).toEqual([]);
    expect(normalizeToHybridReturn(null as any, '')).toEqual([]);
    expect(normalizeToHybridReturn(undefined as any, '')).toEqual([]);
  });

  it('should handle zero denominator gracefully', () => {
    const data = [
      {
        date: '2024-01-01',
        close: 0,
        lot_breakdown: [
          {
            market_value: 0,
            start_value: 0,
            is_pre_period: true,
          },
        ],
      },
    ];

    const result = normalizeToHybridReturn(data, '2024-01-01');

    // Should return 0% when denominator is 0
    expect(result[0].close).toBe(0);
    expect(result[0].hybridDenominator).toBe(0);
  });

  it('should remove price field to prevent contamination', () => {
    const data = [
      {
        date: '2024-01-01',
        close: 17500,
        price: 18000, // Should be removed
        lot_breakdown: [
          {
            market_value: 17500,
            start_value: 15000,
            is_pre_period: true,
          },
        ],
      },
    ];

    const result = normalizeToHybridReturn(data, '2024-01-01');

    expect((result[0] as any).price).toBeUndefined();
    expect(result[0].close).toBeCloseTo(16.67, 1);
  });
});

describe('normalizeToTWR', () => {
  it('should return regular normalization when no TWR data', () => {
    const data = [
      { date: '2024-01-01', close: 100000 },
      { date: '2024-01-02', close: 105000 },
    ];

    const result = normalizeToTWR(data, null);

    expect(result[0].close).toBe(0);
    expect(result[1].close).toBe(5);
  });

  it('should return regular normalization when TWR has error', () => {
    const data = [
      { date: '2024-01-01', close: 100000 },
      { date: '2024-01-02', close: 105000 },
    ];

    const twrData = { error: 'Insufficient data', twr_return: null };

    const result = normalizeToTWR(data, twrData);

    expect(result[0].close).toBe(0);
    expect(result[1].close).toBe(5);
  });

  it('should interpolate TWR across data points when no sub-periods', () => {
    const data = [
      { date: '2024-01-01', close: 100000 },
      { date: '2024-01-02', close: 105000 },
      { date: '2024-01-03', close: 110000 },
    ];

    const twrData = { twr_return: 10, sub_periods: [] };

    const result = normalizeToTWR(data, twrData);

    expect(result[0].close).toBe(0); // Start at 0
    expect(result[1].close).toBe(5); // Midpoint
    expect(result[2].close).toBe(10); // Final TWR
    expect(result[0].isTWRCalculated).toBe(true);
    expect(result[0].hasTWR).toBe(true);
  });

  it('should handle empty data', () => {
    const result = normalizeToTWR([], { twr_return: 10 });
    expect(result).toEqual([]);
  });
});

describe('normalizeToPercentageReturnWithCapitalFlows', () => {
  it('should handle data without capital flows', () => {
    const data = [
      { date: '2024-01-01', close: 100000 },
      { date: '2024-01-02', close: 105000 },
    ];

    const result = normalizeToPercentageReturnWithCapitalFlows(data);

    expect(result[0].close).toBe(0);
    expect(result[1].close).toBe(5);
    expect(result[0].isCapitalAdjusted).toBe(true);
  });

  it('should adjust baseline when capital flow occurs', () => {
    const data = [
      { date: '2024-01-01', close: 100000 },
      { date: '2024-01-02', close: 105000 },
      { date: '2024-01-03', close: 125000, capital_flow: 20000 }, // $20k deposit
      { date: '2024-01-04', close: 130000 },
    ];

    const result = normalizeToPercentageReturnWithCapitalFlows(data);

    // Day 1: 0% (baseline)
    expect(result[0].close).toBe(0);

    // Day 2: +5% (normal gain)
    expect(result[1].close).toBe(5);

    // Day 3: After $20k deposit, baseline adjusts
    // New baseline = previous value ($105k) + capital flow ($20k) = $125k
    // Return = ($125k - $125k) / $125k = 0%
    expect(result[2].close).toBe(0);
    expect(result[2].adjustedBaseline).toBe(125000);

    // Day 4: ($130k - $125k) / $125k = 4%
    expect(result[3].close).toBe(4);
  });

  it('should handle empty data', () => {
    expect(normalizeToPercentageReturnWithCapitalFlows([])).toEqual([]);
    expect(normalizeToPercentageReturnWithCapitalFlows(null as any)).toEqual([]);
  });

  it('should handle zero-baseline portfolios', () => {
    const data = [
      { date: '2024-01-01', close: 0 },
      { date: '2024-01-02', close: 0 },
      { date: '2024-01-03', close: 1000 },
    ];

    const result = normalizeToPercentageReturnWithCapitalFlows(data);

    // Should find first non-zero value and use as baseline
    expect(result[2].isCapitalAdjusted).toBe(true);
  });
});
