import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  getExchangeTimezone,
  getTimezoneAbbreviation,
  parseExchangeTimestamp,
  parseExchangeDate,
  addDaysInTimezone
} from '../utils/formatters';
import { ChartDetailPanel } from './charts/ChartDetailPanel';
import { SentimentRegimeFills } from './charts/SentimentRegimeFills';
import { VolumeAreaChart } from './charts/VolumeAreaChart';
import {
  aggregateDataByTimeframe,
  calculateXAxisPoints,
  getChartTitle,
  getSentimentColor,
  getSentimentLabel,
  hasTimeComponent,
  type ChartDataPoint,
  type AggregatedDataPoint,
  type SentimentHeadline
} from './charts/chartDataUtils';

interface SourceEarliestDates {
  [key: string]: string;
}

interface CombinedSentimentVolumeChartProps {
  data?: ChartDataPoint[];
  timeframe?: string;
  viewMode?: 'rolling' | 'daily' | 'weekly' | 'monthly';
  hasData?: boolean;
  sourceEarliestDates?: SourceEarliestDates | null;
  exchange?: string;
  ticker?: string;
  className?: string;
}

/**
 * CombinedSentimentVolumeChart Component
 *
 * Combined chart with dual Y-axes showing both volume and sentiment:
 * - Volume: Blue area chart (left Y-axis)
 * - Sentiment: Colored line chart with dots (right Y-axis)
 * - Side Panel: Detail view for hovered/pinned data point
 *
 * Features synchronized hover indicators and accurate time display
 *
 * @param {Object} props
 * @param {Array} props.data - Data points (rolling or daily)
 * @param {string} props.timeframe - Selected timeframe (1W, 1M, etc.)
 * @param {string} props.viewMode - View mode ('rolling', 'daily', 'weekly', or 'monthly')
 * @param {boolean} props.hasData - Whether sufficient data is available
 * @param {Object} props.sourceEarliestDates - Earliest dates per source (optional)
 * @param {string} props.exchange - Stock exchange code for timezone (e.g., 'NASDAQ', 'LSE')
 * @param {string} props.ticker - Stock ticker symbol
 * @param {string} props.className - Additional CSS classes
 */
