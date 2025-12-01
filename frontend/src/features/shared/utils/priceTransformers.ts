/**
 * Price Data Transformation Utilities
 *
 * Functions for transforming, filtering, and calculating price data for charts.
 */

import type { PriceDataPoint } from '../../../types';

export interface ChartDataPoint {
  x: number;
  y: number | null;
  date: string;
  time?: string;
  volume: number;
  index: number;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface PriceChangeResult {
  currentPrice: number | null;
  startPrice: number | null;
  priceChange: number;
  priceChangePercent: number | null;
  isValidPercentage: boolean;
}

/**
 * Filters price data based on selected timeframe
 */
export const filterPriceDataByTimeframe = (priceData1Y: PriceDataPoint[], timeframe: string): PriceDataPoint[] => {
  if (!priceData1Y || priceData1Y.length === 0) {
    return [];
  }

  // Get current date in US Eastern Time (where US stock market operates)
  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const etDate = new Date(nowET);

  // Format today's date in US ET as YYYY-MM-DD for comparison
  const todayString = etDate.getFullYear() + '-' +
    String(etDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(etDate.getDate()).padStart(2, '0');

  let filtered = priceData1Y;
  const now = etDate;

  switch (timeframe) {
    case '1D': {
      const lastPoint = priceData1Y[priceData1Y.length - 1];
      if (lastPoint && lastPoint.date) {
        const latestDate = lastPoint.date;
        filtered = priceData1Y.filter(pt => pt.date === latestDate);
      } else {
        filtered = priceData1Y;
      }
      break;
    }
    case '1M': {
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      filtered = priceData1Y.filter(pt => {
        const ptDate = new Date(pt.date);
        return ptDate >= oneMonthAgo && pt.date !== todayString;
      });
      break;
    }
    case '3M': {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      filtered = priceData1Y.filter(pt => {
        const ptDate = new Date(pt.date);
        return ptDate >= threeMonthsAgo && pt.date !== todayString;
      });
      break;
    }
    case '6M': {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      filtered = priceData1Y.filter(pt => {
        const ptDate = new Date(pt.date);
        return ptDate >= sixMonthsAgo && pt.date !== todayString;
      });
      break;
    }
    case 'YTD': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      filtered = priceData1Y.filter(pt => {
        const ptDate = new Date(pt.date);
        return ptDate >= startOfYear && pt.date !== todayString;
      });
      break;
    }
    case '1Y':
      filtered = priceData1Y.filter(pt => pt.date !== todayString);
      break;
    default: {
      filtered = priceData1Y.filter(pt => pt.date !== todayString);

      if (timeframe === '5Y') {
        const MAX_5Y_POINTS = 800;
        if (filtered.length > MAX_5Y_POINTS) {
          const step = Math.ceil(filtered.length / MAX_5Y_POINTS);
          const sampled = filtered.filter((_, idx) => idx % step === 0);
          if (sampled[sampled.length - 1] !== filtered[filtered.length - 1]) {
            sampled.push(filtered[filtered.length - 1]);
          }
          filtered = sampled;
        }
      }
      break;
    }
  }

  return filtered;
};

/**
 * Generate chart coordinates from backend price data
 */
export const generateChartData = (priceData: PriceDataPoint[]): ChartDataPoint[] => {
  if (!priceData || priceData.length === 0) {
    return [];
  }

  return priceData.map((point, i) => {
    const closeValue = point.close !== undefined && point.close !== null ? parseFloat(String(point.close)) : NaN;
    const priceValue = point.price !== undefined && point.price !== null ? parseFloat(String(point.price)) : NaN;

    return {
      x: i,
      y: !isNaN(closeValue) ? closeValue : (!isNaN(priceValue) ? priceValue : null),
      date: point.date,
      time: point.time,
      volume: point.volume || 0,
      index: i
    };
  });
};

/**
 * Calculate price range for chart scaling with padding
 */
export const getPriceRange = (chartData: ChartDataPoint[], paddingPercent: number = 0.1): PriceRange => {
  if (chartData.length === 0) return { min: 0, max: 100 };

  const prices = chartData.map(d => d.y).filter((y): y is number => y !== null);
  if (prices.length === 0) return { min: 0, max: 100 };

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  const range = max - min;
  if (range < 0.01) {
    const midpoint = (max + min) / 2;
    const epsilon = midpoint * 0.01 || 1;
    return { min: midpoint - epsilon, max: midpoint + epsilon };
  }

  const padding = range * paddingPercent;
  return { min: min - padding, max: max + padding };
};

/**
 * Calculate price change metrics
 */
export const calculatePriceChange = (chartData: ChartDataPoint[]): PriceChangeResult => {
  if (chartData.length === 0) {
    return {
      currentPrice: null,
      startPrice: null,
      priceChange: 0,
      priceChangePercent: 0,
      isValidPercentage: false
    };
  }

  const currentPoint = chartData[chartData.length - 1];
  const startPoint = chartData[0];

  if (startPoint.y === null || currentPoint.y === null || !isFinite(startPoint.y) || !isFinite(currentPoint.y)) {
    return {
      currentPrice: currentPoint.y,
      startPrice: startPoint.y,
      priceChange: 0,
      priceChangePercent: null,
      isValidPercentage: false
    };
  }

  const priceChange = currentPoint.y - startPoint.y;
  let priceChangePercent: number | null = 0;
  let isValidPercentage = true;

  if (startPoint.y > 0) {
    priceChangePercent = (priceChange / startPoint.y) * 100;
  } else if (startPoint.y === 0) {
    priceChangePercent = null;
    isValidPercentage = false;
  } else if (startPoint.y < 0) {
    priceChangePercent = (priceChange / Math.abs(startPoint.y)) * -100;
  }

  if (priceChangePercent !== null && !isFinite(priceChangePercent)) {
    priceChangePercent = null;
    isValidPercentage = false;
  }

  return {
    currentPrice: currentPoint.y,
    startPrice: startPoint.y,
    priceChange,
    priceChangePercent,
    isValidPercentage
  };
};

/**
 * Calculate SVG path coordinates for price line
 */
export const calculateChartPath = (
  chartData: ChartDataPoint[],
  priceRange: PriceRange,
  chartWidth: number = 660,
  chartHeight: number = 250,
  paddingLeft: number = 60,
  paddingTop: number = 40
): string => {
  if (chartData.length === 0) return '';

  const points = chartData
    .filter((point): point is ChartDataPoint & { y: number } => point.y !== null)
    .map((point, i) => {
      const x = paddingLeft + (i * (chartWidth / Math.max(1, chartData.length - 1)));
      const y = paddingTop + chartHeight - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
      return { x, y };
    });

  const pathData = points.map((point, i) =>
    i === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
  ).join(' ');

  return pathData;
};

/**
 * Calculate SVG path for filled area under chart
 */
export const calculateFillPath = (
  chartData: ChartDataPoint[],
  priceRange: PriceRange,
  chartWidth: number = 660,
  chartHeight: number = 250,
  paddingLeft: number = 60,
  paddingTop: number = 40
): string => {
  if (chartData.length === 0) return '';

  const bottomY = paddingTop + chartHeight;
  const validPoints = chartData.filter((point): point is ChartDataPoint & { y: number } => point.y !== null);

  const points = validPoints.map((point, i) => {
    const x = paddingLeft + (i * (chartWidth / Math.max(1, chartData.length - 1)));
    const y = paddingTop + chartHeight - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
    return `L ${x} ${y}`;
  }).join(' ');

  const lastX = paddingLeft + ((chartData.length - 1) * (chartWidth / Math.max(1, chartData.length - 1)));

  return `M ${paddingLeft} ${bottomY} ${points} L ${lastX} ${bottomY} Z`;
};
