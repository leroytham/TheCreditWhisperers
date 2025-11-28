import React, { useState, useEffect, useMemo } from 'react';
import CombinedSentimentVolumeChart from '../../../shared/components/CombinedSentimentVolumeChart';
import SentimentScoreCard from '../../../shared/components/SentimentScoreCard';
import MomentumCard from '../../../shared/components/MomentumCard';
import NewsCoverageCard from '../../../shared/components/NewsCoverageCard';
import SentimentConfidenceCard from '../../../shared/components/SentimentConfidenceCard';
import SentimentBreadthCard from '../../../shared/components/SentimentBreadthCard';
import SentimentShockCard from '../../../shared/components/SentimentShockCard';
import SourceConcentrationCard from '../../../shared/components/SourceConcentrationCard';
import SentimentByTopicCard from '../../../shared/components/SentimentByTopicCard';
import HoldingsCoverageCard from '../../../shared/components/HoldingsCoverageCard';
import TimeRangeSelector from '../../../shared/components/TimeRangeSelector';
import ViewModeToggle from '../../../shared/components/ViewModeToggle';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { InlineError } from '../../../../components/ErrorDisplay';
import { useSelectedAccount } from '../../../../hooks/useSelectedAccount';
import { usePortfolioOverview } from '../../hooks/usePortfolioOverview';
import { usePortfolioSentiment } from '../../hooks/usePortfolioSentiment';
import { usePortfolioRollingSentiment } from '../../hooks/usePortfolioRollingSentiment';
import { usePortfolioSectorSentiment } from '../../hooks/usePortfolioSectorSentiment';
import SectorSentimentBreakdown from './SectorSentimentBreakdown';
import HoldingsSentimentTable from './HoldingsSentimentTable';
import { parseNumericString } from '../../../../utils/formatters';

/**
 * PortfolioSentimentView Component
 *
 * AI-powered sentiment analysis dashboard for portfolio holdings.
 * Aggregates sentiment scores, momentum, news coverage, and source analysis across all holdings.
 *
 * Key Features:
 * - Portfolio-wide sentiment score (weighted by position size)
 * - Interactive time-series chart with multiple view modes
 * - Sentiment metrics cards (score, momentum, confidence, breadth, shock)
 * - News coverage analysis
 * - Holdings-level sentiment breakdown table
 * - Support for timeframes: 1D, 1W (uses 1M of data), 1M
 *
 * View Modes:
 * - Rolling: Rolling averages (7-day fast, 30-day slow)
 * - Daily: Raw daily sentiment scores
 * - Weekly: Weekly aggregated sentiment (auto-selected for 3M, 6M, YTD)
 * - Monthly: Monthly aggregated sentiment (auto-selected for 1Y)
 *
 * Data Aggregation:
 * - Fetches sentiment for each holding from API via custom hooks
 * - Calculates position-weighted portfolio sentiment
 * - Lazy loading: only fetches when tab is active
 *
 * @param {boolean} isActive - Whether this tab is currently active (for lazy loading)
 * @returns {React.ReactElement} Rendered portfolio sentiment analysis view
 *
 * @example
 * // Used in Portfolio page "Sentiment" tab
 * <PortfolioSentimentView isActive={activeSubTab === 'sentiment'} />
 */
