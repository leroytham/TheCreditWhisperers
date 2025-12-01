/**
 * PriceHoverTooltip - Bloomberg-style price tooltip on hover
 *
 * Displays price and date information when hovering over chart data points.
 * Works for both entity and sector modes.
 */

import React from 'react';
import { formatPrice } from '../../utils/formatters';
import { formatTooltipDateTime } from '../../utils/chartHelpers';

export interface HoveredPointState {
  x: number;
  y: number;
  xIndex: number;
  index: number;
  price: number;
  date: string;
  time?: string;
}

export interface PriceHoverTooltipProps {
  hoveredPoint: HoveredPointState;
  paddingLeft: number;
  paddingTop: number;
  chartWidth: number;
  timeframe: string;
  currency?: string;
  mode: 'entity' | 'sector';
}

export const PriceHoverTooltip: React.FC<PriceHoverTooltipProps> = ({
  hoveredPoint,
  paddingLeft,
  paddingTop,
  chartWidth,
  timeframe,
  currency,
  mode
}) => {
  const left = Math.max(
    paddingLeft + 10,
    Math.min(hoveredPoint.x - 60, paddingLeft + chartWidth - 120)
  );
  const top = paddingTop + 10;

  const formattedPrice = mode === 'entity'
    ? formatPrice(hoveredPoint.price)
    : Number(hoveredPoint.price).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

  return (
    <div
      className="absolute bg-white border border-gray-300 rounded pointer-events-none"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        padding: '6px 10px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: mode === 'entity' ? 20 : 50
      }}
    >
      <div className="text-sm font-bold text-gray-900">
        {formattedPrice} {currency || 'USD'}
      </div>
      <div className="text-xs text-gray-600 mt-0.5">
        {formatTooltipDateTime(hoveredPoint.date, timeframe, hoveredPoint.time)}
      </div>
    </div>
  );
};

export default PriceHoverTooltip;
