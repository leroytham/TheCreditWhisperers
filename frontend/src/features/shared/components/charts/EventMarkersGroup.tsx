/**
 * EventMarkersGroup - Unified event markers component for PriceChart
 *
 * Handles position calculation, collision detection, and rendering for both
 * entity mode (significantEvents) and sector mode (topEvents).
 */

import React from 'react';
import { findEventPosition } from '../../utils/chartHelpers';
import type { ChartDataPoint, PriceRange } from '../../utils/chartHelpers';
import type { NewsArticle } from '../../../../types';

// Extended event type with additional display properties
export interface DisplayEvent {
  start_date: string;
  trend: string;
  total_move_pct?: number;
  link?: string;
  url?: string;
  news?: NewsArticle[];
}

// Hovered event state
export interface HoveredEventState extends DisplayEvent {
  xPos: number;
  iconY: number;
  chartWidth: number;
  paddingLeft: number;
}

// Event position with display coordinates (internal)
interface EventPositionWithDisplay {
  event: DisplayEvent;
  xPos: number;
  originalXPos?: number;
  iconY: number;
  dataY: number;
  index: number;
}

export interface EventMarkersGroupProps {
  events: DisplayEvent[];
  chartData: ChartDataPoint[];
  chartWidth: number;
  chartHeight: number;
  paddingLeft: number;
  paddingTop: number;
  priceRange: PriceRange;
  priceChangePercent: number;
  hoveredEvent: HoveredEventState | null;
  setHoveredEvent: (event: HoveredEventState | null) => void;
  onEventClick?: (event: DisplayEvent) => void;
  mode: 'entity' | 'sector';
}

/**
 * Calculate event positions with collision detection and spreading
 */
