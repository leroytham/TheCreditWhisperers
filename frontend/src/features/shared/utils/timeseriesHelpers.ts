/**
 * Timeseries & Timeline Utilities
 *
 * Functions for generating timeline points, market hours, and axis labels.
 */

import { parseExchangeDate, parseExchangeTimestamp } from './dateFormatters';
import type { ChartDataPoint } from './priceTransformers';

export interface TimelinePoint {
  label: string;
  x: number;
  dataIndex?: number;
}

export interface MarketHours {
  marketOpen: string;
  marketClose: string;
}

/**
 * Get market open and close times based on exchange
 */
export const getMarketOpenClose = (exchange: string): MarketHours => {
  const exchangeUpper = (exchange || '').toUpperCase();

  // US Markets
  if (exchangeUpper.includes('NMS') || exchangeUpper.includes('NYQ') ||
      exchangeUpper.includes('NASDAQ') || exchangeUpper.includes('NYSE') || exchangeUpper === '') {
    return { marketOpen: '09:30', marketClose: '16:30' };
  }
  // London
  if (exchangeUpper.includes('LSE') || exchangeUpper.includes('LON')) {
    return { marketOpen: '08:00', marketClose: '16:30' };
  }
  // Tokyo
  if (exchangeUpper.includes('JPX') || exchangeUpper.includes('TYO')) {
    return { marketOpen: '09:00', marketClose: '15:00' };
  }
  // Hong Kong
  if (exchangeUpper.includes('HKG') || exchangeUpper.includes('HKEX')) {
    return { marketOpen: '09:30', marketClose: '16:00' };
  }
  // Shanghai
  if (exchangeUpper.includes('SHG') || exchangeUpper.includes('SSE')) {
    return { marketOpen: '09:30', marketClose: '15:00' };
  }
  // Toronto
  if (exchangeUpper.includes('TOR') || exchangeUpper.includes('TSX')) {
    return { marketOpen: '09:30', marketClose: '16:00' };
  }
  // Singapore
  if (exchangeUpper.includes('SES') || exchangeUpper.includes('SGX') || exchangeUpper.includes('SIN')) {
    return { marketOpen: '09:00', marketClose: '17:00' };
  }

  return { marketOpen: '09:30', marketClose: '16:30' };
};

/**
 * Get market hours based on exchange
 */
export const getMarketHours = (exchange: string): string[] => {
  const exchangeUpper = (exchange || '').toUpperCase();

  if (exchangeUpper.includes('NMS') || exchangeUpper.includes('NYQ') ||
      exchangeUpper.includes('NASDAQ') || exchangeUpper.includes('NYSE') || exchangeUpper === '') {
    return ['10:30', '12:00', '13:30', '15:00', '16:30'];
  }
  if (exchangeUpper.includes('LSE') || exchangeUpper.includes('LON')) {
    return ['08:00', '10:00', '12:00', '14:00', '16:30'];
  }
  if (exchangeUpper.includes('JPX') || exchangeUpper.includes('TYO')) {
    return ['09:00', '10:30', '12:00', '13:30', '15:00'];
  }
  if (exchangeUpper.includes('HKG') || exchangeUpper.includes('HKEX')) {
    return ['09:30', '11:00', '13:00', '14:30', '16:00'];
  }
  if (exchangeUpper.includes('SHG') || exchangeUpper.includes('SSE')) {
    return ['09:30', '11:00', '13:00', '14:00', '15:00'];
  }
  if (exchangeUpper.includes('TOR') || exchangeUpper.includes('TSX')) {
    return ['09:30', '11:00', '12:30', '14:00', '16:00'];
  }
  if (exchangeUpper.includes('SES') || exchangeUpper.includes('SGX') || exchangeUpper.includes('SIN')) {
    return ['09:00', '11:00', '13:00', '15:00', '17:00'];
  }

  return ['10:30', '12:00', '13:30', '15:00', '16:30'];
};

/**
 * Calculate trading day elapsed percentage based on last data point time
 */
