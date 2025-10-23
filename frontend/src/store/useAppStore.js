// frontend/src/store/useAppStore.js

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * Global application store using Zustand
 *
 * Features:
 * - Persist to localStorage
 * - Redux DevTools integration
 * - Type-safe state management
 */
const useAppStore = create(
  devtools(
    persist(
      (set, get) => ({
        // ===== USER STATE =====
        user: null,
        isAuthenticated: false,

        setUser: (user) => set({ user, isAuthenticated: !!user }),
        logout: () => set({ user: null, isAuthenticated: false }),

        // ===== SELECTED TICKER =====
        selectedTicker: null,
        selectedTimeframe: '1Y',

        setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),
        setSelectedTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),

        // ===== UI STATE =====
        theme: 'light',
        sidebarOpen: true,

        toggleTheme: () => set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),

        toggleSidebar: () => set((state) => ({
          sidebarOpen: !state.sidebarOpen,
        })),

        setSidebarOpen: (open) => set({ sidebarOpen: open }),

        // ===== WATCHLIST =====
        watchlist: [],

        addToWatchlist: (ticker) => {
          const { watchlist, notifySuccess } = get();
          if (!watchlist.includes(ticker)) {
            set({ watchlist: [...watchlist, ticker] });
            notifySuccess(`${ticker} added to watchlist`, {
              category: 'Portfolio',
              duration: 2500,
            });
          }
        },

        removeFromWatchlist: (ticker) => {
          const { notifyInfo } = get();
          set((state) => ({
            watchlist: state.watchlist.filter((t) => t !== ticker),
          }));
          notifyInfo(`${ticker} removed from watchlist`, {
            category: 'Portfolio',
            duration: 2500,
          });
        },

        isInWatchlist: (ticker) => {
          const { watchlist } = get();
          return watchlist.includes(ticker);
        },

        // ===== RECENT SEARCHES =====
        recentSearches: [],
        maxRecentSearches: 10,

        addRecentSearch: (ticker) => set((state) => {
          const filtered = state.recentSearches.filter((t) => t !== ticker);
          const updated = [ticker, ...filtered].slice(0, state.maxRecentSearches);
          return { recentSearches: updated };
        }),

        clearRecentSearches: () => set({ recentSearches: [] }),

        // ===== PRICE ALERTS =====
        priceAlerts: [],

        addPriceAlert: (alert) => set((state) => ({
          priceAlerts: [
            ...state.priceAlerts,
            {
              id: Date.now() + Math.random(),
              createdAt: new Date().toISOString(),
              isActive: true,
              triggered: false,
              ...alert,
            },
          ],
        })),

        removePriceAlert: (id) => set((state) => ({
          priceAlerts: state.priceAlerts.filter((a) => a.id !== id),
        })),

        updatePriceAlert: (id, updates) => set((state) => ({
          priceAlerts: state.priceAlerts.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),

        togglePriceAlert: (id) => set((state) => ({
          priceAlerts: state.priceAlerts.map((a) =>
            a.id === id ? { ...a, isActive: !a.isActive } : a
          ),
        })),

        getActiveAlertsForTicker: (ticker) => {
          const { priceAlerts } = get();
          return priceAlerts.filter(
            (a) => a.ticker === ticker && a.isActive && !a.triggered
          );
        },

        // ===== NOTIFICATIONS =====
        notifications: [],

        addNotification: (notification) => set((state) => ({
          notifications: [
            ...state.notifications,
            {
              id: Date.now() + Math.random(), // Ensure unique ID
              timestamp: new Date().toISOString(),
              type: 'info', // 'success' | 'error' | 'warning' | 'info' | 'critical'
              category: 'System', // 'Portfolio' | 'Market' | 'News' | 'System'
              priority: 'medium', // 'low' | 'medium' | 'high' | 'critical'
              isRead: false,
              isArchived: false,
              showAsToast: true, // Show in toast container
              duration: 5000, // Auto-dismiss duration in ms (null = no auto-dismiss)
              actionUrl: null, // Optional link for "View Details"
              metadata: {}, // Flexible object for custom data
              ...notification,
            },
          ],
        })),

        removeNotification: (id) => set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

        updateNotification: (id, updates) => set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, ...updates } : n
          ),
        })),

        markAsRead: (id) => set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        })),

        markAllAsRead: () => set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        })),

        archiveNotification: (id) => set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isArchived: true, showAsToast: false } : n
          ),
        })),

        getUnreadCount: () => {
          const { notifications } = get();
          return notifications.filter((n) => !n.isRead && !n.isArchived).length;
        },

        clearNotifications: () => set({ notifications: [] }),

        // Helper methods for specific notification types
        notifySuccess: (message, options = {}) => {
          const { addNotification } = get();
          addNotification({
            type: 'success',
            title: options.title || 'Success',
            message,
            category: options.category || 'System',
            priority: options.priority || 'low',
            duration: options.duration || 3000,
            ...options,
          });
        },

        notifyError: (message, options = {}) => {
          const { addNotification } = get();
          addNotification({
            type: 'error',
            title: options.title || 'Error',
            message,
            category: options.category || 'System',
            priority: options.priority || 'high',
            duration: null, // Errors don't auto-dismiss
            ...options,
          });
        },

        notifyWarning: (message, options = {}) => {
          const { addNotification } = get();
          addNotification({
            type: 'warning',
            title: options.title || 'Warning',
            message,
            category: options.category || 'System',
            priority: options.priority || 'medium',
            duration: options.duration || 5000,
            ...options,
          });
        },

        notifyInfo: (message, options = {}) => {
          const { addNotification } = get();
          addNotification({
            type: 'info',
            title: options.title || 'Information',
            message,
            category: options.category || 'System',
            priority: options.priority || 'low',
            duration: options.duration || 4000,
            ...options,
          });
        },

        // ===== PREFERENCES =====
        preferences: {
          showSentimentColors: true,
          autoRefresh: false,
          refreshInterval: 60000, // 1 minute
          compactView: false,
        },

        updatePreferences: (preferences) => set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        })),

        // ===== FILTERS =====
        filters: {
          sentimentFilter: 'all', // 'all' | 'positive' | 'negative' | 'neutral'
          dateRange: '7d',
          newsSource: 'all',
        },

        updateFilters: (filters) => set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

        resetFilters: () => set({
          filters: {
            sentimentFilter: 'all',
            dateRange: '7d',
            newsSource: 'all',
          },
        }),

        // ===== CACHE INVALIDATION =====
        lastRefresh: {},

        setLastRefresh: (key) => set((state) => ({
          lastRefresh: { ...state.lastRefresh, [key]: Date.now() },
        })),

        shouldRefresh: (key, maxAge = 60000) => {
          const { lastRefresh } = get();
          const lastTime = lastRefresh[key] || 0;
          return Date.now() - lastTime > maxAge;
        },
      }),
      {
        name: 'app-storage', // localStorage key
        partialize: (state) => ({
          // Only persist these fields
          theme: state.theme,
          watchlist: state.watchlist,
          recentSearches: state.recentSearches,
          preferences: state.preferences,
          selectedTimeframe: state.selectedTimeframe,
          priceAlerts: state.priceAlerts,
          notifications: state.notifications,
        }),
      }
    ),
    {
      name: 'AppStore', // Name for Redux DevTools
    }
  )
);

export default useAppStore;
