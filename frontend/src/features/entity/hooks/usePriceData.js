/**
 * usePriceData Hook
 *
 * Custom hook for fetching and polling price data
 * Fetches 1Y of data for all timeframes
 * Optimized with React Query for automatic caching and background refetching
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { PRICE_POLL_INTERVAL } from '../../shared/utils/constants';

export const usePriceData = (ticker, timeframe = '1Y', options = {}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['price', ticker, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/price?ticker=${ticker}&timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch price data: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: Boolean(ticker), // Only fetch if ticker is provided
    staleTime: timeframe === '1D' ? 30 * 1000 : 5 * 60 * 1000, // 30s for 1D, 5min for historical
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchInterval: timeframe === '1D' ? PRICE_POLL_INTERVAL : false, // Poll only for 1D timeframe
    refetchIntervalInBackground: false, // Don't poll when tab is not visible
    retry: 2, // Retry failed requests twice
    ...options // Allow overriding default options
  });

  // Memoize return values to prevent unnecessary re-renders
  return useMemo(() => ({
    priceData1Y: data?.prices || [],
    companyName: data?.company_name || data?.longname || data?.shortname || '',
    currency: data?.currency || 'USD',
    exchange: data?.exchange || '',
    market: data?.market || '',
    marketState: data?.market_state || '',
    prevClose: data?.prev_close || null,
    lastFetched: data ? new Date() : null,
    loading: isLoading,
    error: error?.message || null
  }), [data, isLoading, error]);
};
