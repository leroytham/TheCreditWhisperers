/**
 * Timeframe Filter Utilities
 *
 * Functions to filter price data based on selected timeframe
 */

import type { PriceDataPoint } from '../../../types';

type TimeframeKey = '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y';

/**
 * Filter price data based on timeframe selection
 */
export const filterPriceDataByTimeframe = (priceData1Y: PriceDataPoint[], timeframe: string): PriceDataPoint[] => {
  if (!priceData1Y || priceData1Y.length === 0) {
    return [];
  }

  const now = new Date();
  let filtered = priceData1Y;

  switch (timeframe) {
    case '5D':
      filtered = priceData1Y.slice(-5);
      break;

    case '1M': {
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      filtered = priceData1Y.filter((pt: PriceDataPoint) => new Date(pt.date) >= oneMonthAgo);
      break;
    }

    case '3M': {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      filtered = priceData1Y.filter((pt: PriceDataPoint) => new Date(pt.date) >= threeMonthsAgo);
      break;
    }

    case '6M': {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      filtered = priceData1Y.filter((pt: PriceDataPoint) => new Date(pt.date) >= sixMonthsAgo);
      break;
    }

    case 'YTD': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      filtered = priceData1Y.filter((pt: PriceDataPoint) => new Date(pt.date) >= startOfYear);
      break;
    }

    case '1Y':
    default:
      filtered = priceData1Y;
      break;
  }

  return filtered;
};

/**
 * Get timeframe display label
 */
export const getTimeframeLabel = (timeframe: string): string => {
  const labels: Record<TimeframeKey, string> = {
    '5D': '5 Days',
    '1M': '1 Month',
    '3M': '3 Months',
    '6M': '6 Months',
    'YTD': 'Year to Date',
    '1Y': '1 Year'
  };

  return labels[timeframe as TimeframeKey] || timeframe;
};
