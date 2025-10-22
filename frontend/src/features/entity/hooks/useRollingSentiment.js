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
    const fetchRollingSentiment = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/rolling-sentiment?ticker=${ticker}&timeframe=${timeframe}`);
        const result = await response.json();

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

    if (ticker) {
      fetchRollingSentiment();
    }
  }, [ticker, timeframe]);

  return {
    data,
    hasData,
    loading,
    error,
    sourceEarliestDates
  };
};
