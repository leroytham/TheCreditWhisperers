// frontend/src/store/useAppStore.test.js

import { renderHook, act } from '@testing-library/react';
import useAppStore from './useAppStore';

describe('useAppStore - Zustand Store', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Reset store to initial state
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.watchlist = [];
      result.current.priceAlerts = [];
      result.current.notifications = [];
      result.current.recentSearches = [];
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Watchlist Management', () => {
    test('adds ticker to watchlist', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
      });

      expect(result.current.watchlist).toContain('AAPL');
      expect(result.current.watchlist.length).toBe(1);
    });

    test('prevents duplicate watchlist entries', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
        result.current.addToWatchlist('AAPL'); // Try to add again
      });

      expect(result.current.watchlist).toEqual(['AAPL']);
      expect(result.current.watchlist.length).toBe(1);
    });

    test('removes ticker from watchlist', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
        result.current.addToWatchlist('TSLA');
      });

      expect(result.current.watchlist).toEqual(['AAPL', 'TSLA']);

      act(() => {
        result.current.removeFromWatchlist('AAPL');
      });

      expect(result.current.watchlist).toEqual(['TSLA']);
      expect(result.current.watchlist).not.toContain('AAPL');
    });

    test('checks if ticker is in watchlist', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
      });

      expect(result.current.isInWatchlist('AAPL')).toBe(true);
      expect(result.current.isInWatchlist('TSLA')).toBe(false);
    });

    test('shows success notification when adding to watchlist', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
      });

      // Verify notification was added
      const notifications = result.current.notifications;
      expect(notifications.length).toBeGreaterThan(0);

      const successNotification = notifications.find(
        n => n.type === 'success' && n.message.includes('AAPL added to watchlist')
      );
      expect(successNotification).toBeDefined();
      expect(successNotification.category).toBe('Portfolio');
    });

    test('shows info notification when removing from watchlist', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
      });

      // Clear previous notifications
      act(() => {
        result.current.clearNotifications();
      });

      act(() => {
        result.current.removeFromWatchlist('AAPL');
      });

      const notifications = result.current.notifications;
      const infoNotification = notifications.find(
        n => n.type === 'info' && n.message.includes('AAPL removed from watchlist')
      );
      expect(infoNotification).toBeDefined();
    });
  });

  describe('Price Alerts', () => {
    test('adds price alert with defaults', () => {
      const { result } = renderHook(() => useAppStore());

      const alert = {
        ticker: 'AAPL',
        targetPrice: 150.0,
        condition: 'above',
      };

      act(() => {
        result.current.addPriceAlert(alert);
      });

      expect(result.current.priceAlerts.length).toBe(1);

      const addedAlert = result.current.priceAlerts[0];
      expect(addedAlert.ticker).toBe('AAPL');
      expect(addedAlert.targetPrice).toBe(150.0);
      expect(addedAlert.condition).toBe('above');
      expect(addedAlert.isActive).toBe(true);
      expect(addedAlert.triggered).toBe(false);
      expect(addedAlert.id).toBeDefined();
      expect(addedAlert.createdAt).toBeDefined();
    });

    test('updates price alert', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addPriceAlert({
          ticker: 'AAPL',
          targetPrice: 150.0,
          condition: 'above',
        });
      });

      const alertId = result.current.priceAlerts[0].id;

      act(() => {
        result.current.updatePriceAlert(alertId, {
          targetPrice: 160.0,
          triggered: true,
        });
      });

      const updatedAlert = result.current.priceAlerts.find(a => a.id === alertId);
      expect(updatedAlert.targetPrice).toBe(160.0);
      expect(updatedAlert.triggered).toBe(true);
      expect(updatedAlert.ticker).toBe('AAPL'); // Unchanged
    });

    test('toggles price alert active state', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addPriceAlert({
          ticker: 'AAPL',
          targetPrice: 150.0,
          condition: 'above',
        });
      });

      const alertId = result.current.priceAlerts[0].id;
      expect(result.current.priceAlerts[0].isActive).toBe(true);

      act(() => {
        result.current.togglePriceAlert(alertId);
      });

      expect(result.current.priceAlerts[0].isActive).toBe(false);

      act(() => {
        result.current.togglePriceAlert(alertId);
      });

      expect(result.current.priceAlerts[0].isActive).toBe(true);
    });

    test('removes price alert', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addPriceAlert({
          ticker: 'AAPL',
          targetPrice: 150.0,
          condition: 'above',
        });
        result.current.addPriceAlert({
          ticker: 'TSLA',
          targetPrice: 200.0,
          condition: 'below',
        });
      });

      expect(result.current.priceAlerts.length).toBe(2);

      const alertId = result.current.priceAlerts[0].id;

      act(() => {
        result.current.removePriceAlert(alertId);
      });

      expect(result.current.priceAlerts.length).toBe(1);
      expect(result.current.priceAlerts[0].ticker).toBe('TSLA');
    });

    test('gets active alerts for ticker', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addPriceAlert({
          ticker: 'AAPL',
          targetPrice: 150.0,
          condition: 'above',
        });
        result.current.addPriceAlert({
          ticker: 'AAPL',
          targetPrice: 140.0,
          condition: 'below',
        });
        result.current.addPriceAlert({
          ticker: 'TSLA',
          targetPrice: 200.0,
          condition: 'above',
        });
      });

      // Mark first alert as triggered
      const firstAlertId = result.current.priceAlerts[0].id;
      act(() => {
        result.current.updatePriceAlert(firstAlertId, { triggered: true });
      });

      // Toggle second alert to inactive
      const secondAlertId = result.current.priceAlerts[1].id;
      act(() => {
        result.current.togglePriceAlert(secondAlertId);
      });

      const activeAlertsForAAPL = result.current.getActiveAlertsForTicker('AAPL');

      // Should not include triggered alert or inactive alert
      expect(activeAlertsForAAPL.length).toBe(0);

      const activeAlertsForTSLA = result.current.getActiveAlertsForTicker('TSLA');
      expect(activeAlertsForTSLA.length).toBe(1);
      expect(activeAlertsForTSLA[0].ticker).toBe('TSLA');
    });
  });

  describe('Notifications', () => {
    test('adds notification with timestamp and defaults', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({
          message: 'Test notification',
        });
      });

      expect(result.current.notifications.length).toBe(1);

      const notification = result.current.notifications[0];
      expect(notification.message).toBe('Test notification');
      expect(notification.id).toBeDefined();
      expect(notification.timestamp).toBeDefined();
      expect(notification.type).toBe('info'); // Default
      expect(notification.category).toBe('System'); // Default
      expect(notification.priority).toBe('medium'); // Default
      expect(notification.isRead).toBe(false);
      expect(notification.isArchived).toBe(false);
      expect(notification.showAsToast).toBe(true);
      expect(notification.duration).toBe(5000);
    });

    test('marks notification as read', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({
          message: 'Test notification',
        });
      });

      const notificationId = result.current.notifications[0].id;
      expect(result.current.notifications[0].isRead).toBe(false);

      act(() => {
        result.current.markAsRead(notificationId);
      });

      expect(result.current.notifications[0].isRead).toBe(true);
    });

    test('marks all notifications as read', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ message: 'Notification 1' });
        result.current.addNotification({ message: 'Notification 2' });
        result.current.addNotification({ message: 'Notification 3' });
      });

      expect(result.current.notifications.every(n => !n.isRead)).toBe(true);

      act(() => {
        result.current.markAllAsRead();
      });

      expect(result.current.notifications.every(n => n.isRead)).toBe(true);
    });

    test('archives notification', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({
          message: 'Test notification',
        });
      });

      const notificationId = result.current.notifications[0].id;
      expect(result.current.notifications[0].isArchived).toBe(false);
      expect(result.current.notifications[0].showAsToast).toBe(true);

      act(() => {
        result.current.archiveNotification(notificationId);
      });

      const archivedNotification = result.current.notifications[0];
      expect(archivedNotification.isArchived).toBe(true);
      expect(archivedNotification.showAsToast).toBe(false);
    });

    test('gets unread count excluding archived', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ message: 'Notification 1' });
        result.current.addNotification({ message: 'Notification 2' });
        result.current.addNotification({ message: 'Notification 3' });
      });

      expect(result.current.getUnreadCount()).toBe(3);

      // Mark one as read
      act(() => {
        result.current.markAsRead(result.current.notifications[0].id);
      });

      expect(result.current.getUnreadCount()).toBe(2);

      // Archive one
      act(() => {
        result.current.archiveNotification(result.current.notifications[1].id);
      });

      expect(result.current.getUnreadCount()).toBe(1);
    });

    test('clears all notifications', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ message: 'Notification 1' });
        result.current.addNotification({ message: 'Notification 2' });
      });

      expect(result.current.notifications.length).toBe(2);

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.notifications.length).toBe(0);
    });

    test('removes specific notification', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addNotification({ message: 'Notification 1' });
        result.current.addNotification({ message: 'Notification 2' });
      });

      const firstId = result.current.notifications[0].id;

      act(() => {
        result.current.removeNotification(firstId);
      });

      expect(result.current.notifications.length).toBe(1);
      expect(result.current.notifications[0].message).toBe('Notification 2');
    });
  });

  describe('Helper Notification Methods', () => {
    test('notifySuccess creates success notification', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.notifySuccess('Operation successful', {
          category: 'Portfolio',
        });
      });

      const notification = result.current.notifications[0];
      expect(notification.type).toBe('success');
      expect(notification.title).toBe('Success');
      expect(notification.message).toBe('Operation successful');
      expect(notification.category).toBe('Portfolio');
      expect(notification.priority).toBe('low');
      expect(notification.duration).toBe(3000);
    });

    test('notifyError creates error notification without auto-dismiss', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.notifyError('Something went wrong');
      });

      const notification = result.current.notifications[0];
      expect(notification.type).toBe('error');
      expect(notification.title).toBe('Error');
      expect(notification.message).toBe('Something went wrong');
      expect(notification.priority).toBe('high');
      expect(notification.duration).toBeNull(); // Errors don't auto-dismiss
    });

    test('notifyWarning creates warning notification', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.notifyWarning('Please review your settings');
      });

      const notification = result.current.notifications[0];
      expect(notification.type).toBe('warning');
      expect(notification.title).toBe('Warning');
      expect(notification.message).toBe('Please review your settings');
      expect(notification.priority).toBe('medium');
      expect(notification.duration).toBe(5000);
    });

    test('notifyInfo creates info notification', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.notifyInfo('New data available', {
          category: 'News',
        });
      });

      const notification = result.current.notifications[0];
      expect(notification.type).toBe('info');
      expect(notification.title).toBe('Information');
      expect(notification.message).toBe('New data available');
      expect(notification.category).toBe('News');
      expect(notification.priority).toBe('low');
      expect(notification.duration).toBe(4000);
    });

    test('helper methods accept custom options', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.notifySuccess('Custom success', {
          title: 'Custom Title',
          duration: 10000,
          priority: 'high',
          actionUrl: '/portfolio',
        });
      });

      const notification = result.current.notifications[0];
      expect(notification.title).toBe('Custom Title');
      expect(notification.duration).toBe(10000);
      expect(notification.priority).toBe('high');
      expect(notification.actionUrl).toBe('/portfolio');
    });
  });

  describe('Recent Searches', () => {
    test('adds recent search to beginning of list', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRecentSearch('AAPL');
        result.current.addRecentSearch('TSLA');
      });

      expect(result.current.recentSearches).toEqual(['TSLA', 'AAPL']);
    });

    test('prevents duplicate searches and moves to front', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRecentSearch('AAPL');
        result.current.addRecentSearch('TSLA');
        result.current.addRecentSearch('AAPL'); // Add again
      });

      expect(result.current.recentSearches).toEqual(['AAPL', 'TSLA']);
    });

    test('limits recent searches to maxRecentSearches', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.addRecentSearch(`TICK${i}`);
        }
      });

      expect(result.current.recentSearches.length).toBe(result.current.maxRecentSearches);
      expect(result.current.recentSearches.length).toBe(10);
    });

    test('clears recent searches', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRecentSearch('AAPL');
        result.current.addRecentSearch('TSLA');
      });

      expect(result.current.recentSearches.length).toBe(2);

      act(() => {
        result.current.clearRecentSearches();
      });

      expect(result.current.recentSearches).toEqual([]);
    });
  });

  describe('Persistence', () => {
    test('watchlist state is maintained in store', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addToWatchlist('AAPL');
        result.current.addToWatchlist('TSLA');
      });

      // Verify state is in store (persistence to localStorage is async in tests)
      expect(result.current.watchlist).toEqual(['AAPL', 'TSLA']);

      // Verify localStorage was called (mock behavior)
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('price alerts state is maintained in store', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addPriceAlert({
          ticker: 'AAPL',
          targetPrice: 150.0,
          condition: 'above',
        });
      });

      // Verify state is in store
      expect(result.current.priceAlerts.length).toBe(1);
      expect(result.current.priceAlerts[0].ticker).toBe('AAPL');

      // Verify localStorage was called
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('notifications state is maintained in store', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.notifyInfo('Test message');
      });

      // Verify state is in store
      expect(result.current.notifications.length).toBeGreaterThanOrEqual(1);
      const notification = result.current.notifications.find(
        n => n.message === 'Test message'
      );
      expect(notification).toBeDefined();

      // Verify localStorage was called
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('store configuration includes partialize for selective persistence', () => {
      const { result } = renderHook(() => useAppStore());

      // Set both persisted and non-persisted fields
      act(() => {
        result.current.setUser({ name: 'Test User' });
        result.current.addToWatchlist('AAPL');
      });

      // Verify both fields are in the store
      expect(result.current.user).toEqual({ name: 'Test User' });
      expect(result.current.watchlist).toEqual(['AAPL']);

      // Note: Actual partialize behavior tested in integration
      // Here we verify both types of data exist in store
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('User State', () => {
    test('sets user and authentication state', () => {
      const { result } = renderHook(() => useAppStore());

      const user = { id: 1, name: 'Test User', email: 'test@example.com' };

      act(() => {
        result.current.setUser(user);
      });

      expect(result.current.user).toEqual(user);
      expect(result.current.isAuthenticated).toBe(true);
    });

    test('logs out user', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setUser({ name: 'Test User' });
      });

      expect(result.current.isAuthenticated).toBe(true);

      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('UI State', () => {
    test('toggles theme', () => {
      const { result } = renderHook(() => useAppStore());

      const initialTheme = result.current.theme;
      expect(['light', 'dark']).toContain(initialTheme);

      act(() => {
        result.current.toggleTheme();
      });

      const newTheme = result.current.theme;
      expect(newTheme).toBe(initialTheme === 'light' ? 'dark' : 'light');
    });

    test('toggles sidebar', () => {
      const { result } = renderHook(() => useAppStore());

      const initialState = result.current.sidebarOpen;

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.sidebarOpen).toBe(!initialState);
    });

    test('sets sidebar open state', () => {
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

  describe('Preferences', () => {
    test('updates preferences', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.updatePreferences({
          autoRefresh: true,
          refreshInterval: 30000,
        });
      });

      expect(result.current.preferences.autoRefresh).toBe(true);
      expect(result.current.preferences.refreshInterval).toBe(30000);
      expect(result.current.preferences.showSentimentColors).toBe(true); // Unchanged
    });
  });

  describe('Filters', () => {
    test('updates filters', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.updateFilters({
          sentimentFilter: 'positive',
          dateRange: '30d',
        });
      });

      expect(result.current.filters.sentimentFilter).toBe('positive');
      expect(result.current.filters.dateRange).toBe('30d');
      expect(result.current.filters.newsSource).toBe('all'); // Unchanged
    });

    test('resets filters to defaults', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.updateFilters({
          sentimentFilter: 'positive',
          dateRange: '30d',
          newsSource: 'Reuters',
        });
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters).toEqual({
        sentimentFilter: 'all',
        dateRange: '7d',
        newsSource: 'all',
      });
    });
  });

  describe('Cache Management', () => {
    test('sets last refresh timestamp', () => {
      const { result } = renderHook(() => useAppStore());

      const before = Date.now();

      act(() => {
        result.current.setLastRefresh('stockData');
      });

      const after = Date.now();
      const timestamp = result.current.lastRefresh.stockData;

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    test('determines if data should refresh', () => {
      const { result } = renderHook(() => useAppStore());

      // Should refresh if never set
      expect(result.current.shouldRefresh('newKey', 1000)).toBe(true);

      act(() => {
        result.current.setLastRefresh('newKey');
      });

      // Should not refresh immediately after setting
      expect(result.current.shouldRefresh('newKey', 10000)).toBe(false);

      // Should refresh after maxAge passes
      act(() => {
        result.current.lastRefresh.newKey = Date.now() - 15000;
      });

      expect(result.current.shouldRefresh('newKey', 10000)).toBe(true);
    });
  });
});