const CombinedSentimentVolumeChart: React.FC<CombinedSentimentVolumeChartProps> = ({
  data = [],
  timeframe = '1W',
  viewMode = 'rolling',
  hasData = true,
  sourceEarliestDates = null,
  exchange = 'NASDAQ',
  ticker = '',
  className = 'px-6 pb-6'
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [showAllHeadlines, setShowAllHeadlines] = useState<boolean>(false);
  const [dynamicChartWidth, setDynamicChartWidth] = useState<number>(650);
  const resetTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close pinned tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (chartRef.current && !chartRef.current.contains(event.target as Node)) {
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

  // Responsive width calculation
  useLayoutEffect(() => {
    const measure = () => {
      const el = chartContainerRef.current;
      if (!el) return;
      // Use container width minus padding for dual Y-axis labels
      const containerWidth = el.clientWidth;
      const availableWidth = containerWidth - 120; // Space for left + right Y-axis
      // Cap at max width for very large screens, min width for small screens
      const w = Math.min(1200, Math.max(300, availableWidth));
      setDynamicChartWidth(w);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);


  // Apply aggregation to data using extracted utility
  const processedData = aggregateDataByTimeframe(data, timeframe, exchange);

  // Set initial hover to the latest (last) data point with delay
  // Delay allows users time to move mouse from chart to detail panel
  useEffect(() => {
    // Clear any existing timeout
    if (resetTimeoutIdRef.current) {
      clearTimeout(resetTimeoutIdRef.current);
      resetTimeoutIdRef.current = null;
    }

    // Only auto-reset if both are null AND there's data
    if (processedData && processedData.length > 0 && hoveredIndex === null && pinnedIndex === null) {
      // Delay the reset to allow users time to move to detail panel
      const timeoutId = setTimeout(() => {
        setHoveredIndex(processedData.length - 1);
        resetTimeoutIdRef.current = null;
      }, 750); // 750ms gives users time to move mouse

      resetTimeoutIdRef.current = timeoutId;
    }

    return () => {
      if (resetTimeoutIdRef.current) {
        clearTimeout(resetTimeoutIdRef.current);
        resetTimeoutIdRef.current = null;
      }
    };
  }, [processedData, hoveredIndex, pinnedIndex]);

  // Reset "Show All Headlines" when switching data points
  useEffect(() => {
    setShowAllHeadlines(false);
  }, [hoveredIndex, pinnedIndex]);

  // Reset pinned/hovered indices when data dependencies change
  // This prevents stale indices from pointing to wrong data or out-of-range positions
  useEffect(() => {
    setPinnedIndex(null);
    setHoveredIndex(null);
  }, [timeframe, viewMode, data, exchange]);

  // Chart dimensions - SINGLE combined chart with dual Y-axis
  const topPadding = 40;
  const leftPadding = 60;
  const rightPadding = 60; // Increased for right Y-axis labels
  const bottomPadding = 50; // For X-axis labels
  const chartHeight = 400; // Taller single chart
  const chartWidth = dynamicChartWidth; // Responsive width

  // Find max volume for left Y-axis scaling
  const maxVolume = processedData.length > 0
    ? Math.max(...processedData.map(d => d.volume), 1)
    : 20;

  // Round up to next multiple of 5
  const volumeMax = Math.ceil(maxVolume / 5) * 5 || 20;

  // Sentiment axis is fixed from -1.0 to +1.0
  const sentimentMin = -1.0;
  const sentimentMax = 1.0;
  const sentimentRange = sentimentMax - sentimentMin;

  // Generate Y-axis values for volume (left) - 5 levels
  // Don't round so small volumes show distinct tick labels (e.g., 1.0, 0.8, 0.5 instead of 1, 1, 1)
  const volumeAxisValues = Array.from({ length: 5 }, (_, i) =>
    volumeMax * (1 - i / 4)
  );

  // Generate Y-axis values for sentiment (right) - 5 levels
  const sentimentAxisValues = [1.0, 0.5, 0, -0.5, -1.0];

  // Calculate zero line Y position for sentiment chart
  const zeroY = topPadding + ((sentimentMax - 0) / sentimentRange) * chartHeight;

  // Calculate step width for distributing points across chart
  // Using length-1 ensures last point aligns with right edge
  const stepWidth = chartWidth / Math.max(1, processedData.length - 1);

  // Helper function to get x-position, centering single data points
  const getXPosition = (index: number): number => {
    if (processedData.length === 1) {
      return leftPadding + (chartWidth / 2);
    }
    return leftPadding + (index * stepWidth);
  };

  // Calculate X-axis points using extracted utility
  const xAxisPoints = calculateXAxisPoints(processedData, timeframe);

  // Get chart title using extracted utility
  const chartTitle = getChartTitle(timeframe, viewMode);

  // Detail Panel Component
  interface DetailPanelDataPoint extends AggregatedDataPoint {
    timezone?: string;
  }
  const DetailPanel = ({ dataPoint }: { dataPoint: DetailPanelDataPoint | null }) => {
    if (!dataPoint) return null;

    const pointTimezone = dataPoint.timezone ? dataPoint.timezone.toUpperCase() : null;
    const isUtcPoint = pointTimezone === 'UTC';
    const exchangeTimezone = getExchangeTimezone(exchange);
    const timezone = isUtcPoint ? 'UTC' : exchangeTimezone;
    const tzAbbr = isUtcPoint ? 'UTC' : getTimezoneAbbreviation(exchange);

    const parseTimestampForPoint = (timestamp: string): Date | null => {
      if (!timestamp) return null;
      return isUtcPoint ? new Date(timestamp) : parseExchangeTimestamp(timestamp, exchange);
    };

    const formatInTimezone = (date: Date | null, options: Intl.DateTimeFormatOptions = {}): string => {
      if (!date) return '';
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone,
        ...options
      }).format(date);
    };
    
    // Determine aggregation type and format date accordingly
    const getDateDisplay = () => {
      // Detect if timestamp has time component to determine parsing method
      // Use parseExchangeTimestamp for timestamps with time (intraday/rolling),
      // parseExchangeDate for date-only timestamps (daily aggregated)
      const isIntraday = hasTimeComponent(dataPoint.timestamp || '');
      const date: Date | null = (viewMode === 'rolling' || isIntraday)
        ? parseTimestampForPoint(dataPoint.timestamp || '')
        : parseExchangeDate(dataPoint.timestamp || '', exchange);

      // Monthly aggregation for 1Y
      if (viewMode === 'monthly' || ['1Y'].includes(timeframe)) {
        return {
          title: date?.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: timezone }) ?? 'Unknown',
          subtitle: 'Monthly Average',
          isAggregated: true,
          aggregationType: 'monthly'
        };
      }

      // Weekly aggregation for 3M, 6M, YTD
      if (viewMode === 'weekly' || ['3M', '6M', 'YTD'].includes(timeframe)) {
        // Calculate week end date in exchange timezone
        const weekEnd = date ? addDaysInTimezone(date, 6, exchange) : null;
        return {
          title: `Week of ${date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone }) ?? 'Unknown'}`,
          subtitle: `${date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone }) ?? ''} - ${weekEnd?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: timezone }) ?? ''}`,
          isAggregated: true,
          aggregationType: 'weekly'
        };
      }

      // Rolling 24h window - show times in exchange timezone
      if (viewMode === 'rolling') {
        const startTime = date;
        const endTime = startTime ? new Date(startTime.getTime() + (24 * 60 * 60 * 1000)) : null;

        return {
          title: formatInTimezone(startTime, {
            timeZoneName: 'short'
          }),
          subtitle: `Rolling 24h Window (${tzAbbr})`,
          timeRange: `${formatInTimezone(startTime, { second: '2-digit', timeZoneName: 'short' })} - ${formatInTimezone(endTime, { second: '2-digit', timeZoneName: 'short' })}`,
          isAggregated: false,
          aggregationType: 'rolling'
        };
      }

      // Intraday data (hourly data points) - show time in exchange timezone
      if (isIntraday) {
        return {
          title: formatInTimezone(date, {
            timeZoneName: 'short'
          }),
          subtitle: `Intraday Data (${tzAbbr})`,
          isAggregated: false,
          aggregationType: 'intraday'
        };
      }

      // Daily data (no aggregation) - show in exchange timezone
      return {
        title: date?.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: timezone
        }) ?? 'Unknown',
        subtitle: `Daily Data (${tzAbbr})`,
        isAggregated: false,
        aggregationType: 'daily'
      };
    };

    const dateDisplay = getDateDisplay();
    const hasHeadlines = dataPoint.headlines && dataPoint.headlines.length > 0;

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="mb-4 pb-4 border-b border-gray-300">
          <h4 className="text-lg font-bold text-gray-900">
            {dateDisplay.title}
          </h4>
          <div className="text-xs text-gray-500 mt-1">
            {dateDisplay.subtitle}
          </div>
          {dateDisplay.timeRange && (
            <div className="text-xs text-gray-400 mt-1 font-mono">
              {dateDisplay.timeRange}
            </div>
          )}
          {/* Pin status indicators */}
          {pinnedIndex !== null && (
            <div className="text-xs text-blue-600 font-medium mt-2 flex items-center gap-1">
              <span>📌</span>
              <span>Pinned (click bar again to unpin)</span>
            </div>
          )}
          {pinnedIndex === null && hoveredIndex !== null && (
            <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <span>💡</span>
              <span>Click a bar to pin this view</span>
            </div>
          )}
        </div>

      {/* Metrics */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {dateDisplay.isAggregated ? 'Avg. Daily News Volume' : 'News Volume'}
          </span>
          <span className="text-2xl font-bold text-blue-600">{dataPoint.volume}</span>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">
              {dateDisplay.isAggregated ? 'Avg. Sentiment Score' : 'Sentiment Score'}
            </span>
            <span
              className="text-2xl font-bold"
              style={{ color: getSentimentColor(dataPoint.sentiment ?? 0) }}
            >
              {(dataPoint.sentiment ?? 0) >= 0 ? '+' : ''}{(dataPoint.sentiment ?? 0).toFixed(3)}
            </span>
          </div>
          <div className="flex justify-end">
            <span
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{
                backgroundColor: (dataPoint.sentiment ?? 0) >= 0.35 ? '#d1fae5' :
                                 (dataPoint.sentiment ?? 0) >= 0.15 ? '#a7f3d0' :
                                 (dataPoint.sentiment ?? 0) >= -0.15 ? '#e5e7eb' :
                                 (dataPoint.sentiment ?? 0) >= -0.35 ? '#fed7aa' :
                                 '#fecaca',
                color: (dataPoint.sentiment ?? 0) >= 0.35 ? '#065f46' :
                       (dataPoint.sentiment ?? 0) >= 0.15 ? '#047857' :
                       (dataPoint.sentiment ?? 0) >= -0.15 ? '#374151' :
                       (dataPoint.sentiment ?? 0) >= -0.35 ? '#9a3412' :
                       '#991b1b'
              }}
            >
              {getSentimentLabel(dataPoint.sentiment ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Headlines */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="mb-2">
          <h5 className="text-sm font-semibold text-gray-700">
            {dateDisplay.isAggregated ? 'Top Headlines from Period' : 'Top Headlines'} ({hasHeadlines ? dataPoint.headlines?.length ?? 0 : 0})
          </h5>
          {dateDisplay.isAggregated && hasHeadlines && (
            <p className="text-xs text-gray-500 mt-1">
              Showing top stories from this {dateDisplay.aggregationType} (ranked by impact: sentiment × relevance)
            </p>
          )}
        </div>

        {hasHeadlines && dataPoint.headlines ? (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {(showAllHeadlines ? dataPoint.headlines : dataPoint.headlines.slice(0, 10)).map((headline: SentimentHeadline, idx: number) => (
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
                    <div className="flex items-center gap-2">
                      {/* Sentiment Score */}
                      <span
                        className="font-semibold px-2 py-0.5 rounded whitespace-nowrap text-xs"
                        style={{
                          backgroundColor: (headline.sentiment_score ?? 0) >= 0.35 ? '#d1fae5' :
                                           (headline.sentiment_score ?? 0) >= 0.15 ? '#a7f3d0' :
                                           (headline.sentiment_score ?? 0) >= -0.15 ? '#e5e7eb' :
                                           (headline.sentiment_score ?? 0) >= -0.35 ? '#fed7aa' :
                                           '#fecaca',
                          color: (headline.sentiment_score ?? 0) >= 0.35 ? '#065f46' :
                                 (headline.sentiment_score ?? 0) >= 0.15 ? '#047857' :
                                 (headline.sentiment_score ?? 0) >= -0.15 ? '#374151' :
                                 (headline.sentiment_score ?? 0) >= -0.35 ? '#9a3412' :
                                 '#991b1b'
                        }}
                      >
                        Sentiment: {(headline.sentiment_score ?? 0) >= 0 ? '+' : ''}
                        {(headline.sentiment_score ?? 0).toFixed(2)}
                      </span>
                      
                      {/* Relevance Score - only show if available and non-zero */}
                      {headline.relevance_score !== undefined && headline.relevance_score !== null && headline.relevance_score > 0 && (
                        <span
                          className="font-semibold px-2 py-0.5 rounded whitespace-nowrap bg-blue-100 text-blue-800 text-xs"
                        >
                          Relevance: {headline.relevance_score.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Show More/Less Button */}
            {dataPoint.headlines && dataPoint.headlines.length > 10 && (
              <button
                onClick={() => setShowAllHeadlines(!showAllHeadlines)}
                className="mt-3 w-full py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-colors duration-150 flex items-center justify-center gap-2"
              >
                {showAllHeadlines ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Show Less
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Show More ({(dataPoint.headlines?.length ?? 0) - 10} more)
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400 p-6">
              {dateDisplay.isAggregated ? (
                <>
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm font-medium">No headlines available for this {dateDisplay.aggregationType} period</p>
                  <p className="text-xs mt-2">
                    No news articles were found during this time window.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm">No headlines available for this time window.</p>
                  <p className="text-xs mt-2">Sentiment score is calculated from aggregated article data.</p>
                </>
              )}
            </div>
          </div>
        )}
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
          Hover or click on the chart<br />to see details
        </p>
      </div>
    </div>
  );

  // No data available message - Check this FIRST to avoid infinite loading
  if (!hasData) {
    return (
      <div className={className}>
        <h3 className="text-lg font-semibold mb-4">
          {chartTitle}
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

  // Loading/empty state - Check AFTER hasData to ensure proper state display
  if (!processedData || processedData.length === 0) {
    return (
      <div className={className}>
        <h3 className="text-lg font-semibold mb-4">
          {chartTitle}
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

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-4">
        {chartTitle}
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
              Earliest dates by source: {Object.entries(sourceEarliestDates).map(([source, date]: [string, any], idx) => (
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
      <div className="flex flex-col lg:flex-row gap-6" style={{ minHeight: '400px' }} ref={chartRef}>

        {/* Left: Combined chart (2/3 on desktop, full width on mobile) */}
        <div ref={chartContainerRef} className="w-full lg:flex-[2]">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6" style={{ minHeight: '400px' }}>
            <svg className="w-full h-full" viewBox={`0 0 ${leftPadding + chartWidth + rightPadding + 10} ${topPadding + chartHeight + bottomPadding}`} preserveAspectRatio="xMidYMid meet">
              
              {/* Y-axis label (Volume - Left) */}
              <text
                x={-(topPadding + chartHeight / 2)}
                y="15"
                fill="#3b82f6"
                fontSize="12"
                fontWeight="600"
                transform="rotate(-90)"
                textAnchor="middle"
              >
                News Volume
              </text>

              {/* Y-axis label (Sentiment - Right) */}
              <text
                x={-(topPadding + chartHeight / 2)}
                y={leftPadding + chartWidth + rightPadding + 5}
                fill="#059669"
                fontSize="12"
                fontWeight="600"
                transform="rotate(-90)"
                textAnchor="middle"
              >
                Sentiment Score
              </text>

              {/* Y-axis (Volume - Left) labels and grid lines */}
              <g>
                {volumeAxisValues.map((value, i) => {
                  const yPos = topPadding + (i * (chartHeight / 4));
                  // Use intelligent formatting: decimals for small volumes, integers for large
                  const displayValue = volumeMax > 10
                    ? Math.round(value).toString()
                    : value.toFixed(1);
                  return (
                    <g key={`vol-${i}`}>
                      <line x1={leftPadding} y1={yPos} x2={leftPadding + chartWidth} y2={yPos} stroke="#e5e7eb" strokeWidth="1" />
                      <text
                        x={leftPadding - 10}
                        y={yPos + 4}
                        textAnchor="end"
                        fill="#3b82f6"
                        fontSize="11"
                        fontWeight="500"
                      >
                        {displayValue}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* Y-axis (Sentiment - Right) labels */}
              <g>
                {sentimentAxisValues.map((value, i) => {
                  const yPos = topPadding + (i * (chartHeight / 4));
                  return (
                    <text
                      key={`sent-axis-${i}`}
                      x={leftPadding + chartWidth + 10}
                      y={yPos + 4}
                      textAnchor="start"
                      fill="#059669"
                      fontSize="11"
                      fontWeight="500"
                    >
                      {value.toFixed(1)}
                    </text>
                  );
                })}
              </g>

              {/* Volume Area Chart (rendered first, as background) */}
              <VolumeAreaChart
                processedData={processedData}
                chartHeight={chartHeight}
                chartWidth={chartWidth}
                topPadding={topPadding}
                leftPadding={leftPadding}
                volumeMax={volumeMax}
                stepWidth={stepWidth}
                getXPosition={getXPosition}
              />

              {/* Sentiment Regime Color Fills */}
              <SentimentRegimeFills
                processedData={processedData}
                chartHeight={chartHeight}
                topPadding={topPadding}
                sentimentMax={sentimentMax}
                sentimentMin={sentimentMin}
                sentimentRange={sentimentRange}
                zeroY={zeroY}
                getXPosition={getXPosition}
              />

              {/* Zero reference line for sentiment */}
              <line
                x1={leftPadding}
                y1={zeroY}
                x2={leftPadding + chartWidth}
                y2={zeroY}
                stroke="#6B7280"
                strokeWidth="1.5"
                strokeDasharray="4,4"
                opacity="0.5"
                className="pointer-events-none"
              />

              {/* Sentiment Line (on top of everything) */}
              {processedData.map((point, i) => {
                if (i === 0) return null;

                const x1 = getXPosition(i - 1);
                const x2 = getXPosition(i);

                const normalizedSentiment1 = (sentimentMax - processedData[i - 1].sentiment) / sentimentRange;
                const y1 = topPadding + (normalizedSentiment1 * chartHeight);

                const normalizedSentiment2 = (sentimentMax - point.sentiment) / sentimentRange;
                const y2 = topPadding + (normalizedSentiment2 * chartHeight);

                const avgSentiment = (processedData[i - 1].sentiment + point.sentiment) / 2;

                return (
                  <line
                    key={`sent-line-${i}`}
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

              {/* Sentiment data points (circles) */}
              {processedData.map((point, i) => {
                const x = getXPosition(i);
                const normalizedSentiment = (sentimentMax - point.sentiment) / sentimentRange;
                const y = topPadding + (normalizedSentiment * chartHeight);

                return (
                  <circle
                    key={`sent-dot-${i}`}
                    cx={x}
                    cy={y}
                    r="4"
                    fill={getSentimentColor(point.sentiment)}
                    stroke="white"
                    strokeWidth="2"
                    className="pointer-events-none"
                    opacity={hoveredIndex === i || pinnedIndex === i ? 1 : 0.7}
                  />
                );
              })}

              {/* Hover/Pinned indicator line */}
              {(hoveredIndex !== null || pinnedIndex !== null) && (
                <line
                  x1={getXPosition(pinnedIndex !== null ? pinnedIndex : (hoveredIndex ?? 0))}
                  y1={topPadding}
                  x2={getXPosition(pinnedIndex !== null ? pinnedIndex : (hoveredIndex ?? 0))}
                  y2={topPadding + chartHeight}
                  stroke="#1d4ed8"
                  strokeWidth="2"
                  strokeDasharray="3,3"
                  opacity={pinnedIndex !== null ? "0.9" : "0.7"}
                  className="pointer-events-none"
                />
              )}

              {/* Invisible hover zones for interaction */}
              {processedData.map((point, i) => {
                const barWidth = Math.max(stepWidth, 10);
                const x = getXPosition(i);

                return (
                  <rect
                    key={`hover-${i}`}
                    x={x - barWidth / 2}
                    y={topPadding}
                    width={barWidth}
                    height={chartHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setPinnedIndex(pinnedIndex === i ? null : i)}
                  />
                );
              })}

              {/* X-axis labels */}
              {xAxisPoints.map((point, idx) => {
                const x = getXPosition(point.index);
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
        </div>

        {/* Right: Detail Panel (1/3 on desktop, below charts on mobile) */}
        <div className="w-full lg:flex-[1] bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-200 rounded-lg p-5 overflow-y-auto shadow-sm" style={{ minHeight: '400px', maxHeight: '600px' }}>
            {(pinnedIndex !== null && processedData[pinnedIndex]) ? (
              <DetailPanel dataPoint={processedData[pinnedIndex]} />
            ) : (hoveredIndex !== null && processedData[hoveredIndex]) ? (
              <DetailPanel dataPoint={processedData[hoveredIndex]} />
            ) : (
              <EmptyState />
            )}
          </div>

        </div>
    </div>
  );
};

export default CombinedSentimentVolumeChart;
