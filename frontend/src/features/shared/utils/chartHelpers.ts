/**
 * Shared Chart Helper Functions
 *
 * This file re-exports from domain-specific modules for backward compatibility.
 * New code should import directly from the specific modules:
 * - priceTransformers.ts: Price data filtering, chart data generation, price calculations
 * - timeseriesHelpers.ts: Timeline generation, market hours, axis labels
 * - sentimentTransformers.ts: Sentiment data transformations
 * - eventHelpers.ts: Event position and marker calculations
 */

import type { PriceDataPoint } from '../../../types';

// Re-export types that are used by hooks
export type { PriceDataPoint };

// Re-export all price transformation utilities and types
export {
  filterPriceDataByTimeframe,
  generateChartData,
  getPriceRange,
  calculatePriceChange,
  calculateChartPath,
  calculateFillPath,
} from './priceTransformers';

export type {
  ChartDataPoint,
  PriceRange,
  PriceChangeResult,
} from './priceTransformers';

// Re-export all timeseries utilities and types
export {
  getMarketOpenClose,
  getMarketHours,
  calculateTradingDayElapsed,
  formatXAxisLabel,
  formatTooltipDateTime,
  generateTimelinePoints,
} from './timeseriesHelpers';

export type {
  TimelinePoint,
  MarketHours,
} from './timeseriesHelpers';

// Re-export all sentiment transformation utilities and types
export {
  generateDailySentimentBars,
} from './sentimentTransformers';

export type {
  SentimentHeadline,
  DailySentimentBar,
} from './sentimentTransformers';

// Re-export all event utilities and types
export {
  findEventPosition,
  computeEventMarkers,
} from './eventHelpers';

export type {
  ChartEvent,
  EventPosition,
  EventMarker,
} from './eventHelpers';
