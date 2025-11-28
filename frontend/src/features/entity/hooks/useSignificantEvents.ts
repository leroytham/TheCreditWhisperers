/**
 * useSignificantEvents Hook
 *
 * Custom hook for fetching significant events data
 * Optimized with React Query for automatic caching and background refetching
 */

import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import apiService from '../../../services/api';

interface RawEvent {
  start_date: string;
  total_move_pct: number;
  title?: string;
  description?: string;
  source?: string;
}

interface TransformedEvent extends RawEvent {
  trend: 'Upward' | 'Downward';
  end_date: string;
  days: number;
}

export const useSignificantEvents = (
  ticker: string | null,
  timeframe: string = '1D',
  options: Partial<UseQueryOptions<TransformedEvent[], Error>> = {}
) => {
  const queryClient = useQueryClient();
  const prefetchInitiated = useRef<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<TransformedEvent[], Error>({
    queryKey: ['significantEvents', ticker, timeframe],
    queryFn: async () => {
      const response = await apiService.getStockEvents(ticker!, timeframe);
      const responseData = response.data;

      const rawEvents: RawEvent[] = responseData.events || [];
      // Transform events to match UI expectations
      const transformedEvents: TransformedEvent[] = rawEvents.map((event: RawEvent) => {
        const movePct = event.total_move_pct * 100;
        return {
          ...event,
          trend: (movePct >= 0 ? 'Upward' : 'Downward') as 'Upward' | 'Downward',
          total_move_pct: movePct,
          end_date: event.start_date,
          days: 1
        };
      });

      return transformedEvents;
    },
    enabled: Boolean(ticker), // Only fetch if ticker is provided
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: 2, // Retry failed requests twice
    ...options // Allow overriding default options
  });

  // Background prefetch for all timeframes (only once per ticker)
  useEffect(() => {
    if (ticker && !prefetchInitiated.current.has(ticker)) {
      prefetchInitiated.current.add(ticker);

      // Prefetch other common timeframes in the background
      const timeframesToPrefetch = ['1W', '1M', '3M', '6M', '1Y'].filter(tf => tf !== timeframe);

      timeframesToPrefetch.forEach(tf => {
        queryClient.prefetchQuery({
          queryKey: ['significantEvents', ticker, tf],
          queryFn: async (): Promise<TransformedEvent[]> => {
            try {
              const response = await apiService.getStockEvents(ticker, tf);
              const responseData = response.data;
              const rawEvents: RawEvent[] = responseData.events || [];
              return rawEvents.map((event: RawEvent): TransformedEvent => {
                const movePct = event.total_move_pct * 100;
                return {
                  ...event,
                  trend: (movePct >= 0 ? 'Upward' : 'Downward') as 'Upward' | 'Downward',
                  total_move_pct: movePct,
                  end_date: event.start_date,
                  days: 1
                };
              });
            } catch {
              return [];
            }
          },
          staleTime: 5 * 60 * 1000,
        });
      });

      console.log(`[PREFETCH] Initiated background prefetch for significant events: ${ticker}`);
    }
  }, [ticker, timeframe, queryClient]);

  return {
    significantEvents: data || [],
    loading: isLoading,
    error: error?.message || null
  };
};
