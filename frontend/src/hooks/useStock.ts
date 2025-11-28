// frontend/src/hooks/useStock.ts

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import apiService from '../services/api';
import { QUERY_KEYS, CACHE_TIMES } from '../config/constants';
import useAppStore from '../store/useAppStore';

/**
 * Custom hook for fetching stock price data
 */
export const useStockPrice = (ticker: string, timeframe = '1Y', options: Partial<UseQueryOptions<unknown>> = {}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_PRICE, ticker, timeframe],
    queryFn: async () => {
      const response = await apiService.getStockPrice(ticker, timeframe);
      return response.data;
    },
    enabled: !!ticker, // Only run if ticker is provided
    staleTime: CACHE_TIMES.STOCK_PRICE,
    retry: 2,
    ...options,
  });
};

/**
 * Custom hook for fetching historical stock data
 */
export const useStockHistorical = (ticker: string, timeframe = '1M', options: Partial<UseQueryOptions<unknown>> = {}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_HISTORICAL, ticker, timeframe],
    queryFn: async () => {
      const response = await apiService.getStockHistorical(ticker, timeframe);
      return response.data;
    },
    enabled: !!ticker,
    staleTime: CACHE_TIMES.STOCK_PRICE,
    retry: 2,
    ...options,
  });
};

/**
 * Custom hook for fetching stock sentiment
 */
export const useStockSentiment = (ticker: string, options: Partial<UseQueryOptions<unknown>> = {}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_SENTIMENT, ticker],
    queryFn: async () => {
      const response = await apiService.getStockSentiment(ticker);
      return response.data;
    },
    enabled: !!ticker,
    staleTime: CACHE_TIMES.SENTIMENT,
    retry: 2,
    ...options,
  });
};

/**
 * Custom hook for fetching significant stock events
 */
export const useStockEvents = (ticker: string, options: Partial<UseQueryOptions<unknown>> = {}) => {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_EVENTS, ticker],
    queryFn: async () => {
      const response = await apiService.getStockEvents(ticker);
      return response.data;
    },
    enabled: !!ticker,
    staleTime: 60 * 60 * 1000, // 1 hour - events don't change often
    retry: 2,
    ...options,
  });
};

/**
 * Combined hook that fetches all stock data at once
 */
export const useStockData = (ticker: string, timeframe = '1Y') => {
  const priceQuery = useStockPrice(ticker, timeframe);
  const sentimentQuery = useStockSentiment(ticker);
  const eventsQuery = useStockEvents(ticker);

  return {
    price: priceQuery,
    sentiment: sentimentQuery,
    events: eventsQuery,
    isLoading: priceQuery.isLoading || sentimentQuery.isLoading || eventsQuery.isLoading,
    isError: priceQuery.isError || sentimentQuery.isError || eventsQuery.isError,
    error: priceQuery.error || sentimentQuery.error || eventsQuery.error,
  };
};

/**
 * Hook for adding/removing stocks from watchlist
 */
export const useWatchlist = () => {
  const queryClient = useQueryClient();
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useAppStore();

  const addToWatchlistMutation = useMutation({
    mutationFn: async (ticker: string) => {
      addToWatchlist(ticker);
      return ticker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (ticker: string) => {
      removeFromWatchlist(ticker);
      return ticker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  return {
    watchlist,
    addToWatchlist: addToWatchlistMutation.mutate,
    removeFromWatchlist: removeFromWatchlistMutation.mutate,
    isInWatchlist,
    isAdding: addToWatchlistMutation.isPending,
    isRemoving: removeFromWatchlistMutation.isPending,
  };
};

/**
 * Hook for prefetching stock data (for hover effects, etc.)
 */
export const usePrefetchStock = () => {
  const queryClient = useQueryClient();

  return {
    prefetchPrice: (ticker: string, timeframe = '1Y') => {
      queryClient.prefetchQuery({
        queryKey: [QUERY_KEYS.STOCK_PRICE, ticker, timeframe],
        queryFn: async () => {
          const response = await apiService.getStockPrice(ticker, timeframe);
          return response.data;
        },
        staleTime: CACHE_TIMES.STOCK_PRICE,
      });
    },
    prefetchSentiment: (ticker: string) => {
      queryClient.prefetchQuery({
        queryKey: [QUERY_KEYS.STOCK_SENTIMENT, ticker],
        queryFn: async () => {
          const response = await apiService.getStockSentiment(ticker);
          return response.data;
        },
        staleTime: CACHE_TIMES.SENTIMENT,
      });
    },
  };
};
