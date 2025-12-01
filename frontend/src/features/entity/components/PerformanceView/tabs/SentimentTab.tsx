import React from 'react';
import {
  CombinedSentimentVolumeChart,
  TimeRangeSelector,
  ViewModeToggle,
  SentimentScoreCard,
  MomentumCard,
  SentimentBreadthCard,
  SentimentShockCard,
  SourceConcentrationCard,
  SentimentByTopicCard,
  NewsCoverageCard,
  SentimentConfidenceCard
} from '../../../../shared/components';
import type { ViewModeType } from '../../../../shared/components/ViewModeToggle';
import type { NewsArticle, DailySentimentPoint, TimeframeOption } from '../../../../../types';

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

interface RollingDataPoint {
  timestamp?: string;
  label?: string;
  volume: number;
  sentiment: number;
  headlines?: any[];
}

interface SentimentTabProps {
  // View controls
  viewMode: ViewModeType;
  setViewMode: (mode: ViewModeType) => void;
  sentimentTimeframe: TimeframeOption | string;
  setSentimentTimeframe: (tf: TimeframeOption | string) => void;

  // Rolling sentiment data
  rollingData: RollingDataPoint[] | null;
  hasRollingData: boolean;
  sentimentLoading: boolean;
  sentimentError: string | null;
  sourceEarliestDates: Record<string, string> | null;

  // Daily sentiment data
  dailySentiment: Record<string, DailySentimentPoint> | null;
  dailySentimentLoading: boolean;
  dailySentimentError: string | null;

  // Sentiment metrics
  sentiment: SentimentData | null;
  news: NewsArticle[] | null;
  newsLoading: boolean;
  newsError: string | null;

  // Entity info
  exchange: string;
  ticker: string;
}

export const SentimentTab: React.FC<SentimentTabProps> = ({
  viewMode,
  setViewMode,
  sentimentTimeframe,
  setSentimentTimeframe,
  rollingData,
  hasRollingData,
  sentimentLoading,
  sentimentError,
  sourceEarliestDates,
  dailySentiment,
  dailySentimentLoading,
  dailySentimentError,
  sentiment,
  news,
  newsLoading,
  newsError,
  exchange,
  ticker
}) => {
  const activeSentimentLoading = viewMode === 'rolling' ? sentimentLoading : dailySentimentLoading;
  const activeSentimentError = viewMode === 'rolling' ? sentimentError : dailySentimentError;

  const renderChartContent = () => {
    // Show error state if sentiment data fetch failed
    if (activeSentimentError && !activeSentimentLoading) {
      return (
        <div className="relative" style={{ minHeight: '400px' }}>
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-red-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-lg font-medium text-gray-900 mb-2">Failed to Load Sentiment Data</div>
              <div className="text-sm text-gray-600 mb-4">{activeSentimentError}</div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeSentimentLoading) {
      return (
        <div className="relative" style={{ minHeight: '400px' }}>
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-lg">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 font-medium">Loading sentiment data...</p>
              <p className="text-gray-400 text-sm mt-2">Fetching {sentimentTimeframe} timeframe</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <CombinedSentimentVolumeChart
        data={viewMode === 'rolling' ? (rollingData ?? undefined) : Object.entries(dailySentiment || {}).map(([date, data]) => {
          const d = data as { count?: number; score?: number; headlines?: any[] };
          return {
            timestamp: date,
            label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            volume: d.count || 0,
            sentiment: d.score || 0,
            headlines: d.headlines || []
          };
        })}
        timeframe={sentimentTimeframe}
        viewMode={viewMode}
        hasData={viewMode === 'rolling' ? hasRollingData : Object.keys(dailySentiment || {}).length > 0}
        sourceEarliestDates={viewMode === 'rolling' ? (sourceEarliestDates ?? undefined) : undefined}
        exchange={exchange}
        ticker={ticker}
      />
    );
  };

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
              timeframes={['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y']}
            />
          </div>
        </div>
        {renderChartContent()}
      </div>

      {/* Row 2: Core Metrics (4 columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <SentimentScoreCard
          sentiment={sentiment}
          newsCount={news?.length || 0}
          dataQuality={sentiment?.data_quality}
          loading={newsLoading}
          error={newsError}
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
          loading={newsLoading}
          error={newsError}
        />
        <NewsCoverageCard
          effectiveNewsVolume={sentiment?.effective_news_volume}
          volumeInterpretation={sentiment?.volume_interpretation}
          dataQuality={sentiment?.data_quality}
          loading={newsLoading}
          error={newsError}
        />
        <SentimentConfidenceCard
          sentimentVolatility={sentiment?.sentiment_volatility}
          volatilityQuality={sentiment?.volatility_quality}
          dataQuality={sentiment?.data_quality}
          loading={newsLoading}
          error={newsError}
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
          loading={newsLoading}
          error={newsError}
        />
        <SentimentShockCard
          sentimentZScore={sentiment?.sentiment_z_score}
          zScoreInterpretation={sentiment?.z_score_interpretation}
          zScoreHistoricalMean={sentiment?.z_score_historical_mean}
          zScoreHistoricalStd={sentiment?.z_score_historical_std}
          zScoreDaysOfHistory={sentiment?.z_score_days_of_history}
          zScoreQuality={sentiment?.z_score_quality}
          currentScore={sentiment?.slow_score}
          loading={newsLoading}
          error={newsError}
        />
      </div>

      {/* Row 4: Source & Topic Analysis (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SourceConcentrationCard
          sourceConcentrationHhi={sentiment?.sourceConcentrationHhi}
          concentrationInterpretation={sentiment?.concentrationInterpretation}
          topSources={sentiment?.topSources}
          loading={newsLoading}
          error={newsError}
        />
        <SentimentByTopicCard
          dominantTopic={sentiment?.dominantTopic}
          dominantTopicWeight={sentiment?.dominantTopicWeight}
          dominantTopicPercentage={sentiment?.dominantTopicPercentage}
          topicCount={sentiment?.topicCount}
          sentimentByTopic={sentiment?.sentimentByTopic}
          topicWeights={sentiment?.topicWeights}
          loading={newsLoading}
          error={newsError}
        />
      </div>
    </div>
  );
};

export default SentimentTab;
