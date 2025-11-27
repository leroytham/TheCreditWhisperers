import { useQueries } from "@tanstack/react-query";
import { useUser } from "../../../hooks/useUser";
import { useSelectedAccount } from "../../../hooks/useSelectedAccount";
import apiService from "../../../services/api";

/**
 * Unified hook for fetching all portfolio overview data in parallel.
 * Uses React Query for caching, deduplication, and parallel fetching.
 *
 * This hook replaces individual data fetching in components with a single,
 * optimized data loading strategy that:
 * - Fetches all data concurrently (not sequentially)
 * - Caches responses to prevent duplicate requests
 * - Deduplicates simultaneous requests for the same data
 * - Provides unified loading/error states
 *
 * @returns {Object} Combined data, loading, and error states for:
 *   - holdings: Portfolio holdings with P/L, sentiment, news volume
 *   - performance: MTD, QTD, YTD, ITD performance metrics
 *   - accounts: List of user accounts
 */
export function usePortfolioOverview() {
  const { username: userFromHook } = useUser();
  const { selectedAccount } = useSelectedAccount();

  // Get username from selected account or fall back to logged-in user
  const username = selectedAccount?.username || userFromHook || 'TestUser';

  // Extract account name from selectedAccount object
  const accountName = selectedAccount?.accountName;

  // Define all queries - React Query will fetch them in parallel
  const results = useQueries({
    queries: [
      // Query 1: Portfolio Holdings
      {
        queryKey: ["portfolio", "holdings", username, accountName],
        queryFn: async () => {
          if (!accountName) return null;
          const response = await apiService.getPortfolioHoldings(username, accountName);
          return response.data.holdings || [];
        },
        enabled: !!accountName,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
      // Query 2: Portfolio Performance
      {
        queryKey: ["portfolio", "performance", username, accountName],
        queryFn: async () => {
          if (!accountName) return null;
          const response = await apiService.getPortfolioPerformance(username, accountName, '1Y');
          return response.data;
        },
        enabled: !!accountName,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
      // Query 3: User Accounts
      {
        queryKey: ["accounts", username],
        queryFn: async () => {
          const response = await apiService.getPortfolioAccounts(username);
          return response.data.accounts || [];
        },
        staleTime: 10 * 60 * 1000, // 10 minutes - accounts change less frequently
      },
    ],
  });

  // Destructure results
  const [holdingsQuery, performanceQuery, accountsQuery] = results;

  // Calculate combined loading state
  const isLoading = results.some((query) => query.isLoading);
  const isFetching = results.some((query) => query.isFetching);
  const isError = results.some((query) => query.isError);

  // Get first error if any
  const error = results.find((query) => query.error)?.error;

  // Refetch all data
  const refetchAll = () => {
    results.forEach((query) => query.refetch());
  };

  return {
    // Holdings data
    holdings: holdingsQuery.data || [],
    holdingsLoading: holdingsQuery.isLoading,
    holdingsError: holdingsQuery.error,
    refetchHoldings: holdingsQuery.refetch,

    // Performance data
    performance: performanceQuery.data || null,
    performanceLoading: performanceQuery.isLoading,
    performanceError: performanceQuery.error,
    refetchPerformance: performanceQuery.refetch,

    // Accounts data
    accounts: accountsQuery.data || [],
    accountsLoading: accountsQuery.isLoading,
    accountsError: accountsQuery.error,
    refetchAccounts: accountsQuery.refetch,

    // Combined states
    isLoading, // True if any query is loading
    isFetching, // True if any query is fetching (includes background refetches)
    isError, // True if any query has errored
    error, // First error encountered
    refetchAll, // Refetch all queries
  };
}
