/**
 * useDailySentiment Hook
 *
 * Custom hook for fetching daily sentiment data
 * Supports different timeframes with corresponding day counts
 */

import { useState, useEffect } from 'react';

export const useDailySentiment = (ticker, timeframe = '7D') => {
  const [dailySentiment, setDailySentiment] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Map timeframe to number of days
  const getDaysFromTimeframe = (tf) => {
    const map = {
      '1D': 1,
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      'YTD': 365, // Will be calculated on backend
      '1Y': 365,
      '5Y': 1825, // 5 years
      '7D': 7  // Fallback for legacy usage
    };
    return map[tf] || 7;
  };

  useEffect(() => {
    const fetchDailySentiment = async () => {
      try {
        setLoading(true);
        setError(null);

        const days = getDaysFromTimeframe(timeframe);
        const response = await fetch(`/api/daily-sentiment?ticker=${ticker}&days=${days}`);
        const data = await response.json();

        setDailySentiment(data.daily || {});
      } catch (err) {
        console.error('Error fetching daily sentiment:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (ticker) {
      fetchDailySentiment();
    }
  }, [ticker, timeframe]);

  return {
    dailySentiment,
    loading,
    error
  };
};
