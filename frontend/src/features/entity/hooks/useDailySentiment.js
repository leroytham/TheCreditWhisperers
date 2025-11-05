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
  // Note: This mapping is kept for reference but not used in API call
  // The backend handles timeframe-to-days conversion internally
  const getDaysFromTimeframe = (tf) => {
    const map = {
      '1D': 1,
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      'YTD': 365, // Will be calculated on backend
      '1Y': 365,
      '7D': 7  // Fallback for legacy usage
    };
    return map[tf] || 7;
  };

  useEffect(() => {
    const fetchDailySentiment = async () => {
      try {
        setLoading(true);
        setError(null);

        // Pass timeframe parameter to backend for proper news fetching
        // Backend will use timeframe to fetch appropriate amount of historical news
        const response = await fetch(`/api/daily-sentiment?ticker=${ticker}&timeframe=${timeframe}`);
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
