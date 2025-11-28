// src/features/entity/hooks/useSourceReliability.js

import { useState, useEffect } from 'react';
import apiService from '../../../services/api';

/**
 * Custom hook to fetch news source reliability and sentiment breakdown
 *
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @returns {Object} - { sources, loading, error, refetch }
 */
export const useSourceReliability = (ticker) => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    } catch (err) {
      console.error('Error fetching source reliability:', err);
      setError(err.message);
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
