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

        addToWatchlist: (ticker) => set((state) => {
          if (!state.watchlist.includes(ticker)) {
            return { watchlist: [...state.watchlist, ticker] };
          }
          return state;
        }),

        removeFromWatchlist: (ticker) => set((state) => ({
          watchlist: state.watchlist.filter((t) => t !== ticker),
        })),

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

        // ===== NOTIFICATIONS =====
        notifications: [],

        addNotification: (notification) => set((state) => ({
          notifications: [
            ...state.notifications,
            {
              id: Date.now(),
              timestamp: new Date().toISOString(),
              ...notification,
            },
          ],
        })),

        removeNotification: (id) => set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

        clearNotifications: () => set({ notifications: [] }),

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
        }),
      }
    ),
    {
      name: 'AppStore', // Name for Redux DevTools
    }
  )
);

export default useAppStore;
