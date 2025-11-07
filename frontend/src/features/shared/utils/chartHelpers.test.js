/**
 * Test Suite for Chart Helper Functions
 * Tests the fixed nullish coalescing logic for handling zero percent returns
 */

import { generateChartData, getPriceRange, calculatePriceChange } from './chartHelpers';

describe('chartHelpers', () => {
  describe('generateChartData', () => {
    it('should handle zero percent returns correctly (not fallback to price)', () => {
      const priceData = [
        { date: '2024-01-01', close: 100, price: 125000 },
        { date: '2024-01-02', close: 0, price: 125000 },   // 0% return, should stay 0
        { date: '2024-01-03', close: 5, price: 131250 }
      ];

      const chartData = generateChartData(priceData);

      expect(chartData[0].y).toBe(100);
      expect(chartData[1].y).toBe(0);    // Should be 0, not 125000
      expect(chartData[2].y).toBe(5);
    });

    it('should fallback to price when close is missing', () => {
      const priceData = [
        { date: '2024-01-01', price: 100 },
        { date: '2024-01-02', close: undefined, price: 105 }
      ];

      const chartData = generateChartData(priceData);

      expect(chartData[0].y).toBe(100);
      expect(chartData[1].y).toBe(105);
    });

    it('should fallback to 0 when both close and price are missing', () => {
      const priceData = [
        { date: '2024-01-01', close: undefined, price: undefined }
      ];

      const chartData = generateChartData(priceData);

      expect(chartData[0].y).toBe(0);
    });

    it('should handle negative returns correctly', () => {
      const priceData = [
        { date: '2024-01-01', close: 100 },
        { date: '2024-01-02', close: -5 },   // -5% return
        { date: '2024-01-03', close: -10 }
      ];

      const chartData = generateChartData(priceData);

      expect(chartData[0].y).toBe(100);
      expect(chartData[1].y).toBe(-5);
      expect(chartData[2].y).toBe(-10);
    });

    it('should include all required fields', () => {
      const priceData = [
        { date: '2024-01-01', close: 100, time: '09:30', volume: 1000 }
      ];

      const chartData = generateChartData(priceData);

      expect(chartData[0]).toEqual({
        x: 0,
        y: 100,
        date: '2024-01-01',
        time: '09:30',
        volume: 1000,
        index: 0
      });
    });

    it('should handle empty data', () => {
      expect(generateChartData([])).toEqual([]);
      expect(generateChartData(null)).toEqual([]);
      expect(generateChartData(undefined)).toEqual([]);
    });

    it('should handle string numbers correctly', () => {
      const priceData = [
        { date: '2024-01-01', close: '100.5', price: '200' }
      ];

      const chartData = generateChartData(priceData);

      expect(chartData[0].y).toBe(100.5);
    });
  });

  describe('getPriceRange', () => {
    it('should calculate correct range with padding', () => {
      const chartData = [
        { y: 100 },
        { y: 200 }
      ];

      const range = getPriceRange(chartData, 0.1);

      expect(range.min).toBe(90);   // 100 - 10% of (200-100)
      expect(range.max).toBe(210);  // 200 + 10% of (200-100)
    });

    it('should handle zero values in chart data', () => {
      const chartData = [
        { y: 0 },
        { y: 100 },
        { y: 50 }
      ];

      const range = getPriceRange(chartData, 0.1);

      expect(range.min).toBeLessThan(0);
      expect(range.max).toBeGreaterThan(100);
    });

    it('should handle flat series (all same values)', () => {
      const chartData = [
        { y: 100 },
        { y: 100 },
        { y: 100 }
      ];

      const range = getPriceRange(chartData, 0.1);

      // Should create artificial range around the midpoint
      expect(range.min).toBeLessThan(100);
      expect(range.max).toBeGreaterThan(100);
    });

    it('should handle empty chart data', () => {
      const range = getPriceRange([]);

      expect(range).toEqual({ min: 0, max: 100 });
    });
  });

  describe('calculatePriceChange', () => {
    it('should calculate price changes correctly', () => {
      const chartData = [
        { y: 100 },
        { y: 110 },
        { y: 105 }
      ];

      const result = calculatePriceChange(chartData);

      expect(result.startPrice).toBe(100);
      expect(result.currentPrice).toBe(105);
      expect(result.priceChange).toBe(5);
      expect(result.priceChangePercent).toBe(5);
      expect(result.isValidPercentage).toBe(true);
    });

    it('should handle zero starting price (normalized data) - Bug Fix #3', () => {
      const chartData = [
        { y: 0 },    // 0% return at start
        { y: 5 },    // +5%
        { y: 10 }    // +10%
      ];

      const result = calculatePriceChange(chartData);

      expect(result.startPrice).toBe(0);
      expect(result.currentPrice).toBe(10);
      expect(result.priceChange).toBe(10);
      expect(result.priceChangePercent).toBe(null); // Prevented division by zero
      expect(result.isValidPercentage).toBe(false); // Flag invalid percentage
    });

    it('should handle negative price changes', () => {
      const chartData = [
        { y: 100 },
        { y: 90 }
      ];

      const result = calculatePriceChange(chartData);

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
        isValidPercentage: false
      });
    });

    it('should handle negative starting price correctly', () => {
      const chartData = [
        { y: -100 },  // Starting at -$100 (unusual but possible)
        { y: -50 }    // Increase to -$50
      ];

      const result = calculatePriceChange(chartData);

      expect(result.startPrice).toBe(-100);
      expect(result.currentPrice).toBe(-50);
      expect(result.priceChange).toBe(50);
      // For negative baseline: (50 / abs(-100)) * -100 = -50%
      expect(result.priceChangePercent).toBe(-50);
      expect(result.isValidPercentage).toBe(true);
    });

    it('should prevent Infinity when result is infinite', () => {
      const chartData = [
        { y: 0 },
        { y: Infinity }
      ];

      const result = calculatePriceChange(chartData);

      expect(result.priceChangePercent).toBe(null);
      expect(result.isValidPercentage).toBe(false);
    });

    it('should prevent NaN when result is NaN', () => {
      const chartData = [
        { y: NaN },
        { y: 100 }
      ];

      const result = calculatePriceChange(chartData);

      expect(result.priceChangePercent).toBe(null);
      expect(result.isValidPercentage).toBe(false);
    });
  });
});
