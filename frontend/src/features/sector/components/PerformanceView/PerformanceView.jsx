// src/features/sector/components/PerformanceView/PerformanceView.jsx

import React, { useState, useEffect } from 'react';
import { resolveSectorTicker } from '../../utils/tickerResolver';
import { useSectorData } from '../../hooks/useSectorData';
import { usePriceData } from '../../hooks/usePriceData';
import { usePriceData as useEntityPriceData } from '../../../entity/hooks/usePriceData';
import { useRollingSentiment } from '../../../entity/hooks/useRollingSentiment';
import { TIMEFRAMES } from '../../../shared/utils/constants';
import {
  PriceChart,
  CombinedSentimentVolumeChart,
  TimeRangeSelector,
  ViewModeToggle,
  SignificantEvents,
  RelatedNews,
  DetailedRelatedNews,
  OverallSentiment,
  SentimentScoreCard,
  MomentumCard,
  NewsCoverageCard,
  SentimentConfidenceCard,
  SentimentBreadthCard,
  SentimentShockCard,
  SourceConcentrationCard,
  SentimentByTopicCard,
  TickerCoverageCard
} from '../../../shared/components';
import { formatFullTimestamp } from '../../../shared/utils/formatters';
import PerformanceHeader from './PerformanceHeader';
import TopConstituents from './TopConstituents';

/**
 * PerformanceView components - orchestrates the sector performance dashboard
 */
