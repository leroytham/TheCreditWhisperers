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
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,

      // Error handling
      onError: (error) => {
        console.error('Query error:', error);
        // TODO: Send to error tracking service
      },
    },
    mutations: {
      // Global mutation defaults
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
        // TODO: Send to error tracking service
      },
    },
  },
});

export default queryClient;
