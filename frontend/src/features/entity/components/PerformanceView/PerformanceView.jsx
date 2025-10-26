// src/features/entity/components/PerformanceView/PerformanceView.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PriceChart,
  CombinedSentimentVolumeChart,
  TimeRangeSelector,
  ViewModeToggle,
  EventsToggle,
  OverallSentiment,
  SentimentScoreCard,
  SignificantEvents,
  RelatedNews,
  MomentumCard,
  SentimentBreadthCard,
  SentimentShockCard,
  SourceConcentrationCard,
  SentimentByTopicCard,
  NewsCoverageCard,
  SentimentConfidenceCard
} from '../../../shared/components';
import CompanyOverview from '../CompanyOverview';
import { useRollingSentiment } from '../../hooks/useRollingSentiment';
import { TIMEFRAMES } from '../../../shared/utils/constants';
import { filterPriceDataByTimeframe } from '../../../shared/utils/chartHelpers';
import { formatPrice, getPriceChangeColor, getPriceChangeArrow, formatFullTimestamp } from '../../../shared/utils/formatters';
import { calculatePriceChange } from '../../../shared/utils/chartHelpers';
import { usePriceData } from '../../hooks/usePriceData';

/**
 * PerformanceView Component
 *
 * Main performance display container with charts and controls
 */

