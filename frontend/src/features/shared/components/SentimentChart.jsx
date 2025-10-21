import React, { useState } from 'react';
import { generateDailySentimentBars } from '../utils/chartHelpers';
import { getBarColor } from '../utils/formatters';
import { SENTIMENT_CHART_CONFIG, DEFAULT_VISIBLE_HEADLINES } from '../utils/constants';

/**
 * Shared SentimentChart Component
 *
 * Bar chart displaying daily sentiment with headline tooltips
 * Used by both Entity and Sector features
 *
 * @param {Object} props
 * @param {Object} props.dailySentiment - Daily sentiment data object (keyed by date)
 * @param {Array} props.sentimentBars - Pre-processed sentiment bars (optional, overrides dailySentiment)
 * @param {number} props.daysToShow - Number of days to display (default: 7)
 * @param {string} props.className - Additional CSS classes for wrapper
 */
const SentimentChart = ({
  dailySentiment,
  sentimentBars: preProcesedBars,
  daysToShow = SENTIMENT_CHART_CONFIG.daysToShow,
  className = 'p-6'
}) => {
  const [hoveredBar, setHoveredBar] = useState(null);
  const [visibleHeadlines, setVisibleHeadlines] = useState(DEFAULT_VISIBLE_HEADLINES);

  // Use pre-processed bars if provided, otherwise generate from dailySentiment
  const dailySentimentBars = preProcesedBars || generateDailySentimentBars(dailySentiment, daysToShow);

  if (!dailySentimentBars || dailySentimentBars.length === 0) {
    return (
      <div className={className}>
        <h3 className="text-lg font-semibold mb-4">Daily Average Sentiment (Past 7 Days)</h3>
        <div className="relative h-96 bg-white border border-gray-200 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div>Loading sentiment data...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-4">Daily Average Sentiment (Past 7 Days)</h3>
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
            Average Sentiment Score
          </text>

          {/* Y-axis labels and grid lines */}
          <g className="text-gray-400 text-xs">
            {SENTIMENT_CHART_CONFIG.yAxisValues.map((value, i) => {
              const yPos = 40 + i * 60;
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
                    {value.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Bars with score labels */}
          {dailySentimentBars.map((bar, i) => {
            const barWidth = SENTIMENT_CHART_CONFIG.barWidth;
            const barSpacing = 680 / dailySentimentBars.length;
            const x = 70 + i * barSpacing + (barSpacing - barWidth) / 2;
            const zeroY = 160; // Middle of chart (0 value) - adjusted for new scale
            const scoreHeight = Math.abs(bar.score) * 120; // Scale: 1.0 = 120px (total range 240px for -1 to 1)
            const barY = bar.score >= 0 ? zeroY - scoreHeight : zeroY;
            const barColor = getBarColor(bar.score);

            return (
              <g key={i}>
                {/* Bar */}
                <rect
                  x={x}
                  y={barY}
                  width={barWidth}
                  height={Math.max(scoreHeight, 3)}
                  fill={barColor}
                  opacity="0.85"
                  rx="3"
                  className="cursor-pointer transition-opacity"
                  style={{ opacity: hoveredBar === i ? 1 : 0.85 }}
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                />

                {/* Score label above bar */}
                <text
                  x={x + barWidth / 2}
                  y={bar.score >= 0 ? barY - 8 : barY + scoreHeight + 18}
                  textAnchor="middle"
                  fill="#374151"
                  fontSize="12"
                  fontWeight="600"
                >
                  {bar.score.toFixed(2)}
                </text>

                {/* Date label on X-axis */}
                <text
                  x={x + barWidth / 2}
                  y="325"
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
        {hoveredBar !== null && dailySentimentBars[hoveredBar] && (
          <div
            className="absolute bg-white border-2 border-blue-400 rounded-lg shadow-2xl z-30"
            style={{
              left: `${Math.min(
                Math.max(
                  70 +
                    hoveredBar * (680 / dailySentimentBars.length) +
                    680 / dailySentimentBars.length / 2 -
                    150,
                  20
                ),
                600
              )}px`,
              top: '80px',
              width: '320px',
              maxHeight: '280px',
              display: 'flex',
              flexDirection: 'column'
            }}
            onMouseEnter={() => setHoveredBar(hoveredBar)}
            onMouseLeave={() => {
              setHoveredBar(null);
              setVisibleHeadlines(DEFAULT_VISIBLE_HEADLINES);
            }}
          >
            {/* Tooltip Header - Fixed at top */}
            <div className="p-3 pb-2 border-b border-gray-200" style={{ flexShrink: 0 }}>
              <div className="text-sm font-semibold text-gray-700">
                {dailySentimentBars[hoveredBar].label}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-600">Sentiment Score:</span>
                <span
                  className={`text-sm font-bold ${
                    dailySentimentBars[hoveredBar].score >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {dailySentimentBars[hoveredBar].score.toFixed(3)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-600">Articles Analyzed:</span>
                <span className="text-sm font-semibold text-blue-600">
                  {dailySentimentBars[hoveredBar].count}
                </span>
              </div>
            </div>

            {/* Headlines List - Scrollable */}
            {dailySentimentBars[hoveredBar].headlines &&
              dailySentimentBars[hoveredBar].headlines.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1" style={{ flexShrink: 0 }}>
                    <div className="text-xs font-semibold text-gray-700">
                      Most Polar Headlines (Top{' '}
                      {Math.min(visibleHeadlines, dailySentimentBars[hoveredBar].headlines.length)})
                    </div>
                  </div>
                  <div className="px-3 overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
                    <div className="space-y-2 pb-2">
                      {dailySentimentBars[hoveredBar].headlines
                        .slice(0, visibleHeadlines)
                        .map((headline, idx) => (
                          <div key={idx} className="border-l-2 border-blue-300 pl-2 py-1">
                            <a
                              href={headline.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-800 hover:text-blue-600 hover:underline leading-snug block cursor-pointer transition-colors"
                              style={{ pointerEvents: 'auto' }}
                            >
                              {headline.title}
                            </a>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-gray-500">{headline.provider}</span>
                              <span
                                className={`text-xs font-semibold ${
                                  headline.sentiment_score >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {headline.sentiment_score >= 0 ? '+' : ''}
                                {headline.sentiment_score.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* View More Button - Fixed at bottom */}
                  {visibleHeadlines < dailySentimentBars[hoveredBar].headlines.length && (
                    <div className="p-3 pt-2 border-t border-gray-200 bg-white rounded-b-lg" style={{ flexShrink: 0 }}>
                      <button
                        onClick={() => setVisibleHeadlines((prev) => prev + 5)}
                        className="w-full py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded transition-colors"
                      >
                        View More (
                        {dailySentimentBars[hoveredBar].headlines.length - visibleHeadlines}{' '}
                        remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SentimentChart;
