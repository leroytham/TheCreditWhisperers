/**
 * useRollingSentiment Hook
 *
 * Custom hook for fetching rolling-window sentiment data with different timeframes
 */

import { useState, useEffect } from 'react';

export const useRollingSentiment = (ticker, timeframe = '1D') => {
  const [data, setData] = useState([]);
  const [hasData, setHasData] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sourceEarliestDates, setSourceEarliestDates] = useState(null);

  useEffect(() => {
    // If ticker is null (lazy loading - tab not active), set loading to false immediately
    if (!ticker) {
      setLoading(false);
      return;
    }

    // Set loading immediately when ticker changes (before async fetch)
    setLoading(true);
    setError(null);

    const fetchRollingSentiment = async () => {
      try {
        const params = new URLSearchParams({
          ticker: ticker || '',
          timeframe: timeframe || ''
        });

        const response = await fetch(`/api/rolling-sentiment?${params.toString()}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Rolling sentiment API error (${response.status}):`, errorText);
          throw new Error(`Failed to fetch rolling sentiment: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[useRollingSentiment] Response:', result);

        setData(result.data || []);
        setHasData(result.has_data !== false);
        setSourceEarliestDates(result.source_earliest_dates || null);
      } catch (err) {
        console.error('Error fetching rolling sentiment:', err);
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
