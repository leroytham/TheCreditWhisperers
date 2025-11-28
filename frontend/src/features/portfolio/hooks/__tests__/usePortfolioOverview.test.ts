/**
 * usePortfolioOverview Hook Tests
 *
 * Tests for the unified portfolio data fetching hook that uses React Query
 * for parallel data fetching with caching and deduplication.
 */

import { renderHook } from '@testing-library/react';
import { useQueries } from '@tanstack/react-query';
import { usePortfolioOverview } from '../usePortfolioOverview';
import { useUser } from '../../../../hooks/useUser';
import { useSelectedAccount } from '../../../../hooks/useSelectedAccount';
import apiService from '../../../../services/api';

// Mock dependencies
jest.mock('@tanstack/react-query', () => ({
  useQueries: jest.fn(),
}));

jest.mock('../../../../hooks/useUser');
jest.mock('../../../../hooks/useSelectedAccount');
jest.mock('../../../../services/api');

const mockUseQueries = useQueries as jest.MockedFunction<typeof useQueries>;
const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;
const mockUseSelectedAccount = useSelectedAccount as jest.MockedFunction<typeof useSelectedAccount>;
const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Type for query configuration - used for mock call assertions
interface MockQueryConfig {
  queries: Array<{
    queryKey: unknown[];
    queryFn: () => Promise<unknown>;
    enabled?: boolean;
    staleTime?: number;
  }>;
}

