// src/features/entity/components/PerformanceView/PerformanceView.tsx

import React, { useState, useEffect, useMemo } from 'react';
import type { ViewModeType } from '../../../shared/components/ViewModeToggle';
import { useRollingSentiment } from '../../hooks/useRollingSentiment';
import { filterPriceDataByTimeframe, calculatePriceChange } from '../../../shared/utils/chartHelpers';
import { OverviewTab, SentimentTab, NewsTab, PerformanceTab } from './tabs';
import type {
  PriceDataPoint,
  DailySentimentPoint,
  NewsArticle,
  SignificantEvent,
  ApiMetadata,
  TimeframeOption
} from '../../../../types';

// DisplayEvent type expected by PriceChart
interface DisplayEvent {
  start_date: string;
  trend: string;
  total_move_pct?: number;
  link?: string;
  url?: string;
  news?: NewsArticle[];
  title?: string;
  description?: string;
}

// Map SignificantEvent to DisplayEvent for PriceChart compatibility
const mapToDisplayEvents = (events: SignificantEvent[] | null): DisplayEvent[] => {
  if (!events) return [];
  return events.map(event => ({
    start_date: event.start_date,
    trend: event.trend,
    total_move_pct: event.total_move_pct,
    title: event.title,
    description: event.description,
  }));
};

/**
 * PerformanceView Component
 *
 * Main performance display container with charts and controls
 */

interface SentimentData {
  avg_score?: number;
  sentiment_momentum?: number;
  fast_score?: number;
  slow_score?: number;
  momentum_label?: string;
  momentum_interpretation?: string;
  momentum_quality?: string;
  momentum_direction?: string;
  momentum_strength?: number;
  half_life_fast_hours?: number;
  half_life_slow_hours?: number;
  sentiment_volatility?: number;
  volatility_quality?: string;
  effective_news_volume?: number;
  volume_interpretation?: string;
  sentiment_breadth_score?: number;
  num_bullish_articles?: number;
  num_bearish_articles?: number;
  total_directional_articles?: number;
  breadth_interpretation?: string;
  breadth_quality?: string;
  sentiment_z_score?: number;
  z_score_interpretation?: string;
  z_score_historical_mean?: number;
  z_score_historical_std?: number;
  z_score_days_of_history?: number;
  z_score_quality?: string;
  sourceConcentrationHhi?: number;
  concentrationInterpretation?: string;
  topSources?: Array<{ source: string; count: number }>;
  dominantTopic?: string;
  dominantTopicWeight?: number;
  dominantTopicPercentage?: number;
  topicCount?: number;
  sentimentByTopic?: Record<string, number>;
  topicWeights?: Record<string, number>;
  data_quality?: string;
}

interface PerformanceViewProps {
  ticker: string;
  companyName: string;
  currency: string;
  exchange: string;
  priceData1Y: PriceDataPoint[] | null;
  priceData1D: PriceDataPoint[] | null;
  priceLoading1Y: boolean;
  priceError1Y: string | null;
  priceLoading1D: boolean;
  priceError1D: string | null;
  lastFetched?: Date | null;
  dailySentiment: Record<string, DailySentimentPoint> | null;
  dailySentimentLoading: boolean;
  dailySentimentError: string | null;
  sentiment: SentimentData | null;
  news: NewsArticle[] | null;
  newsLoading: boolean;
  newsError: string | null;
  apiMetadata?: ApiMetadata;
  significantEvents: SignificantEvent[] | null;
  significantEventsLoading: boolean;
  significantEventsError: string | null;
  prevClose?: number | null;
  prevClose1D?: number | null;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  sentimentTimeframe: TimeframeOption | string;
  setSentimentTimeframe: (tf: TimeframeOption | string) => void;
  priceTimeframe: TimeframeOption | string;
  setPriceTimeframe: (tf: TimeframeOption | string) => void;
}

