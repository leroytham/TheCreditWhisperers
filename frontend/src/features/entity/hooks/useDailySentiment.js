/**
 * useDailySentiment Hook
 *
 * Custom hook for fetching daily sentiment data
 * Supports different timeframes with corresponding day counts
 * Optimized with React Query for automatic caching and background refetching
 */

import { useQuery } from '@tanstack/react-query';

export const useDailySentiment = (ticker, timeframe = '1W', options = {}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dailySentiment', ticker, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/daily-sentiment?ticker=${ticker}&timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch daily sentiment: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: Boolean(ticker), // Only fetch if ticker is provided
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: 2, // Retry failed requests twice
    ...options // Allow overriding default options
  });

  return {
    dailySentiment: data?.daily || {},
    loading: isLoading,
    error: error?.message || null
  };
};