export const calculateTradingDayElapsed = (chartData: ChartDataPoint[], exchange: string): number => {
  if (!chartData || chartData.length === 0) return 1;

  const lastPoint = chartData[chartData.length - 1];
  if (!lastPoint.time) return 1;

  const { marketOpen, marketClose } = getMarketOpenClose(exchange);

  const parseTime = (timeStr: string): number => {
    let timeOnly = timeStr.trim();
    let hours: number;
    let minutes: number;

    if (timeOnly.includes('AM') || timeOnly.includes('PM')) {
      const isPM = timeOnly.includes('PM');
      timeOnly = timeOnly.replace(/\s*(AM|PM)\s*/i, '').trim();
      [hours, minutes] = timeOnly.split(':').map(Number);

      if (isPM && hours !== 12) {
        hours += 12;
      } else if (!isPM && hours === 12) {
        hours = 0;
      }
    } else {
      [hours, minutes] = timeOnly.split(':').map(Number);
    }

    return hours * 60 + minutes;
  };

  const openMinutes = parseTime(marketOpen);
  const closeMinutes = parseTime(marketClose);
  const lastDataMinutes = parseTime(lastPoint.time);

  const totalTradingMinutes = closeMinutes - openMinutes;
  const elapsedMinutes = Math.max(0, Math.min(lastDataMinutes - openMinutes, totalTradingMinutes));

  return Math.min(elapsedMinutes / totalTradingMinutes, 1);
};

/**
 * Format X-axis label based on timeframe
 */
