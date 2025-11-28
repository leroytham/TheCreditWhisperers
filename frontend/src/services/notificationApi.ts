// frontend/src/services/notificationApi.ts
/**
 * API service for notification management
 */

import axios from 'axios';

// Type definitions
interface Notification {
  id?: string;
  _id?: string;
  is_read?: boolean;
  isRead?: boolean;
  is_archived?: boolean;
  isArchived?: boolean;
  created_at?: string;
  timestamp?: string;
  createdAt?: string;
  portfolio_id?: string;
  portfolioId?: string;
  portfolio_name?: string;
  portfolioName?: string;
  is_global?: boolean;
  isGlobal?: boolean;
  affected_tickers?: string[];
  affectedTickers?: string[];
  signal_analysis?: Record<string, unknown>;
  signalAnalysis?: Record<string, unknown>;
  portfolio_impact?: Record<string, unknown>;
  portfolioImpact?: Record<string, unknown>;
  account_servicing?: Record<string, unknown>;
  accountServicing?: Record<string, unknown>;
  [key: string]: unknown;
}

interface NotificationResponse {
  notifications?: Notification[];
  notification?: Notification;
  id?: string;
  _id?: string;
  [key: string]: unknown;
}

interface NotificationParams {
  is_archived?: boolean;
  is_read?: boolean;
  category?: string;
  portfolio_id?: string;
  include_global?: boolean;
  limit?: number;
  offset?: number;
}

interface NotificationPreferences {
  [key: string]: unknown;
}

interface PriceAlert {
  ticker?: string;
  condition?: string;
  target_price?: number;
  base_price?: number;
  percent_change?: number;
  priority?: string;
  notes?: string;
  portfolio_id?: string;
  portfolio_name?: string;
  is_global?: boolean;
  [key: string]: unknown;
}

interface Portfolio {
  account_name?: string;
  portfolio_name?: string;
  account_no?: string;
  [key: string]: unknown;
}

// Base API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Normalize notification data from snake_case (backend) to camelCase (frontend)
 */
const normalizeNotification = (notification: Notification): Notification => {
  if (!notification) return notification;

  return {
    ...notification,
    // Top-level field normalization
    isRead: notification.is_read ?? notification.isRead ?? false,
    isArchived: notification.is_archived ?? notification.isArchived ?? false,
    timestamp: notification.created_at || notification.timestamp,
    createdAt: notification.created_at || notification.createdAt,
    portfolioId: notification.portfolio_id ?? notification.portfolioId,
    portfolioName: notification.portfolio_name ?? notification.portfolioName,
    isGlobal: notification.is_global ?? notification.isGlobal ?? false,
    affectedTickers: notification.affected_tickers ?? notification.affectedTickers ?? [],

    // Nested object normalization
    signalAnalysis: notification.signal_analysis || notification.signalAnalysis,
    portfolioImpact: notification.portfolio_impact || notification.portfolioImpact,
    accountServicing: notification.account_servicing || notification.accountServicing,

    // Keep original fields for backward compatibility
    is_read: notification.is_read ?? notification.isRead ?? false,
    is_archived: notification.is_archived ?? notification.isArchived ?? false,
    created_at: notification.created_at || notification.timestamp,
    portfolio_id: notification.portfolio_id ?? notification.portfolioId,
    portfolio_name: notification.portfolio_name ?? notification.portfolioName,
    is_global: notification.is_global ?? notification.isGlobal ?? false,
    affected_tickers: notification.affected_tickers ?? notification.affectedTickers ?? [],
  };
};

/**
 * Normalize API response data
 */
const normalizeResponse = (data: NotificationResponse): NotificationResponse => {
  if (!data) return data;

  // If response has notifications array, normalize each notification
  if (data.notifications && Array.isArray(data.notifications)) {
    return {
      ...data,
      notifications: data.notifications.map(normalizeNotification),
    };
  }

  // If response has notification object (single notification)
  if (data.notification) {
    return {
      ...data,
      notification: normalizeNotification(data.notification),
    };
  }

  // If response is a single notification (from create/update endpoints)
  if (data.id || data._id) {
    return normalizeNotification(data);
  }

  return data;
};

