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
import { usePortfolioSentiment, PortfolioSentimentData } from '../../hooks/usePortfolioSentiment';
import { usePortfolioRollingSentiment } from '../../hooks/usePortfolioRollingSentiment';
import { usePortfolioSectorSentiment } from '../../hooks/usePortfolioSectorSentiment';
import SectorSentimentBreakdown from './SectorSentimentBreakdown';
import HoldingsSentimentTable from './HoldingsSentimentTable';
import { parseNumericString } from '../../../../utils/formatters';

// Type definitions
interface PortfolioSentimentViewProps {
  isActive?: boolean;
}

interface Holding {
  ticker: string;
  name: string;
  marketValue: number;
  weight?: number;
}

type TimeframeType = '1D' | '1W' | '1M';
type ViewModeType = 'rolling' | 'daily' | 'weekly' | 'monthly';

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
const PortfolioSentimentView: React.FC<PortfolioSentimentViewProps> = ({ isActive = true }) => {
  const [timeframe, setTimeframe] = useState<TimeframeType>('1M');
  const [viewMode, setViewMode] = useState<ViewModeType>('rolling');

  // Backend fetches data for selected timeframe
  // Metrics and charts both reflect the same period
  // Caching handled by backend Redis layer
  const dataTimeframe = timeframe; // Use actual user selection

  // Use hooks for account selection and data
  const { selectedAccount } = useSelectedAccount();
  const { holdings: portfolioHoldings, holdingsLoading, holdingsError } = usePortfolioOverview();

  // Transform holdings data to extract market values and weights
  interface ApiHolding {
    symbol?: string;
    position?: string;
  }
  const holdings = useMemo<Holding[]>(() => {
    if (!portfolioHoldings) return [];
    const apiHoldings: ApiHolding[] = Array.isArray(portfolioHoldings)
      ? (portfolioHoldings as ApiHolding[])
      : ((portfolioHoldings as { holdings?: ApiHolding[] }).holdings || []);

    const transformedHoldings = apiHoldings.map((holding) => ({
      ticker: holding.symbol || '',
      name: holding.symbol || '',
      marketValue: parseNumericString(holding.position || '0')
    }));

    // Calculate weights
    const totalValue = transformedHoldings.reduce((sum: number, h) => sum + h.marketValue, 0);
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
  const shouldFetchData = Boolean(isActive && selectedAccount && holdings && holdings.length > 0);

  // Determine primary exchange for portfolio based on holdings
  const portfolioExchange = useMemo<string>(() => {
    if (!holdings || holdings.length === 0) return 'US';

    // Analyze tickers to determine likely exchanges
    const exchangeWeights = holdings.reduce<Record<string, number>>((acc, holding) => {
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
    const primaryExchange = Object.entries(exchangeWeights).reduce(
      (max, [exchange, weight]) =>
        weight > max.weight ? { exchange, weight } : max,
      { exchange: 'US', weight: 0 }
    );

    return primaryExchange.exchange;
  }, [holdings]);

  // Use custom hooks for data fetching with new backend endpoints
  const portfolioSentimentResult = usePortfolioSentiment(
    selectedAccount?.username,
    selectedAccount?.accountName,
    holdings,
    dataTimeframe,
    shouldFetchData,
    portfolioExchange
  );
  const dailySentimentData: PortfolioSentimentData | null = portfolioSentimentResult.sentimentData;
  const dailyHoldingsSentiment = portfolioSentimentResult.holdingsSentiment;
  const dailySentimentLoading: boolean = portfolioSentimentResult.loading;
  const dailySentimentError: string | null = portfolioSentimentResult.error;
  const dailyFailedHoldings = portfolioSentimentResult.failedHoldings;
  const dailySuccessCount = portfolioSentimentResult.successCount;
  const dailyTotalCount = portfolioSentimentResult.totalCount;

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
  const activeHasData = viewMode === 'rolling' ? hasRollingData : ((dailySentimentData?.timeSeries?.length ?? 0) > 0);

  // Backend returns correctly filtered data for selected timeframe
  const activeSentimentData = rawActiveSentimentData;

  // Utility functions for sentiment display
  const getSentimentColor = (score: number | null | undefined): string => {
    if (score == null) return 'text-gray-500';
    if (score > 0.5) return 'text-green-600';
    if (score > 0) return 'text-green-500';
    if (score > -0.5) return 'text-orange-500';
    return 'text-red-600';
  };

  const getSentimentLabel = (score: number | null | undefined): string => {
    if (score == null) return 'N/A';
    if (score > 0.5) return 'Very Bullish';
    if (score > 0.2) return 'Bullish';
    if (score > -0.2) return 'Neutral';
    if (score > -0.5) return 'Bearish';
    return 'Very Bearish';
  };

  // Helper function for metrics grid to avoid type inference issues
  const renderMetricsGrid = (): React.ReactNode => {
    if (dailySentimentLoading && !dailySentimentData) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-center h-24">
                <LoadingSpinner size="sm" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (dailySentimentError && !dailySentimentData) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-full">
            <div className="bg-white rounded-lg shadow p-6">
              <InlineError
                message={dailySentimentError}
                onRetry={() => window.location.reload()}
              />
            </div>
          </div>
        </div>
      );
    }
    if (dailySentimentData) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>
      );
    }
    return null;
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
      {/* Key Metrics Grid - Testing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p>Test</p>
        </div>
      </div>

      {/* Temporarily disabled for debugging */}

      {/* Enhanced Holdings Sentiment Table */}
      <HoldingsSentimentTable
        holdings={dailyHoldingsSentiment}
        loading={dailySentimentLoading && dailyHoldingsSentiment.length === 0}
        error={dailySentimentError && dailyHoldingsSentiment.length === 0 ? dailySentimentError : null}
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