const PerformanceView = ({
  ticker,
  companyName,
  currency,
  exchange,
  priceData1Y,
  priceData1D,
  dailySentiment,
  sentiment,
  news,
  significantEvents,
  prevClose: prevCloseFromParent,
  prevClose1D,
  activeTab = 'overview',
  setActiveTab,
  sentimentTimeframe,
  setSentimentTimeframe,
}) => {
  const [timeframe, setTimeframe] = useState('1Y');
  const [viewMode, setViewMode] = useState('rolling');
  const [priceData, setPriceData] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showEvents, setShowEvents] = useState(true);

  // Fetch data based on selected timeframe (only for 5Y, since 1D comes from parent)
  const {
    priceData1Y: timeframeSpecificData,
    prevClose: timeframeSpecificPrevClose,
    loading: timeframeLoading,
    error: timeframeError
  } = usePriceData(ticker, timeframe === '5Y' ? '5Y' : '1Y');

  // Use timeframe-specific data if available, otherwise fall back to parent data
  // Memoize to prevent reference changes that trigger re-renders
  const activePriceData = useMemo(() => {
    return timeframe === '1D'
      ? priceData1D
      : timeframe === '5Y'
        ? timeframeSpecificData
        : priceData1Y;
  }, [timeframe, priceData1D, timeframeSpecificData, priceData1Y]);

  const activePrevClose = useMemo(() => {
    return timeframe === '1D'
      ? prevClose1D
      : timeframe === '5Y'
        ? timeframeSpecificPrevClose
        : prevCloseFromParent;
  }, [timeframe, prevClose1D, timeframeSpecificPrevClose, prevCloseFromParent]);

  // Only show loading on initial page load, not on timeframe switches
  const isTimeframeSpecificLoading = isInitialLoad && timeframe === '5Y' && timeframeLoading;

  // Mark initial load as complete once we have data
  useEffect(() => {
    if (priceData1Y && priceData1Y.length > 0) {
      setIsInitialLoad(false);
    }
  }, [priceData1Y]);

  // Fetch rolling sentiment data for the combined chart
  const { data: rollingData, hasData: hasRollingData, sourceEarliestDates } = useRollingSentiment(ticker, sentimentTimeframe);

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
  const chartData = priceData.map((point, i) => ({
    x: i,
    y: parseFloat(point.close) || parseFloat(point.price) || 0,
    date: point.date,
    time: point.time
  }));

  // Calculate price changes for the selected timeframe
  const { priceChange, priceChangePercent } = calculatePriceChange(chartData);

  // Get current price from real-time 1D data (always use latest intraday price)
  const realtimeChartData = priceData1D ? priceData1D.map((point, i) => ({
    x: i,
    y: parseFloat(point.close) || parseFloat(point.price) || 0,
    date: point.date,
    time: point.time
  })) : [];
  const currentPrice = realtimeChartData.length > 0 ? realtimeChartData[realtimeChartData.length - 1] : null;

  // Check if data is loading
  const isLoading = !priceData1Y || priceData1Y.length === 0;

  // Render content based on active tab
  const renderContent = () => {
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
          <>
            {/* Combined Grid: Top & Middle Rows */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8" style={{ gridTemplateRows: 'auto 1fr' }}>
              {/* Price Summary Card - Row 1, Col 1 */}
              <div className="bg-white border border-gray-200 rounded-lg shadow p-6 lg:col-start-1 lg:row-start-1 h-full">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Current Price</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {currentPrice ? formatPrice(currentPrice.y, currency) : '--'}
                  </span>
                  <span className="text-lg font-medium text-gray-500">{currency}</span>
                </div>
                <div className={`text-sm font-medium ${getPriceChangeColor(priceChange)}`}>
                  {getPriceChangeArrow(priceChange)} {Math.abs(priceChange).toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  As of {currentPrice ? formatFullTimestamp(currentPrice.date) : 'Loading...'}
                </p>
              </div>

              {/* Sentiment Score Card - Row 1, Col 2 */}
              <div className="lg:col-start-2 lg:row-start-1 h-full">
                <SentimentScoreCard
                  sentiment={sentiment}
                  newsCount={news?.length || 0}
                  dataQuality={sentiment?.data_quality}
                  className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full"
                />
              </div>

              {/* Significant Events - Spans 2 rows, Col 3 */}
              <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2 h-full">
                <SignificantEvents
                  events={significantEvents}
                  ticker={ticker}
                  className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full flex flex-col"
                />
              </div>

              {/* Price Chart - Row 2, Spans 2 columns */}
              <div className="lg:col-start-1 lg:col-span-2 lg:row-start-2 bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-gray-900">Price Performance</h3>
                    <EventsToggle
                      showEvents={showEvents}
                      onToggle={setShowEvents}
                    />
                  </div>
                  <div className="flex space-x-2">
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                          timeframe === tf
                            ? 'bg-gray-900 text-white rounded-md'
                            : 'text-gray-600 hover:text-gray-900 bg-transparent'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <PriceChart
                  priceData={priceData}
                  ticker={ticker}
                  currency={currency}
                  exchange={exchange}
                  significantEvents={significantEvents}
                  showSignificantEvents={showEvents}
                  timeframe={timeframe}
                  prevClose={activePrevClose}
                />
              </div>
            </div>

            {/* Bottom Row: [News - Full Width] */}
            <div className="mb-8">
              <RelatedNews
                news={news}
                displayName={companyName}
                loading={!news}
                error={null}
                isOverview={true}
                onViewMore={() => setActiveTab('news')}
              />
            </div>
          </>
        );

      case 'performance':
        return (
          <div className="space-y-6">
            {/* Company Overview Section */}
            <CompanyOverview ticker={ticker} />
            
            {/* Price Performance Chart */}
            <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-semibold text-gray-900">Price Performance</h3>
                  <EventsToggle
                    showEvents={showEvents}
                    onToggle={setShowEvents}
                  />
                </div>
                <div className="flex space-x-2">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                        timeframe === tf
                          ? 'bg-gray-900 text-white rounded-md'
                          : 'text-gray-600 hover:text-gray-900 bg-transparent'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <PriceChart
                priceData={priceData}
                ticker={ticker}
                currency={currency}
                exchange={exchange}
                significantEvents={significantEvents}
                showSignificantEvents={showEvents}
                timeframe={timeframe}
                prevClose={activePrevClose}
              />
            </div>
          </div>
        );

      case 'sentiment':
        return (
          <div className="space-y-6">
            {/* Row 1: Graph Card with Filters */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Sentiment Analysis</h3>
                <div className="flex items-center space-x-4">
                  <TimeRangeSelector
                    activeTimeframe={sentimentTimeframe}
                    onTimeframeChange={setSentimentTimeframe}
                  />
                  <ViewModeToggle
                    activeMode={viewMode}
                    onModeChange={setViewMode}
                  />
                </div>
              </div>
              <CombinedSentimentVolumeChart
                data={viewMode === 'rolling' ? rollingData : Object.entries(dailySentiment || {}).map(([date, data]) => ({
                  timestamp: date,
                  label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  volume: data.count || 0,
                  sentiment: data.score || 0,
                  headlines: data.headlines || []
                }))}
                timeframe={sentimentTimeframe}
                viewMode={viewMode}
                hasData={viewMode === 'rolling' ? hasRollingData : Object.keys(dailySentiment || {}).length > 0}
                sourceEarliestDates={viewMode === 'rolling' ? sourceEarliestDates : null}
              />
            </div>

            {/* Row 2: Core Metrics (4 columns) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <SentimentScoreCard
                sentiment={sentiment}
                newsCount={news?.length || 0}
                dataQuality={sentiment?.data_quality}
              />
              <MomentumCard
                sentimentMomentum={sentiment?.sentiment_momentum}
                momentumLabel={sentiment?.momentum_label}
                momentumInterpretation={sentiment?.momentum_interpretation}
                momentumQuality={sentiment?.momentum_quality}
                fastScore={sentiment?.fast_score}
                slowScore={sentiment?.slow_score}
                halfLifeFastHours={sentiment?.half_life_fast_hours}
                halfLifeSlowHours={sentiment?.half_life_slow_hours}
              />
              <NewsCoverageCard
                effectiveNewsVolume={sentiment?.effective_news_volume}
                volumeInterpretation={sentiment?.volume_interpretation}
                dataQuality={sentiment?.data_quality}
              />
              <SentimentConfidenceCard
                sentimentVolatility={sentiment?.sentiment_volatility}
                volatilityQuality={sentiment?.volatility_quality}
                dataQuality={sentiment?.data_quality}
              />
            </div>

            {/* Row 3: Advanced Analytics (2 columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SentimentBreadthCard
                sentimentBreadthScore={sentiment?.sentiment_breadth_score}
                numBullishArticles={sentiment?.num_bullish_articles}
                numBearishArticles={sentiment?.num_bearish_articles}
                totalDirectionalArticles={sentiment?.total_directional_articles}
                breadthInterpretation={sentiment?.breadth_interpretation}
                breadthQuality={sentiment?.breadth_quality}
                avgScore={sentiment?.avg_score}
              />
              <SentimentShockCard
                sentimentZScore={sentiment?.sentiment_z_score}
                zScoreInterpretation={sentiment?.z_score_interpretation}
                zScoreHistoricalMean={sentiment?.z_score_historical_mean}
                zScoreHistoricalStd={sentiment?.z_score_historical_std}
                zScoreDaysOfHistory={sentiment?.z_score_days_of_history}
                zScoreQuality={sentiment?.z_score_quality}
                currentScore={sentiment?.slow_score}
              />
            </div>

            {/* Row 4: Source & Topic Analysis (2 columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SourceConcentrationCard
                sourceConcentrationHhi={sentiment?.sourceConcentrationHhi}
                concentrationInterpretation={sentiment?.concentrationInterpretation}
                topSources={sentiment?.topSources}
              />
              <SentimentByTopicCard
                dominantTopic={sentiment?.dominantTopic}
                dominantTopicWeight={sentiment?.dominantTopicWeight}
                dominantTopicPercentage={sentiment?.dominantTopicPercentage}
                topicCount={sentiment?.topicCount}
                sentimentByTopic={sentiment?.sentimentByTopic}
                topicWeights={sentiment?.topicWeights}
              />
            </div>
          </div>
        );

      case 'news':
        return (
          <div className="">
            <RelatedNews
                news={news}
                displayName={companyName}
                loading={!news}
                error={null}
                isOverview={false}
            />
          </div>
        );

      case 'events':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <SignificantEvents events={significantEvents} ticker={ticker} />
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Event Timeline</h3>
              <p className="text-gray-600">Detailed event timeline visualization coming soon...</p>
            </div>
          </div>
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
