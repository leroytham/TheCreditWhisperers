// src/features/entity/hooks/useSourceReliability.ts

import { useState, useEffect, useCallback } from 'react';
import apiService from '../../../services/api';

interface SourceReliability {
  source: string;
  count: number;
  avgSentiment?: number;
  reliability?: number;
}

/**
 * Custom hook to fetch news source reliability and sentiment breakdown
 *
 * @param ticker - Stock ticker symbol (e.g., 'AAPL')
 * @returns { sources, loading, error, refetch }
 */
export const useSourceReliability = (ticker: string | null) => {
  const [sources, setSources] = useState<SourceReliability[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = async () => {
    if (!ticker) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getNewsSources(ticker);
      const data = response.data;
      setSources(data.sources || []);
    } catch (err: unknown) {
      console.error('Error fetching source reliability:', err);
      const error = err as { message?: string };
      setError(error.message || 'Failed to fetch source reliability');
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [ticker]);

  return {
    sources,
    loading,
    error,
    refetch: fetchSources
  };
};
