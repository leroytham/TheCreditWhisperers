/**
 * SentimentRegimeFills - SVG sentiment regime color fills component
 *
 * Renders positive (green) and negative (red) fill regions for sentiment data,
 * handling zero-crossing calculations for accurate visualization.
 */

import React from 'react';

interface DataPoint {
  sentiment: number;
  [key: string]: any;
}

export interface SentimentRegimeFillsProps {
  processedData: DataPoint[];
  chartHeight: number;
  topPadding: number;
  sentimentMax: number;
  sentimentMin: number;
  sentimentRange: number;
  zeroY: number;
  getXPosition: (index: number) => number;
}

export const SentimentRegimeFills: React.FC<SentimentRegimeFillsProps> = ({
  processedData,
  chartHeight,
  topPadding,
  sentimentMax,
  sentimentRange,
  zeroY,
  getXPosition
}) => {
  let positivePath = '';
  let negativePath = '';
  let isInPositive = false;
  let isInNegative = false;

  processedData.forEach((point, i) => {
    const x = getXPosition(i);
    const sentiment = point.sentiment;
    const normalizedSentiment = (sentimentMax - sentiment) / sentimentRange;
    const y = topPadding + (normalizedSentiment * chartHeight);

    // Handle zero crossings between consecutive points
    if (i > 0) {
      const prevPoint = processedData[i - 1];
      const prevX = getXPosition(i - 1);
      const prevSentiment = prevPoint.sentiment;

      // Check if sentiment crosses zero between previous and current point
      const crossesZero = (prevSentiment > 0 && sentiment < 0) ||
                          (prevSentiment < 0 && sentiment > 0);

      if (crossesZero) {
        // Calculate exact X-coordinate where sentiment crosses zero using linear interpolation
        const xCross = prevX + (x - prevX) * (0 - prevSentiment) / (sentiment - prevSentiment);

        // Close current region at the crossing point
        if (isInPositive) {
          positivePath += `L ${xCross} ${zeroY} Z `;
          isInPositive = false;
        }
        if (isInNegative) {
          negativePath += `L ${xCross} ${zeroY} Z `;
          isInNegative = false;
        }

        // Start new region from the crossing point
        if (sentiment > 0) {
          positivePath += `M ${xCross} ${zeroY} L ${x} ${y} `;
          isInPositive = true;
        } else if (sentiment < 0) {
          negativePath += `M ${xCross} ${zeroY} L ${x} ${y} `;
          isInNegative = true;
        }
      } else {
        // No zero crossing, handle normally
        if (sentiment > 0) {
          if (!isInPositive) {
            positivePath += `M ${x} ${zeroY} L ${x} ${y} `;
            isInPositive = true;
          } else {
            positivePath += `L ${x} ${y} `;
          }
        } else if (sentiment < 0) {
          if (!isInNegative) {
            negativePath += `M ${x} ${zeroY} L ${x} ${y} `;
            isInNegative = true;
          } else {
            negativePath += `L ${x} ${y} `;
          }
        } else {
          // Sentiment exactly at zero, close any open paths
          if (isInPositive) {
            positivePath += `L ${x} ${zeroY} Z `;
            isInPositive = false;
          }
          if (isInNegative) {
            negativePath += `L ${x} ${zeroY} Z `;
            isInNegative = false;
          }
        }
      }
    } else {
      // First point - start a region if sentiment is non-zero
      if (sentiment > 0) {
        positivePath += `M ${x} ${zeroY} L ${x} ${y} `;
        isInPositive = true;
      } else if (sentiment < 0) {
        negativePath += `M ${x} ${zeroY} L ${x} ${y} `;
        isInNegative = true;
      }
    }
  });

  // Close any remaining open paths at the end
  if (isInPositive) {
    const lastX = getXPosition(processedData.length - 1);
    positivePath += `L ${lastX} ${zeroY} Z`;
  }
  if (isInNegative) {
    const lastX = getXPosition(processedData.length - 1);
    negativePath += `L ${lastX} ${zeroY} Z`;
  }

  return (
    <>
      {positivePath && (
        <path
          d={positivePath}
          fill="#10B981"
          fillOpacity="0.15"
          className="pointer-events-none"
        />
      )}
      {negativePath && (
        <path
          d={negativePath}
          fill="#EF4444"
          fillOpacity="0.15"
          className="pointer-events-none"
        />
      )}
    </>
  );
};

export default SentimentRegimeFills;
