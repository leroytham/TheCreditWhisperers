// frontend/src/hooks/useNews.ts

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import apiService from '../services/api';
import { QUERY_KEYS, CACHE_TIMES } from '../config/constants';

interface NewsArticle {
  title?: string;
  link?: string;
  provider?: string;
  publish_date?: string;
  sentiment_score?: number | null;
  sentiment_label?: string;
  image?: string | null;
  summary?: string;
  tickers?: string[];
  relevance_score?: number | null;
  [key: string]: unknown;
}

interface NewsData {
  ticker?: string;
  news?: NewsArticle[];
  avg_score?: number;
  source_concentration_hhi?: number;
  concentration_interpretation?: string;
  top_sources?: Array<{ name: string; count: number }>;
  dominant_topic?: string;
  dominant_topic_weight?: number;
  dominant_topic_percentage?: number;
  topic_count?: number;
  sentiment_by_topic?: Record<string, number>;
  topic_weights?: Record<string, number>;
  [key: string]: unknown;
}

interface DailySentimentInfo {
  score?: number;
  count?: number;
  headlines?: string[];
}

interface StatsAccumulator {
  positive: number;
  negative: number;
  neutral: number;
}

/**
 * Custom hook for fetching news articles
 */
export const useNews = (ticker: string, options: Partial<UseQueryOptions<NewsData>> = {}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.NEWS, ticker],
    queryFn: async () => {
      const response = await apiService.getNews(ticker);
      return response.data;
    },
    enabled: !!ticker,
    staleTime: CACHE_TIMES.NEWS,
    retry: 2,
    select: (data) => ({
      ticker: data.ticker,
      news: data.news || [],
      avgScore: data.avg_score || 0,
      // Source & Topic Analysis
      sourceConcentrationHhi: data.source_concentration_hhi,
      concentrationInterpretation: data.concentration_interpretation,
      topSources: data.top_sources || [],
      dominantTopic: data.dominant_topic,
      dominantTopicWeight: data.dominant_topic_weight,
      dominantTopicPercentage: data.dominant_topic_percentage,
      topicCount: data.topic_count || 0,
      sentimentByTopic: data.sentiment_by_topic || {},
      topicWeights: data.topic_weights || {},
    }),
    ...options,
  });
};

/**
 * Custom hook for fetching categorized news
 */
export const useCategorizedNews = (ticker: string, startDate: string, endDate: string, options: Partial<UseQueryOptions<unknown>> = {}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.NEWS_CATEGORIZED, ticker, startDate, endDate],
    queryFn: async () => {
      const response = await apiService.getCategorizedNews(ticker, startDate, endDate);
      return response.data;
    },
    enabled: !!ticker && !!startDate && !!endDate,
    staleTime: CACHE_TIMES.NEWS,
    retry: 2,
    ...options,
  });
};

/**
 * Custom hook for fetching daily sentiment data
 */
export const useDailySentiment = (ticker: string, options: Partial<UseQueryOptions<unknown>> = {}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.DAILY_SENTIMENT, ticker],
    queryFn: async () => {
      const response = await apiService.getDailySentiment(ticker);
      return response.data;
    },
    enabled: !!ticker,
    staleTime: CACHE_TIMES.SENTIMENT,
    retry: 2,
    select: (data: unknown) => {
      const typedData = data as { ticker?: string; daily?: Record<string, DailySentimentInfo> };
      // Transform daily data into array format for charting
      const dailyArray = Object.entries(typedData.daily || {}).map(([date, info]) => ({
        date,
        score: info.score || 0,
        count: info.count || 0,
        headlines: info.headlines || [],
      }));

      return {
        ticker: typedData.ticker,
        daily: dailyArray,
        dailyMap: typedData.daily,
      };
    },
    ...options,
  });
};

/**
 * Hook for filtering news by sentiment
 */
export const useFilteredNews = (ticker: string, sentimentFilter = 'all') => {
  const { data, ...rest } = useNews(ticker);

  const filteredNews = data?.news?.filter((article: NewsArticle) => {
    if (sentimentFilter === 'all') return true;
    return article.sentiment_label === sentimentFilter;
  });

  return {
    data: {
      ...data,
      news: filteredNews || [],
      filteredCount: filteredNews?.length || 0,
      totalCount: data?.news?.length || 0,
    },
    ...rest,
  };
};

/**
 * Hook for getting news statistics
 */
export const useNewsStats = (ticker: string) => {
  const { data, isLoading, isError } = useNews(ticker);

  if (isLoading || isError || !data?.news) {
    return {
      total: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      avgScore: 0,
      isLoading,
      isError,
    };
  }

  const stats = data.news.reduce(
    (acc: StatsAccumulator, article: NewsArticle) => {
      const label = article.sentiment_label || 'Neutral';

      // Map Bullish/Bearish labels to positive/negative/neutral categories
      if (label === 'Bullish' || label === 'Somewhat-Bullish') {
        acc.positive += 1;
      } else if (label === 'Bearish' || label === 'Somewhat-Bearish') {
        acc.negative += 1;
      } else {
        acc.neutral += 1;
      }

      return acc;
    },
    { positive: 0, negative: 0, neutral: 0 }
  );

  return {
    total: data.news.length,
    ...stats,
    avgScore: data.avgScore,
    isLoading: false,
    isError: false,
  };
};
