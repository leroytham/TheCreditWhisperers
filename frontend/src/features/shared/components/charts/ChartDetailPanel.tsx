import React from 'react';
import { getExchangeTimezone, getTimezoneAbbreviation, parseExchangeTimestamp, parseExchangeDate } from '../../utils/formatters';
import { SENTIMENT_THRESHOLDS } from '../../../../config/constants';

interface SentimentHeadline {
  link?: string;
  title?: string;
  sentiment_score?: number;
  relevance_score?: number;
  source?: string;
  provider?: string;
}

interface DetailPanelDataPoint {
  timestamp?: string;
  date?: string;
  label?: string;
  volume: number;
  sentiment: number;
  score?: number;
  count?: number;
  headlines?: SentimentHeadline[];
  weekStart?: string;
  monthKey?: string;
  monthStart?: string;
  timezone?: string;
}

interface DateDisplay {
  title: string;
  subtitle: string;
  isAggregated: boolean;
  aggregationType: string;
}

interface ChartDetailPanelProps {
  dataPoint: DetailPanelDataPoint | null;
  exchange: string;
  timeframe: string;
  viewMode: 'rolling' | 'daily' | 'weekly' | 'monthly';
  showAllHeadlines: boolean;
  setShowAllHeadlines: (show: boolean) => void;
}

const hasTimeComponent = (timestamp: string): boolean => {
  return Boolean(timestamp && typeof timestamp === 'string' && timestamp.includes('T'));
};

const getSentimentLabel = (sentiment: number): string => {
  if (sentiment >= SENTIMENT_THRESHOLDS.BULLISH) return 'Bullish';
  if (sentiment >= SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH) return 'Somewhat-Bullish';
  if (sentiment >= SENTIMENT_THRESHOLDS.NEUTRAL_LOWER) return 'Neutral';
  if (sentiment >= SENTIMENT_THRESHOLDS.BEARISH) return 'Somewhat-Bearish';
  return 'Bearish';
};

const getSentimentColor = (sentiment: number): string => {
  if (sentiment >= SENTIMENT_THRESHOLDS.BULLISH) return '#10b981';
  if (sentiment >= SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH) return '#34d399';
  if (sentiment >= SENTIMENT_THRESHOLDS.NEUTRAL_LOWER) return '#9ca3af';
  if (sentiment >= SENTIMENT_THRESHOLDS.BEARISH) return '#fb923c';
  return '#ef4444';
};

const getHeadlineSentimentStyle = (score: number) => ({
  backgroundColor: score >= SENTIMENT_THRESHOLDS.BULLISH ? '#d1fae5' :
                   score >= SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH ? '#a7f3d0' :
                   score >= SENTIMENT_THRESHOLDS.NEUTRAL_LOWER ? '#e5e7eb' :
                   score >= SENTIMENT_THRESHOLDS.BEARISH ? '#fed7aa' :
                   '#fecaca',
  color: score >= SENTIMENT_THRESHOLDS.BULLISH ? '#065f46' :
         score >= SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH ? '#047857' :
         score >= SENTIMENT_THRESHOLDS.NEUTRAL_LOWER ? '#374151' :
         score >= SENTIMENT_THRESHOLDS.BEARISH ? '#9a3412' :
         '#991b1b'
});

export const ChartDetailPanel: React.FC<ChartDetailPanelProps> = ({
  dataPoint,
  exchange,
  timeframe,
  viewMode,
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

  const formatInTimezone = (date: Date | null): string => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(date);
  };

  const getDateDisplay = (): DateDisplay => {
    const isIntraday = hasTimeComponent(dataPoint.timestamp || '');
    const date: Date | null = (viewMode === 'rolling' || isIntraday)
      ? parseTimestampForPoint(dataPoint.timestamp || '')
      : parseExchangeDate(dataPoint.timestamp || '', exchange);

    if (viewMode === 'monthly' || ['1Y'].includes(timeframe)) {
      return {
        title: date?.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: timezone }) ?? 'Unknown',
        subtitle: 'Monthly Average',
        isAggregated: true,
        aggregationType: 'monthly'
      };
    }

    if (viewMode === 'weekly' || ['3M', '6M', 'YTD'].includes(timeframe)) {
      const weekStart = date;
      const weekEnd = weekStart ? new Date(weekStart.getTime() + (6 * 24 * 60 * 60 * 1000)) : null;
      const formatDate = (d: Date | null) => d?.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: timezone
      }) ?? '';
      return {
        title: `${formatDate(weekStart)} - ${formatDate(weekEnd)}`,
        subtitle: 'Weekly Average',
        isAggregated: true,
        aggregationType: 'weekly'
      };
    }

    if (viewMode === 'rolling') {
      return {
        title: formatInTimezone(date),
        subtitle: `Rolling 24h Window (${tzAbbr})`,
        isAggregated: false,
        aggregationType: 'rolling'
      };
    }

    return {
      title: date?.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
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
  const headlinesToShow = showAllHeadlines
    ? dataPoint.headlines
    : dataPoint.headlines?.slice(0, 10);

  return (
    <div className="w-full lg:flex-[1] bg-white border border-gray-200 rounded-lg shadow-sm p-6" style={{ minHeight: '400px' }}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4 mb-4">
          <p className="text-base font-semibold text-gray-900">{dateDisplay.title}</p>
          <p className="text-sm text-gray-500">{dateDisplay.subtitle}</p>
        </div>

        {/* Sentiment Summary */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Sentiment</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: getSentimentColor(dataPoint.sentiment) }}
              />
              <span className="font-semibold text-gray-900">
                {getSentimentLabel(dataPoint.sentiment)}
              </span>
              <span className="text-gray-500 text-sm">
                ({dataPoint.sentiment >= 0 ? '+' : ''}{dataPoint.sentiment.toFixed(2)})
              </span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Volume</p>
            <p className="font-semibold text-gray-900 mt-1">
              {dataPoint.volume} article{dataPoint.volume !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Headlines */}
        {headlinesToShow && headlinesToShow.length > 0 ? (
          <>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              Top Headlines ({dataPoint.headlines?.length ?? 0})
            </p>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2" style={{ maxHeight: '280px' }}>
              {headlinesToShow.map((headline: SentimentHeadline, idx: number) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
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
                      <span
                        className="font-semibold px-2 py-0.5 rounded whitespace-nowrap text-xs"
                        style={getHeadlineSentimentStyle(headline.sentiment_score ?? 0)}
                      >
                        Sentiment: {(headline.sentiment_score ?? 0) >= 0 ? '+' : ''}
                        {(headline.sentiment_score ?? 0).toFixed(2)}
                      </span>
                      {headline.relevance_score !== undefined && headline.relevance_score > 0 && (
                        <span className="font-semibold px-2 py-0.5 rounded whitespace-nowrap bg-blue-100 text-blue-800 text-xs">
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
                  <p className="text-xs mt-2">No news articles were found during this time window.</p>
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

export default ChartDetailPanel;
