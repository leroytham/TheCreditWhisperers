import React, { useState } from 'react';
import { generateDailySentimentBars } from '../utils/chartHelpers';
import { DEFAULT_VISIBLE_HEADLINES } from '../utils/constants';

interface SentimentHeadline {
  title?: string;
  link?: string;
  provider?: string;
  sentiment_score?: number;
}

interface DaySentiment {
  score?: number;
  count?: number;
  headlines?: SentimentHeadline[];
}

interface DailySentimentData {
  [date: string]: DaySentiment;
}

interface NewsVolumeChartProps {
  dailySentiment: DailySentimentData | null;
  daysToShow?: number;
  className?: string;
}

/**
 * NewsVolumeChart Component
 *
 * Bar chart displaying daily news article volume with headline tooltips
 * Used in Sentiment page to show news activity over time
 */
const NewsVolumeChart: React.FC<NewsVolumeChartProps> = ({
  dailySentiment,
  daysToShow = 7,
  className = 'px-6 pb-6'
}) => {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [visibleHeadlines, setVisibleHeadlines] = useState(DEFAULT_VISIBLE_HEADLINES);

  // Generate bars from dailySentiment data
  // Type assertion needed because the function signature expects DailySentimentPoint but actually uses score/count/headlines
  const dailyVolumeBars = generateDailySentimentBars(
    (dailySentiment || {}) as Parameters<typeof generateDailySentimentBars>[0],
    daysToShow
  );

  // Chart dimensions for consistent positioning
  const topPadding = 40;
  const chartHeight = 325;

  // Find max count for y-axis scaling
  const maxCount = dailyVolumeBars.length > 0
    ? Math.max(...dailyVolumeBars.map(bar => bar.count))
    : 20;

  // Round up to next multiple of 5 for cleaner y-axis
  const yAxisMax = Math.ceil(maxCount / 5) * 5 || 20;

  // Generate Y-axis values (5 levels)
  const yAxisValues = Array.from({ length: 5 }, (_, i) =>
    Math.round(yAxisMax * (1 - i / 4))
  );

  if (!dailyVolumeBars || dailyVolumeBars.length === 0) {
    return (
      <div className={className}>
        <h3 className="text-lg font-semibold mb-4">Daily News Volume (Past 7 Days)</h3>
        <div className="relative h-96 bg-white border border-gray-200 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div>Loading news volume data...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-4">Daily News Volume (Past 7 Days)</h3>
      <div className="relative h-96 bg-white border border-gray-200 rounded-lg shadow-md p-6">
        <svg className="w-full h-full">
          {/* Y-axis label */}
          <text
            x="-180"
            y="15"
            fill="#6b7280"
            fontSize="11"
            fontWeight="600"
            transform="rotate(-90)"
            textAnchor="middle"
          >
            Number of Articles
          </text>

          {/* Y-axis labels and grid lines */}
          <g className="text-gray-400 text-xs">
            {yAxisValues.map((value, i) => {
              const yPos = topPadding + (i * (chartHeight / 4));
              return (
                <g key={i}>
                  <line x1="70" y1={yPos} x2="750" y2={yPos} stroke="#e5e7eb" strokeWidth="1" />
                  <text
                    x="60"
                    y={yPos + 4}
                    textAnchor="end"
                    fill="#6b7280"
                    fontSize="12"
                    fontWeight="500"
                  >
                    {value}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Volume Bars */}
          {dailyVolumeBars.map((bar, i) => {
            const barWidth = 60;
            const barSpacing = 680 / dailyVolumeBars.length;
            const x = 70 + i * barSpacing + (barSpacing - barWidth) / 2;

            // Calculate bar height based on count
            const barHeight = bar.count > 0
              ? (bar.count / yAxisMax) * chartHeight
              : 0;
            const barY = topPadding + chartHeight - barHeight;

            return (
              <g key={i}>
                {/* Bar */}
                <rect
                  x={x}
                  y={barY}
                  width={barWidth}
                  height={Math.max(barHeight, 3)}
                  fill="#3b82f6"
                  opacity="0.75"
                  rx="3"
                  className="cursor-pointer transition-opacity"
                  style={{ opacity: hoveredBar === i ? 1 : 0.75 }}
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                />

                {/* Count label above bar */}
                <text
                  x={x + barWidth / 2}
                  y={barY - 8}
                  textAnchor="middle"
                  fill="#374151"
                  fontSize="12"
                  fontWeight="600"
                >
                  {bar.count}
                </text>

                {/* Date label on X-axis */}
                <text
                  x={x + barWidth / 2}
                  y={topPadding + chartHeight + 25}
                  textAnchor="middle"
                  fill="#374151"
                  fontSize="12"
                  fontWeight="500"
                >
                  {bar.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredBar !== null && dailyVolumeBars[hoveredBar] && (
          <div
            className="absolute bg-white border-2 border-blue-400 rounded-lg shadow-2xl p-4 z-30 overflow-y-auto"
            style={{
              left: `${Math.min(
                Math.max(
                  70 +
                    hoveredBar * (680 / dailyVolumeBars.length) +
                    680 / dailyVolumeBars.length / 2 -
                    150,
                  20
                ),
                600
              )}px`,
              top: '100px',
              width: '320px',
              maxHeight: '400px'
            }}
            onMouseEnter={() => setHoveredBar(hoveredBar)}
            onMouseLeave={() => {
              setHoveredBar(null);
              setVisibleHeadlines(DEFAULT_VISIBLE_HEADLINES);
            }}
          >
            {/* Tooltip Header */}
            <div className="mb-3 pb-2 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-700">
                {dailyVolumeBars[hoveredBar].label}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-600">Articles Published:</span>
                <span className="text-lg font-bold text-blue-600">
                  {dailyVolumeBars[hoveredBar].count}
                </span>
              </div>
            </div>

            {/* Headlines List */}
            {dailyVolumeBars[hoveredBar].headlines &&
              dailyVolumeBars[hoveredBar].headlines.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">
                    Top Headlines (
                    {Math.min(visibleHeadlines, dailyVolumeBars[hoveredBar].headlines.length)})
                  </div>
                  <div className="space-y-3">
                    {dailyVolumeBars[hoveredBar].headlines
                      .slice(0, visibleHeadlines)
                      .map((headline, idx) => (
                        <div key={idx} className="border-l-2 border-blue-300 pl-2 py-1">
                          <a
                            href={headline.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-800 hover:text-blue-600 hover:underline leading-tight block cursor-pointer transition-colors"
                            style={{
                              pointerEvents: 'auto',
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {headline.title}
                          </a>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-500">{headline.provider}</span>
                            {headline.sentiment_score !== undefined && (
                              <span
                                className={`text-xs font-semibold ${
                                  headline.sentiment_score >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {headline.sentiment_score >= 0 ? '+' : ''}
                                {headline.sentiment_score.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* View More Button */}
                  {visibleHeadlines < dailyVolumeBars[hoveredBar].headlines.length && (
                    <button
                      onClick={() => setVisibleHeadlines((prev) => prev + 5)}
                      className="mt-3 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded transition-colors"
                    >
                      View More (
                      {dailyVolumeBars[hoveredBar].headlines.length - visibleHeadlines}{' '}
                      remaining)
                    </button>
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsVolumeChart;
