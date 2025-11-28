/**
 * useDailySentiment Hook
 *
 * Custom hook for fetching daily sentiment data
 * Supports different timeframes with corresponding day counts
 * Optimized with React Query for automatic caching and background refetching
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import apiService from '../../../services/api';
import type { DailySentimentPoint, TimeframeOption } from '../../../types';

interface DailySentimentResponse {
  daily?: Record<string, DailySentimentPoint>;
}

interface UseDailySentimentReturn {
  dailySentiment: Record<string, DailySentimentPoint>;
  loading: boolean;
  error: string | null;
}

export const useDailySentiment = (
  ticker: string,
  timeframe: TimeframeOption | string = '1W',
  options: Partial<UseQueryOptions<DailySentimentResponse>> = {}
): UseDailySentimentReturn => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dailySentiment', ticker, timeframe],
    queryFn: async () => {
      const response = await apiService.getDailySentiment(ticker, timeframe);
      return response.data;
    },
    enabled: Boolean(ticker), // Only fetch if ticker is provided
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: 2, // Retry failed requests twice
    ...options // Allow overriding default options
  });

  return {
    dailySentiment: data?.daily || {},
    loading: isLoading,
    error: error instanceof Error ? error.message : null
  };
};