export const formatXAxisLabel = (
  date: Date | string,
  timeframe: string,
  time: string | null = null,
  exchange: string = 'NASDAQ'
): string => {
  const parsed = typeof date === 'string'
    ? (timeframe === '1D' ? parseExchangeTimestamp(date, exchange) : parseExchangeDate(date, exchange))
    : date;

  const dateObj = parsed || new Date();

  switch (timeframe) {
    case '1D':
      if (time) {
        return time;
      }
      return dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    case '1M':
    case '6M':
    case 'YTD':
    case '1Y':
      return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    default:
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

/**
 * Format tooltip date/time based on timeframe
 */
export const formatTooltipDateTime = (
  date: Date | string,
  timeframe: string,
  time: string | null = null,
  exchange: string = 'NASDAQ'
): string => {
  const parsed = typeof date === 'string'
    ? (timeframe === '1D' ? parseExchangeTimestamp(date, exchange) : parseExchangeDate(date, exchange))
    : date;

  const dateObj = parsed || new Date();
  const currentYear = new Date().getFullYear();
  const dateYear = dateObj.getFullYear();

  switch (timeframe) {
    case '1D':
      if (time) {
        if (time.includes('AM') || time.includes('PM')) {
          const isPM = time.includes('PM');
          const timeOnly = time.replace(/\s*(AM|PM)\s*/i, '').trim();
          const timeParts = timeOnly.split(':').map(Number);
          let hours: number = timeParts[0];
          const minutes: number = timeParts[1];

          if (isPM && hours !== 12) {
            hours += 12;
          } else if (!isPM && hours === 12) {
            hours = 0;
          }

          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        return time;
      }
      return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    case '1M':
    case '6M':
    case 'YTD':
    case '1Y':
      if (dateYear < currentYear) {
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    default:
      return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};

/**
 * Generate timeline points for x-axis labels
 */
export const generateTimelinePoints = (
  chartData: ChartDataPoint[],
  chartWidth: number | null = null,
  numPoints: number = 6,
  paddingLeft: number = 60,
  timeframe: string = '1Y',
  exchange: string = 'NASDAQ'
): TimelinePoint[] => {
  if (chartData.length === 0) return [];

  const effectiveWidth = chartWidth || 660;

  // For 5Y, select points at year boundaries
  if (timeframe === '5Y') {
    const yearMap = new Map<number, { point: ChartDataPoint; index: number }[]>();

    chartData.forEach((point, index) => {
      if (point.date) {
        const year = new Date(point.date).getFullYear();
        if (!yearMap.has(year)) {
          yearMap.set(year, []);
        }
        yearMap.get(year)!.push({ point, index });
      }
    });

    const years = Array.from(yearMap.keys()).sort();

    if (years.length >= 1) {
      const yearLabels = years.map((year) => {
        const yearDataPoints = yearMap.get(year)!;
        const firstPointIndex = yearDataPoints[0].index;
        const xPosition = paddingLeft + (firstPointIndex * (effectiveWidth / Math.max(1, chartData.length - 1)));
        return { label: year.toString(), x: xPosition };
      });

      const filteredLabels: TimelinePoint[] = [];
      for (let i = 0; i < yearLabels.length; i++) {
        if (i === 0) {
          filteredLabels.push(yearLabels[i]);
        } else {
          const prevLabel = filteredLabels[filteredLabels.length - 1];
          const currentLabel = yearLabels[i];
          if (currentLabel.x - prevLabel.x >= 80) {
            filteredLabels.push(currentLabel);
          } else {
            filteredLabels[filteredLabels.length - 1] = currentLabel;
          }
        }
      }

      return filteredLabels;
    }
  }

  // Handle 1D timeframe - show market hours based on exchange
  if (timeframe === '1D') {
    const targetTimes = getMarketHours(exchange);
    const { marketOpen, marketClose } = getMarketOpenClose(exchange);
    const timelinePoints: TimelinePoint[] = [];

    const [openHours, openMinutes] = marketOpen.split(':').map(Number);
    const openMinutesSinceMidnight = openHours * 60 + openMinutes;

    const [closeHours, closeMinutes] = marketClose.split(':').map(Number);
    const closeMinutesSinceMidnight = closeHours * 60 + closeMinutes;

    const totalTradingMinutes = closeMinutesSinceMidnight - openMinutesSinceMidnight;

    targetTimes.forEach((targetTime) => {
      const [hours, minutes] = targetTime.split(':').map(Number);
      const targetMinutes = hours * 60 + minutes;
      const minutesIntoTradingDay = targetMinutes - openMinutesSinceMidnight;
      const percentageIntoDay = minutesIntoTradingDay / totalTradingMinutes;
      const xPosition = paddingLeft + (percentageIntoDay * effectiveWidth);

      timelinePoints.push({ label: targetTime, x: xPosition });
    });

    return timelinePoints;
  }

  // For 1M, 6M, YTD, 1Y: Skip first ~10% of data for first label
  if (timeframe === '1M' || timeframe === '6M' || timeframe === 'YTD' || timeframe === '1Y') {
    const offsetPercent = timeframe === '1M' ? 0.05 : 0.1;
    const startOffset = Math.floor(chartData.length * offsetPercent);
    const remainingLength = chartData.length - startOffset - 1;

    const effectiveNumPoints = Math.min(numPoints, chartData.length - startOffset);

    const selectedIndices: number[] = [];
    for (let i = 0; i < effectiveNumPoints; i++) {
      const index = startOffset + Math.floor((i * remainingLength) / Math.max(1, effectiveNumPoints - 1));
      selectedIndices.push(Math.min(index, chartData.length - 1));
    }

    const uniqueIndices = [...new Set(selectedIndices)];
    const selectedPoints = uniqueIndices.map(index => chartData[index]).filter(Boolean);

    return selectedPoints.map((point) => {
      const dataIndex = chartData.indexOf(point);
      const xPosition = paddingLeft + (dataIndex * (effectiveWidth / Math.max(1, chartData.length - 1)));

      let label = '';
      if (point.date) {
        label = formatXAxisLabel(point.date, timeframe, point.time, exchange);
      } else {
        label = `Point`;
      }

      return { label, x: xPosition, dataIndex };
    });
  }

  // Default behavior
  const step = Math.max(1, Math.floor((chartData.length - 1) / (numPoints - 1)));
  const selectedIndices: number[] = [];

  for (let i = 0; i < numPoints - 1; i++) {
    selectedIndices.push(i * step);
  }
  selectedIndices.push(chartData.length - 1);

  const selectedPoints = selectedIndices.map(index => chartData[index]).filter(Boolean);

  return selectedPoints.map((point) => {
    const dataIndex = chartData.indexOf(point);
    const xPosition = paddingLeft + (dataIndex * (effectiveWidth / Math.max(1, chartData.length - 1)));

    let label = '';
    if (point.date) {
      label = formatXAxisLabel(point.date, timeframe, point.time, exchange);
    } else {
      label = `Point`;
    }

    return { label, x: xPosition, dataIndex };
  });
};
