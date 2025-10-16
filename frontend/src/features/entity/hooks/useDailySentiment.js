/**
 * useDailySentiment Hook
 *
 * Custom hook for fetching daily sentiment data
 */

import { useState, useEffect } from 'react';

export const useDailySentiment = (ticker) => {
  const [dailySentiment, setDailySentiment] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDailySentiment = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/daily-sentiment?ticker=${ticker}`);
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
  }, [ticker]);

  return {
    dailySentiment,
    loading,
    error
  };
};
