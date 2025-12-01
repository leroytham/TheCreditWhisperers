/**
 * VolumeAreaChart - SVG volume area chart component
 *
 * Renders a blue area chart showing news volume as connected bars.
 */

import React from 'react';

interface DataPoint {
  volume: number;
  [key: string]: any;
}

export interface VolumeAreaChartProps {
  processedData: DataPoint[];
  chartHeight: number;
  chartWidth: number;
  topPadding: number;
  leftPadding: number;
  volumeMax: number;
  stepWidth: number;
  getXPosition: (index: number) => number;
}

export const VolumeAreaChart: React.FC<VolumeAreaChartProps> = ({
  processedData,
  chartHeight,
  chartWidth,
  topPadding,
  leftPadding,
  volumeMax,
  stepWidth,
  getXPosition
}) => {
  const baseline = topPadding + chartHeight;

  if (!processedData || processedData.length === 0) {
    return null;
  }

  // Pre-compute bar bounds so we can clamp to the plot area cleanly
  const barSegments = processedData.map((point, i) => {
    const barHeight = point.volume > 0
      ? (point.volume / volumeMax) * chartHeight
      : 0;
    const y = baseline - barHeight;

    if (processedData.length === 1) {
      const centerX = getXPosition(i);
      const halfWidth = Math.min(chartWidth * 0.2, 60);
      const xLeft = Math.max(leftPadding, centerX - halfWidth);
      const xRight = Math.min(leftPadding + chartWidth, centerX + halfWidth);
      return { xLeft, xRight, y };
    }

    const centerX = getXPosition(i);
    const maxHalfWidth = stepWidth / 2;
    const desiredHalfWidth = Math.min(maxHalfWidth, Math.min(24, stepWidth * 0.45));

    let xLeft = centerX - desiredHalfWidth;
    let xRight = centerX + desiredHalfWidth;

    if (i === 0) {
      xLeft = leftPadding;
    }
    if (i === processedData.length - 1) {
      xRight = leftPadding + chartWidth;
    }

    xLeft = Math.max(leftPadding, xLeft);
    xRight = Math.min(leftPadding + chartWidth, xRight);

    if (xRight <= xLeft) {
      // Ensure a visible bar when points are extremely dense
      const fallbackHalfWidth = Math.max(0.5, maxHalfWidth * 0.4);
      const adjustedCenter = Math.min(leftPadding + chartWidth, Math.max(leftPadding, centerX));
      xLeft = Math.max(leftPadding, adjustedCenter - fallbackHalfWidth);
      xRight = Math.min(leftPadding + chartWidth, adjustedCenter + fallbackHalfWidth);
    }

    return { xLeft, xRight, y };
  });

  let pathD = `M ${barSegments[0].xLeft} ${baseline}`;

  barSegments.forEach((segment, index) => {
    if (index > 0) {
      pathD += ` L ${segment.xLeft} ${baseline}`;
    }

    pathD += ` L ${segment.xLeft} ${segment.y}`;
    pathD += ` L ${segment.xRight} ${segment.y}`;
    pathD += ` L ${segment.xRight} ${baseline}`;
  });

  pathD += ' Z';

  return (
    <path
      d={pathD}
      fill="#3b82f6"
      fillOpacity="0.15"
      stroke="#3b82f6"
      strokeWidth="2"
      strokeOpacity="0.4"
      className="pointer-events-none"
    />
  );
};

export default VolumeAreaChart;