/**
 * Helper to read CSRF token from cookie
 */
function getCsrfToken() {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

// Create axios instance with default config
// withCredentials: true is required for httpOnly cookie authentication
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // IMPORTANT: Send cookies with requests
});

// Add CSRF token to state-changing requests
// Note: Auth token is now in httpOnly cookie (sent automatically by browser)
apiClient.interceptors.request.use(
  (config) => {
    // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
    const method = config.method?.toLowerCase();
    if (method && !['get', 'head', 'options'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for normalization and error handling
apiClient.interceptors.response.use(
  (response) => {
    // Apply normalization to notification-related responses
    if (response.data && response.config.url?.includes('/notifications')) {
      response.data = normalizeResponse(response.data);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login (cookie will be cleared by backend logout or expiry)
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Notification API endpoints
 */
export const notificationApi = {
  /**
   * Get notifications for the current user
   * @param {Object} params - Query parameters
   * @param {boolean} params.is_archived - Filter by archived status
   * @param {boolean} params.is_read - Filter by read status
   * @param {string} params.category - Filter by category
   * @param {string} params.portfolio_id - Filter by portfolio ID
   * @param {boolean} params.include_global - Include global notifications (default: true)
   * @param {number} params.limit - Maximum number of results (default: 50)
   * @param {number} params.offset - Number of results to skip (default: 0)
   */
  getNotifications: async (params = {}) => {
    const response = await apiClient.get('/api/notifications/', { params });
    return response.data;
  },

  /**
   * Get notifications for a specific portfolio
   */
  getPortfolioNotifications: async (portfolioId: string, params: NotificationParams = {}) => {
    const response = await apiClient.get(`/api/notifications/portfolio/${portfolioId}`, { params });
    return response.data;
  },

  /**
   * Get unread count for a specific portfolio
   */
  getPortfolioUnreadCount: async (portfolioId: string, includeGlobal = true) => {
    const response = await apiClient.get(`/api/notifications/portfolio/${portfolioId}/unread-count`, {
      params: { include_global: includeGlobal },
    });
    return response.data;
  },

  /**
   * Get notifications for multiple portfolios
   */
  getMultiPortfolioNotifications: async (portfolioIds: string[], params: NotificationParams = {}) => {
    const response = await apiClient.post('/api/notifications/multi-portfolio', portfolioIds, { params });
    return response.data;
  },

  /**
   * Create a new notification
   */
  createNotification: async (notification: Notification) => {
    const response = await apiClient.post('/api/notifications/', notification);
    return response.data;
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async () => {
    const response = await apiClient.get('/api/notifications/unread-count');
    return response.data;
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (notificationId: string) => {
    const response = await apiClient.patch(`/api/notifications/${notificationId}/read`);
    return response.data;
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async () => {
    const response = await apiClient.post('/api/notifications/mark-all-read');
    return response.data;
  },

  /**
   * Archive a notification
   */
  archiveNotification: async (notificationId: string) => {
    const response = await apiClient.patch(`/api/notifications/${notificationId}/archive`);
    return response.data;
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (notificationId: string) => {
    const response = await apiClient.delete(`/api/notifications/${notificationId}`);
    return response.data;
  },

  /**
   * Clear notifications
   * @param {boolean} isArchived - Clear only archived or active notifications
   */
  clearNotifications: async (isArchived = null) => {
    const params = isArchived !== null ? { is_archived: isArchived } : {};
    const response = await apiClient.post('/api/notifications/clear', null, { params });
    return response.data;
  },

  /**
   * Test endpoint to create a sample notification
   */
  createSampleNotification: async () => {
    const response = await apiClient.post('/api/notifications/test/create-sample');
    return response.data;
  },
};

/**
 * Notification Preferences API endpoints
 */
export const preferencesApi = {
  /**
   * Get user notification preferences
   */
  getPreferences: async () => {
    const response = await apiClient.get('/api/notifications/preferences');
    return response.data;
  },

  /**
   * Update user notification preferences
   */
  updatePreferences: async (preferences: NotificationPreferences) => {
    const response = await apiClient.put('/api/notifications/preferences', preferences);
    return response.data;
  },
};

/**
 * Price Alert API endpoints
 */
export const priceAlertApi = {
  /**
   * Get price alerts for the current user
   * @param {Object} params - Query parameters
   * @param {boolean} params.is_active - Filter by active status
   * @param {string} params.ticker - Filter by ticker symbol
   * @param {string} params.portfolio_id - Filter by portfolio ID
   * @param {boolean} params.include_global - Include global alerts (default: true)
   */
  getAlerts: async (params = {}) => {
    const response = await apiClient.get('/api/notifications/alerts', { params });
    return response.data;
  },

  /**
   * Create a new price alert
   */
  createAlert: async (alert: PriceAlert) => {
    const response = await apiClient.post('/api/notifications/alerts', alert);
    return response.data;
  },

  /**
   * Update a price alert
   */
  updateAlert: async (alertId: string, updates: Partial<PriceAlert>) => {
    const response = await apiClient.patch(`/api/notifications/alerts/${alertId}`, updates);
    return response.data;
  },

  /**
   * Delete a price alert
   */
  deleteAlert: async (alertId: string) => {
    const response = await apiClient.delete(`/api/notifications/alerts/${alertId}`);
    return response.data;
  },

  /**
   * Get alerts for a specific ticker
   */
  getAlertsForTicker: async (ticker: string) => {
    const response = await apiClient.get(`/api/notifications/alerts/ticker/${ticker}`);
    return response.data;
  },
};

/**
 * Portfolio API endpoints
 */
export const portfolioApi = {
  /**
   * Get all portfolios for the current user
   * @param {boolean} includeInactive - Include inactive portfolios (default: false)
   */
  getPortfolios: async (includeInactive = false) => {
    const response = await apiClient.get('/api/portfolios/', {
      params: { include_inactive: includeInactive },
    });
    return response.data;
  },

  /**
   * Get the user's primary portfolio
   */
  getPrimaryPortfolio: async () => {
    const response = await apiClient.get('/api/portfolios/primary');
    return response.data;
  },

  /**
   * Get a specific portfolio by ID
   */
  getPortfolio: async (portfolioId: string) => {
    const response = await apiClient.get(`/api/portfolios/${portfolioId}`);
    return response.data;
  },

  /**
   * Get holdings for a specific portfolio
   */
  getPortfolioHoldings: async (portfolioId: string) => {
    const response = await apiClient.get(`/api/portfolios/${portfolioId}/holdings`);
    return response.data;
  },

  /**
   * Set a portfolio as primary
   */
  setPrimary: async (portfolioId: string) => {
    const response = await apiClient.post(`/api/portfolios/${portfolioId}/set-primary`);
    return response.data;
  },

  /**
   * Refresh portfolio holdings cache
   */
  refreshCache: async (portfolioId: string) => {
    const response = await apiClient.post(`/api/portfolios/${portfolioId}/refresh-cache`);
    return response.data;
  },

  /**
   * Get portfolio by account name (backward compatibility)
   */
  getByAccountName: async (accountName: string) => {
    const response = await apiClient.get(`/api/portfolios/by-account/${accountName}`);
    return response.data;
  },

  /**
   * Create a new portfolio
   */
  createPortfolio: async (portfolio: Portfolio) => {
    const response = await apiClient.post('/api/portfolios/create', portfolio);
    return response.data;
  },
};

// Export normalization function for use in WebSocket handlers
export { normalizeNotification };

// Export default for convenience
export default {
  notifications: notificationApi,
  preferences: preferencesApi,
  priceAlerts: priceAlertApi,
  portfolios: portfolioApi,
};