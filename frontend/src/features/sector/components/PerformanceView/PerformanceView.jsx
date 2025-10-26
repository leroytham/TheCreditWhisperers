// src/features/sector/components/PerformanceView/PerformanceView.jsx

import React, { useState } from 'react';
import { resolveSectorTicker } from '../../utils/tickerResolver';
import { useSectorData } from '../../hooks/useSectorData';
import { usePriceData } from '../../hooks/usePriceData';
import { useRollingSentiment } from '../../../entity/hooks/useRollingSentiment';
import { TIMEFRAMES } from '../../../shared/utils/constants';
import {
  PriceChart,
  CombinedSentimentVolumeChart,
  TimeRangeSelector,
  ViewModeToggle,
  EventsToggle,
  SignificantEvents,
  RelatedNews,
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
  const [sentimentTimeframe, setSentimentTimeframe] = useState('1W');
  const [viewMode, setViewMode] = useState('rolling');

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
  const { data: rollingData, hasData: hasRollingData, sourceEarliestDates } = useRollingSentiment(ticker, sentimentTimeframe);

  // Map sentiment timeframe to days for existing charts
  const getDaysToShow = (tf) => {
    const map = { '1W': 7, '1M': 30 };
    return map[tf] || 7;
  };

  // Process price data based on timeframe
  const {
    chartData,
    priceRange,
    priceChange,
    priceChangePercent,
    currentPrice
  } = usePriceData(priceData1Y, timeframe);

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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-gray-900">Price Performance</h3>
                    <EventsToggle
                      showEvents={showEvents}
                      onToggle={setShowEvents}
                    />
                  </div>
                  <div className="flex space-x-2">
                    {TIMEFRAMES.map(tf => (
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
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold text-gray-900">Detailed Performance</h3>
                <EventsToggle
                  showEvents={showEvents}
                  onToggle={setShowEvents}
                />
              </div>
              <div className="flex space-x-2">
                {TIMEFRAMES.map(tf => (
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
              />
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
          <div className="grid grid-cols-1 gap-8">
            {/* Aggregated News Metadata Banner */}
            {newsAggregationMetadata && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-blue-800">
                      Aggregated Sector News
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Showing <strong>{newsAggregationMetadata.unique_articles}</strong> unique articles
                        from <strong>{newsAggregationMetadata.total_tickers}</strong> companies in {newsAggregationMetadata.sector_name}
                      </p>
                      <p className="mt-1">
                        <span className="text-xs text-blue-600">
                          {newsAggregationMetadata.total_articles_fetched} total articles fetched
                          ({newsAggregationMetadata.deduplication_rate}% duplicates removed)
                        </span>
                      </p>
                      {newsAggregationMetadata.total_market_weight_coverage && (
                        <p className="mt-1">
                          <span className="text-xs text-blue-600">
                            Market weight coverage: <strong>{(newsAggregationMetadata.total_market_weight_coverage * 100).toFixed(1)}%</strong>
                            {' '}• Success rate: <strong>{newsAggregationMetadata.success_rate}%</strong>
                          </span>
                        </p>
                      )}
                      {sentiment?.breadth_score !== null && sentiment?.breadth_score !== undefined && (
                        <p className="mt-2 pt-2 border-t border-blue-200">
                          <span className="text-xs text-blue-800 font-medium">
                            Sector Sentiment: <strong className={sentiment.breadth_score > 0.2 ? 'text-green-700' : sentiment.breadth_score < -0.2 ? 'text-red-700' : 'text-gray-700'}>
                              {sentiment.breadth_interpretation || `Score: ${sentiment.breadth_score.toFixed(2)}`}
                            </strong>
                          </span>
                          {sentiment?.ticker_coverage && sentiment.ticker_coverage.coverage_percentage && (
                            <span className="text-xs text-blue-600 ml-2">
                              • Coverage: {sentiment.ticker_coverage.coverage_percentage}% of sector tickers
                            </span>
                          )}
                        </p>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800">
                          View source companies ({newsAggregationMetadata.total_tickers})
                        </summary>
                        <div className="mt-2 p-2 bg-white rounded border border-blue-100">
                          <p className="text-xs text-gray-700 font-mono">
                            {newsAggregationMetadata.tickers_queried.join(', ')}
                          </p>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <RelatedNews
                news={news}
                displayName={companyName}
                error={error}
                isOverview={false}
            />
          </div>
        );

      case 'events':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <SignificantEvents events={topEvents} sectorName={sectorName} />
            <RelatedNews news={news} companyName={companyName} error={error} />
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
