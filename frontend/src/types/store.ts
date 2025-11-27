import type {
  User,
  SelectedAccount,
  Toast,
  PriceAlert,
  NotificationCategory,
  PriorityLevel,
} from './index';

// =============================================================================
// TOAST OPTIONS (for ephemeral UI notifications)
// =============================================================================

export interface ToastOptions {
  title?: string;
  category?: NotificationCategory;
  priority?: PriorityLevel;
  duration?: number | null;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// USER PREFERENCES
// =============================================================================

export interface UserPreferences {
  showSentimentColors: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  compactView: boolean;
}

// =============================================================================
// APP FILTERS
// =============================================================================

export interface AppFilters {
  sentimentFilter: 'all' | 'positive' | 'negative' | 'neutral';
  dateRange: string;
  newsSource: string;
}

// =============================================================================
// APP STORE STATE
// =============================================================================

export interface AppStoreState {
  // User State
  user: User | string | null;
  isAuthenticated: boolean;
  setUser: (user: User | string | null) => void;
  logout: () => void;

  // Selected Account
  selectedAccount: SelectedAccount | null;
  selectAccount: (username: string, accountName: string, accountNumber?: string) => void;
  clearSelectedAccount: () => void;

  // UI State
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Selected Ticker
  selectedTicker: string | null;
  selectedTimeframe: string;
  setSelectedTicker: (ticker: string) => void;
  setSelectedTimeframe: (timeframe: string) => void;

  // Watchlist
  watchlist: string[];
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
  isInWatchlist: (ticker: string) => boolean;

  // Recent Searches
  recentSearches: string[];
  maxRecentSearches: number;
  addRecentSearch: (ticker: string) => void;
  clearRecentSearches: () => void;

  // Price Alerts
  priceAlerts: PriceAlert[];
  addPriceAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'isActive'>) => void;
  removePriceAlert: (id: string | number) => void;
  updatePriceAlert: (id: string | number, updates: Partial<PriceAlert>) => void;
  togglePriceAlert: (id: string | number) => void;
  getActiveAlertsForTicker: (ticker: string) => PriceAlert[];

  // Toasts (ephemeral UI notifications)
  // NOTE: For server-persisted notifications, use React Query hooks in useNotifications.js
  toasts: Toast[];
  addToast: (toast: Partial<Toast>) => void;
  removeToast: (id: string | number) => void;
  clearToasts: () => void;
  notifySuccess: (message: string, options?: ToastOptions) => void;
  notifyError: (message: string, options?: ToastOptions) => void;
  notifyWarning: (message: string, options?: ToastOptions) => void;
  notifyInfo: (message: string, options?: ToastOptions) => void;
  notifyWithMetadata: (config: ToastConfig) => void;

  // Preferences
  preferences: UserPreferences;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;

  // Filters
  filters: AppFilters;
  updateFilters: (filters: Partial<AppFilters>) => void;
  resetFilters: () => void;

  // Cache Invalidation
  lastRefresh: Record<string, number>;
  setLastRefresh: (key: string) => void;
  shouldRefresh: (key: string, maxAge?: number) => boolean;
}

// =============================================================================
// TOAST CONFIG (for notifyWithMetadata)
// =============================================================================

export interface ToastConfig extends ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info' | 'critical';
  message: string;
  subcategory?: string;
  preview?: string;
  modalTitle?: string;
  subject?: string;
  body?: string;
  signalAnalysis?: Record<string, unknown>;
  portfolioImpact?: Record<string, unknown>;
  accountServicing?: Record<string, unknown>;
}
