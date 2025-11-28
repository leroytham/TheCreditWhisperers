/**
 * useRollingSentiment Hook
 *
 * Custom hook for fetching rolling-window sentiment data with different timeframes
 */

import { useState, useEffect } from 'react';
import apiService from '../../../services/api';

interface SentimentHeadline {
  link?: string;
  title?: string;
  sentiment_score?: number;
  relevance_score?: number;
  source?: string;
}

interface RollingSentimentDataPoint {
  timestamp?: string;
  date?: string;
  label?: string;
  volume: number;
  sentiment: number;
  headlines?: SentimentHeadline[];
}

interface SourceEarliestDates {
  [source: string]: string;
}

export const useRollingSentiment = (ticker: string | null, timeframe: string = '1D') => {
  const [data, setData] = useState<RollingSentimentDataPoint[]>([]);
  const [hasData, setHasData] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceEarliestDates, setSourceEarliestDates] = useState<SourceEarliestDates | null>(null);

  useEffect(() => {
    console.log('[useRollingSentiment] Effect triggered:', { ticker, timeframe });

    // If ticker is null (lazy loading - tab not active), set loading to false immediately
    if (!ticker) {
      console.log('[useRollingSentiment] Ticker is null, skipping fetch');
      setLoading(false);
      return;
    }

    // Set loading immediately when ticker changes (before async fetch)
    setLoading(true);
    setError(null);

    const fetchRollingSentiment = async () => {
      try {
        console.log('[useRollingSentiment] Fetching:', { ticker, timeframe });

        const response = await apiService.getRollingSentiment(ticker, timeframe);
        const result = response.data;
        console.log('[useRollingSentiment] Response:', result);

        setData(result.data || []);
        setHasData(result.has_data !== false);
        setSourceEarliestDates(result.source_earliest_dates || null);
      } catch (err: unknown) {
        console.error('[useRollingSentiment] Error fetching rolling sentiment:', err);
        const error = err as { message?: string };
        setError(error.message || 'Failed to fetch rolling sentiment');
        setData([]);
        setHasData(false);
        setSourceEarliestDates(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRollingSentiment();
  }, [ticker, timeframe]);

  return {
    data,
    hasData,
    loading,
    error,
    sourceEarliestDates
  };
};
