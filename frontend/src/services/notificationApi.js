// frontend/src/services/notificationApi.js
/**
 * API service for notification management
 */

import axios from 'axios';

// Base API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Normalize notification data from snake_case (backend) to camelCase (frontend)
 * @param {Object} notification - Raw notification from backend
 * @returns {Object} Normalized notification
 */
const normalizeNotification = (notification) => {
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
 * @param {Object} data - API response data
 * @returns {Object} Normalized data
 */
const normalizeResponse = (data) => {
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
   * @param {string} portfolioId - Portfolio ID
   * @param {Object} params - Query parameters
   * @param {boolean} params.include_global - Include global notifications (default: true)
   * @param {number} params.limit - Maximum number of results (default: 50)
   * @param {number} params.offset - Number of results to skip (default: 0)
   */
  getPortfolioNotifications: async (portfolioId, params = {}) => {
    const response = await apiClient.get(`/api/notifications/portfolio/${portfolioId}`, { params });
    return response.data;
  },

  /**
   * Get unread count for a specific portfolio
   * @param {string} portfolioId - Portfolio ID
   * @param {boolean} includeGlobal - Include global notifications (default: true)
   */
  getPortfolioUnreadCount: async (portfolioId, includeGlobal = true) => {
    const response = await apiClient.get(`/api/notifications/portfolio/${portfolioId}/unread-count`, {
      params: { include_global: includeGlobal },
    });
    return response.data;
  },

  /**
   * Get notifications for multiple portfolios
   * @param {string[]} portfolioIds - Array of portfolio IDs
   * @param {Object} params - Query parameters
   * @param {boolean} params.include_global - Include global notifications (default: true)
   * @param {number} params.limit - Maximum number of results (default: 50)
   * @param {number} params.offset - Number of results to skip (default: 0)
   */
  getMultiPortfolioNotifications: async (portfolioIds, params = {}) => {
    const response = await apiClient.post('/api/notifications/multi-portfolio', portfolioIds, { params });
    return response.data;
  },

  /**
   * Create a new notification
   * @param {Object} notification - Notification data
   */
  createNotification: async (notification) => {
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
   * @param {string} notificationId - Notification ID
   */
  markAsRead: async (notificationId) => {
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
   * @param {string} notificationId - Notification ID
   */
  archiveNotification: async (notificationId) => {
    const response = await apiClient.patch(`/api/notifications/${notificationId}/archive`);
    return response.data;
  },

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   */
  deleteNotification: async (notificationId) => {
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
   * @param {Object} preferences - Preference updates
   */
  updatePreferences: async (preferences) => {
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
   * @param {Object} alert - Alert data
   * @param {string} alert.ticker - Stock ticker symbol
   * @param {string} alert.condition - Alert condition (above, below, percent_increase, percent_decrease)
   * @param {number} alert.target_price - Target price for above/below conditions
   * @param {number} alert.base_price - Base price for percentage conditions
   * @param {number} alert.percent_change - Percentage change for percentage conditions
   * @param {string} alert.priority - Alert priority (low, medium, high, critical)
   * @param {string} alert.notes - Optional notes
   * @param {string} alert.portfolio_id - Portfolio ID (optional)
   * @param {string} alert.portfolio_name - Portfolio name for display (optional)
   * @param {boolean} alert.is_global - Whether alert applies to all portfolios (default: false)
   */
  createAlert: async (alert) => {
    const response = await apiClient.post('/api/notifications/alerts', alert);
    return response.data;
  },

  /**
   * Update a price alert
   * @param {string} alertId - Alert ID
   * @param {Object} updates - Alert updates
   */
  updateAlert: async (alertId, updates) => {
    const response = await apiClient.patch(`/api/notifications/alerts/${alertId}`, updates);
    return response.data;
  },

  /**
   * Delete a price alert
   * @param {string} alertId - Alert ID
   */
  deleteAlert: async (alertId) => {
    const response = await apiClient.delete(`/api/notifications/alerts/${alertId}`);
    return response.data;
  },

  /**
   * Get alerts for a specific ticker
   * @param {string} ticker - Stock ticker symbol
   */
  getAlertsForTicker: async (ticker) => {
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
   * @param {string} portfolioId - Portfolio ID
   */
  getPortfolio: async (portfolioId) => {
    const response = await apiClient.get(`/api/portfolios/${portfolioId}`);
    return response.data;
  },

  /**
   * Get holdings for a specific portfolio
   * @param {string} portfolioId - Portfolio ID
   */
  getPortfolioHoldings: async (portfolioId) => {
    const response = await apiClient.get(`/api/portfolios/${portfolioId}/holdings`);
    return response.data;
  },

  /**
   * Set a portfolio as primary
   * @param {string} portfolioId - Portfolio ID
   */
  setPrimary: async (portfolioId) => {
    const response = await apiClient.post(`/api/portfolios/${portfolioId}/set-primary`);
    return response.data;
  },

  /**
   * Refresh portfolio holdings cache
   * @param {string} portfolioId - Portfolio ID
   */
  refreshCache: async (portfolioId) => {
    const response = await apiClient.post(`/api/portfolios/${portfolioId}/refresh-cache`);
    return response.data;
  },

  /**
   * Get portfolio by account name (backward compatibility)
   * @param {string} accountName - Account name
   */
  getByAccountName: async (accountName) => {
    const response = await apiClient.get(`/api/portfolios/by-account/${accountName}`);
    return response.data;
  },

  /**
   * Create a new portfolio
   * @param {Object} portfolio - Portfolio data
   * @param {string} portfolio.account_name - Account name
   * @param {string} portfolio.portfolio_name - Portfolio display name (optional)
   * @param {string} portfolio.account_no - Account number (optional)
   */
  createPortfolio: async (portfolio) => {
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