describe('usePortfolioOverview', () => {
  // Default mock data
  const defaultUserState = {
    user: 'testuser',
    username: 'testuser',
    isAuthenticated: true,
    setUser: jest.fn(),
    logout: jest.fn(),
  };

  const defaultAccountState = {
    selectedAccount: {
      username: 'testuser',
      accountName: 'Main Portfolio',
      accountNumber: 'ACC-123',
    },
    selectAccount: jest.fn(),
    clearSelectedAccount: jest.fn(),
    hasAccount: true,
    username: 'testuser',
    accountName: 'Main Portfolio',
    accountNumber: 'ACC-123',
  };

  // Mock query result factory
  const createQueryResult = (overrides: Partial<{
    data: unknown;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => void;
  }> = {}) => ({
    data: overrides.data ?? null,
    isLoading: overrides.isLoading ?? false,
    isFetching: overrides.isFetching ?? false,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
    refetch: overrides.refetch ?? jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue(defaultUserState);
    mockUseSelectedAccount.mockReturnValue(defaultAccountState);
  });

  // Helper to setup useQueries mock
  const setupQueriesMock = (
    holdingsResult = createQueryResult(),
    performanceResult = createQueryResult(),
    accountsResult = createQueryResult()
  ) => {
    mockUseQueries.mockReturnValue([holdingsResult, performanceResult, accountsResult]);
  };

  describe('Query Configuration', () => {
    it('configures three parallel queries', () => {
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      expect(mockUseQueries).toHaveBeenCalledTimes(1);
      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      expect(config.queries).toHaveLength(3);
    });

    it('uses correct query keys for holdings', () => {
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      expect(config.queries[0].queryKey).toEqual([
        'portfolio',
        'holdings',
        'testuser',
        'Main Portfolio',
      ]);
    });

    it('uses correct query keys for performance', () => {
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      expect(config.queries[1].queryKey).toEqual([
        'portfolio',
        'performance',
        'testuser',
        'Main Portfolio',
      ]);
    });

    it('uses correct query keys for accounts', () => {
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      expect(config.queries[2].queryKey).toEqual(['accounts', 'testuser']);
    });

    it('enables holdings and performance queries when accountName exists', () => {
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      expect(config.queries[0].enabled).toBe(true);
      expect(config.queries[1].enabled).toBe(true);
    });

    it('disables holdings and performance queries when no accountName', () => {
      mockUseSelectedAccount.mockReturnValue({
        ...defaultAccountState,
        selectedAccount: null,
        hasAccount: false,
        accountName: null,
      });
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      expect(config.queries[0].enabled).toBe(false);
      expect(config.queries[1].enabled).toBe(false);
    });

    it('always enables accounts query', () => {
      mockUseSelectedAccount.mockReturnValue({
        ...defaultAccountState,
        selectedAccount: null,
        hasAccount: false,
        accountName: null,
      });
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      // Accounts query doesn't have enabled property, so it defaults to true
      expect(config.queries[2].enabled).toBeUndefined();
    });

    it('sets correct staleTime for queries', () => {
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      expect(config.queries[0].staleTime).toBe(5 * 60 * 1000); // Holdings: 5 min
      expect(config.queries[1].staleTime).toBe(5 * 60 * 1000); // Performance: 5 min
      expect(config.queries[2].staleTime).toBe(10 * 60 * 1000); // Accounts: 10 min
    });
  });

  describe('Username Resolution', () => {
    it('uses username from selectedAccount when available', () => {
      const accountWithDifferentUser = {
        ...defaultAccountState,
        selectedAccount: {
          username: 'account-user',
          accountName: 'Portfolio',
        },
        username: 'account-user',
      };
      mockUseSelectedAccount.mockReturnValue(accountWithDifferentUser);
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      expect(config.queries[0].queryKey[2]).toBe('account-user');
    });

    it('falls back to user from useUser when no selectedAccount username', () => {
      mockUseSelectedAccount.mockReturnValue({
        ...defaultAccountState,
        selectedAccount: null,
        username: null,
      });
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      expect(config.queries[2].queryKey[1]).toBe('testuser');
    });

    it('falls back to TestUser when no user available', () => {
      mockUseUser.mockReturnValue({
        ...defaultUserState,
        user: null,
        username: null,
        isAuthenticated: false,
      });
      mockUseSelectedAccount.mockReturnValue({
        ...defaultAccountState,
        selectedAccount: null,
        username: null,
      });
      setupQueriesMock();

      renderHook(() => usePortfolioOverview());

      const config = mockUseQueries.mock.calls[0][0] as MockQueryConfig;
      expect(config.queries[2].queryKey[1]).toBe('TestUser');
    });
  });

  describe('Holdings Data', () => {
    it('returns empty array when holdings data is null', () => {
      setupQueriesMock(createQueryResult({ data: null }));

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.holdings).toEqual([]);
    });

    it('returns holdings array when data is available', () => {
      const holdingsData = [
        { ticker: 'AAPL', quantity: 100, position: 15000 },
        { ticker: 'GOOGL', quantity: 50, position: 12500 },
      ];
      setupQueriesMock(createQueryResult({ data: holdingsData }));

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.holdings).toEqual(holdingsData);
    });

    it('returns holdingsLoading state', () => {
      setupQueriesMock(createQueryResult({ isLoading: true }));

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.holdingsLoading).toBe(true);
    });

    it('returns holdingsError when query fails', () => {
      const error = new Error('Failed to fetch holdings');
      setupQueriesMock(createQueryResult({ isError: true, error }));

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.holdingsError).toBe(error);
    });

    it('returns refetchHoldings function', () => {
      const refetchFn = jest.fn();
      setupQueriesMock(createQueryResult({ refetch: refetchFn }));

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.refetchHoldings).toBe(refetchFn);
    });
  });

  describe('Performance Data', () => {
    it('returns null when performance data is null', () => {
      setupQueriesMock(
        createQueryResult(),
        createQueryResult({ data: null })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.performance).toBeNull();
    });

    it('returns performance data when available', () => {
      const performanceData = {
        account_name: 'Main Portfolio',
        calculation_date: '2024-01-15',
        performance: [
          { period: 'MTD', portfolio_return: 0.025 },
          { period: 'YTD', portfolio_return: 0.12 },
        ],
      };
      setupQueriesMock(
        createQueryResult(),
        createQueryResult({ data: performanceData })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.performance).toEqual(performanceData);
    });

    it('returns performanceLoading state', () => {
      setupQueriesMock(
        createQueryResult(),
        createQueryResult({ isLoading: true })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.performanceLoading).toBe(true);
    });

    it('returns performanceError when query fails', () => {
      const error = new Error('Failed to fetch performance');
      setupQueriesMock(
        createQueryResult(),
        createQueryResult({ isError: true, error })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.performanceError).toBe(error);
    });

    it('returns refetchPerformance function', () => {
      const refetchFn = jest.fn();
      setupQueriesMock(
        createQueryResult(),
        createQueryResult({ refetch: refetchFn })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.refetchPerformance).toBe(refetchFn);
    });
  });

  describe('Accounts Data', () => {
    it('returns empty array when accounts data is null', () => {
      setupQueriesMock(
        createQueryResult(),
        createQueryResult(),
        createQueryResult({ data: null })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.accounts).toEqual([]);
    });

    it('returns accounts array when data is available', () => {
      const accountsData = [
        { client_account_name: 'Main Portfolio', account_no: 'ACC-123' },
        { client_account_name: 'IRA', account_no: 'ACC-456' },
      ];
      setupQueriesMock(
        createQueryResult(),
        createQueryResult(),
        createQueryResult({ data: accountsData })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.accounts).toEqual(accountsData);
    });

    it('returns accountsLoading state', () => {
      setupQueriesMock(
        createQueryResult(),
        createQueryResult(),
        createQueryResult({ isLoading: true })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.accountsLoading).toBe(true);
    });

    it('returns accountsError when query fails', () => {
      const error = new Error('Failed to fetch accounts');
      setupQueriesMock(
        createQueryResult(),
        createQueryResult(),
        createQueryResult({ isError: true, error })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.accountsError).toBe(error);
    });

    it('returns refetchAccounts function', () => {
      const refetchFn = jest.fn();
      setupQueriesMock(
        createQueryResult(),
        createQueryResult(),
        createQueryResult({ refetch: refetchFn })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.refetchAccounts).toBe(refetchFn);
    });
  });

  describe('Combined States', () => {
    it('returns isLoading true when any query is loading', () => {
      setupQueriesMock(
        createQueryResult({ isLoading: true }),
        createQueryResult({ isLoading: false }),
        createQueryResult({ isLoading: false })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.isLoading).toBe(true);
    });

    it('returns isLoading false when no query is loading', () => {
      setupQueriesMock(
        createQueryResult({ isLoading: false }),
        createQueryResult({ isLoading: false }),
        createQueryResult({ isLoading: false })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.isLoading).toBe(false);
    });

    it('returns isFetching true when any query is fetching', () => {
      setupQueriesMock(
        createQueryResult({ isFetching: false }),
        createQueryResult({ isFetching: true }),
        createQueryResult({ isFetching: false })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.isFetching).toBe(true);
    });

    it('returns isFetching false when no query is fetching', () => {
      setupQueriesMock(
        createQueryResult({ isFetching: false }),
        createQueryResult({ isFetching: false }),
        createQueryResult({ isFetching: false })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.isFetching).toBe(false);
    });

    it('returns isError true when any query has error', () => {
      setupQueriesMock(
        createQueryResult({ isError: false }),
        createQueryResult({ isError: false }),
        createQueryResult({ isError: true, error: new Error('Error') })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.isError).toBe(true);
    });

    it('returns isError false when no query has error', () => {
      setupQueriesMock(
        createQueryResult({ isError: false }),
        createQueryResult({ isError: false }),
        createQueryResult({ isError: false })
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.isError).toBe(false);
    });

    it('returns first error found among queries', () => {
      const error1 = new Error('Holdings error');
      const error2 = new Error('Performance error');
      setupQueriesMock(
        createQueryResult({ isError: true, error: error1 }),
        createQueryResult({ isError: true, error: error2 }),
        createQueryResult()
      );

      const { result } = renderHook(() => usePortfolioOverview());

      expect(result.current.error).toBe(error1);
    });

    it('returns undefined error when no query has error', () => {
      setupQueriesMock();

      const { result } = renderHook(() => usePortfolioOverview());

      // Optional chaining returns undefined when no error found
      expect(result.current.error).toBeUndefined();
    });
  });

  describe('Refetch All', () => {
    it('returns refetchAll function', () => {
      setupQueriesMock();

      const { result } = renderHook(() => usePortfolioOverview());

      expect(typeof result.current.refetchAll).toBe('function');
    });

    it('refetchAll calls refetch on all queries', () => {
      const refetchHoldings = jest.fn();
      const refetchPerformance = jest.fn();
      const refetchAccounts = jest.fn();

      setupQueriesMock(
        createQueryResult({ refetch: refetchHoldings }),
        createQueryResult({ refetch: refetchPerformance }),
        createQueryResult({ refetch: refetchAccounts })
      );

      const { result } = renderHook(() => usePortfolioOverview());
      result.current.refetchAll();

      expect(refetchHoldings).toHaveBeenCalled();
      expect(refetchPerformance).toHaveBeenCalled();
      expect(refetchAccounts).toHaveBeenCalled();
    });
  });

  describe('Return Value Shape', () => {
    it('returns all expected properties', () => {
      setupQueriesMock();

      const { result } = renderHook(() => usePortfolioOverview());

      // Holdings
      expect(result.current).toHaveProperty('holdings');
      expect(result.current).toHaveProperty('holdingsLoading');
      expect(result.current).toHaveProperty('holdingsError');
      expect(result.current).toHaveProperty('refetchHoldings');

      // Performance
      expect(result.current).toHaveProperty('performance');
      expect(result.current).toHaveProperty('performanceLoading');
      expect(result.current).toHaveProperty('performanceError');
      expect(result.current).toHaveProperty('refetchPerformance');

      // Accounts
      expect(result.current).toHaveProperty('accounts');
      expect(result.current).toHaveProperty('accountsLoading');
      expect(result.current).toHaveProperty('accountsError');
      expect(result.current).toHaveProperty('refetchAccounts');

      // Combined
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isFetching');
      expect(result.current).toHaveProperty('isError');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetchAll');
    });
  });
});
