/**
 * Event Position & Marker Utilities
 *
 * Functions for calculating event positions on charts.
 */

import type { ChartDataPoint, PriceRange } from './priceTransformers';

export interface ChartEvent {
  start_date: string;
  trend: string;
  total_move_pct?: number;
  news?: string[];
}

export interface EventPosition {
  xPos: number;
  pricePoint: ChartDataPoint;
  isUpward: boolean;
}

export interface EventMarker {
  x: number;
  y: number;
  trend: string;
  pct: number;
  date: string;
  news: string[];
}

/**
 * Find event position on chart (Entity style - using CHART_CONFIG)
 */
export const findEventPosition = (
  event: ChartEvent,
  chartData: ChartDataPoint[],
  chartWidth: number = 660,
  paddingLeft: number = 60
): EventPosition | null => {
  const eventDate = new Date(event.start_date);

  // Find the index of the actual event date
  const eventIndex = chartData.findIndex(p => {
    const pointDateStr = (new Date(p.date)).toISOString().slice(0,10);
    const eventDateStr = (new Date(event.start_date)).toISOString().slice(0,10);
    return pointDateStr === eventDateStr;
  });

  if (eventIndex === -1) return null;

  // Use the previous data point (1 interval before) if available
  const displayIndex = eventIndex > 0 ? eventIndex - 1 : eventIndex;
  const pricePoint = chartData[displayIndex];

  if (!pricePoint || pricePoint.index === undefined) return null;

  const xPos = paddingLeft + ((pricePoint.index / Math.max(1, chartData.length - 1)) * chartWidth);

  return {
    xPos,
    pricePoint,
    isUpward: event.trend === 'Upward'
  };
};

/**
 * Compute event marker positions on chart (Sector style - with y-coordinate)
 */
export const computeEventMarkers = (
  events: ChartEvent[],
  chartData: ChartDataPoint[],
  chartWidth: number,
  chartHeight: number,
  priceRange: PriceRange,
  paddingLeft: number = 60,
  paddingTop: number = 40
): EventMarker[] => {
  if (!chartData || chartData.length === 0 || !events || events.length === 0) {
    return [];
  }

  const markers: EventMarker[] = [];

  for (const event of events) {
    const index = chartData.findIndex(pt => {
      const ptDateStr = (new Date(pt.date)).toISOString().slice(0,10);
      const evDateStr = (new Date(event.start_date)).toISOString().slice(0,10);
      return ptDateStr === evDateStr;
    });

    if (index === -1) continue;

    const pointY = chartData[index].y;
    if (pointY === null) continue;

    const x = paddingLeft + (index * (chartWidth / Math.max(1, chartData.length - 1)));
    const y = (paddingTop + chartHeight) - ((pointY - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);

    markers.push({
      x,
      y,
      trend: event.trend,
      pct: event.total_move_pct ?? 0,
      date: event.start_date,
      news: event.news || []
    });
  }

  return markers;
};
