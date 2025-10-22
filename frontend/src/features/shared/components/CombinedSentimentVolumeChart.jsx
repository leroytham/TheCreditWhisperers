import React, { useState, useRef, useEffect } from 'react';

/**
 * CombinedSentimentVolumeChart Component
 *
 * Dual-axis chart showing both news volume (bars) and sentiment (line overlay)
 * with a side detail panel for hover and click interactions
 *
 * Left Y-axis: Article count (volume)
 * Right Y-axis: Sentiment score (-1.0 to +1.0)
 * Right Side Panel: Detail view when hovering or clicking on bars
 *
 * @param {Object} props
 * @param {Array} props.data - Data points (rolling or daily)
 * @param {string} props.timeframe - Selected timeframe (1W, 1M)
 * @param {string} props.viewMode - View mode ('rolling' or 'daily')
 * @param {boolean} props.hasData - Whether sufficient data is available
 * @param {Object} props.sourceEarliestDates - Earliest dates per source (optional)
 * @param {string} props.className - Additional CSS classes
 */
const CombinedSentimentVolumeChart = ({
  data = [],
  timeframe = '1W',
  viewMode = 'rolling',
  hasData = true,
  sourceEarliestDates = null,
  className = 'px-6 pb-6'
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [pinnedIndex, setPinnedIndex] = useState(null);
  const chartRef = useRef(null);

  // Handle click outside to close pinned tooltip
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chartRef.current && !chartRef.current.contains(event.target)) {
        setPinnedIndex(null);
      }
    };

    if (pinnedIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [pinnedIndex]);

  // Chart dimensions - adjusted for side panel layout (2/3 and 1/3 split)
  const topPadding = 50;
  const leftPadding = 60;
  const rightPadding = 40;
  const chartHeight = 400;
  const chartWidth = 650;  // Increased to fit 2/3 layout

  // Find max volume for left Y-axis scaling
  const maxVolume = data.length > 0
    ? Math.max(...data.map(d => d.volume), 1)
    : 20;

  // Round up to next multiple of 5
  const volumeMax = Math.ceil(maxVolume / 5) * 5 || 20;

  // Sentiment axis is fixed from -1.0 to +1.0
  const sentimentMin = -1.0;
  const sentimentMax = 1.0;
  const sentimentRange = sentimentMax - sentimentMin;

  // Generate Y-axis values for volume (left) - 5 levels
  const volumeAxisValues = Array.from({ length: 5 }, (_, i) =>
    Math.round(volumeMax * (1 - i / 4))
  );

  // Generate Y-axis values for sentiment (right) - 5 levels
  const sentimentAxisValues = [1.0, 0.5, 0, -0.5, -1.0];

  // Calculate zero line Y position for sentiment
  const zeroY = topPadding + ((sentimentMax - 0) / sentimentRange) * chartHeight;

  // Determine number of X-axis labels based on timeframe and data length
  const getXAxisPoints = () => {
    if (!data || data.length === 0) return [];

    let step;
    if (timeframe === '1W') {
      // Show every 24th point (once per day) for 168 hourly points
      step = 24;
    } else if (timeframe === '1M') {
      // Show ~8-10 labels for 120 six-hourly points
      step = Math.max(1, Math.floor(data.length / 8));
    } else {
      // Default: show ~7 labels
      step = Math.max(1, Math.floor(data.length / 7));
    }

    const points = [];
    for (let i = 0; i < data.length; i += step) {
      points.push({
        index: i,
        label: data[i].label
      });
    }

    // Always include the last point
    if (points.length > 0 && points[points.length - 1].index !== data.length - 1) {
      points.push({
        index: data.length - 1,
        label: data[data.length - 1].label
      });
    }

    return points;
  };

  const xAxisPoints = getXAxisPoints();

  // Chart title based on view mode
  const getChartTitle = () => {
    if (viewMode === 'rolling') {
      const granularity = timeframe === '1W' ? 'Hourly' : '6-Hourly';
      return `Combined Sentiment & Volume - Rolling 24h Windows (${timeframe}, ${granularity})`;
    } else {
      const days = timeframe === '1W' ? '7 Days' : '30 Days';
      return `Combined Sentiment & Volume - Daily Average (${timeframe}, ${days})`;
    }
  };

  // Detail Panel Component
  const DetailPanel = ({ dataPoint }) => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 pb-4 border-b border-gray-300">
        <h4 className="text-lg font-bold text-gray-900">{dataPoint.label}</h4>
        <div className="text-xs text-gray-500 mt-1">
          {new Date(dataPoint.timestamp).toLocaleString()}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Articles</span>
          <span className="text-2xl font-bold text-blue-600">{dataPoint.volume}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Sentiment</span>
          <span className={`text-2xl font-bold ${
            dataPoint.sentiment >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {dataPoint.sentiment >= 0 ? '+' : ''}{dataPoint.sentiment.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Headlines */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <h5 className="text-sm font-semibold text-gray-700 mb-2">
          Top Headlines ({dataPoint.headlines.length})
        </h5>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {dataPoint.headlines.map((headline, idx) => (
            <div key={idx} className="border-l-4 border-blue-400 pl-3 py-2 bg-white rounded-r shadow-sm">
              <a
                href={headline.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-800 hover:text-blue-600 font-medium block mb-1 line-clamp-3 leading-tight"
              >
                {headline.title}
              </a>
              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-gray-500 truncate mr-2">{headline.provider}</span>
                <span className={`font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                  headline.sentiment_score >= 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {headline.sentiment_score >= 0 ? '+' : ''}
                  {headline.sentiment_score.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Empty State Component
  const EmptyState = () => (
    <div className="h-full flex items-center justify-center text-center px-4">
      <div>
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm text-gray-500 font-medium">
          Hover or click on a bar<br />to see details
        </p>
      </div>
    </div>
  );

  // Loading/empty state
  if (!data || data.length === 0) {
    return (
      <div className={className}>
        <h3 className="text-lg font-semibold mb-4">
          {getChartTitle()}
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6" style={{ minHeight: '500px' }}>
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div>Loading combined data...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No data available message
  if (!hasData) {
    return (
      <div className={className}>
        <h3 className="text-lg font-semibold mb-4">
          {getChartTitle()}
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6" style={{ minHeight: '500px' }}>
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">No Data Available</h4>
              <p className="text-sm text-gray-500">
                News data for the {timeframe} timeframe is not available.
                <br />
                Try selecting a shorter timeframe.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-4">
        {getChartTitle()}
      </h3>
      
      {/* Source Coverage Notice */}
      {sourceEarliestDates && Object.keys(sourceEarliestDates).length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <span className="font-semibold">Data Coverage Notice:</span> News sources have varying coverage depths. 
              Earliest dates by source: {Object.entries(sourceEarliestDates).map(([source, date], idx) => (
                <span key={source}>
                  {idx > 0 && ', '}
                  <span className="font-medium">{source}</span>: {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Flex container: Chart (2/3) + Detail Panel (1/3) */}
      <div className="flex flex-col lg:flex-row gap-6" style={{ minHeight: '500px' }} ref={chartRef}>

        {/* Left: Chart Area (2/3 on desktop, full width on mobile) */}
        <div className="w-full lg:flex-[2] bg-white border border-gray-200 rounded-lg shadow-sm p-6" style={{ height: '450px' }}>
            <svg className="w-full h-full" viewBox={`0 0 ${leftPadding + chartWidth + rightPadding} ${topPadding + chartHeight + 50}`} preserveAspectRatio="xMidYMid meet">
              {/* Left Y-axis label (Volume) */}
              <text
                x="-250"
                y="20"
                fill="#3b82f6"
                fontSize="11"
                fontWeight="600"
                transform="rotate(-90)"
                textAnchor="middle"
              >
                Number of Articles (24h Rolling Window)
              </text>

              {/* Right Y-axis label (Sentiment) */}
              <text
                x="-250"
                y={leftPadding + chartWidth + rightPadding - 10}
                fill="#059669"
                fontSize="11"
                fontWeight="600"
                transform="rotate(-90)"
                textAnchor="middle"
              >
                Average Sentiment Score
              </text>

              {/* Left Y-axis (Volume) labels and grid lines */}
              <g>
                {volumeAxisValues.map((value, i) => {
                  const yPos = topPadding + (i * (chartHeight / 4));
                  return (
                    <g key={`vol-${i}`}>
                      <line x1={leftPadding} y1={yPos} x2={leftPadding + chartWidth} y2={yPos} stroke="#e5e7eb" strokeWidth="1" />
                      <text
                        x={leftPadding - 10}
                        y={yPos + 4}
                        textAnchor="end"
                        fill="#3b82f6"
                        fontSize="12"
                        fontWeight="500"
                      >
                        {value}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* Right Y-axis (Sentiment) labels */}
              <g>
                {sentimentAxisValues.map((value, i) => {
                  const yPos = topPadding + (i * (chartHeight / 4));
                  return (
                    <text
                      key={`sent-${i}`}
                      x={leftPadding + chartWidth + 10}
                      y={yPos + 4}
                      textAnchor="start"
                      fill="#059669"
                      fontSize="12"
                      fontWeight="500"
                    >
                      {value.toFixed(1)}
                    </text>
                  );
                })}
              </g>

              {/* Zero line for sentiment */}
              <line
                x1={leftPadding}
                y1={zeroY}
                x2={leftPadding + chartWidth}
                y2={zeroY}
                stroke="#6b7280"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.5"
              />

              {/* Volume Bars */}
              {data.map((point, i) => {
                const barWidth = Math.max(chartWidth / data.length - 2, 2);
                const x = leftPadding + (i * (chartWidth / data.length));

                // Calculate bar height based on volume
                const barHeight = point.volume > 0
                  ? (point.volume / volumeMax) * chartHeight
                  : 0;
                const barY = topPadding + chartHeight - barHeight;

                return (
                  <rect
                    key={`bar-${i}`}
                    x={x}
                    y={barY}
                    width={barWidth}
                    height={Math.max(barHeight, 1)}
                    fill="#3b82f6"
                    opacity={(hoveredIndex === i || pinnedIndex === i) ? 0.9 : 0.6}
                    stroke={(hoveredIndex === i || pinnedIndex === i) ? '#1d4ed8' : 'none'}
                    strokeWidth="2"
                    rx="1"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setPinnedIndex(pinnedIndex === i ? null : i)}
                  />
                );
              })}

              {/* Sentiment Line */}
              <path
                d={data.map((point, i) => {
                  const x = leftPadding + (i * (chartWidth / data.length)) + (chartWidth / data.length / 2);
                  const normalizedSentiment = (sentimentMax - point.sentiment) / sentimentRange;
                  const y = topPadding + (normalizedSentiment * chartHeight);
                  return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                }).join(' ')}
                stroke="#10b981"
                strokeWidth="2.5"
                fill="none"
                className="pointer-events-none"
              />

              {/* Sentiment Line Points */}
              {data.map((point, i) => {
                const x = leftPadding + (i * (chartWidth / data.length)) + (chartWidth / data.length / 2);
                const normalizedSentiment = (sentimentMax - point.sentiment) / sentimentRange;
                const y = topPadding + (normalizedSentiment * chartHeight);

                return (
                  <circle
                    key={`point-${i}`}
                    cx={x}
                    cy={y}
                    r={(hoveredIndex === i || pinnedIndex === i) ? 5 : 3}
                    fill={point.sentiment >= 0 ? '#10b981' : '#ef4444'}
                    stroke="white"
                    strokeWidth="2"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setPinnedIndex(pinnedIndex === i ? null : i)}
                  />
                );
              })}

              {/* X-axis labels */}
              {xAxisPoints.map((point, idx) => {
                const x = leftPadding + (point.index * (chartWidth / data.length)) + (chartWidth / data.length / 2);
                return (
                  <text
                    key={`x-label-${idx}`}
                    x={x}
                    y={topPadding + chartHeight + 25}
                    textAnchor="middle"
                    fill="#374151"
                    fontSize="11"
                    fontWeight="500"
                  >
                    {point.label}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Right: Detail Panel (1/3 on desktop, below chart on mobile) */}
          <div className="w-full lg:flex-[1] bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-200 rounded-lg p-5 overflow-y-auto shadow-sm" style={{ height: '450px' }}>
            {(pinnedIndex !== null && data[pinnedIndex]) ? (
              <DetailPanel dataPoint={data[pinnedIndex]} />
            ) : (hoveredIndex !== null && data[hoveredIndex]) ? (
              <DetailPanel dataPoint={data[hoveredIndex]} />
            ) : (
              <EmptyState />
            )}
          </div>

        </div>
    </div>
  );
};

export default CombinedSentimentVolumeChart;
