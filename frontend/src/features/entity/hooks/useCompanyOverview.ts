// src/features/entity/hooks/useCompanyOverview.ts

import { useState, useEffect } from 'react';
import apiService from '../../../services/api';
import type { CompanyOverview } from '../../../types';

interface UseCompanyOverviewReturn {
  overview: CompanyOverview | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch company overview data from Alpha Vantage API
 */
export const useCompanyOverview = (ticker: string): UseCompanyOverviewReturn => {
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) {
      setLoading(false);
      return;
    }

    const fetchOverview = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await apiService.getCompanyOverview(ticker);

        if (response.data && response.data.data) {
          setOverview(response.data.data);
        } else {
          setOverview(null);
        }
      } catch (err: unknown) {
        console.error(`Error fetching company overview for ${ticker}:`, err);
        const errorMessage = err instanceof Error
          ? err.message
          : (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to fetch company overview';
        setError(errorMessage);
        setOverview(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, [ticker]);

  return { overview, loading, error };
};
