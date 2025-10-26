// src/features/entity/hooks/useCompanyOverview.js

import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Custom hook to fetch company overview data from Alpha Vantage API
 * 
 * @param {string} ticker - Stock ticker symbol
 * @returns {Object} - { overview, loading, error }
 */
export const useCompanyOverview = (ticker) => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) {
      setLoading(false);
      return;
    }

    const fetchOverview = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await axios.get(
          `http://localhost:8000/stocks/${ticker}/company-overview`
        );
        
        if (response.data && response.data.data) {
          setOverview(response.data.data);
        } else {
          setOverview(null);
        }
      } catch (err) {
        console.error(`Error fetching company overview for ${ticker}:`, err);
        setError(err.response?.data?.detail || 'Failed to fetch company overview');
        setOverview(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, [ticker]);

  return { overview, loading, error };
};
