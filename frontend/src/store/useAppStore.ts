import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AppStoreState } from '../types/store';
import type { Toast, PriceAlert } from '../types';

/**
 * Subcategory map for toast categories
 */
const subcategoryMap: Record<string, string> = {
  'Market': 'Market Signals',
  'Portfolio': 'Portfolio Updates',
  'News': 'News & Insights',
  'System': 'Operational Alerts',
};

/**
 * Global application store using Zustand
 *
 * Features:
 * - Persist to localStorage
 * - Redux DevTools integration
 * - Type-safe state management
 */
const useAppStore = create<AppStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // ===== USER STATE =====
        user: null,
        isAuthenticated: false,

        setUser: (user) => set({ user, isAuthenticated: !!user }),
        logout: () => set({
          user: null,
          isAuthenticated: false,
          selectedAccount: null, // Clear account on logout
        }),

        // ===== SELECTED ACCOUNT STATE =====
        // Replaces PortfolioContext's selectedAccount
        // Shape: { username, accountName, accountNumber } or null
        selectedAccount: null,

        selectAccount: (username, accountName, accountNumber) => set({
          selectedAccount: { username, accountName, accountNumber },
        }),

        clearSelectedAccount: () => set({ selectedAccount: null }),

        // ===== SELECTED TICKER =====
        selectedTicker: null,
        selectedTimeframe: '1D',

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
              id: String(Date.now() + Math.random()),
              createdAt: new Date().toISOString(),
              isActive: true,
              ...alert,
              // Ensure triggered defaults to false if not provided
              triggered: alert.triggered ?? false,
            } as PriceAlert,
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

        // ===== TOASTS (Ephemeral UI notifications) =====
        // NOTE: For server-persisted notifications, use React Query hooks in useNotifications.js
        toasts: [],

        addToast: (toast) => set((state) => {
          // Generate subcategory if not provided
          const category = toast.category || 'System';

          const newToast: Toast = {
            id: Date.now() + Math.random(), // Ensure unique ID
            timestamp: new Date().toISOString(),
            type: 'info', // 'success' | 'error' | 'warning' | 'info' | 'critical'
            category: 'System', // 'Portfolio' | 'Market' | 'News' | 'System'
            subcategory: subcategoryMap[category] || 'General',
            priority: 'medium', // 'low' | 'medium' | 'high' | 'critical'
            message: '',
            duration: 5000, // Auto-dismiss duration in ms (null = no auto-dismiss)
            actionUrl: null, // Optional link for "View Details"
            metadata: {}, // Flexible object for custom data
            ...toast,
          };

          // Generate preview field from message if not provided
          if (!newToast.preview && newToast.message) {
            newToast.preview = newToast.message.length > 80
              ? newToast.message.substring(0, 80) + '...'
              : newToast.message;
          }

          return {
            toasts: [...state.toasts, newToast],
          };
        }),

        removeToast: (id) => set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

        clearToasts: () => set({ toasts: [] }),

        // Helper methods for creating toasts
        notifySuccess: (message, options = {}) => {
          const { addToast } = get();
          addToast({
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
          const { addToast } = get();
          addToast({
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
          const { addToast } = get();
          addToast({
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
          const { addToast } = get();
          addToast({
            type: 'info',
            title: options.title || 'Information',
            message,
            category: options.category || 'System',
            priority: options.priority || 'low',
            duration: options.duration || 4000,
            ...options,
          });
        },

        // Helper for creating enriched toasts with full metadata
        notifyWithMetadata: (config) => {
          const { addToast } = get();
          addToast({
            type: config.type || 'info',
            title: config.title || 'Notification',
            message: config.message || '',
            category: config.category || 'System',
            subcategory: config.subcategory,
            priority: config.priority || 'medium',
            preview: config.preview,
            duration: config.duration !== undefined ? config.duration : 5000,
            actionUrl: config.actionUrl,
            metadata: {
              ...(config.metadata || {}),
              // Optional rich data fields stored in metadata
              ...(config.modalTitle && { modalTitle: config.modalTitle }),
              ...(config.subject && { subject: config.subject }),
              ...(config.body && { body: config.body }),
              ...(config.signalAnalysis && { signalAnalysis: config.signalAnalysis }),
              ...(config.portfolioImpact && { portfolioImpact: config.portfolioImpact }),
              ...(config.accountServicing && { accountServicing: config.accountServicing }),
            },
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

        // ===== NOTIFICATIONS (for NotificationPage) =====
        notifications: [],

        markAsRead: (id) => set((state) => ({
          notifications: state.notifications.map((n: any) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        })),

        archiveNotification: (id) => set((state) => ({
          notifications: state.notifications.map((n: any) =>
            n.id === id ? { ...n, isArchived: true } : n
          ),
        })),

        markAllAsRead: () => set((state) => ({
          notifications: state.notifications.map((n: any) => ({ ...n, isRead: true })),
        })),

        clearNotifications: () => set({ notifications: [] }),

        clearActiveNotifications: () => set((state) => ({
          notifications: state.notifications.filter((n: any) => n.isArchived),
        })),

        clearArchivedNotifications: () => set((state) => ({
          notifications: state.notifications.filter((n: any) => !n.isArchived),
        })),
      }),
      {
        name: 'app-storage', // localStorage key
        partialize: (state) => ({
          // Only persist these fields
          // User & Account state
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          selectedAccount: state.selectedAccount,
          // UI preferences
          theme: state.theme,
          watchlist: state.watchlist,
          recentSearches: state.recentSearches,
          preferences: state.preferences,
          selectedTimeframe: state.selectedTimeframe,
          priceAlerts: state.priceAlerts,
          // NOTE: toasts are NOT persisted - they are ephemeral UI messages
        }),
      }
    ),
    {
      name: 'AppStore', // Name for Redux DevTools
    }
  )
);

export default useAppStore;
