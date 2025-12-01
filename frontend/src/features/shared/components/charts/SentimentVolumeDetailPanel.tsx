import React from 'react';
import {
  getExchangeTimezone,
  getTimezoneAbbreviation,
  parseExchangeTimestamp,
  parseExchangeDate,
  addDaysInTimezone
} from '../../utils/formatters';
import {
  getSentimentColor,
  getSentimentLabel,
  hasTimeComponent,
  type AggregatedDataPoint,
  type SentimentHeadline
} from './chartDataUtils';

interface DetailPanelDataPoint extends AggregatedDataPoint {
  timezone?: string;
}

interface SentimentVolumeDetailPanelProps {
  dataPoint: DetailPanelDataPoint | null;
  exchange: string;
  viewMode: 'rolling' | 'daily' | 'weekly' | 'monthly';
  timeframe: string;
  pinnedIndex: number | null;
  hoveredIndex: number | null;
  showAllHeadlines: boolean;
  setShowAllHeadlines: (show: boolean) => void;
}

/**
 * Detail panel for displaying sentiment/volume data point information.
 *
 * Extracted from CombinedSentimentVolumeChart for better modularity.
 * Shows date, metrics, and headlines for the selected data point.
 */
export const SentimentVolumeDetailPanel: React.FC<SentimentVolumeDetailPanelProps> = ({
  dataPoint,
  exchange,
  viewMode,
  timeframe,
  pinnedIndex,
  hoveredIndex,
  showAllHeadlines,
  setShowAllHeadlines
}) => {
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

export default SentimentVolumeDetailPanel;
