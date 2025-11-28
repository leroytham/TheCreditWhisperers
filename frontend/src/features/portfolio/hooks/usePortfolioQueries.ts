// frontend/src/features/portfolio/hooks/usePortfolioQueries.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

// Type definitions
interface Portfolio {
  id: string;
  client_account_name: string;
  is_primary?: boolean;
  holdings?: unknown[];
}

/**
 * Query key factory for portfolio-related queries.
 *
 * Provides consistent, hierarchical query keys for:
 * - Cache invalidation
 * - Optimistic updates
 * - Prefetching
 *
 * Usage:
 *   queryClient.invalidateQueries({ queryKey: portfolioKeys.all });
 *   queryClient.invalidateQueries({ queryKey: portfolioKeys.lists() });
 */
export const portfolioKeys = {
  all: ['portfolios'] as const,
  lists: () => [...portfolioKeys.all, 'list'] as const,
  list: (username: string | undefined) => [...portfolioKeys.lists(), username] as const,
  details: () => [...portfolioKeys.all, 'detail'] as const,
  detail: (username: string | undefined, accountName: string | undefined) => [...portfolioKeys.details(), username, accountName] as const,
  holdings: (username: string | undefined, accountName: string | undefined) => [...portfolioKeys.detail(username, accountName), 'holdings'] as const,
  performance: (username: string | undefined, accountName: string | undefined, timeframe: string) => [
    ...portfolioKeys.detail(username, accountName),
    'performance',
    timeframe,
  ] as const,
};

/**
 * Fetch user's portfolio list.
 *
 * Replaces Zustand's loadUserPortfolios() async function.
 * Server state belongs in React Query, not Zustand.
 *
 * @param {string} username - User's identifier
 * @returns {Object} React Query result with portfolios data
 *
 * Usage:
 *   const { data: portfolios, isLoading, error } = useUserPortfolios('john@example.com');
 */
export function useUserPortfolios(username: string | undefined) {
  return useQuery({
    queryKey: portfolioKeys.list(username),
    queryFn: async () => {
      if (!username) throw new Error('Username required');
      const response = await apiService.getPortfolioAccounts(username);
      return response.data.accounts || [];
    },
    enabled: !!username,
    staleTime: 10 * 60 * 1000, // 10 minutes - accounts change infrequently
  });
}

/**
 * Mutation to set a portfolio as primary.
 *
 * Replaces Zustand's setPrimaryPortfolio() async function.
 * Uses optimistic updates for instant UI feedback.
 *
 * @returns {Object} React Query mutation with mutate function
 *
 * Usage:
 *   const setPrimary = useSetPrimaryMutation();
 *   setPrimary.mutate({ username: 'john@example.com', portfolioId: 'portfolio-123' });
 */
export function useSetPrimaryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ portfolioId }: { portfolioId: string; username?: string }) => {
      const response = await apiService.post(`/portfolios/${portfolioId}/set-primary`);
      return response.data;
    },
    onMutate: async ({ username, portfolioId }: { username?: string; portfolioId: string }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: portfolioKeys.list(username) });

      // Snapshot previous value for rollback
      const previousPortfolios = queryClient.getQueryData(portfolioKeys.list(username));

      // Optimistically update the cache
      queryClient.setQueryData(portfolioKeys.list(username), (old: any) => {
        if (!old) return old;
        return old.map((portfolio: any) => ({
          ...portfolio,
          is_primary: portfolio.id === portfolioId,
        }));
      });

      return { previousPortfolios };
    },
    onError: (err, { username }, context) => {
      // Rollback on error
      if (context?.previousPortfolios) {
        queryClient.setQueryData(portfolioKeys.list(username), context.previousPortfolios);
      }
    },
    onSettled: (data, error, { username }) => {
      // Refetch to ensure server state sync
      queryClient.invalidateQueries({ queryKey: portfolioKeys.list(username) });
    },
  });
}

/**
 * Mutation to add a new portfolio.
 *
 * @returns {Object} React Query mutation with mutate function
 *
 * Usage:
 *   const addPortfolio = useAddPortfolioMutation();
 *   addPortfolio.mutate({ portfolioData: {...}, username: 'john@example.com' });
 */
export function useAddPortfolioMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ portfolioData, username }: { portfolioData: unknown; username?: string }) => {
      const response = await apiService.addPortfolio(portfolioData);
      return response.data;
    },
    onSuccess: (_data, { username }) => {
      // Invalidate to refetch updated list
      queryClient.invalidateQueries({ queryKey: portfolioKeys.list(username) });
    },
  });
}

/**
 * Mutation to delete a portfolio.
 *
 * @returns {Object} React Query mutation with mutate function
 *
 * Usage:
 *   const deletePortfolio = useDeletePortfolioMutation();
 *   deletePortfolio.mutate({ username: 'john@example.com', accountName: 'Main Account' });
 */
export function useDeletePortfolioMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ username, accountName }: { username: string; accountName: string }) => {
      const response = await apiService.deletePortfolio(username, accountName);
      return response.data;
    },
    onMutate: async ({ username, accountName }) => {
      await queryClient.cancelQueries({ queryKey: portfolioKeys.list(username) });

      const previousPortfolios = queryClient.getQueryData(portfolioKeys.list(username));

      // Optimistically remove from list
      queryClient.setQueryData(portfolioKeys.list(username), (old: Portfolio[] | undefined) => {
        if (!old) return old;
        return old.filter((p) => p.client_account_name !== accountName);
      });

      return { previousPortfolios };
    },
    onError: (_err, { username }, context) => {
      if (context?.previousPortfolios) {
        queryClient.setQueryData(portfolioKeys.list(username), context.previousPortfolios);
      }
    },
    onSettled: (_data, _error, { username }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.list(username) });
    },
  });
}

/**
 * Hook to get the primary portfolio from cached data.
 *
 * @param {string} username - User's identifier
 * @returns {Object|null} Primary portfolio or first portfolio if none set
 *
 * Usage:
 *   const primaryPortfolio = usePrimaryPortfolio('john@example.com');
 */
export function usePrimaryPortfolio(username: string | undefined): Portfolio | null {
  const { data: portfolios = [] } = useUserPortfolios(username);

  if (!portfolios.length) return null;

  return portfolios.find((p: Portfolio) => p.is_primary) || portfolios[0];
}

export default {
  portfolioKeys,
  useUserPortfolios,
  useSetPrimaryMutation,
  useAddPortfolioMutation,
  useDeletePortfolioMutation,
  usePrimaryPortfolio,
};
