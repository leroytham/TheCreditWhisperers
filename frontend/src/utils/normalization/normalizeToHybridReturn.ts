/**
 * Normalize data using hybrid denominator calculation.
 *
 * This function implements the documented hybrid logic:
 * - Holdings purchased BEFORE the period start: Use market value at period start as denominator
 * - Holdings purchased WITHIN the period: Use cost basis as denominator
 */

import { DataPoint, NormalizedDataPoint, TWRData } from './types';

/**
 * Normalize data using hybrid denominator calculation.
 *
 * @param data - Array of data points with lot_breakdown field
 * @param periodStartDate - Start date of the period
 * @param twrData - Optional TWR data for fallback
 * @returns Normalized data with hybrid percentage returns
 */
export function normalizeToHybridReturn(data: DataPoint[], periodStartDate: Date | string, twrData: TWRData | null = null): NormalizedDataPoint[] {
  if (!data || data.length === 0) {
    return [];
  }

  // Initialize baseline and capital flow tracking for fallback calculation
  const firstPoint = data[0];
  let baseline = firstPoint.close || firstPoint.portfolio_value || 0;
  let adjustedBaseline = baseline;

  return data.map((point, index) => {
    const lotBreakdown = point.lot_breakdown || [];

    if (lotBreakdown.length === 0) {
      // No lot data, fall back to capital-flow-adjusted percentage return
      const currentValue = point.close || point.portfolio_value || 0;
      const capitalFlow = point.capital_flow || 0;

      // Update adjusted baseline when capital flow occurs
      if (capitalFlow !== 0) {
        const prevValue = index > 0
          ? (data[index - 1].close || data[index - 1].portfolio_value || adjustedBaseline)
          : adjustedBaseline;

        adjustedBaseline = prevValue + capitalFlow;
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
        adjustedBaseline
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
      hybridDenominator += lot.start_value || 0;

      if (lot.is_pre_period) {
        prePeriodValue += lot.start_value || 0;
        prePeriodLots++;
      } else {
        inPeriodCost += lot.start_value || 0;
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
