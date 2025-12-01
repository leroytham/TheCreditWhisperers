/**
 * Normalize time-series data to percentage returns starting from 0%
 *
 * Converts absolute values to percentage change from the starting value.
 * Useful for comparing portfolio performance against benchmarks.
 */

import { DataPoint, NormalizedDataPoint } from './types';

/**
 * Normalize time-series data to percentage returns starting from 0%
 *
 * @param data - Array of data points with 'close' or 'portfolio_value' field
 * @param startValue - Optional starting value (uses first data point if not provided)
 * @returns Array with values normalized to % returns from start
 */
export function normalizeToPercentageReturn(data: DataPoint[], startValue: number | null = null): NormalizedDataPoint[] {
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
    let baselineDate: string | null = null;

    for (let i = 0; i < data.length; i++) {
      const currentValue = data[i].close || data[i].portfolio_value || 0;
      if (currentValue > 0.01) {
        baselineIndex = i;
        baselineValue = currentValue;
        baselineDate = (data[i].date || data[i].timestamp || null) as string | null;
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
