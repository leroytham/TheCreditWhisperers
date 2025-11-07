import { useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { usePortfolio, useIsDataStale } from '../context/PortfolioContext';
import apiService from '../services/api';

/**
 * Custom hook to fetch and manage portfolio holdings data
 *
 * Features:
 * - Automatic caching with staleness detection
 * - AbortController for cleanup
 * - Integrates with PortfolioContext
 * - Handles loading and error states
 *
 * @param {Object} options
 * @param {boolean} options.autoFetch - Automatically fetch on mount (default: true)
 * @param {number} options.cacheTime - Cache duration in ms (default: 5 minutes)
 * @returns {Object} { holdings, loading, error, refetch }
 */
export function useHoldings({ autoFetch = true, cacheTime = 5 * 60 * 1000 } = {}) {
  const {
    selectedAccount,
    holdings,
    loading,
    error,
    actions,
  } = usePortfolio();

  const isStale = useIsDataStale('holdings', cacheTime);
  const abortControllerRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Extract individual action functions to avoid recreating callback on every state change
  const { setHoldings, setLoading, setError } = actions;

  const fetchHoldings = useCallback(async (force = false) => {
    if (!selectedAccount) {
      setError('holdings', 'No account selected');
      return null;
    }

    // Return cached data if not stale and not forcing refresh
    // Note: holdings and isStale are accessed but not dependencies
    // to avoid infinite re-render loops
    if (!force && holdings && !isStale) {
      return holdings;
    }

    // Prevent multiple simultaneous requests
    if (isFetchingRef.current && !force) {
      return holdings;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    isFetchingRef.current = true;

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading('holdings', true);

    try {
      const response = await apiService.getPortfolioHoldings(
        selectedAccount.username,
        selectedAccount.accountName,
        { signal: abortControllerRef.current.signal }
      );

      const data = response.data;
      setHoldings(data.holdings || data);
      isFetchingRef.current = false;
      return data.holdings || data;
    } catch (err) {
      isFetchingRef.current = false;

      // Don't update state if request was aborted/canceled
      if (axios.isCancel(err)) {
        return null;
      }

      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load holdings';
      setError('holdings', errorMessage);
      throw err;
    }
    // Only depend on stable references and selectedAccount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount, setHoldings, setLoading, setError]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && selectedAccount) {
      fetchHoldings();
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // fetchHoldings is stable now with fixed dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, selectedAccount]); // Only refetch when account changes, not on every data update

  return {
    holdings,
    loading: loading.holdings,
    error: error.holdings,
    refetch: fetchHoldings,
  };
}

/**
 * Custom hook to fetch and manage portfolio performance data
 *
 * @param {Object} options
 * @param {boolean} options.autoFetch - Automatically fetch on mount (default: true)
 * @param {number} options.cacheTime - Cache duration in ms (default: 5 minutes)
 * @returns {Object} { performance, loading, error, refetch }
 */
export function usePerformance({ autoFetch = true, cacheTime = 5 * 60 * 1000 } = {}) {
  const {
    selectedAccount,
    performance,
    loading,
    error,
    actions,
  } = usePortfolio();

  const isStale = useIsDataStale('performance', cacheTime);
  const abortControllerRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Extract individual action functions to avoid recreating callback on every state change
  const { setPerformance, setLoading, setError } = actions;

  const fetchPerformance = useCallback(async (force = false) => {
    if (!selectedAccount) {
      setError('performance', 'No account selected');
      return null;
    }

    // Return cached data if not stale and not forcing refresh
    // Note: performance and isStale are accessed but not dependencies
    // to avoid infinite re-render loops
    if (!force && performance && !isStale) {
      return performance;
    }

    // Prevent multiple simultaneous requests
    if (isFetchingRef.current && !force) {
      return performance;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    isFetchingRef.current = true;

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading('performance', true);

    try {
      const response = await apiService.getPortfolioPerformance(
        selectedAccount.username,
        selectedAccount.accountName,
        '1Y',
        { signal: abortControllerRef.current.signal }
      );

      const data = response.data;
      setPerformance(data);
      isFetchingRef.current = false;
      return data;
    } catch (err) {
      isFetchingRef.current = false;

      // Don't update state if request was aborted/canceled
      if (axios.isCancel(err)) {
        return null;
      }

      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load performance data';
      setError('performance', errorMessage);
      throw err;
    }
    // Only depend on stable references and selectedAccount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount, setPerformance, setLoading, setError]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && selectedAccount) {
      fetchPerformance();
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // fetchPerformance is stable now with fixed dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, selectedAccount]); // Only refetch when account changes, not on every data update

  return {
    performance,
    loading: loading.performance,
    error: error.performance,
    refetch: fetchPerformance,
  };
}

/**
 * Custom hook to get current account context
 *
 * Simple wrapper around usePortfolio for components that only need account info
 *
 * @returns {Object} { selectedAccount, selectAccount, clearAccount }
 */
export function useAccountContext() {
  const { selectedAccount, actions } = usePortfolio();

  return {
    selectedAccount,
    selectAccount: actions.selectAccount,
    clearAccount: actions.clearAccount,
    hasAccount: !!selectedAccount,
  };
}

/**
 * Hook to fetch portfolio data (combines holdings and performance)
 *
 * Useful for dashboard views that need both datasets
 *
 * @param {Object} options
 * @param {boolean} options.includeHoldings - Fetch holdings data (default: true)
 * @param {boolean} options.includePerformance - Fetch performance data (default: true)
 * @returns {Object} Combined data and state from both hooks
 */
export function usePortfolioData({
  includeHoldings = true,
  includePerformance = true,
} = {}) {
  const holdingsData = useHoldings({ autoFetch: includeHoldings });
  const performanceData = usePerformance({ autoFetch: includePerformance });

  const refetchAll = useCallback(async () => {
    const results = await Promise.all([
      includeHoldings ? holdingsData.refetch(true) : Promise.resolve(null),
      includePerformance ? performanceData.refetch(true) : Promise.resolve(null),
    ]);

    return {
      holdings: results[0],
      performance: results[1],
    };
    // Only depend on the refetch functions and flags
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingsData.refetch, performanceData.refetch, includeHoldings, includePerformance]);

  return {
    holdings: includeHoldings ? holdingsData.holdings : null,
    performance: includePerformance ? performanceData.performance : null,
    loading: {
      holdings: includeHoldings ? holdingsData.loading : false,
      performance: includePerformance ? performanceData.loading : false,
      any: (includeHoldings && holdingsData.loading) || (includePerformance && performanceData.loading),
    },
    error: {
      holdings: includeHoldings ? holdingsData.error : null,
      performance: includePerformance ? performanceData.error : null,
      any: (includeHoldings && holdingsData.error) || (includePerformance && performanceData.error),
    },
    refetch: refetchAll,
    refetchHoldings: holdingsData.refetch,
    refetchPerformance: performanceData.refetch,
  };
}