const PerformanceView = ({ context, onBack, activeTab = 'overview', setActiveTab }) => {
  const countryCode = context?.countryCode || '';
  const countryName = context?.countryName || '';
  const sector = context?.sector || null;
  const sectorName = sector?.name || '';
  const indexName = sector?.index || '';

  const [timeframe, setTimeframe] = useState('1M');
  const [showEvents, setShowEvents] = useState(true);
  const [sentimentTimeframe, setSentimentTimeframe] = useState('1M');
  const [viewMode, setViewMode] = useState('rolling');

  // Auto-switch view mode based on timeframe
  // For sectors, all timeframes (1D, 1W, 1M) support both rolling and daily modes
  // No forced switching needed
  useEffect(() => {
    // Sectors use exponential decay with 1M data fetch for all timeframes
    // All timeframes support both rolling 24h windows and daily averages
    // No auto-switching required
  }, [sentimentTimeframe]);

  // Resolve ticker
  const ticker = resolveSectorTicker(sector, countryCode);

  // Fetch all sector data
  const {
    priceData1Y,
    news,
    dailySentiment,
    topConstituents,
    topEvents,
    companyName,
    currency,
    loading,
    error,
    lastFetched,
    sentiment,
    newsAggregationMetadata
  } = useSectorData(ticker, timeframe, sector);

  // Fetch rolling sentiment data for the combined chart
  const {
    data: rollingData,
    hasData: hasRollingData,
    sourceEarliestDates,
    loading: sentimentLoading
  } = useRollingSentiment(ticker, sentimentTimeframe);

  // Map sentiment timeframe to days for existing charts
  const getDaysToShow = (tf) => {
    const map = { '1W': 7, '1M': 30 };
    return map[tf] || 7;
  };

  // Process price data based on timeframe
  const {
    priceData,
    chartData,
    priceRange,
    priceChange,
    priceChangePercent,
    currentPrice
  } = usePriceData(priceData1Y, timeframe);

  // Also fetch true intraday data using the entity hook so we can render 1D correctly
  const {
    priceData1Y: intradayPricesFromApi,
    prevClose: intradayPrevClose,
    exchange: intradayExchange
  } = useEntityPriceData(ticker, '1D');

  // Dev logging to inspect chartData vs events for 1M (helps debug markers not lining up)
  useEffect(() => {
    if (timeframe === '1M' && chartData && chartData.length > 0 && topEvents && topEvents.length > 0) {
      // eslint-disable-next-line no-console
      console.log('DEV: sector 1M chartData (last 3)', chartData.slice(-3));
      // eslint-disable-next-line no-console
      console.log('DEV: sector 1M topEvents (last 3)', topEvents.slice(-3));
    }
  }, [timeframe, chartData, topEvents]);

  // Debug logging for topEvents to verify news data
  useEffect(() => {
    if (topEvents && topEvents.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[PerformanceView] Sector topEvents:', topEvents);
      // eslint-disable-next-line no-console
      console.log('[PerformanceView] First event has news?', topEvents[0].news ? `Yes (${topEvents[0].news.length} articles)` : 'No');
    }
  }, [topEvents]);

  // Render content based on active tab
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <div className="text-lg font-medium text-gray-700">Loading performance data...</div>
            <div className="text-sm text-gray-500 mt-2">Please wait while we fetch the latest information</div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-md">
            <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Data</h3>
            <p className="text-sm text-gray-600 mb-4">
              {error || 'An error occurred while fetching sector performance data. Please try again later.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Reload Page
            </button>
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
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {currentPrice ? `${currency} ${currentPrice.toFixed(2)}` : '--'}
                </div>
                <div className={`text-sm font-medium ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  As of {lastFetched ? formatFullTimestamp(lastFetched) : 'Loading...'}
                </p>
              </div>

              {/* Sentiment Score Card - Row 1, Col 2 */}
              <div className="lg:col-start-2 lg:row-start-1 h-full">
                <SentimentScoreCard
                  sentimentAvg={sentiment?.avg}
                  newsCount={sentiment?.total_articles_analyzed || news?.length || 0}
                  dataQuality={sentiment?.data_quality}
                  className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full"
                />
              </div>

              {/* Significant Events - Spans 2 rows, Col 3 */}
              <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2 h-full">
                <SignificantEvents
                  events={topEvents}
                  sectorName={sectorName}
                  className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full flex flex-col"
                />
              </div>

              {/* Price Chart - Row 2, Spans 2 columns */}
              <div className="lg:col-start-1 lg:col-span-2 lg:row-start-2 bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Price Performance</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                    {/* Events Toggle Switch - Bloomberg style */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Events</span>
                      <button
                        onClick={() => setShowEvents(!showEvents)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
                          showEvents ? 'bg-gray-900' : 'bg-gray-300'
                        }`}
                        role="switch"
                        aria-checked={showEvents}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            showEvents ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Timeframe Buttons */}
                    <div className="flex flex-wrap gap-1">
                      {TIMEFRAMES.map(tf => (
                        <button
                          key={tf}
                          onClick={() => setTimeframe(tf)}
                          className={`px-3 py-1 rounded text-sm ${
                            timeframe === tf
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {timeframe === '1D' ? (
                  <PriceChart
                    priceData={intradayPricesFromApi && intradayPricesFromApi.length > 0 ? intradayPricesFromApi : priceData}
                    ticker={ticker}
                    companyName={companyName}
                    currency={currency}
                    exchange={intradayExchange || undefined}
                    significantEvents={showEvents ? topEvents : []}
                    timeframe={timeframe}
                    prevClose={intradayPrevClose ?? (chartData.length > 1 ? chartData[chartData.length - 2]?.y : null)}
                    showSignificantEvents={showEvents}
                  />
                ) : (
                  <PriceChart
                    chartData={chartData}
                    priceRange={priceRange}
                    priceChange={priceChange}
                    companyName={companyName}
                    ticker={ticker}
                    topEvents={topEvents}
                    showEvents={showEvents}
                    timeframe={timeframe}
                    prevClose={chartData.length > 1 ? chartData[chartData.length - 2]?.y : null}
                  />
                )}
              </div>
            </div>

            {/* Bottom Row: [News - Full Width] */}
            <div className="mb-8">
              <RelatedNews
                news={news}
                displayName={companyName}
                error={error}
                isOverview={true}
                onViewMore={() => setActiveTab('news')}
              />
            </div>

            {/* Top Holdings Section - Full Width */}
            <TopConstituents constituents={topConstituents} sectorName={sectorName} />
          </>
        );

      case 'performance':
        return (
          <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Detailed Performance Analysis</h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                {/* Events Toggle Switch - Bloomberg style */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Events</span>
                  <button
                    onClick={() => setShowEvents(!showEvents)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
                      showEvents ? 'bg-gray-900' : 'bg-gray-300'
                    }`}
                    role="switch"
                    aria-checked={showEvents}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showEvents ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Timeframe Buttons */}
                <div className="flex flex-wrap gap-1">
                  {TIMEFRAMES.map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1 rounded text-sm ${
                        timeframe === tf
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {timeframe === '1D' ? (
              <PriceChart
                priceData={intradayPricesFromApi && intradayPricesFromApi.length > 0 ? intradayPricesFromApi : priceData}
                ticker={ticker}
                companyName={companyName}
                currency={currency}
                exchange={intradayExchange || undefined}
                significantEvents={showEvents ? topEvents : []}
                timeframe={timeframe}
                prevClose={intradayPrevClose ?? (chartData.length > 1 ? chartData[chartData.length - 2]?.y : null)}
                showSignificantEvents={showEvents}
              />
            ) : (
              <PriceChart
                chartData={chartData}
                priceRange={priceRange}
                priceChange={priceChange}
                companyName={companyName}
                ticker={ticker}
                topEvents={topEvents}
                showEvents={showEvents}
                timeframe={timeframe}
                prevClose={chartData.length > 1 ? chartData[chartData.length - 2]?.y : null}
              />
            )}
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
                  <ViewModeToggle
                    activeMode={viewMode}
                    onModeChange={setViewMode}
                    timeframe={sentimentTimeframe}
                  />
                  <TimeRangeSelector
                    activeTimeframe={sentimentTimeframe}
                    onTimeframeChange={setSentimentTimeframe}
                    timeframes={['1D', '1W', '1M']}
                  />
                </div>
              </div>
              
              {/* Loading Overlay */}
              {sentimentLoading ? (
                <div className="relative" style={{ minHeight: '400px' }}>
                  <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-lg">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-gray-600 font-medium">Loading sentiment data...</p>
                      <p className="text-gray-400 text-sm mt-2">Fetching {sentimentTimeframe} timeframe</p>
                    </div>
                  </div>
                </div>
              ) : (
                <CombinedSentimentVolumeChart
                  data={viewMode === 'rolling' ? rollingData : Object.entries(dailySentiment).map(([date, data]) => ({
                    timestamp: date,
                    label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    volume: data.count || 0,
                    sentiment: data.score || 0,
                    headlines: data.headlines || []
                  }))}
                  timeframe={sentimentTimeframe}
                  viewMode={viewMode}
                  hasData={viewMode === 'rolling' ? hasRollingData : Object.keys(dailySentiment).length > 0}
                  sourceEarliestDates={viewMode === 'rolling' ? sourceEarliestDates : null}
                  exchange="NYSE"
                  ticker={ticker}
                />
              )}
            </div>

            {/* Row 2: Core Metrics (4 columns) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <SentimentScoreCard
                sentimentAvg={sentiment?.avg}
                newsCount={sentiment?.total_articles_analyzed || news?.length || 0}
                dataQuality={sentiment?.data_quality}
                context="sector"
              />
              <MomentumCard
                sentimentMomentum={sentiment?.momentum}
                momentumLabel={sentiment?.momentum_label}
                momentumInterpretation={sentiment?.momentum_interpretation}
                momentumQuality={sentiment?.momentum_quality}
                fastScore={sentiment?.fast_score}
                slowScore={sentiment?.slow_score}
                halfLifeFastHours={sentiment?.half_life_fast_hours}
                halfLifeSlowHours={sentiment?.half_life_slow_hours}
                context="sector"
              />
              <NewsCoverageCard
                effectiveNewsVolume={sentiment?.effective_news_volume}
                volumeInterpretation={sentiment?.volume_interpretation}
                dataQuality={sentiment?.data_quality}
                context="sector"
              />
              <SentimentConfidenceCard
                sentimentVolatility={sentiment?.sentiment_volatility}
                volatilityQuality={sentiment?.volatility_quality}
                dataQuality={sentiment?.data_quality}
                context="sector"
              />
            </div>

            {/* Row 3: Advanced Analytics (2 columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SentimentBreadthCard
                sentimentBreadthScore={sentiment?.breadth_score}
                numBullishArticles={sentiment?.num_bullish_mentions || 0}
                numBearishArticles={sentiment?.num_bearish_mentions || 0}
                totalDirectionalArticles={(sentiment?.num_bullish_mentions || 0) + (sentiment?.num_bearish_mentions || 0)}
                breadthInterpretation={sentiment?.breadth_interpretation}
                breadthQuality={sentiment?.data_quality}
                avgScore={sentiment?.avg}
                context="sector"
              />
              <SentimentShockCard
                sentimentZScore={sentiment?.z_score}
                zScoreInterpretation={sentiment?.z_score_interpretation}
                zScoreHistoricalMean={sentiment?.z_score_historical_mean}
                zScoreHistoricalStd={sentiment?.z_score_historical_std}
                zScoreDaysOfHistory={sentiment?.z_score_days_of_history}
                zScoreQuality={sentiment?.z_score_quality}
                currentScore={sentiment?.slow_score}
                context="sector"
              />
            </div>

            {/* Row 4: Source & Topic Analysis (2 columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SourceConcentrationCard
                sourceConcentrationHhi={sentiment?.source_concentration_hhi}
                concentrationInterpretation={sentiment?.concentration_interpretation}
                topSources={sentiment?.top_sources || []}
                context="sector"
              />
              <SentimentByTopicCard
                dominantTopic={sentiment?.dominant_topic}
                dominantTopicWeight={sentiment?.dominant_topic_weight}
                dominantTopicPercentage={sentiment?.dominant_topic_percentage}
                topicCount={sentiment?.topic_count}
                sentimentByTopic={sentiment?.sentiment_by_topic}
                topicWeights={sentiment?.topic_weights}
                context="sector"
              />
            </div>

            {/* Row 5: Ticker Coverage (Full Width) */}
            <TickerCoverageCard
              tickerCoverage={sentiment?.ticker_coverage}
              totalTickers={newsAggregationMetadata?.total_tickers}
            />
          </div>
        );

      case 'constituents':
        return <TopConstituents constituents={topConstituents} sectorName={sectorName} />;

      case 'news':
        return (
          <div className="">
            <DetailedRelatedNews
                news={news}
                displayName={companyName}
                ticker={ticker}
                loading={loading}
                error={error}
                apiMetadata={newsAggregationMetadata}
            />
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
      {/* Dev: log event / chart alignment for 1M to help debug marker placement (remove in prod) */}
      {/* dev logging handled via useEffect (see above) */}
    </div>
  );
};

export default PerformanceView;
