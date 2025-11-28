/**
 * Test Suite for Formatter Functions
 * Tests zero-baseline handling by keeping percentage returns at 0%
 */

import { normalizeToPercentageReturn, normalizeToHybridReturn, DataPoint } from './formatters';

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

    it('should rebase from first non-zero value when custom startValue is 0', () => {
      const data = [
        { date: '2024-01-01', close: 1000 },
        { date: '2024-01-02', close: 2000 }
      ];

      const result = normalizeToPercentageReturn(data, 0);

      // Should rebase on first non-zero value ($1000)
      // Day 1: 0% (at baseline)
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
      // Test null/undefined handling - function should handle these gracefully
      expect(normalizeToPercentageReturn(null as unknown as DataPoint[])).toEqual([]);
      expect(normalizeToPercentageReturn(undefined as unknown as DataPoint[])).toEqual([]);
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

    it('should emit close: null for pre-baseline points in zero-baseline portfolios', () => {
      const data = [
        { date: '2024-01-01', close: 0 },
        { date: '2024-01-02', close: 0 },
        { date: '2024-01-03', close: 0 },
        { date: '2024-01-04', close: 10000 },  // First investment
        { date: '2024-01-05', close: 10500 }   // +5%
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

    it('should emit close: null for pre-baseline points when portfolio starts with small values', () => {
      const data = [
        { date: '2024-01-01', close: 0.005 },  // < $0.01 threshold
        { date: '2024-01-02', close: 0.008 },
        { date: '2024-01-03', close: 100 },    // First real investment
        { date: '2024-01-04', close: 105 }
      ];

      const result = normalizeToPercentageReturn(data);

      // Pre-baseline points should have close: null
      expect(result[0].close).toBe(null);
      expect(result[0].isPreBaseline).toBe(true);

      expect(result[1].close).toBe(null);
      expect(result[1].isPreBaseline).toBe(true);

      // At baseline: 0%
      expect(result[2].close).toBe(0);
      expect(result[2].baselineValue).toBe(100);

      // After baseline: +5%
      expect(result[3].close).toBe(5);
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
              symbol: 'AAPL',
              lot_id: 'uuid-1',
              quantity: 100,
              market_value: 17500,
              start_value: 15000,  // Pre-period lot: started at $15k
              is_pre_period: true
            }
          ]
        },
        {
          date: '2024-01-02',
          close: 18000,
          lot_breakdown: [
            {
              symbol: 'AAPL',
              lot_id: 'uuid-1',
              quantity: 100,
              market_value: 18000,
              start_value: 15000,
              is_pre_period: true
            }
          ]
        }
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
          lot_breakdown: []  // No lot data
        },
        {
          date: '2024-01-02',
          close: 10500,
          lot_breakdown: []  // No lot data
        },
        {
          date: '2024-01-03',
          close: 11000,
          lot_breakdown: [
            {
              symbol: 'AAPL',
              lot_id: 'uuid-1',
              quantity: 100,
              market_value: 11000,
              start_value: 10000,
              is_pre_period: false
            }
          ]
        }
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
              symbol: 'AAPL',
              lot_id: 'uuid-1',
              quantity: 100,
              market_value: 17500,
              start_value: 16000,  // Pre-period: market value at period start
              is_pre_period: true
            },
            {
              symbol: 'MSFT',
              lot_id: 'uuid-2',
              quantity: 25,
              market_value: 9500,
              start_value: 8000,  // In-period: cost basis
              is_pre_period: false
            }
          ]
        }
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
      expect(normalizeToHybridReturn([], '2024-01-01')).toEqual([]);
      expect(normalizeToHybridReturn(null as any, '2024-01-01')).toEqual([]);
      expect(normalizeToHybridReturn(undefined as any, '2024-01-01')).toEqual([]);
    });

    it('should handle zero denominator gracefully', () => {
      const data = [
        {
          date: '2024-01-01',
          close: 0,
          lot_breakdown: [
            {
              symbol: 'AAPL',
              lot_id: 'uuid-1',
              quantity: 0,
              market_value: 0,
              start_value: 0,
              is_pre_period: true
            }
          ]
        }
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
          price: 18000,  // Should be removed
          lot_breakdown: [
            {
              symbol: 'AAPL',
              lot_id: 'uuid-1',
              quantity: 100,
              market_value: 17500,
              start_value: 15000,
              is_pre_period: true
            }
          ]
        }
      ];

      const result = normalizeToHybridReturn(data, '2024-01-01');

      expect(result[0].price).toBeUndefined();
      expect(result[0].close).toBeCloseTo(16.67, 1);
    });
  });
});
