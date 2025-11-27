import type { AppStoreState } from '../../types/store';

/**
 * Default mock state for Zustand store
 * Provides sensible defaults for all store properties
 */
export const defaultMockState: Partial<AppStoreState> = {
  // User State
  user: null,
  isAuthenticated: false,

  // Selected Account
  selectedAccount: null,

  // UI State
  theme: 'light',
  sidebarOpen: true,

  // Selected Ticker
  selectedTicker: null,
  selectedTimeframe: '1D',

  // Watchlist
  watchlist: [],

  // Recent Searches
  recentSearches: [],
  maxRecentSearches: 10,

  // Price Alerts
  priceAlerts: [],

  // Toasts (ephemeral UI notifications)
  toasts: [],

  // Preferences
  preferences: {
    showSentimentColors: true,
    autoRefresh: false,
    refreshInterval: 60000,
    compactView: false,
  },

  // Filters
  filters: {
    sentimentFilter: 'all',
    dateRange: '7d',
    newsSource: 'all',
  },

  // Cache
  lastRefresh: {},
};

/**
 * Mock action implementations
 * All actions are jest.fn() to allow verification in tests
 */
export const mockActions = {
  // User Actions
  setUser: jest.fn(),
  logout: jest.fn(),

  // Account Actions
  selectAccount: jest.fn(),
  clearSelectedAccount: jest.fn(),

  // UI Actions
  toggleTheme: jest.fn(),
  toggleSidebar: jest.fn(),
  setSidebarOpen: jest.fn(),

  // Ticker Actions
  setSelectedTicker: jest.fn(),
  setSelectedTimeframe: jest.fn(),

  // Watchlist Actions
  addToWatchlist: jest.fn(),
  removeFromWatchlist: jest.fn(),
  isInWatchlist: jest.fn().mockReturnValue(false),

  // Recent Searches Actions
  addRecentSearch: jest.fn(),
  clearRecentSearches: jest.fn(),

  // Price Alert Actions
  addPriceAlert: jest.fn(),
  removePriceAlert: jest.fn(),
  updatePriceAlert: jest.fn(),
  togglePriceAlert: jest.fn(),
  getActiveAlertsForTicker: jest.fn().mockReturnValue([]),

  // Toast Actions (ephemeral UI notifications)
  addToast: jest.fn(),
  removeToast: jest.fn(),
  clearToasts: jest.fn(),
  notifySuccess: jest.fn(),
  notifyError: jest.fn(),
  notifyWarning: jest.fn(),
  notifyInfo: jest.fn(),
  notifyWithMetadata: jest.fn(),

  // Preferences Actions
  updatePreferences: jest.fn(),

  // Filter Actions
  updateFilters: jest.fn(),
  resetFilters: jest.fn(),

  // Cache Actions
  setLastRefresh: jest.fn(),
  shouldRefresh: jest.fn().mockReturnValue(true),
};

/**
 * Create a mock Zustand store for testing
 *
 * @example
 * ```ts
 * // Basic usage
 * const mockStore = createMockStore();
 *
 * // With overrides
 * const mockStore = createMockStore({
 *   user: { email: 'test@example.com', name: 'Test User' },
 *   isAuthenticated: true,
 * });
 *
 * // In a test with jest.mock
 * jest.mock('../store/useAppStore', () => ({
 *   __esModule: true,
 *   default: jest.fn(() => createMockStore({ isAuthenticated: true })),
 * }));
 * ```
 */
export function createMockStore(overrides: Partial<AppStoreState> = {}): Partial<AppStoreState> {
  return {
    ...defaultMockState,
    ...mockActions,
    ...overrides,
  };
}

/**
 * Reset all mock functions to their initial state
 * Call this in beforeEach or afterEach to ensure clean tests
 *
 * @example
 * ```ts
 * afterEach(() => {
 *   resetStoreMocks();
 * });
 * ```
 */
export function resetStoreMocks(): void {
  Object.values(mockActions).forEach((mock) => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      (mock as jest.Mock).mockReset();
    }
  });

  // Reset default return values
  mockActions.isInWatchlist.mockReturnValue(false);
  mockActions.getActiveAlertsForTicker.mockReturnValue([]);
  mockActions.shouldRefresh.mockReturnValue(true);
}

/**
 * Create a mock store selector function
 * Useful for mocking useAppStore with selective state
 *
 * @example
 * ```ts
 * const useAppStore = jest.fn((selector) => {
 *   return selector(createMockStore({ isAuthenticated: true }));
 * });
 * ```
 */
export function createMockSelector(overrides: Partial<AppStoreState> = {}) {
  const store = createMockStore(overrides);
  return <T>(selector: (state: AppStoreState) => T): T => {
    return selector(store as AppStoreState);
  };
}