const PerformanceView: React.FC<PerformanceViewProps> = ({
  ticker,
  companyName,
  currency,
  exchange,
  priceData1Y,
  priceData1D,
  priceLoading1Y,
  priceError1Y,
  priceLoading1D,
  priceError1D,
  lastFetched,
  dailySentiment,
  dailySentimentLoading,
  dailySentimentError,
  sentiment,
  news,
  newsLoading,
  newsError,
  apiMetadata,
  significantEvents,
  significantEventsLoading,
  significantEventsError,
  prevClose: prevCloseFromParent,
  prevClose1D,
  activeTab = 'overview',
  setActiveTab,
  sentimentTimeframe,
  setSentimentTimeframe,
  priceTimeframe,
  setPriceTimeframe,
}) => {
  const timeframe = priceTimeframe; // Use prop instead of local state
  const setTimeframe = setPriceTimeframe; // Use prop setter instead of local state
  const [viewMode, setViewMode] = useState<ViewModeType>('rolling');
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [showSignificantEvents, setShowSignificantEvents] = useState<boolean>(true);
  const [selectedEventDate, setSelectedEventDate] = useState<string | null>(null);

  // Handle event click from PriceChart
  const handleEventClick = (event: SignificantEvent | { start_date?: string }) => {
    if ('start_date' in event && event.start_date) {
      setSelectedEventDate(event.start_date);
    } else if ('date' in event && (event as SignificantEvent).date) {
      setSelectedEventDate((event as SignificantEvent).date ?? null);
    }
  };

  // Auto-switch view mode based on timeframe
  useEffect(() => {
    // For 1Y: force to 'monthly' (monthly aggregation, both rolling/daily disabled)
    if (['1Y'].includes(sentimentTimeframe)) {
      setViewMode('monthly');
    }
    // For 3M, 6M, YTD: force to 'weekly' (weekly aggregation, rolling disabled)
    else if (['3M', '6M', 'YTD'].includes(sentimentTimeframe)) {
      setViewMode('weekly');
    }
    // For 1D, 1W, 1M: default to rolling if currently on monthly/weekly
    else if (['monthly', 'weekly'].includes(viewMode)) {
      setViewMode('rolling');
    }
    // For 1D, 1W, 1M: allow both rolling and daily modes (no forced change)
  }, [sentimentTimeframe, viewMode]);

  // Use timeframe-specific data and loading states from parent
  // Memoize to prevent reference changes that trigger re-renders
  const activePriceData = useMemo(() => {
    return timeframe === '1D'
      ? priceData1D
        : priceData1Y;
  }, [timeframe, priceData1D, priceData1Y]);

  const activePrevClose = useMemo(() => {
    return timeframe === '1D'
      ? prevClose1D
        : prevCloseFromParent;
  }, [timeframe, prevClose1D, prevCloseFromParent]);

  // Determine active loading state based on current timeframe
  const activeLoading = timeframe === '1D' ? priceLoading1D : priceLoading1Y;

  // Only show loading on initial page load, not on timeframe switches
  const isTimeframeSpecificLoading = isInitialLoad && activeLoading;

  // Mark initial load as complete once we have data
  useEffect(() => {
    if (priceData1Y && priceData1Y.length > 0) {
      setIsInitialLoad(false);
    }
  }, [priceData1Y]);

  // Fetch rolling sentiment data for the combined chart (only when viewing sentiment tab)
  const shouldFetchRollingSentiment = activeTab === 'sentiment';
  const { data: rollingData, hasData: hasRollingData, loading: sentimentLoading, error: sentimentError, sourceEarliestDates } = useRollingSentiment(
    shouldFetchRollingSentiment ? ticker : null,
    sentimentTimeframe
  );

  // Filter price data based on timeframe
  // FIXED: Only depend on activePriceData and timeframe to prevent infinite loop
  // Removed timeframeLoading, timeframeError from dependencies as they change on every poll
  useEffect(() => {
    if (!activePriceData || activePriceData.length === 0) {
      setPriceData([]);
      return;
    }

    const filtered = filterPriceDataByTimeframe(activePriceData, timeframe);
    setPriceData(filtered);
  }, [activePriceData, timeframe]);

  // Create chart data from price data
  const chartData = priceData.map((point, i) => {
    // Use explicit checks with NaN handling to correctly handle 0 values
    const closeValue = point.close !== undefined && point.close !== null ? Number(point.close) : NaN;
    const priceValue = point.price !== undefined && point.price !== null ? Number(point.price) : NaN;

    return {
      x: i,
      y: !isNaN(closeValue) ? closeValue : (!isNaN(priceValue) ? priceValue : 0),
      date: point.date,
      time: point.time,
      volume: point.volume ?? 0,
      index: i
    };
  });

  // Calculate price changes for the selected timeframe
  const { priceChange, priceChangePercent } = calculatePriceChange(chartData);

  // Get current price from real-time 1D data (always use latest intraday price)
  const realtimeChartData = priceData1D ? priceData1D.map((point, i) => {
    // Use explicit checks with NaN handling to correctly handle 0 values
    const closeValue = point.close !== undefined && point.close !== null ? Number(point.close) : NaN;
    const priceValue = point.price !== undefined && point.price !== null ? Number(point.price) : NaN;

    return {
      x: i,
      y: !isNaN(closeValue) ? closeValue : (!isNaN(priceValue) ? priceValue : 0),
      date: point.date,
      time: point.time
    };
  }) : [];

  // Current price with fallback to 1Y data if 1D unavailable
  const currentPrice = useMemo(() => {
    // Try 1D real-time data first
    if (realtimeChartData.length > 0) {
      return {
        ...realtimeChartData[realtimeChartData.length - 1],
        isRealtime: true,
        isEstimate: false
      };
    }
    // Fall back to 1Y last close if 1D unavailable
    if (priceData1Y && priceData1Y.length > 0) {
      const lastClose = priceData1Y[priceData1Y.length - 1];
      return {
        x: priceData1Y.length - 1,
        y: Number(lastClose.close) || Number(lastClose.price) || 0,
        date: lastClose.date,
        time: lastClose.time,
        isRealtime: false,
        isEstimate: true
      };
    }
    return null;
  }, [realtimeChartData, priceData1Y]);

  // Check if data is loading using actual loading states
  const isLoading = priceLoading1Y || priceLoading1D;

  // Render content based on active tab
  const renderContent = () => {
    // Split error detection for graceful degradation
    const hasPrice1YError = priceError1Y && !priceLoading1Y;
    const hasPrice1DError = priceError1D && !priceLoading1D;
    const hasPartialPriceData = ((priceData1Y?.length ?? 0) > 0) || ((priceData1D?.length ?? 0) > 0);

    // Show full error only when BOTH feeds fail AND no partial data available
    if ((hasPrice1YError && hasPrice1DError) && !hasPartialPriceData) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-md">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-lg font-medium text-gray-900 mb-2">Failed to Load Price Data</div>
            <div className="text-sm text-gray-600 mb-4">{priceError1Y || priceError1D}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    // Show loading for initial data or timeframe-specific data
    if (isLoading || isTimeframeSpecificLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <div className="text-lg font-medium text-gray-700">Loading {timeframe} data...</div>
            <div className="text-sm text-gray-500 mt-2">Please wait while we fetch the latest information</div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            priceData={priceData}
            currentPrice={currentPrice}
            priceChange={priceChange}
            priceChangePercent={priceChangePercent}
            currency={currency}
            exchange={exchange}
            ticker={ticker}
            companyName={companyName}
            hasPrice1DError={!!hasPrice1DError}
            hasPrice1YError={!!hasPrice1YError}
            sentiment={sentiment}
            news={news ?? []}
            newsLoading={newsLoading}
            newsError={newsError}
            significantEvents={significantEvents}
            significantEventsLoading={significantEventsLoading}
            significantEventsError={significantEventsError}
            showSignificantEvents={showSignificantEvents}
            setShowSignificantEvents={setShowSignificantEvents}
            selectedEventDate={selectedEventDate}
            handleEventClick={handleEventClick}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            activePrevClose={activePrevClose ?? null}
            setActiveTab={setActiveTab}
            mapToDisplayEvents={mapToDisplayEvents}
          />
        );

      case 'performance':
        return (
          <PerformanceTab
            priceData={priceData}
            ticker={ticker}
            currency={currency}
            exchange={exchange}
            significantEvents={significantEvents}
            showSignificantEvents={showSignificantEvents}
            setShowSignificantEvents={setShowSignificantEvents}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            activePrevClose={activePrevClose ?? null}
            handleEventClick={handleEventClick}
            mapToDisplayEvents={mapToDisplayEvents}
          />
        );

      case 'sentiment':
        return (
          <SentimentTab
            viewMode={viewMode}
            setViewMode={setViewMode}
            sentimentTimeframe={sentimentTimeframe}
            setSentimentTimeframe={setSentimentTimeframe}
            rollingData={rollingData}
            hasRollingData={hasRollingData}
            sentimentLoading={sentimentLoading}
            sentimentError={sentimentError}
            sourceEarliestDates={sourceEarliestDates}
            dailySentiment={dailySentiment}
            dailySentimentLoading={dailySentimentLoading}
            dailySentimentError={dailySentimentError}
            sentiment={sentiment}
            news={news}
            newsLoading={newsLoading}
            newsError={newsError}
            exchange={exchange}
            ticker={ticker}
          />
        );

      case 'news':
        return (
          <NewsTab
            news={news}
            companyName={companyName}
            ticker={ticker}
            newsLoading={newsLoading}
            newsError={newsError}
            apiMetadata={apiMetadata}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Tab Content */}
      {renderContent()}
    </div>
  );
};

export default PerformanceView;
