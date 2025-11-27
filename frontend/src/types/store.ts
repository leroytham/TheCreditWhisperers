import type {
  User,
  SelectedAccount,
  Notification,
  PriceAlert,
  NotificationCategory,
  PriorityLevel,
} from './index';

// =============================================================================
// NOTIFICATION OPTIONS
// =============================================================================

export interface NotificationOptions {
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

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Partial<Notification>) => void;
  removeNotification: (id: string | number) => void;
  updateNotification: (id: string | number, updates: Partial<Notification>) => void;
  markAsRead: (id: string | number) => void;
  markAllAsRead: () => void;
  archiveNotification: (id: string | number) => void;
  getUnreadCount: () => number;
  clearNotifications: () => void;
  clearActiveNotifications: () => void;
  clearArchivedNotifications: () => void;
  notifySuccess: (message: string, options?: NotificationOptions) => void;
  notifyError: (message: string, options?: NotificationOptions) => void;
  notifyWarning: (message: string, options?: NotificationOptions) => void;
  notifyInfo: (message: string, options?: NotificationOptions) => void;
  notifyWithMetadata: (config: NotificationConfig) => void;

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
// NOTIFICATION CONFIG (for notifyWithMetadata)
// =============================================================================

export interface NotificationConfig extends NotificationOptions {
  type?: 'success' | 'error' | 'warning' | 'info' | 'critical';
  message: string;
  subcategory?: string;
  preview?: string;
  showAsToast?: boolean;
  modalTitle?: string;
  subject?: string;
  body?: string;
  signalAnalysis?: Record<string, unknown>;
  portfolioImpact?: Record<string, unknown>;
  accountServicing?: Record<string, unknown>;
}
