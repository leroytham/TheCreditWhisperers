/**
 * Normalize data using Time-Weighted Return (TWR) from backend.
 *
 * This is the most accurate method for portfolios with cash flows,
 * as it uses the Modified Dietz method to isolate investment performance
 * from capital contributions/withdrawals.
 */

import { DataPoint, NormalizedDataPoint, TWRData } from './types';
import { normalizeToPercentageReturn } from './normalizeToPercentageReturn';

/**
 * Normalize data using Time-Weighted Return (TWR) from backend.
 *
 * @param data - Array of data points
 * @param twrData - TWR calculation result from backend
 * @returns Normalized data with TWR-based returns
 */
export function normalizeToTWR(data: DataPoint[], twrData: TWRData | null): NormalizedDataPoint[] {
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
  const twrByDate = new Map<string, number>();
  let cumulativeTWR = 0;

  // Build cumulative TWR at each sub-period end date
  for (const period of subPeriods) {
    const periodReturn = period.return || 0;
    // Chain this period's return with previous cumulative
    // Formula: (1 + cumulative) * (1 + period) - 1
    cumulativeTWR = ((1 + cumulativeTWR / 100) * (1 + periodReturn / 100) - 1) * 100;
    if (period.end_date) {
      twrByDate.set(period.end_date, cumulativeTWR);
    }

    // Also set the start date if it's the first period
    if (twrByDate.size === 1 && period.start_date) {
      twrByDate.set(period.start_date, 0); // Start at 0% return
    }
  }

  // Convert to sorted array for interpolation
  const twrPoints = Array.from(twrByDate.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  // Map each data point to its interpolated TWR value
  return data.map(point => {
    const { price, ...pointWithoutPrice } = point;
    const pointDate = new Date(point.date || '');

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
          const totalDays = (twrDateTime.getTime() - prevDateTime.getTime()) / (1000 * 60 * 60 * 24);
          const daysFromPrev = (pointDate.getTime() - prevDateTime.getTime()) / (1000 * 60 * 60 * 24);

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