const PortfolioSentimentView = ({ isActive = true }) => {
  const [timeframe, setTimeframe] = useState('1M');
  const [viewMode, setViewMode] = useState('rolling');

  // Backend fetches data for selected timeframe
  // Metrics and charts both reflect the same period
  // Caching handled by backend Redis layer
  const dataTimeframe = timeframe; // Use actual user selection

  // Use hooks for account selection and data
  const { selectedAccount } = useSelectedAccount();
  const { holdings: portfolioHoldings, holdingsLoading, holdingsError } = usePortfolioOverview();

  // Transform holdings data to extract market values and weights
  const holdings = useMemo(() => {
    if (!portfolioHoldings) return [];
    const apiHoldings = Array.isArray(portfolioHoldings) ? portfolioHoldings : portfolioHoldings.holdings || [];

    const transformedHoldings = apiHoldings.map(holding => ({
      ticker: holding.symbol,
      name: holding.symbol,
      marketValue: parseNumericString(holding.position || '0')
    }));

    // Calculate weights
    const totalValue = transformedHoldings.reduce((sum, h) => sum + h.marketValue, 0);
    return transformedHoldings.map(h => ({
      ...h,
      weight: totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0
    }));
  }, [portfolioHoldings]);

  // Auto-switch view mode based on timeframe
  // With only 1D, 1W, 1M available, default to rolling if on monthly/weekly
  useEffect(() => {
    // For 1D, 1W, 1M: default to rolling if currently on monthly/weekly
    if (['monthly', 'weekly'].includes(viewMode)) {
      setViewMode('rolling');
    }
    // For 1D, 1W, 1M: allow both rolling and daily modes (no forced change)
  }, [timeframe, viewMode]);

  // Lazy loading: only fetch data when tab is active
  const shouldFetchData = isActive && selectedAccount && holdings && holdings.length > 0;

  // Determine primary exchange for portfolio based on holdings
  const portfolioExchange = useMemo(() => {
    if (!holdings || holdings.length === 0) return 'US';

    // Analyze tickers to determine likely exchanges
    const exchangeWeights = holdings.reduce((acc, holding) => {
      const ticker = holding.ticker || '';
      let exchange = 'US'; // Default

      // Basic heuristics for exchange detection
      if (ticker.includes('.L') || ticker.includes('.LON')) {
        exchange = 'LSE'; // London Stock Exchange
      } else if (ticker.includes('.T') || ticker.includes('.TYO')) {
        exchange = 'TSE'; // Tokyo Stock Exchange
      } else if (ticker.includes('.HK')) {
        exchange = 'HKEX'; // Hong Kong Exchange
      } else if (ticker.includes('.TO') || ticker.includes('.TSX')) {
        exchange = 'TSX'; // Toronto Stock Exchange
      } else if (ticker.includes('.AX') || ticker.includes('.ASX')) {
        exchange = 'ASX'; // Australian Securities Exchange
      } else if (ticker.includes('.PA') || ticker.includes('.PAR')) {
        exchange = 'Euronext'; // Euronext Paris
      } else if (ticker.includes('.DE') || ticker.includes('.FRA')) {
        exchange = 'Xetra'; // Frankfurt Stock Exchange
      }
      // Add more exchanges as needed

      if (!acc[exchange]) acc[exchange] = 0;
      acc[exchange] += holding.weight || 0;
      return acc;
    }, {});

    // Return the exchange with the highest weight
    const primaryExchange = Object.entries(exchangeWeights).reduce((max, [exchange, weight]: [string, number]) =>
      weight > max.weight ? { exchange, weight } : max,
      { exchange: 'US', weight: 0 }
    );

    return primaryExchange.exchange;
  }, [holdings]);

  // Use custom hooks for data fetching with new backend endpoints
  const {
    sentimentData: dailySentimentData,
    holdingsSentiment: dailyHoldingsSentiment,
    loading: dailySentimentLoading,
    error: dailySentimentError,
    failedHoldings: dailyFailedHoldings,
    successCount: dailySuccessCount,
    totalCount: dailyTotalCount
  } = usePortfolioSentiment(
    selectedAccount?.username,
    selectedAccount?.accountName,
    holdings,
    dataTimeframe,
    shouldFetchData,
    portfolioExchange
  );

  const {
    data: rollingData,
    hasData: hasRollingData,
    loading: rollingSentimentLoading,
    error: rollingSentimentError,
    sourceEarliestDates,
    failedHoldings: rollingFailedHoldings,
    successCount: rollingSuccessCount,
    totalCount: rollingTotalCount
  } = usePortfolioRollingSentiment(
    selectedAccount?.username,
    selectedAccount?.accountName,
    holdings,
    dataTimeframe,
    shouldFetchData,
    portfolioExchange
  );

  // Fetch sector breakdown data
  const {
    sectorData,
    loading: sectorLoading,
    error: sectorError
  } = usePortfolioSectorSentiment(
    selectedAccount?.username,
    selectedAccount?.accountName,
    shouldFetchData
  );

  // Select active data based on view mode
  const activeSentimentLoading = viewMode === 'rolling' ? rollingSentimentLoading : dailySentimentLoading;
  const activeSentimentError = viewMode === 'rolling' ? rollingSentimentError : dailySentimentError;
  const rawActiveSentimentData = viewMode === 'rolling' ? rollingData : dailySentimentData?.timeSeries;
  const activeHasData = viewMode === 'rolling' ? hasRollingData : (dailySentimentData?.timeSeries?.length > 0);

  // Backend returns correctly filtered data for selected timeframe
  const activeSentimentData = rawActiveSentimentData;

  // Utility functions for sentiment display
  const getSentimentColor = (score) => {
    if (score > 0.5) return 'text-green-600';
    if (score > 0) return 'text-green-500';
    if (score > -0.5) return 'text-orange-500';
    return 'text-red-600';
  };

  const getSentimentLabel = (score) => {
    if (score > 0.5) return 'Very Bullish';
    if (score > 0.2) return 'Bullish';
    if (score > -0.2) return 'Neutral';
    if (score > -0.5) return 'Bearish';
    return 'Very Bearish';
  };

  // Show loading state while holdings are loading
  if (holdingsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show error if holdings failed to load
  if (holdingsError) {
    return (
      <div className="p-4">
        <InlineError
          message="Failed to load portfolio holdings"
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // Show message if no holdings
  if (!holdings || holdings.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium mb-2">No holdings in this portfolio</p>
          <p className="text-sm">Add holdings to see sentiment analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Combined Sentiment Chart */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Portfolio Sentiment Analysis
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Aggregated sentiment across all holdings
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <ViewModeToggle
                activeMode={viewMode}
                onModeChange={setViewMode}
                timeframe={timeframe}
              />
              <TimeRangeSelector
                activeTimeframe={timeframe}
                onTimeframeChange={setTimeframe}
                timeframes={['1D', '1W', '1M']}
              />
            </div>
          </div>

          {/* Mode-aware loading and error states */}
          <div style={{ minHeight: '550px' }}>
            {activeSentimentError && !activeSentimentLoading ? (
              <div className="flex items-center justify-center h-full">
                <InlineError
                  message={activeSentimentError}
                  onRetry={() => window.location.reload()}
                />
              </div>
            ) : activeSentimentLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <LoadingSpinner size="md" />
                  <p className="text-gray-600 font-medium mt-4">Loading sentiment data...</p>
                  <p className="text-gray-400 text-sm mt-2">Fetching {timeframe} timeframe</p>
                </div>
              </div>
            ) : (
              <CombinedSentimentVolumeChart
                data={activeSentimentData}
                timeframe={timeframe}
                viewMode={viewMode}
                hasData={activeHasData}
                sourceEarliestDates={viewMode === 'rolling' ? sourceEarliestDates : null}
                exchange={portfolioExchange}
                ticker="PORTFOLIO"
              />
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics Grid - Show with loading/error states per card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dailySentimentLoading && !dailySentimentData ? (
          // Show loading placeholders
          <>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-center h-24">
                  <LoadingSpinner size="sm" />
                </div>
              </div>
            ))}
          </>
        ) : dailySentimentError && !dailySentimentData ? (
          // Show error state
          <div className="col-span-full">
            <div className="bg-white rounded-lg shadow p-6">
              <InlineError
                message={dailySentimentError}
                onRetry={() => window.location.reload()}
              />
            </div>
          </div>
        ) : dailySentimentData ? (
          // Show actual data
          <>
            <SentimentScoreCard
              sentimentAvg={dailySentimentData.aggregate.slow_score || dailySentimentData.aggregate.avg_sentiment}
              newsCount={dailySentimentData.aggregate.total_articles_analyzed || 0}
              dataQuality={dailySentimentData.aggregate.data_quality}
              context="portfolio"
            />
            <MomentumCard
              sentimentMomentum={dailySentimentData.aggregate.sentiment_momentum}
              momentumLabel={dailySentimentData.aggregate.momentum_label}
              momentumInterpretation={dailySentimentData.aggregate.momentum_interpretation}
              momentumQuality={dailySentimentData.aggregate.momentum_quality}
              fastScore={dailySentimentData.aggregate.fast_score}
              slowScore={dailySentimentData.aggregate.slow_score}
              halfLifeFastHours={dailySentimentData.aggregate.half_life_fast_hours}
              halfLifeSlowHours={dailySentimentData.aggregate.half_life_slow_hours}
              context="portfolio"
            />
            <NewsCoverageCard
              effectiveNewsVolume={dailySentimentData.aggregate.effective_news_volume}
              volumeInterpretation={dailySentimentData.aggregate.volume_interpretation}
              dataQuality={dailySentimentData.aggregate.data_quality}
              context="portfolio"
            />
            <SentimentConfidenceCard
              sentimentVolatility={dailySentimentData.aggregate.sentiment_volatility}
              volatilityQuality={dailySentimentData.aggregate.volatility_quality}
              dataQuality={dailySentimentData.aggregate.data_quality}
            />
          </>
        ) : null}
      </div>

      {/* Advanced Analytics - Show with loading/error states per card */}
      {(dailySentimentData || dailySentimentLoading || dailySentimentError) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dailySentimentLoading && !dailySentimentData ? (
            // Show loading placeholders
            <>
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-center h-32">
                    <LoadingSpinner size="sm" />
                  </div>
                </div>
              ))}
            </>
          ) : dailySentimentError && !dailySentimentData ? (
            // Error already shown above, show disabled placeholders
            <>
              <div className="bg-gray-50 rounded-lg shadow p-6 opacity-50">
                <p className="text-center text-gray-500">Data unavailable</p>
              </div>
              <div className="bg-gray-50 rounded-lg shadow p-6 opacity-50">
                <p className="text-center text-gray-500">Data unavailable</p>
              </div>
            </>
          ) : dailySentimentData ? (
            <>
              <SentimentBreadthCard
                sentimentBreadthScore={dailySentimentData.aggregate.sentiment_breadth_score}
                numBullishArticles={dailySentimentData.aggregate.num_bullish_articles}
                numBearishArticles={dailySentimentData.aggregate.num_bearish_articles}
                totalDirectionalArticles={dailySentimentData.aggregate.total_directional_articles}
                breadthInterpretation={dailySentimentData.aggregate.breadth_interpretation}
                breadthQuality={dailySentimentData.aggregate.breadth_quality}
                avgScore={dailySentimentData.aggregate.avg_score}
                context="portfolio"
              />
              <SentimentShockCard
                sentimentZScore={dailySentimentData.aggregate.sentiment_z_score}
                zScoreInterpretation={dailySentimentData.aggregate.z_score_interpretation}
                zScoreHistoricalMean={dailySentimentData.aggregate.z_score_historical_mean}
                zScoreHistoricalStd={dailySentimentData.aggregate.z_score_historical_std}
                zScoreDaysOfHistory={dailySentimentData.aggregate.z_score_days_of_history}
                zScoreQuality={dailySentimentData.aggregate.z_score_quality}
                currentScore={dailySentimentData.aggregate.slow_score}
                context="portfolio"
              />
            </>
          ) : null}
        </div>
      )}

      {/* Enhanced Holdings Sentiment Table */}
      <HoldingsSentimentTable
        holdings={dailyHoldingsSentiment}
        loading={dailySentimentLoading && (!dailyHoldingsSentiment || dailyHoldingsSentiment.length === 0)}
        error={dailySentimentError && (!dailyHoldingsSentiment || dailyHoldingsSentiment.length === 0) ? dailySentimentError : null}
      />

      {/* Holdings Coverage Card */}
      {dailySentimentData?.metadata?.holdingsCoverageDetails && (
        <HoldingsCoverageCard
          holdingsCoverage={dailySentimentData.metadata.holdingsCoverageDetails}
        />
      )}

      {/* Advanced NLP Analytics */}
      {dailySentimentData?.metadata ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SourceConcentrationCard
            sourceConcentrationHhi={dailySentimentData.metadata.sourceConcentrationHhi}
            concentrationInterpretation={dailySentimentData.metadata.concentrationInterpretation}
            topSources={dailySentimentData.metadata.topSources}
            context="portfolio"
          />
          <SentimentByTopicCard
            dominantTopic={dailySentimentData.metadata.dominantTopic}
            dominantTopicWeight={dailySentimentData.metadata.dominantTopicWeight}
            dominantTopicPercentage={dailySentimentData.metadata.dominantTopicPercentage}
            topicCount={dailySentimentData.metadata.topicCount}
            sentimentByTopic={dailySentimentData.metadata.sentimentByTopic}
            topicWeights={dailySentimentData.metadata.topicWeights}
            context="portfolio"
          />
        </div>
      ) : dailySentimentLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-center h-32">
                <LoadingSpinner size="sm" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg shadow p-6 opacity-50">
            <p className="text-center text-gray-500">NLP data unavailable</p>
          </div>
          <div className="bg-gray-50 rounded-lg shadow p-6 opacity-50">
            <p className="text-center text-gray-500">NLP data unavailable</p>
          </div>
        </div>
      )}

      {/* Sector Sentiment Breakdown */}
      <SectorSentimentBreakdown
        sectors={sectorData?.sectors}
        loading={sectorLoading}
        error={sectorError}
      />
    </div>
  );
};

export default PortfolioSentimentView;