/**
 * Test Suite for Chart Helper Functions
 *
 * Tests the chart helper utilities including:
 * - generateChartData: Converts backend price data to chart coordinates
 * - getPriceRange: Calculates min/max with padding for chart scaling
 * - calculatePriceChange: Calculates price change metrics with safety guards
 *
 * Key behaviors tested:
 * - Zero percent returns are preserved (not treated as falsy)
 * - Missing values result in null (to render chart gaps)
 * - Division by zero protection in percentage calculations
 * - NaN/Infinity prevention
 */

import {
  generateChartData,
  getPriceRange,
  calculatePriceChange,
  filterPriceDataByTimeframe,
  formatXAxisLabel,
  getMarketHours,
  getMarketOpenClose,
  PriceDataPoint,
  ChartDataPoint,
} from './chartHelpers';

// Test data uses minimal properties - cast to expected types for type checking
// The actual implementation handles partial data gracefully
const asPriceData = (data: unknown[]): PriceDataPoint[] => data as PriceDataPoint[];
const asChartData = (data: unknown[]): ChartDataPoint[] => data as ChartDataPoint[];

describe('chartHelpers', () => {
  describe('generateChartData', () => {
    it('should handle zero percent returns correctly (not fallback to price)', () => {
      const priceData = [
        { date: '2024-01-01', close: 100, price: 125000 },
        { date: '2024-01-02', close: 0, price: 125000 }, // 0% return, should stay 0
        { date: '2024-01-03', close: 5, price: 131250 },
      ];

      const chartData = generateChartData(asPriceData(priceData));

      expect(chartData[0].y).toBe(100);
      expect(chartData[1].y).toBe(0); // Should be 0, not 125000
      expect(chartData[2].y).toBe(5);
    });

    it('should fallback to price when close is missing', () => {
      const priceData = [
        { date: '2024-01-01', price: 100 },
        { date: '2024-01-02', close: undefined, price: 105 },
      ];

      const chartData = generateChartData(asPriceData(priceData));

      expect(chartData[0].y).toBe(100);
      expect(chartData[1].y).toBe(105);
    });

    it('should return null when both close and price are missing (chart gap)', () => {
      const priceData = [{ date: '2024-01-01', close: undefined, price: undefined }];

      const chartData = generateChartData(asPriceData(priceData));

      // Implementation returns null for missing values to render gaps in charts
      expect(chartData[0].y).toBe(null);
    });

    it('should handle negative returns correctly', () => {
      const priceData = [
        { date: '2024-01-01', close: 100 },
        { date: '2024-01-02', close: -5 }, // -5% return
        { date: '2024-01-03', close: -10 },
      ];

      const chartData = generateChartData(asPriceData(priceData));

      expect(chartData[0].y).toBe(100);
      expect(chartData[1].y).toBe(-5);
      expect(chartData[2].y).toBe(-10);
    });

    it('should include all required fields', () => {
      const priceData = [{ date: '2024-01-01', close: 100, time: '09:30', volume: 1000 }];

      const chartData = generateChartData(asPriceData(priceData));

      expect(chartData[0]).toEqual({
        x: 0,
        y: 100,
        date: '2024-01-01',
        time: '09:30',
        volume: 1000,
        index: 0,
      });
    });

    it('should handle empty data', () => {
      expect(generateChartData([])).toEqual([]);
      expect(generateChartData(null as any)).toEqual([]);
      expect(generateChartData(undefined as any)).toEqual([]);
    });

    it('should handle string numbers correctly', () => {
      const priceData = [{ date: '2024-01-01', close: '100.5', price: '200' }];

      const chartData = generateChartData(asPriceData(priceData));

      expect(chartData[0].y).toBe(100.5);
    });

    it('should handle null close but valid price', () => {
      const priceData = [{ date: '2024-01-01', close: null, price: 150 }];

      const chartData = generateChartData(asPriceData(priceData));

      expect(chartData[0].y).toBe(150);
    });

    it('should prefer close over price when both exist', () => {
      const priceData = [{ date: '2024-01-01', close: 100, price: 200 }];

      const chartData = generateChartData(asPriceData(priceData));

      expect(chartData[0].y).toBe(100);
    });
  });

  describe('getPriceRange', () => {
    it('should calculate correct range with padding', () => {
      const chartData = [{ y: 100 }, { y: 200 }];

      const range = getPriceRange(asChartData(chartData), 0.1);

      expect(range.min).toBe(90); // 100 - 10% of (200-100)
      expect(range.max).toBe(210); // 200 + 10% of (200-100)
    });

    it('should handle zero values in chart data', () => {
      const chartData = [{ y: 0 }, { y: 100 }, { y: 50 }];

      const range = getPriceRange(asChartData(chartData), 0.1);

      expect(range.min).toBeLessThan(0);
      expect(range.max).toBeGreaterThan(100);
    });

    it('should handle flat series (all same values)', () => {
      const chartData = [{ y: 100 }, { y: 100 }, { y: 100 }];

      const range = getPriceRange(asChartData(chartData), 0.1);

      // Should create artificial range around the midpoint
      expect(range.min).toBeLessThan(100);
      expect(range.max).toBeGreaterThan(100);
    });

    it('should handle empty chart data', () => {
      const range = getPriceRange([]);

      expect(range).toEqual({ min: 0, max: 100 });
    });

    it('should use default padding of 0.1', () => {
      const chartData = [{ y: 0 }, { y: 100 }];

      const range = getPriceRange(asChartData(chartData));

      expect(range.min).toBe(-10); // 0 - 10% of 100
      expect(range.max).toBe(110); // 100 + 10% of 100
    });

    it('should handle negative values', () => {
      const chartData = [{ y: -50 }, { y: 50 }];

      const range = getPriceRange(asChartData(chartData), 0.1);

      expect(range.min).toBeLessThan(-50);
      expect(range.max).toBeGreaterThan(50);
    });
  });

  describe('calculatePriceChange', () => {
    it('should calculate price changes correctly', () => {
      const chartData = [{ y: 100 }, { y: 110 }, { y: 105 }];

      const result = calculatePriceChange(asChartData(chartData));

      expect(result.startPrice).toBe(100);
      expect(result.currentPrice).toBe(105);
      expect(result.priceChange).toBe(5);
      expect(result.priceChangePercent).toBe(5);
      expect(result.isValidPercentage).toBe(true);
    });

    it('should handle zero starting price (normalized data) - Bug Fix #3', () => {
      const chartData = [
        { y: 0 }, // 0% return at start
        { y: 5 }, // +5%
        { y: 10 }, // +10%
      ];

      const result = calculatePriceChange(asChartData(chartData));

      expect(result.startPrice).toBe(0);
      expect(result.currentPrice).toBe(10);
      expect(result.priceChange).toBe(10);
      expect(result.priceChangePercent).toBe(null); // Prevented division by zero
      expect(result.isValidPercentage).toBe(false); // Flag invalid percentage
    });

    it('should handle negative price changes', () => {
      const chartData = [{ y: 100 }, { y: 90 }];

      const result = calculatePriceChange(asChartData(chartData));

      expect(result.priceChange).toBe(-10);
      expect(result.priceChangePercent).toBe(-10);
      expect(result.isValidPercentage).toBe(true);
    });

    it('should handle empty chart data', () => {
      const result = calculatePriceChange([]);

      expect(result).toEqual({
        currentPrice: null,
        startPrice: null,
        priceChange: 0,
        priceChangePercent: 0,
        isValidPercentage: false,
      });
    });

    it('should handle negative starting price correctly', () => {
      const chartData = [
        { y: -100 }, // Starting at -$100 (unusual but possible)
        { y: -50 }, // Increase to -$50
      ];

      const result = calculatePriceChange(asChartData(chartData));

      expect(result.startPrice).toBe(-100);
      expect(result.currentPrice).toBe(-50);
      expect(result.priceChange).toBe(50);
      // For negative baseline: (50 / abs(-100)) * -100 = -50%
      expect(result.priceChangePercent).toBe(-50);
      expect(result.isValidPercentage).toBe(true);
    });

    it('should prevent Infinity when result is infinite', () => {
      const chartData = [{ y: 0 }, { y: Infinity }];

      const result = calculatePriceChange(asChartData(chartData));

      expect(result.priceChangePercent).toBe(null);
      expect(result.isValidPercentage).toBe(false);
    });

    it('should prevent NaN when result is NaN', () => {
      const chartData = [{ y: NaN }, { y: 100 }];

      const result = calculatePriceChange(asChartData(chartData));

      expect(result.priceChangePercent).toBe(null);
      expect(result.isValidPercentage).toBe(false);
    });

    it('should handle single data point', () => {
      const chartData = [{ y: 100 }];

      const result = calculatePriceChange(asChartData(chartData));

      expect(result.startPrice).toBe(100);
      expect(result.currentPrice).toBe(100);
      expect(result.priceChange).toBe(0);
      expect(result.priceChangePercent).toBe(0);
      expect(result.isValidPercentage).toBe(true);
    });
  });

  describe('filterPriceDataByTimeframe', () => {
    const createDateArray = (count: number, startDaysAgo: number = count) => {
      const data = [];
      const now = new Date();
      for (let i = 0; i < count; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (startDaysAgo - i - 1));
        data.push({
          date: date.toISOString().split('T')[0],
          close: 100 + i,
        });
      }
      return data;
    };

    it('should handle empty data', () => {
      expect(filterPriceDataByTimeframe([], '1M')).toEqual([]);
      expect(filterPriceDataByTimeframe(null as any, '1M')).toEqual([]);
    });

    it('should filter 1D timeframe to most recent trading day', () => {
      const priceData = [
        { date: '2024-01-01', close: 100 },
        { date: '2024-01-01', close: 101 },
        { date: '2024-01-02', close: 102 },
        { date: '2024-01-02', close: 103 },
      ];

      const filtered = filterPriceDataByTimeframe(asPriceData(priceData), '1D');

      // Should only contain the latest date's data
      expect(filtered.every((pt) => pt.date === '2024-01-02')).toBe(true);
    });

    it('should return original data for 1Y without today', () => {
      const priceData = createDateArray(365, 365);

      const filtered = filterPriceDataByTimeframe(asPriceData(priceData), '1Y');

      // Should have data, excluding today if present
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.length).toBeLessThanOrEqual(priceData.length);
    });
  });

  describe('getMarketHours', () => {
    it('should return US market hours for NASDAQ', () => {
      const hours = getMarketHours('NASDAQ');
      expect(hours).toContain('10:30');
      expect(hours).toContain('16:30');
    });

    it('should return US market hours for NYSE', () => {
      const hours = getMarketHours('NYSE');
      expect(hours).toContain('10:30');
      expect(hours).toContain('16:30');
    });

    it('should return London hours for LSE', () => {
      const hours = getMarketHours('LSE');
      expect(hours).toContain('08:00');
      expect(hours).toContain('16:30');
    });

    it('should return Tokyo hours for JPX', () => {
      const hours = getMarketHours('JPX');
      expect(hours).toContain('09:00');
      expect(hours).toContain('15:00');
    });

    it('should default to US hours for unknown exchange', () => {
      const hours = getMarketHours('UNKNOWN');
      expect(hours).toContain('10:30');
      expect(hours).toContain('16:30');
    });

    it('should handle empty/null exchange', () => {
      const hours = getMarketHours('');
      expect(hours).toContain('10:30');
    });
  });

  describe('getMarketOpenClose', () => {
    it('should return US market open/close for NASDAQ', () => {
      const { marketOpen, marketClose } = getMarketOpenClose('NASDAQ');
      expect(marketOpen).toBe('09:30');
      expect(marketClose).toBe('16:30');
    });

    it('should return London market open/close for LSE', () => {
      const { marketOpen, marketClose } = getMarketOpenClose('LSE');
      expect(marketOpen).toBe('08:00');
      expect(marketClose).toBe('16:30');
    });

    it('should return Singapore market open/close for SGX', () => {
      const { marketOpen, marketClose } = getMarketOpenClose('SGX');
      expect(marketOpen).toBe('09:00');
      expect(marketClose).toBe('17:00');
    });

    it('should default to US hours', () => {
      const { marketOpen, marketClose } = getMarketOpenClose('');
      expect(marketOpen).toBe('09:30');
      expect(marketClose).toBe('16:30');
    });
  });

  describe('formatXAxisLabel', () => {
    it('should format 1D with time', () => {
      const label = formatXAxisLabel('2024-01-15', '1D', '10:30');
      expect(label).toBe('10:30');
    });

    it('should format 1M with month/day', () => {
      const label = formatXAxisLabel('2024-01-15', '1M');
      // Should be formatted as M/DD
      expect(label).toMatch(/\d{1,2}\/\d{1,2}/);
    });

    it('should format YTD with month/day', () => {
      const label = formatXAxisLabel('2024-06-15', 'YTD');
      expect(label).toMatch(/\d{1,2}\/\d{1,2}/);
    });
  });
});
