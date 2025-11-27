/**
 * useRollingSentiment Hook
 *
 * Custom hook for fetching rolling-window sentiment data with different timeframes
 */

import { useState, useEffect } from 'react';
import apiService from '../../../services/api';

export const useRollingSentiment = (ticker, timeframe = '1D') => {
  const [data, setData] = useState([]);
  const [hasData, setHasData] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sourceEarliestDates, setSourceEarliestDates] = useState(null);

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
      } catch (err) {
        console.error('[useRollingSentiment] Error fetching rolling sentiment:', err);
        setError(err.message);
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
