// frontend/src/utils/queryClient.js

import { QueryClient } from '@tanstack/react-query';

/**
 * Create and configure React Query client
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global query defaults
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      // Note: onError removed in React Query v5 - use throwOnError or meta for error handling
    },
    mutations: {
      // Global mutation defaults
      retry: 1,
      // Note: onError removed in React Query v5 - use throwOnError or meta for error handling
    },
  },
});

export default queryClient;
