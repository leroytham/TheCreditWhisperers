import { QueryClient } from '@tanstack/react-query';

/**
 * Create a QueryClient configured for testing
 * - Disables retries for predictable behavior
 * - Disables caching between tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Mock query result for success state
 */
export function createSuccessQueryResult<T>(data: T) {
  return {
    data,
    isLoading: false,
    isError: false,
    isSuccess: true,
    isFetching: false,
    isPending: false,
    error: null,
    status: 'success' as const,
    fetchStatus: 'idle' as const,
    refetch: jest.fn(),
  };
}

/**
 * Mock query result for loading state
 */
export function createLoadingQueryResult<T = unknown>() {
  return {
    data: undefined as T | undefined,
    isLoading: true,
    isError: false,
    isSuccess: false,
    isFetching: true,
    isPending: true,
    error: null,
    status: 'pending' as const,
    fetchStatus: 'fetching' as const,
    refetch: jest.fn(),
  };
}

/**
 * Mock query result for error state
 */
export function createErrorQueryResult<T = unknown>(error: Error = new Error('Test error')) {
  return {
    data: undefined as T | undefined,
    isLoading: false,
    isError: true,
    isSuccess: false,
    isFetching: false,
    isPending: false,
    error,
    status: 'error' as const,
    fetchStatus: 'idle' as const,
    refetch: jest.fn(),
  };
}

/**
 * Mock mutation result for idle state
 */
export function createIdleMutationResult<T = unknown>() {
  return {
    data: undefined as T | undefined,
    isLoading: false,
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    error: null,
    status: 'idle' as const,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    reset: jest.fn(),
  };
}

/**
 * Mock mutation result for pending state
 */
export function createPendingMutationResult<T = unknown>() {
  return {
    data: undefined as T | undefined,
    isLoading: true,
    isPending: true,
    isError: false,
    isSuccess: false,
    isIdle: false,
    error: null,
    status: 'pending' as const,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    reset: jest.fn(),
  };
}

/**
 * Mock mutation result for success state
 */
export function createSuccessMutationResult<T>(data: T) {
  return {
    data,
    isLoading: false,
    isPending: false,
    isError: false,
    isSuccess: true,
    isIdle: false,
    error: null,
    status: 'success' as const,
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue(data),
    reset: jest.fn(),
  };
}

/**
 * Mock mutation result for error state
 */
export function createErrorMutationResult<T = unknown>(error: Error = new Error('Mutation error')) {
  return {
    data: undefined as T | undefined,
    isLoading: false,
    isPending: false,
    isError: true,
    isSuccess: false,
    isIdle: false,
    error,
    status: 'error' as const,
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockRejectedValue(error),
    reset: jest.fn(),
  };
}
