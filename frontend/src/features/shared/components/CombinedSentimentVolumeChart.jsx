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

  // Helper function to get sentiment label based on score
  const getSentimentLabel = (sentiment) => {
    if (sentiment >= 0.35) return 'Bullish';
    if (sentiment >= 0.15) return 'Somewhat-Bullish';
    if (sentiment >= -0.15) return 'Neutral';
    if (sentiment >= -0.35) return 'Somewhat-Bearish';
    return 'Bearish';
  };

  // Helper function to get sentiment color based on score
  const getSentimentColor = (sentiment) => {
    if (sentiment >= 0.35) return '#10b981'; // Bullish - green-500
    if (sentiment >= 0.15) return '#34d399'; // Somewhat-Bullish - green-400
    if (sentiment >= -0.15) return '#9ca3af'; // Neutral - gray-400
    if (sentiment >= -0.35) return '#fb923c'; // Somewhat-Bearish - orange-400
    return '#ef4444'; // Bearish - red-500
  };

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
    // Adjust label density based on timeframe and data points
    if (timeframe === '1D') {
      // 24 hourly points: show every 3 hours (8 labels)
      step = 3;
    } else if (timeframe === '1W') {
      // 28 six-hourly points: show every 4th point (7 labels)
      step = 4;
    } else if (timeframe === '1M') {
      // 60 12-hourly points: show every 10th point (6 labels)
      step = 10;
    } else if (timeframe === '3M') {
      // 90 daily points: show every 15th day (6 labels)
      step = 15;
    } else if (timeframe === '6M') {
      // 180 daily points: show every 30th day (6 labels)
      step = 30;
    } else if (timeframe === 'YTD' || timeframe === '1Y') {
      // 365 daily points: show every 60th day (~6 labels)
      step = 60;
    } else if (timeframe === '5Y') {
      // 1825 daily points: show every 365th day (~5 labels)
      step = 365;
    } else {
      // Default: ~7-8 labels
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

  // Chart title based on timeframe with accurate granularity
  const getChartTitle = () => {
    const granularityMap = {
      '1D': 'Hourly',
      '1W': '6-Hourly',
      '1M': '12-Hourly',
      '3M': 'Daily',
      '6M': 'Daily',
      'YTD': 'Daily',
      '1Y': 'Daily',
      '5Y': 'Daily'
    };
    
    const windowMap = {
      '1D': '24h',
      '1W': '24h',
      '1M': '24h',
      '3M': '24h',
      '6M': '24h',
      'YTD': '24h',
      '1Y': '24h',
      '5Y': '24h'
    };

    if (viewMode === 'rolling') {
      const granularity = granularityMap[timeframe] || 'Hourly';
      const window = windowMap[timeframe] || '24h';
      return `Combined Sentiment & Volume - ${granularity} Rolling ${window} Windows`;
    } else {
      const days = timeframe === '1W' ? '7 Days' : '30 Days';
      return `Combined Sentiment & Volume - Daily Average (${timeframe}, ${days})`;
    }
  };

  // Detail Panel Component
  const DetailPanel = ({ dataPoint }) => {
    // Calculate the time window range for rolling mode
    const getTimeWindowRange = () => {
      if (viewMode !== 'rolling') {
        return null;
      }

      const endTime = new Date(dataPoint.timestamp);
      const startTime = new Date(endTime.getTime() - (24 * 60 * 60 * 1000)); // 24h window

      const formatDateTime = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
      };

      return `${formatDateTime(startTime)} - ${formatDateTime(endTime)}`;
    };

    const timeWindowRange = getTimeWindowRange();

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="mb-4 pb-4 border-b border-gray-300">
          <h4 className="text-lg font-bold text-gray-900">{dataPoint.label}</h4>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(dataPoint.timestamp).toLocaleString()}
          </div>
          {timeWindowRange && (
            <div className="text-xs text-blue-600 font-medium mt-2 bg-blue-50 px-2 py-1 rounded">
              Rolling 24h Window: {timeWindowRange}
            </div>
          )}
        </div>

      {/* Metrics */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Articles</span>
          <span className="text-2xl font-bold text-blue-600">{dataPoint.volume}</span>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Sentiment</span>
            <span 
              className="text-2xl font-bold"
              style={{ color: getSentimentColor(dataPoint.sentiment) }}
            >
              {dataPoint.sentiment >= 0 ? '+' : ''}{dataPoint.sentiment.toFixed(3)}
            </span>
          </div>
          <div className="flex justify-end">
            <span 
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{ 
                backgroundColor: dataPoint.sentiment >= 0.35 ? '#d1fae5' :
                                 dataPoint.sentiment >= 0.15 ? '#a7f3d0' :
                                 dataPoint.sentiment >= -0.15 ? '#e5e7eb' :
                                 dataPoint.sentiment >= -0.35 ? '#fed7aa' :
                                 '#fecaca',
                color: dataPoint.sentiment >= 0.35 ? '#065f46' :
                       dataPoint.sentiment >= 0.15 ? '#047857' :
                       dataPoint.sentiment >= -0.15 ? '#374151' :
                       dataPoint.sentiment >= -0.35 ? '#9a3412' :
                       '#991b1b'
              }}
            >
              {getSentimentLabel(dataPoint.sentiment)}
            </span>
          </div>
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
                <span 
                  className="font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                  style={{ 
                    backgroundColor: headline.sentiment_score >= 0.35 ? '#d1fae5' :
                                     headline.sentiment_score >= 0.15 ? '#a7f3d0' :
                                     headline.sentiment_score >= -0.15 ? '#e5e7eb' :
                                     headline.sentiment_score >= -0.35 ? '#fed7aa' :
                                     '#fecaca',
                    color: headline.sentiment_score >= 0.35 ? '#065f46' :
                           headline.sentiment_score >= 0.15 ? '#047857' :
                           headline.sentiment_score >= -0.15 ? '#374151' :
                           headline.sentiment_score >= -0.35 ? '#9a3412' :
                           '#991b1b'
                  }}
                >
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
  };

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
              {/* Left Y-axis label (Volume) - dynamic based on window size */}
              <text
                x="-250"
                y="20"
                fill="#3b82f6"
                fontSize="11"
                fontWeight="600"
                transform="rotate(-90)"
                textAnchor="middle"
              >
                Number of Articles ({
                  timeframe === '1D' ? '6h' :
                  timeframe === '1W' ? '24h' :
                  timeframe === '5Y' ? '30d' :
                  '7d'
                } Rolling Window)
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

              {/* Sentiment Line - removed single color path, will use segments */}
              {/* Draw line segments with appropriate colors */}
              {data.map((point, i) => {
                if (i === 0) return null;
                
                const x1 = leftPadding + ((i - 1) * (chartWidth / data.length)) + (chartWidth / data.length / 2);
                const x2 = leftPadding + (i * (chartWidth / data.length)) + (chartWidth / data.length / 2);
                
                const normalizedSentiment1 = (sentimentMax - data[i - 1].sentiment) / sentimentRange;
                const y1 = topPadding + (normalizedSentiment1 * chartHeight);
                
                const normalizedSentiment2 = (sentimentMax - point.sentiment) / sentimentRange;
                const y2 = topPadding + (normalizedSentiment2 * chartHeight);
                
                // Use the average sentiment of the two points to determine color
                const avgSentiment = (data[i - 1].sentiment + point.sentiment) / 2;
                
                return (
                  <line
                    key={`line-${i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={getSentimentColor(avgSentiment)}
                    strokeWidth="3"
                    className="pointer-events-none"
                  />
                );
              })}

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
                    r={(hoveredIndex === i || pinnedIndex === i) ? 6 : 4}
                    fill={getSentimentColor(point.sentiment)}
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