const calculateEventPositions = (
  events: DisplayEvent[],
  chartData: ChartDataPoint[],
  chartWidth: number,
  chartHeight: number,
  paddingLeft: number,
  paddingTop: number,
  priceRange: PriceRange
): EventPositionWithDisplay[] => {
  const eventPositions: EventPositionWithDisplay[] = [];

  events.forEach((event, i) => {
    const eventPos = findEventPosition(
      { start_date: event.start_date, trend: event.trend, total_move_pct: event.total_move_pct },
      chartData,
      chartWidth,
      paddingLeft
    );

    if (eventPos) {
      // Prefer the matched pricePoint/index from findEventPosition
      let dataPoint: ChartDataPoint | null = eventPos.pricePoint || null;
      if ((!dataPoint || dataPoint.index === undefined) && chartData && chartData.length) {
        const matchedIndex = chartData.findIndex(
          (d: ChartDataPoint) =>
            new Date(d.date).toISOString().slice(0, 10) ===
            new Date(event.start_date).toISOString().slice(0, 10)
        );
        const displayIndex = matchedIndex > 0 ? matchedIndex - 1 : matchedIndex;
        dataPoint = displayIndex >= 0 ? chartData[displayIndex] : null;
      }

      const dataY = dataPoint
        ? paddingTop + chartHeight - ((dataPoint.y ?? 0) - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight
        : paddingTop;

      eventPositions.push({ event, ...eventPos, dataY, index: i, iconY: 0 });
    }
  });

  // Sort by xPos for collision detection
  eventPositions.sort((a, b) => a.xPos - b.xPos);

  // Apply horizontal spreading for overlapping icons
  const baseIconY = paddingTop + chartHeight - 15;
  const OVERLAP_THRESHOLD = 25;
  const SPREAD_SPACING = 18;

  eventPositions.forEach((pos, i) => {
    pos.iconY = baseIconY;
    // Store original xPos BEFORE spreading for dotted line positioning
    pos.originalXPos = pos.xPos;

    // Find all previous icons that overlap with this one
    const overlappingGroup: EventPositionWithDisplay[] = [];
    for (let j = 0; j < i; j++) {
      if (Math.abs(pos.xPos - eventPositions[j].xPos) < OVERLAP_THRESHOLD) {
        overlappingGroup.push(eventPositions[j]);
      }
    }

    // If overlapping, spread icons horizontally
    if (overlappingGroup.length > 0) {
      const groupSize = overlappingGroup.length + 1;
      const totalWidth = (groupSize - 1) * SPREAD_SPACING;
      const startX = pos.xPos - totalWidth / 2;

      // Adjust positions of all icons in the overlapping group
      overlappingGroup.forEach((overlapped, idx) => {
        overlapped.xPos = startX + idx * SPREAD_SPACING;
      });

      // Position current icon at the end of the group
      pos.xPos = startX + overlappingGroup.length * SPREAD_SPACING;
    }
  });

  return eventPositions;
};

export const EventMarkersGroup: React.FC<EventMarkersGroupProps> = ({
  events,
  chartData,
  chartWidth,
  chartHeight,
  paddingLeft,
  paddingTop,
  priceRange,
  priceChangePercent,
  hoveredEvent,
  setHoveredEvent,
  onEventClick,
  mode
}) => {
  if (!events || events.length === 0) return null;

  const eventPositions = calculateEventPositions(
    events,
    chartData,
    chartWidth,
    chartHeight,
    paddingLeft,
    paddingTop,
    priceRange
  );

  const baseIconY = paddingTop + chartHeight - 15;

  return (
    <>
      {eventPositions.map(({ event, xPos, iconY, dataY, originalXPos, index }) => {
        const handleNavigate = (): void => {
          const url = event.link || event.url;
          if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        };

        return (
          <g
            key={`${mode}-event-${index}`}
            className="cursor-pointer group"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              // Toggle tooltip: if clicking same icon, close it; otherwise open new one
              if (hoveredEvent && hoveredEvent.start_date === event.start_date) {
                setHoveredEvent(null);
              } else {
                setHoveredEvent({
                  ...event,
                  xPos,
                  iconY,
                  chartWidth,
                  paddingLeft
                });
                // Notify parent component that an event was clicked (entity mode only)
                if (onEventClick && mode === 'entity') {
                  onEventClick(event);
                }
              }
            }}
          >
            {/* Dot at data point on chart line - matches chart color */}
            <circle
              cx={originalXPos}
              cy={dataY}
              r="6"
              fill={priceChangePercent >= 0 ? '#00a850' : '#ef4444'}
              stroke="white"
              strokeWidth="2"
            />

            {/* Vertical dotted line - starts below the dot */}
            <line
              x1={originalXPos}
              y1={dataY + 8}
              x2={originalXPos}
              y2={paddingTop + chartHeight}
              stroke="#6b7280"
              strokeWidth="1.5"
              strokeDasharray="3,3"
              opacity="1"
            />

            {/* Connector line if icon is offset (for entity mode compatibility) */}
            {mode === 'entity' && iconY !== baseIconY && (
              <line
                x1={xPos}
                y1={paddingTop + chartHeight}
                x2={xPos}
                y2={iconY + 14}
                stroke="#9ca3af"
                strokeWidth="1"
                strokeDasharray="2,3"
                opacity="0.6"
              />
            )}

            {/* Background blurred glow circle - larger for visible halo */}
            <circle
              cx={xPos}
              cy={iconY}
              r="18"
              fill="white"
              fillOpacity="0.5"
              stroke="#9ca3af"
              strokeWidth="2"
              filter="url(#iconCircleGlow)"
            />

            {/* Foreground crisp circle - thin BLACK border, NO blur */}
            <circle
              cx={xPos}
              cy={iconY}
              r="15"
              fill="white"
              fillOpacity="0.9"
              stroke="black"
              strokeWidth="0.5"
              className="group-hover:fill-opacity-95 transition-all"
            />

            {/* Document icon - Bloomberg style with WHITE fill */}
            <g>
              {/* Main document body - WHITE */}
              <path
                d={`M ${xPos - 5} ${iconY - 6} L ${xPos - 5} ${iconY + 6} L ${xPos + 5} ${iconY + 6} L ${xPos + 5} ${iconY - 3} L ${xPos + 2} ${iconY - 6} Z`}
                fill="white"
                stroke="#374151"
                strokeWidth="1"
              />
              {/* Folded corner flap - medium gray for shadow */}
              <path
                d={`M ${xPos + 2} ${iconY - 6} L ${xPos + 2} ${iconY - 3} L ${xPos + 5} ${iconY - 3} Z`}
                fill="#9ca3af"
                stroke="#6b7280"
                strokeWidth="0.5"
              />
              {/* Horizontal lines inside document - BLACK for visibility */}
              <line x1={xPos - 3} y1={iconY - 1} x2={xPos + 3} y2={iconY - 1} stroke="#374151" strokeWidth="0.8" />
              <line x1={xPos - 3} y1={iconY + 1} x2={xPos + 3} y2={iconY + 1} stroke="#374151" strokeWidth="0.8" />
              <line x1={xPos - 3} y1={iconY + 3} x2={xPos + 1} y2={iconY + 3} stroke="#374151" strokeWidth="0.8" />
            </g>

            {/* Transparent clickable area - ensures reliable clicking */}
            <rect
              x={xPos - 17}
              y={iconY - 17}
              width="34"
              height="34"
              fill="transparent"
              className="cursor-pointer"
              onClick={handleNavigate}
            />
          </g>
        );
      })}
    </>
  );
};

export default EventMarkersGroup;
