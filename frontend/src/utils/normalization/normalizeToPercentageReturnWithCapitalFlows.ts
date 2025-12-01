/**
 * Normalize portfolio data to percentage return with capital flow adjustment.
 *
 * This function properly accounts for deposits and withdrawals when calculating
 * percentage returns, preventing capital injections from appearing as investment gains
 * while preserving gains earned before deposits.
 */

import { DataPoint, NormalizedDataPoint } from './types';

/**
 * Normalize portfolio data to percentage return with capital flow adjustment.
 *
 * @param data - Array of data points with portfolio_value and capital_flow fields
 * @param startValue - Optional starting value override
 * @returns Normalized data with percentage returns
 */
export function normalizeToPercentageReturnWithCapitalFlows(data: DataPoint[], startValue: number | null = null): NormalizedDataPoint[] {
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

  return data.map((point, index) => {
    const currentValue = point.close || point.portfolio_value || 0;
    const capitalFlow = point.capital_flow || 0;

    // If there's a capital flow at this point, adjust the baseline
    if (capitalFlow !== 0) {
      // Roll baseline forward from PREVIOUS market value (not original baseline)
      // This preserves gains earned before the deposit, preventing understatement
      const prevValue = index > 0
        ? (data[index - 1].close || data[index - 1].portfolio_value || adjustedBaseline)
        : adjustedBaseline;

      // New baseline = previous market value + new capital flow
      adjustedBaseline = prevValue + capitalFlow;
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
      isCapitalAdjusted: true
    };
  });
}
