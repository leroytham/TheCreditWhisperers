/**
 * Test Suite for Formatter Functions
 * Tests zero-baseline handling by keeping percentage returns at 0%
 */

import { normalizeToPercentageReturn } from './formatters';

describe('formatters', () => {
  describe('normalizeToPercentageReturn', () => {
    it('should normalize data to percentage returns correctly', () => {
      const data = [
        { date: '2024-01-01', close: 100000 },
        { date: '2024-01-02', close: 105000 },
        { date: '2024-01-03', close: 103000 }
      ];

      const result = normalizeToPercentageReturn(data);

      expect(result[0].close).toBe(0);      // 0% change from start
      expect(result[1].close).toBe(5);      // +5% from start
      expect(result[2].close).toBe(3);      // +3% from start
      expect(result[0].originalValue).toBe(100000);
      expect(result[1].originalValue).toBe(105000);
    });

    it('should keep percentage returns at 0% for zero-start portfolios', () => {
      const data = [
        { date: '2024-01-01', close: 0 },
        { date: '2024-01-02', close: 1000 },
        { date: '2024-01-03', close: 2000 }
      ];

      const result = normalizeToPercentageReturn(data);

      // All points should be 0% with isZeroBaseline flag
      expect(result[0].close).toBe(0);
      expect(result[1].close).toBe(0);
      expect(result[2].close).toBe(0);
      expect(result[0].originalValue).toBe(0);
      expect(result[1].originalValue).toBe(1000);
      expect(result[2].originalValue).toBe(2000);
      expect(result[0].isZeroBaseline).toBe(true);
      expect(result[1].isZeroBaseline).toBe(true);
      expect(result[2].isZeroBaseline).toBe(true);
    });

    it('should handle zero percent returns in middle of series', () => {
      const data = [
        { date: '2024-01-01', close: 100000 },
        { date: '2024-01-02', close: 100000 },  // No change = 0%
        { date: '2024-01-03', close: 105000 }
      ];

      const result = normalizeToPercentageReturn(data);

      expect(result[0].close).toBe(0);
      expect(result[1].close).toBe(0);   // Should be exactly 0, not fallback
      expect(result[2].close).toBe(5);
      // isZeroBaseline should be false for normal portfolios
      expect(result[0].isZeroBaseline).toBe(false);
      expect(result[1].isZeroBaseline).toBe(false);
      expect(result[2].isZeroBaseline).toBe(false);
    });

    it('should remove price field to prevent fallback contamination', () => {
      const data = [
        { date: '2024-01-01', close: 100000, price: 125000 },
        { date: '2024-01-02', close: 105000, price: 131250 }
      ];

      const result = normalizeToPercentageReturn(data);

      expect(result[0].price).toBeUndefined();
      expect(result[1].price).toBeUndefined();
      expect(result[0].close).toBe(0);
      expect(result[1].close).toBe(5);
    });

    it('should handle negative returns correctly', () => {
      const data = [
        { date: '2024-01-01', close: 100000 },
        { date: '2024-01-02', close: 95000 },
        { date: '2024-01-03', close: 90000 }
      ];

      const result = normalizeToPercentageReturn(data);

      expect(result[0].close).toBe(0);
      expect(result[1].close).toBe(-5);
      expect(result[2].close).toBe(-10);
    });

    it('should use portfolio_value field when close is not available', () => {
      const data = [
        { date: '2024-01-01', portfolio_value: 100000 },
        { date: '2024-01-02', portfolio_value: 105000 }
      ];

      const result = normalizeToPercentageReturn(data);

      expect(result[0].close).toBe(0);
      expect(result[1].close).toBe(5);
      expect(result[0].originalValue).toBe(100000);
    });

    it('should accept custom startValue parameter', () => {
      const data = [
        { date: '2024-01-01', close: 105000 },
        { date: '2024-01-02', close: 110000 }
      ];

      // Normalize from 100000 instead of first data point (105000)
      const result = normalizeToPercentageReturn(data, 100000);

      expect(result[0].close).toBe(5);      // (105000 - 100000) / 100000 * 100
      expect(result[1].close).toBe(10);     // (110000 - 100000) / 100000 * 100
    });

    it('should keep percentage returns at 0% when custom startValue is 0', () => {
      const data = [
        { date: '2024-01-01', close: 1000 },
        { date: '2024-01-02', close: 2000 }
      ];

      const result = normalizeToPercentageReturn(data, 0);

      // Should keep at 0% with isZeroBaseline flag
      expect(result[0].close).toBe(0);
      expect(result[1].close).toBe(0);
      expect(result[0].isZeroBaseline).toBe(true);
      expect(result[1].isZeroBaseline).toBe(true);
      expect(result[0].originalValue).toBe(1000);
      expect(result[1].originalValue).toBe(2000);
    });

    it('should handle empty data', () => {
      expect(normalizeToPercentageReturn([])).toEqual([]);
      expect(normalizeToPercentageReturn(null)).toEqual([]);
      expect(normalizeToPercentageReturn(undefined)).toEqual([]);
    });

    it('should preserve all other fields except price', () => {
      const data = [
        {
          date: '2024-01-01',
          close: 100000,
          price: 125000,
          volume: 1000,
          time: '09:30',
          customField: 'test'
        }
      ];

      const result = normalizeToPercentageReturn(data);

      expect(result[0].date).toBe('2024-01-01');
      expect(result[0].volume).toBe(1000);
      expect(result[0].time).toBe('09:30');
      expect(result[0].customField).toBe('test');
      expect(result[0].close).toBe(0);
      expect(result[0].originalValue).toBe(100000);
      expect(result[0].price).toBeUndefined();
    });

    it('should handle very small non-zero starting values as zero-baseline', () => {
      const data = [
        { date: '2024-01-01', close: 0.001 },
        { date: '2024-01-02', close: 0.002 }
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

    it('should handle benchmark data (S&P 500) normalization', () => {
      const benchmarkData = [
        { date: '2024-01-01', close: 4500 },
        { date: '2024-01-02', close: 4500 },  // No change = 0%
        { date: '2024-01-03', close: 4725 }   // +5%
      ];

      const result = normalizeToPercentageReturn(benchmarkData);

      expect(result[0].close).toBe(0);
      expect(result[1].close).toBe(0);   // Should be 0, not fallback to 4500
      expect(result[2].close).toBe(5);
      expect(result[1].price).toBeUndefined();  // Price field removed
    });
  });
});
