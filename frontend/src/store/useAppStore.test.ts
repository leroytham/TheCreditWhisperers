/**
 * useAppStore Tests
 *
 * Comprehensive tests for the Zustand global application store including:
 * - User authentication state
 * - Account selection
 * - UI state (theme, sidebar)
 * - Watchlist management
 * - Recent searches
 * - Price alerts
 * - Notifications
 * - User preferences
 * - Filters
 * - Cache invalidation
 */

import { act, renderHook } from '@testing-library/react';
import useAppStore from './useAppStore';

// Helper to reset the store between tests
const resetStore = () => {
  const store = useAppStore.getState();
  useAppStore.setState({
    user: null,
    isAuthenticated: false,
    selectedAccount: null,
    theme: 'light',
    sidebarOpen: true,
    selectedTicker: null,
    selectedTimeframe: '1D',
    watchlist: [],
    recentSearches: [],
    maxRecentSearches: 10,
    priceAlerts: [],
    notifications: [],
    preferences: {
      showSentimentColors: true,
      autoRefresh: false,
      refreshInterval: 60000,
      compactView: false,
    },
    filters: {
      sentimentFilter: 'all',
      dateRange: '7d',
      newsSource: 'all',
    },
    lastRefresh: {},
  });
};

describe('useAppStore', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  // =========================================================================
  // USER STATE
  // =========================================================================
  describe('User State', () => {
    it('initializes with null user and false authentication', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('setUser sets user and authenticates', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setUser({ email: 'test@example.com', name: 'Test User' });
      });

      expect(result.current.user).toEqual({ email: 'test@example.com', name: 'Test User' });
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('setUser with null clears authentication', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setUser({ email: 'test@example.com', name: 'Test User' });
        result.current.setUser(null);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('logout clears user, authentication, and selected account', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setUser({ email: 'test@example.com', name: 'Test User' });
        result.current.selectAccount('test@example.com', 'Main Portfolio', 'ACC001');
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.selectedAccount).toBeNull();
    });
  });

  // =========================================================================
  // SELECTED ACCOUNT
  // =========================================================================
  describe('Selected Account', () => {
    it('initializes with null selected account', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.selectedAccount).toBeNull();
    });

    it('selectAccount sets the account', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectAccount('user@example.com', 'Investment Account', 'ACC123');
      });

      expect(result.current.selectedAccount).toEqual({
        username: 'user@example.com',
        accountName: 'Investment Account',
        accountNumber: 'ACC123',
      });
    });

    it('clearSelectedAccount clears the account', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectAccount('user@example.com', 'Investment Account');
        result.current.clearSelectedAccount();
      });

      expect(result.current.selectedAccount).toBeNull();
    });
  });

  // =========================================================================
  // UI STATE
  // =========================================================================
  describe('UI State', () => {
    it('initializes with light theme and open sidebar', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.theme).toBe('light');
      expect(result.current.sidebarOpen).toBe(true);
    });

    it('toggleTheme switches between light and dark', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe('dark');

      act(() => {
        result.current.toggleTheme();
      });
      expect(result.current.theme).toBe('light');
    });

    it('toggleSidebar switches sidebar state', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.toggleSidebar();
      });
      expect(result.current.sidebarOpen).toBe(false);

      act(() => {
        result.current.toggleSidebar();
      });
      expect(result.current.sidebarOpen).toBe(true);
    });

    it('setSidebarOpen sets specific state', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setSidebarOpen(false);
      });
      expect(result.current.sidebarOpen).toBe(false);

      act(() => {
        result.current.setSidebarOpen(true);
      });
      expect(result.current.sidebarOpen).toBe(true);
    });
  });

  // =========================================================================
  // SELECTED TICKER
  // =========================================================================
  describe('Selected Ticker', () => {
    it('initializes with null ticker and 1D timeframe', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.selectedTicker).toBeNull();
      expect(result.current.selectedTimeframe).toBe('1D');
    });

    it('setSelectedTicker updates the ticker', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setSelectedTicker('AAPL');
      });

      expect(result.current.selectedTicker).toBe('AAPL');
    });

    it('setSelectedTimeframe updates the timeframe', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setSelectedTimeframe('1W');
      });

      expect(result.current.selectedTimeframe).toBe('1W');
    });
  });

  // =========================================================================
  // WATCHLIST
  // =========================================================================
  describe('Watchlist', () => {
    it('initializes with empty watchlist', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.watchlist).toEqual([]);
    });

    it('addToWatchlist adds a ticker', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
      });

      expect(result.current.watchlist).toContain('AAPL');
    });

    it('addToWatchlist does not add duplicates', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
        result.current.addToWatchlist('AAPL');
      });

      expect(result.current.watchlist).toEqual(['AAPL']);
    });

    it('removeFromWatchlist removes a ticker', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
        result.current.addToWatchlist('MSFT');
        result.current.removeFromWatchlist('AAPL');
      });

      expect(result.current.watchlist).toEqual(['MSFT']);
    });

    it('isInWatchlist returns correct boolean', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
      });

      expect(result.current.isInWatchlist('AAPL')).toBe(true);
      expect(result.current.isInWatchlist('MSFT')).toBe(false);
    });
  });

  // =========================================================================
  // RECENT SEARCHES
  // =========================================================================
  describe('Recent Searches', () => {
    it('initializes with empty recent searches', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.recentSearches).toEqual([]);
    });

    it('addRecentSearch adds to the beginning', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRecentSearch('AAPL');
        result.current.addRecentSearch('MSFT');
      });

      expect(result.current.recentSearches).toEqual(['MSFT', 'AAPL']);
    });

    it('addRecentSearch moves existing ticker to front', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRecentSearch('AAPL');
        result.current.addRecentSearch('MSFT');
        result.current.addRecentSearch('AAPL');
      });

      expect(result.current.recentSearches).toEqual(['AAPL', 'MSFT']);
    });

    it('addRecentSearch respects maxRecentSearches', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        // Add 12 tickers (max is 10)
        for (let i = 0; i < 12; i++) {
          result.current.addRecentSearch(`TICK${i}`);
        }
      });

      expect(result.current.recentSearches.length).toBe(10);
      expect(result.current.recentSearches[0]).toBe('TICK11');
    });

    it('clearRecentSearches clears all searches', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRecentSearch('AAPL');
        result.current.addRecentSearch('MSFT');
        result.current.clearRecentSearches();
      });

      expect(result.current.recentSearches).toEqual([]);
    });
  });

  // =========================================================================
  // PRICE ALERTS
  // =========================================================================
  describe('Price Alerts', () => {
    it('initializes with empty price alerts', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.priceAlerts).toEqual([]);
    });

    it('addPriceAlert creates an alert with auto-generated fields', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addPriceAlert({
          ticker: 'AAPL',
          condition: 'above',
          price: 200,
          triggered: false,
        });
      });

      expect(result.current.priceAlerts).toHaveLength(1);
      expect(result.current.priceAlerts[0]).toMatchObject({
        ticker: 'AAPL',
        condition: 'above',
        price: 200,
        isActive: true,
        triggered: false,
      });
      expect(result.current.priceAlerts[0].id).toBeDefined();
      expect(result.current.priceAlerts[0].createdAt).toBeDefined();
    });

    it('removePriceAlert removes an alert by id', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addPriceAlert({ ticker: 'AAPL', condition: 'above', price: 200, triggered: false });
      });

      const alertId = result.current.priceAlerts[0].id;

      act(() => {
        result.current.removePriceAlert(alertId);
      });

      expect(result.current.priceAlerts).toHaveLength(0);
    });

    it('updatePriceAlert updates alert properties', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addPriceAlert({ ticker: 'AAPL', condition: 'above', price: 200, triggered: false });
      });

      const alertId = result.current.priceAlerts[0].id;

      act(() => {
        result.current.updatePriceAlert(alertId, { price: 250 });
      });

      expect(result.current.priceAlerts[0].price).toBe(250);
    });

    it('togglePriceAlert toggles isActive', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addPriceAlert({ ticker: 'AAPL', condition: 'above', price: 200, triggered: false });
      });

      const alertId = result.current.priceAlerts[0].id;

      act(() => {
        result.current.togglePriceAlert(alertId);
      });

      expect(result.current.priceAlerts[0].isActive).toBe(false);
    });

    it('getActiveAlertsForTicker returns filtered alerts', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addPriceAlert({ ticker: 'AAPL', condition: 'above', price: 200, triggered: false });
        result.current.addPriceAlert({ ticker: 'MSFT', condition: 'below', price: 300, triggered: false });
        result.current.addPriceAlert({ ticker: 'AAPL', condition: 'below', price: 150, triggered: false });
      });

      const aaplAlerts = result.current.getActiveAlertsForTicker('AAPL');
      expect(aaplAlerts).toHaveLength(2);
      expect(aaplAlerts.every((a) => a.ticker === 'AAPL')).toBe(true);
    });
  });

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================
  describe('Notifications', () => {
    it('initializes with empty notifications', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.notifications).toEqual([]);
    });

    it('addNotification creates a notification with defaults', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({
          message: 'Test notification',
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject({
        message: 'Test notification',
        type: 'info',
        category: 'System',
        isRead: false,
        isArchived: false,
        showAsToast: true,
      });
    });

    it('removeNotification removes by id', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ message: 'Test' });
      });

      const id = result.current.notifications[0].id;

      act(() => {
        result.current.removeNotification(id);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('markAsRead marks notification as read', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ message: 'Test' });
      });

      const id = result.current.notifications[0].id;

      act(() => {
        result.current.markAsRead(id);
      });

      expect(result.current.notifications[0].isRead).toBe(true);
    });

    it('markAllAsRead marks all notifications as read', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ message: 'Test 1' });
        result.current.addNotification({ message: 'Test 2' });
      });

      act(() => {
        result.current.markAllAsRead();
      });

      expect(result.current.notifications.every((n) => n.isRead)).toBe(true);
    });

    it('archiveNotification archives and hides from toast', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ message: 'Test' });
      });

      const id = result.current.notifications[0].id;

      act(() => {
        result.current.archiveNotification(id);
      });

      expect(result.current.notifications[0].isArchived).toBe(true);
      expect(result.current.notifications[0].showAsToast).toBe(false);
    });

    it('getUnreadCount returns correct count', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ message: 'Test 1' });
        result.current.addNotification({ message: 'Test 2' });
        result.current.addNotification({ message: 'Test 3' });
      });

      expect(result.current.getUnreadCount()).toBe(3);

      act(() => {
        result.current.markAsRead(result.current.notifications[0].id);
      });

      expect(result.current.getUnreadCount()).toBe(2);
    });

    it('clearNotifications clears all', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ message: 'Test 1' });
        result.current.addNotification({ message: 'Test 2' });
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    describe('Notification Helper Methods', () => {
      it('notifySuccess creates success notification', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.notifySuccess('Operation successful');
        });

        expect(result.current.notifications[0]).toMatchObject({
          type: 'success',
          message: 'Operation successful',
          priority: 'low',
        });
      });

      it('notifyError creates error notification without auto-dismiss', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.notifyError('Something went wrong');
        });

        expect(result.current.notifications[0]).toMatchObject({
          type: 'error',
          message: 'Something went wrong',
          priority: 'high',
          duration: null,
        });
      });

      it('notifyWarning creates warning notification', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.notifyWarning('Please review');
        });

        expect(result.current.notifications[0]).toMatchObject({
          type: 'warning',
          message: 'Please review',
          priority: 'medium',
        });
      });

      it('notifyInfo creates info notification', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.notifyInfo('FYI: Something happened');
        });

        expect(result.current.notifications[0]).toMatchObject({
          type: 'info',
          message: 'FYI: Something happened',
          priority: 'low',
        });
      });
    });
  });

  // =========================================================================
  // PREFERENCES
  // =========================================================================
  describe('Preferences', () => {
    it('initializes with default preferences', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.preferences).toEqual({
        showSentimentColors: true,
        autoRefresh: false,
        refreshInterval: 60000,
        compactView: false,
      });
    });

    it('updatePreferences merges with existing', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.updatePreferences({ autoRefresh: true });
      });

      expect(result.current.preferences.autoRefresh).toBe(true);
      expect(result.current.preferences.showSentimentColors).toBe(true);
    });
  });

  // =========================================================================
  // FILTERS
  // =========================================================================
  describe('Filters', () => {
    it('initializes with default filters', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.filters).toEqual({
        sentimentFilter: 'all',
        dateRange: '7d',
        newsSource: 'all',
      });
    });

    it('updateFilters merges with existing', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.updateFilters({ sentimentFilter: 'positive' });
      });

      expect(result.current.filters.sentimentFilter).toBe('positive');
      expect(result.current.filters.dateRange).toBe('7d');
    });

    it('resetFilters restores defaults', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.updateFilters({
          sentimentFilter: 'negative',
          dateRange: '30d',
          newsSource: 'reuters',
        });
        result.current.resetFilters();
      });

      expect(result.current.filters).toEqual({
        sentimentFilter: 'all',
        dateRange: '7d',
        newsSource: 'all',
      });
    });
  });

  // =========================================================================
  // CACHE INVALIDATION
  // =========================================================================
  describe('Cache Invalidation', () => {
    it('initializes with empty lastRefresh', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.lastRefresh).toEqual({});
    });

    it('setLastRefresh records current timestamp', () => {
      const { result } = renderHook(() => useAppStore());
      const before = Date.now();

      act(() => {
        result.current.setLastRefresh('holdings');
      });

      const after = Date.now();
      expect(result.current.lastRefresh['holdings']).toBeGreaterThanOrEqual(before);
      expect(result.current.lastRefresh['holdings']).toBeLessThanOrEqual(after);
    });

    it('shouldRefresh returns true when never refreshed', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.shouldRefresh('holdings')).toBe(true);
    });

    it('shouldRefresh returns false when recently refreshed', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setLastRefresh('holdings');
      });

      // Default maxAge is 60000ms (1 minute)
      expect(result.current.shouldRefresh('holdings')).toBe(false);
    });

    it('shouldRefresh returns true when maxAge exceeded', async () => {
      const { result } = renderHook(() => useAppStore());

      // Manually set an old timestamp
      act(() => {
        useAppStore.setState({
          lastRefresh: { holdings: Date.now() - 120000 }, // 2 minutes ago
        });
      });

      expect(result.current.shouldRefresh('holdings', 60000)).toBe(true);
    });

    it('shouldRefresh respects custom maxAge', () => {
      const { result } = renderHook(() => useAppStore());

      // Manually set an old timestamp (5 seconds ago)
      act(() => {
        useAppStore.setState({
          lastRefresh: { holdings: Date.now() - 5000 },
        });
      });

      // Should refresh with 1 second maxAge (data is 5 seconds old)
      expect(result.current.shouldRefresh('holdings', 1000)).toBe(true);

      // Should NOT refresh with 10 second maxAge (data is only 5 seconds old)
      expect(result.current.shouldRefresh('holdings', 10000)).toBe(false);
    });
  });
});
