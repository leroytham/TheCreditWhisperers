/**
 * useNewsData Hook
 *
 * Custom hook for fetching news and sentiment data with momentum analysis
 * Optimized with React Query for automatic caching and background refetching
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import apiService from '../../../services/api';
import type { NewsArticle, SourceInfo, TimeframeOption, SentimentByTopic, TopicWeights } from '../../../types';

interface NewsResponse {
  news?: NewsArticle[];
  feed?: NewsArticle[];
  items?: number;
  sentiment_score_definition?: string;
  relevance_score_definition?: string;
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
  data_quality?: string;
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
  source_concentration_hhi?: number;
  concentration_interpretation?: string;
  top_sources?: SourceInfo[];
  dominant_topic?: string;
  dominant_topic_weight?: number;
  dominant_topic_percentage?: number;
  topic_count?: number;
  sentiment_by_topic?: SentimentByTopic;
  topic_weights?: TopicWeights;
}

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
  data_quality?: string;
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
  topSources: SourceInfo[];
  dominantTopic?: string;
  dominantTopicWeight?: number;
  dominantTopicPercentage?: number;
  topicCount: number;
  sentimentByTopic: SentimentByTopic;
  topicWeights: TopicWeights;
}

interface ApiMetadata {
  items?: number;
  sentiment_score_definition?: string;
  relevance_score_definition?: string;
}

interface UseNewsDataReturn {
  news: NewsArticle[];
  sentiment: SentimentData;
  apiMetadata: ApiMetadata;
  loading: boolean;
  error: string | null;
}

export const useNewsData = (
  ticker: string,
  timeframe: TimeframeOption | string = '1Y',
  options: Partial<UseQueryOptions<NewsResponse>> = {}
): UseNewsDataReturn => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['news', ticker, timeframe],
    queryFn: async () => {
      const response = await apiService.getNews(ticker, timeframe);
      return response.data;
    },
    enabled: Boolean(ticker), // Only fetch if ticker is provided
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: 2, // Retry failed requests twice
    ...options // Allow overriding default options
  });

  // Transform data into the expected format
  // Prefer formatted news over raw feed data for proper field names (image, provider, etc.)
  const news = data?.news || data?.feed || [];

  const apiMetadata = {
    items: data?.items,
    sentiment_score_definition: data?.sentiment_score_definition,
    relevance_score_definition: data?.relevance_score_definition,
  };

  const sentiment = {
    avg_score: data?.avg_score,
    // Momentum fields
    sentiment_momentum: data?.sentiment_momentum,
    fast_score: data?.fast_score,
    slow_score: data?.slow_score,
    momentum_label: data?.momentum_label,
    momentum_interpretation: data?.momentum_interpretation,
    momentum_quality: data?.momentum_quality,
    momentum_direction: data?.momentum_direction,
    momentum_strength: data?.momentum_strength,
    half_life_fast_hours: data?.half_life_fast_hours,
    half_life_slow_hours: data?.half_life_slow_hours,
    data_quality: data?.data_quality,
    // Volatility fields
    sentiment_volatility: data?.sentiment_volatility,
    volatility_quality: data?.volatility_quality,
    // Effective news volume (quantity/coverage)
    effective_news_volume: data?.effective_news_volume,
    volume_interpretation: data?.volume_interpretation,
    // Breadth metrics (bull/bear ratio)
    sentiment_breadth_score: data?.sentiment_breadth_score,
    num_bullish_articles: data?.num_bullish_articles,
    num_bearish_articles: data?.num_bearish_articles,
    total_directional_articles: data?.total_directional_articles,
    breadth_interpretation: data?.breadth_interpretation,
    breadth_quality: data?.breadth_quality,
    // Z-Score metrics (sentiment shock)
    sentiment_z_score: data?.sentiment_z_score,
    z_score_interpretation: data?.z_score_interpretation,
    z_score_historical_mean: data?.z_score_historical_mean,
    z_score_historical_std: data?.z_score_historical_std,
    z_score_days_of_history: data?.z_score_days_of_history,
    z_score_quality: data?.z_score_quality,
    // Source & Topic Analysis metrics
    sourceConcentrationHhi: data?.source_concentration_hhi,
    concentrationInterpretation: data?.concentration_interpretation,
    topSources: data?.top_sources || [],
    dominantTopic: data?.dominant_topic,
    dominantTopicWeight: data?.dominant_topic_weight,
    dominantTopicPercentage: data?.dominant_topic_percentage,
    topicCount: data?.topic_count || 0,
    sentimentByTopic: data?.sentiment_by_topic || {},
    topicWeights: data?.topic_weights || {}
  };

  return {
    news,
    sentiment,
    apiMetadata,
    loading: isLoading,
    error: error instanceof Error ? error.message : null
  };
};
