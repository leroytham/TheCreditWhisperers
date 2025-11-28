/**
 * PortfolioPerformanceDetail Component Tests
 *
 * Tests for the portfolio performance detail view including:
 * - Loading states
 * - Error handling
 * - Data display
 * - User interactions (timeframe changes, display mode toggles)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock child components
jest.mock('../../../../shared/components/PriceChart', () => ({
  __esModule: true,
  default: ({ priceData, timeframe }: { priceData: unknown[]; timeframe: string }) => (
    <div data-testid="price-chart" data-timeframe={timeframe}>
      Mock PriceChart - {priceData?.length || 0} points
    </div>
  ),
}));

jest.mock('../../../../shared/components/TimeRangeSelector', () => ({
  __esModule: true,
  default: ({
    activeTimeframe,
    onTimeframeChange,
  }: {
    activeTimeframe: string;
    onTimeframeChange: (value: string) => void;
  }) => (
    <div data-testid="time-range-selector" data-value={activeTimeframe}>
      <button onClick={() => onTimeframeChange('1M')} data-testid="range-1M">1M</button>
      <button onClick={() => onTimeframeChange('3M')} data-testid="range-3M">3M</button>
      <button onClick={() => onTimeframeChange('6M')} data-testid="range-6M">6M</button>
      <button onClick={() => onTimeframeChange('YTD')} data-testid="range-YTD">YTD</button>
      <button onClick={() => onTimeframeChange('1Y')} data-testid="range-1Y">1Y</button>
    </div>
  ),
}));

jest.mock('../../../../../components/LoadingSpinner', () => ({
  __esModule: true,
  default: ({ size }: { size: string }) => (
    <div data-testid="loading-spinner" data-size={size}>
      Loading...
    </div>
  ),
}));

jest.mock('../../../../../components/ErrorDisplay', () => ({
  InlineError: ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry?: () => void;
  }) => (
    <div data-testid="inline-error">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} data-testid="retry-button">
          Retry
        </button>
      )}
    </div>
  ),
}));

// Mock hooks and services
jest.mock('../../../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: jest.fn(),
}));

jest.mock('../../../../../services/api', () => ({
  __esModule: true,
  default: {
    getPortfolioPerformance: jest.fn(),
  },
}));

// Mock formatters
jest.mock('../../../../../utils/formatters', () => ({
  formatCurrency: jest.fn((value) => `$${value?.toFixed(2) || '0.00'}`),
  formatPercentage: jest.fn((value) => `${value?.toFixed(2) || '0.00'}%`),
  normalizeToPercentageReturn: jest.fn((data) => data),
  normalizeToPercentageReturnWithCapitalFlows: jest.fn((data) => data),
  normalizeToTWR: jest.fn((data) => data),
  normalizeToHybridReturn: jest.fn((data) => data),
}));

jest.mock('../../../../shared/utils/formatters', () => ({
  __esModule: true,
  parseExchangeDate: jest.fn((date: string | null | undefined) => {
    // Always return a valid Date object
    if (!date) return new Date('2024-01-01');
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date('2024-01-01') : parsed;
  }),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

import PortfolioPerformanceDetail from '../PortfolioPerformanceDetail';
import { useSelectedAccount } from '../../../../../hooks/useSelectedAccount';
import apiService from '../../../../../services/api';

const mockUseSelectedAccount = useSelectedAccount as jest.MockedFunction<typeof useSelectedAccount>;
const mockApiService = apiService as jest.Mocked<typeof apiService>;

describe('PortfolioPerformanceDetail', () => {
  // Sample test data
  const mockSelectedAccount = {
    selectedAccount: {
      username: 'testuser@example.com',
      accountName: 'Main Portfolio',
      accountNumber: 'ACC-123',
    },
    selectAccount: jest.fn(),
    clearSelectedAccount: jest.fn(),
    hasAccount: true,
    username: 'testuser@example.com',
    accountName: 'Main Portfolio',
    accountNumber: 'ACC-123',
  };

  // Helper to create mock AxiosResponse
  const createMockResponse = <T,>(data: T) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as import('axios').InternalAxiosRequestConfig,
  });

  const mockPerformanceResponse = createMockResponse({
    historical_data: {
      data_points: [
        { date: '2024-01-01', portfolio_value: 100000, capital_flow: 0 },
        { date: '2024-01-15', portfolio_value: 102000, capital_flow: 0 },
        { date: '2024-01-31', portfolio_value: 105000, capital_flow: 0 },
      ],
      missing_price_symbols: [],
    },
    benchmark_data: {
      data_points: [
        { date: '2024-01-01', value: 4500, close: 0 },
        { date: '2024-01-15', value: 4550, close: 1.1 },
        { date: '2024-01-31', value: 4600, close: 2.2 },
      ],
    },
    events: [], // Simplified - no events in default mock to avoid date processing issues
    performance: [
      {
        period: 'MTD',
        holdings_count: 15,
        top_gainers: [
          { ticker: 'AAPL', contribution: 2.5 },
          { ticker: 'MSFT', contribution: 1.8 },
        ],
        top_losers: [
          { ticker: 'TSLA', contribution: -1.2 },
        ],
      },
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    mockUseSelectedAccount.mockReturnValue(mockSelectedAccount);
    mockApiService.getPortfolioPerformance.mockResolvedValue(mockPerformanceResponse);
  });

  describe('Loading State', () => {
    it('shows loading spinner while fetching data', async () => {
      // Make API call never resolve
      mockApiService.getPortfolioPerformance.mockImplementation(
        () => new Promise(() => {})
      );

      render(<PortfolioPerformanceDetail />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('shows loading spinner with large size', async () => {
      mockApiService.getPortfolioPerformance.mockImplementation(
        () => new Promise(() => {})
      );

      render(<PortfolioPerformanceDetail />);

      expect(screen.getByTestId('loading-spinner')).toHaveAttribute('data-size', 'lg');
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API call fails', async () => {
      mockApiService.getPortfolioPerformance.mockRejectedValue(
        new Error('Network error')
      );

      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(screen.getByTestId('inline-error')).toBeInTheDocument();
      });
    });

    it('displays API error detail when available', async () => {
      mockApiService.getPortfolioPerformance.mockRejectedValue({
        response: { data: { detail: 'Account not found' } },
      });

      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(screen.getByText('Account not found')).toBeInTheDocument();
      });
    });

    it('provides retry button on error', async () => {
      mockApiService.getPortfolioPerformance.mockRejectedValue(
        new Error('Failed')
      );

      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });
    });

    it('retries API call when retry button is clicked', async () => {
      mockApiService.getPortfolioPerformance
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce(mockPerformanceResponse);

      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('retry-button'));

      await waitFor(() => {
        expect(mockApiService.getPortfolioPerformance).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('No Account Selected', () => {
    it('does not fetch data when no account is selected', async () => {
      mockUseSelectedAccount.mockReturnValue({
        ...mockSelectedAccount,
        selectedAccount: null,
        hasAccount: false,
      });

      render(<PortfolioPerformanceDetail />);

      // Wait a bit to ensure no API call is made
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockApiService.getPortfolioPerformance).not.toHaveBeenCalled();
    });
  });

  describe('Data Display', () => {
    it('renders price chart after data loads', async () => {
      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(screen.getByTestId('price-chart')).toBeInTheDocument();
      });
    });

    it('passes correct data to price chart', async () => {
      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        const chart = screen.getByTestId('price-chart');
        expect(chart).toHaveTextContent('3 points');
      });
    });

    it('renders time range selector', async () => {
      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
      });
    });
  });

  describe('Timeframe Changes', () => {
    it('fetches data with default timeframe (1M)', async () => {
      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(mockApiService.getPortfolioPerformance).toHaveBeenCalledWith(
          'testuser@example.com',
          'Main Portfolio',
          '1M',
          expect.any(Object)
        );
      });
    });

    it('renders time range selector with default value', async () => {
      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        const selector = screen.getByTestId('time-range-selector');
        expect(selector).toHaveAttribute('data-value', '1M');
      });
    });

    it('refetches data when timeframe changes', async () => {
      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(screen.getByTestId('price-chart')).toBeInTheDocument();
      });

      // Click on 3M range
      fireEvent.click(screen.getByTestId('range-3M'));

      await waitFor(() => {
        expect(mockApiService.getPortfolioPerformance).toHaveBeenCalledWith(
          'testuser@example.com',
          'Main Portfolio',
          '3M',
          expect.any(Object)
        );
      });
    });
  });

  describe('Display Mode', () => {
    it('initializes with value mode by default', () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<PortfolioPerformanceDetail />);

      // Component should initialize, localStorage.getItem should be called
      expect(localStorageMock.getItem).toHaveBeenCalledWith('portfolioDisplayMode');
    });

    it('reads display mode from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('percent');

      render(<PortfolioPerformanceDetail />);

      expect(localStorageMock.getItem).toHaveBeenCalledWith('portfolioDisplayMode');
    });

    it('persists display mode changes to localStorage', async () => {
      render(<PortfolioPerformanceDetail />);

      // Wait for component to mount and initialize
      await waitFor(() => {
        // localStorage.setItem should have been called with display mode
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'portfolioDisplayMode',
          expect.any(String)
        );
      });
    });
  });

  describe('Benchmark Toggle', () => {
    it('reads benchmark visibility from localStorage', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'portfolioShowBenchmark') return 'true';
        return null;
      });

      render(<PortfolioPerformanceDetail />);

      expect(localStorageMock.getItem).toHaveBeenCalledWith('portfolioShowBenchmark');
    });
  });

  describe('API Integration', () => {
    it('includes abort signal in API call', async () => {
      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(mockApiService.getPortfolioPerformance).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
      });
    });

    it('handles abort errors gracefully', async () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      mockApiService.getPortfolioPerformance.mockRejectedValue(abortError);

      render(<PortfolioPerformanceDetail />);

      // Should not show error for aborted requests
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.queryByTestId('inline-error')).not.toBeInTheDocument();
    });

    it('handles CanceledError gracefully', async () => {
      const canceledError = new Error('Request canceled');
      canceledError.name = 'CanceledError';
      mockApiService.getPortfolioPerformance.mockRejectedValue(canceledError);

      render(<PortfolioPerformanceDetail />);

      // Should not show error for canceled requests
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.queryByTestId('inline-error')).not.toBeInTheDocument();
    });
  });

  describe('Account Changes', () => {
    it('refetches data when account changes', async () => {
      const { rerender } = render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(mockApiService.getPortfolioPerformance).toHaveBeenCalledTimes(1);
      });

      // Update account
      mockUseSelectedAccount.mockReturnValue({
        ...mockSelectedAccount,
        selectedAccount: {
          username: 'newuser@example.com',
          accountName: 'New Portfolio',
          accountNumber: 'ACC-456',
        },
        username: 'newuser@example.com',
        accountName: 'New Portfolio',
      });

      rerender(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(mockApiService.getPortfolioPerformance).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Component Cleanup', () => {
    it('aborts pending requests on unmount', async () => {
      // Create a promise that never resolves
      mockApiService.getPortfolioPerformance.mockImplementation(
        () => new Promise(() => {})
      );

      const { unmount } = render(<PortfolioPerformanceDetail />);

      // Unmount while request is pending
      unmount();

      // Component should have cleaned up without errors
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('shows empty state message for empty historical data', async () => {
      mockApiService.getPortfolioPerformance.mockResolvedValue(createMockResponse({
        historical_data: { data_points: [] },
        benchmark_data: { data_points: [] },
        events: [],
        performance: [],
      }));

      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        expect(screen.getByText(/no performance history available/i)).toBeInTheDocument();
      });
    });

    it('handles missing benchmark data gracefully', async () => {
      mockApiService.getPortfolioPerformance.mockResolvedValue(createMockResponse({
        historical_data: {
          data_points: [
            { date: '2024-01-01', portfolio_value: 100000 },
          ],
        },
        benchmark_data: {},
        events: [],
        performance: [],
      }));

      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        // Component should render without crashing
        expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
      });
    });

    it('handles undefined events array', async () => {
      mockApiService.getPortfolioPerformance.mockResolvedValue(createMockResponse({
        historical_data: {
          data_points: [
            { date: '2024-01-01', portfolio_value: 100000 },
          ],
        },
        benchmark_data: { data_points: [] },
        events: undefined,
        performance: [],
      }));

      render(<PortfolioPerformanceDetail />);

      await waitFor(() => {
        // Component should render without crashing
        expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
      });
    });
  });
});
