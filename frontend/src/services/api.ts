import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, HTTP_STATUS, ERROR_MESSAGES, RETRY_CONFIG } from '../config/constants';
import useAppStore from '../store/useAppStore';
import {
  getErrorMessage,
  getSuccessMessage,
  getCategoryFromUrl,
  shouldSuppressError,
  shouldSuppressSuccess,
  shouldShowSuccessNotification,
} from '../features/notifications/utils/notificationHelpers';
import { ApiError } from './errors';

// Extend axios config to include custom metadata
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: {
    startTime: Date;
  };
  _retryCount?: number;
}

/**
 * Helper to read CSRF token from cookie
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Create axios instance with base configuration
 * withCredentials: true is required to send/receive httpOnly cookies
 */
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds (increased for sector news aggregation)
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // IMPORTANT: Send cookies with requests
});

/**
 * Request interceptor - Add CSRF token for state-changing requests
 * Note: Auth token is now in httpOnly cookie (sent automatically by browser)
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Add timestamp for debugging
    (config as CustomAxiosRequestConfig).metadata = { startTime: new Date() };

    // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
    const method = config.method?.toLowerCase();
    if (method && !['get', 'head', 'options'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log('=> API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle errors, retries, logging
 */
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Calculate request duration
    const config = response.config as CustomAxiosRequestConfig;
    const duration = config.metadata ? new Date().getTime() - config.metadata.startTime.getTime() : 0;

    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(' API Response:', {
        url: response.config.url,
        status: response.status,
        duration: `${duration}ms`,
        data: response.data,
      });
    }

    // Show success notification for mutations
    if (shouldShowSuccessNotification(response.config) && !shouldSuppressSuccess(response.config)) {
      const { notifySuccess } = useAppStore.getState();
      const message = getSuccessMessage(response.config, response);
      const category = getCategoryFromUrl(response.config.url || '') as 'Portfolio' | 'Market' | 'News' | 'System';

      notifySuccess(message, {
        category,
        duration: 3000,
      });
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // IMPORTANT: Preserve cancel errors - don't transform them
    // This allows components to properly detect and ignore canceled requests
    if (axios.isCancel(error)) {
      throw error; // Re-throw unchanged so axios.isCancel() works downstream
    }

    // Handle network errors
    if (!error.response) {
      console.error('❌ Network Error:', error.message);

      // Show network error notification
      const { notifyError } = useAppStore.getState();
      notifyError('Network error. Please check your connection.', {
        category: 'System',
        priority: 'critical',
      });

      throw new ApiError({
        message: ERROR_MESSAGES.NETWORK_ERROR,
        code: 'NETWORK_ERROR',
        isRetryable: true,
      });
    }

    const { status, data } = error.response;

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('L API Error:', {
        url: originalRequest.url,
        status,
        message: data?.detail || error.message,
        data,
      });
    }

    // Retry logic for specific status codes
    if (
      RETRY_CONFIG.RETRY_STATUS_CODES.includes(status) &&
      (!originalRequest._retryCount || originalRequest._retryCount < RETRY_CONFIG.MAX_RETRIES)
    ) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

      // Exponential backoff
      const delay = RETRY_CONFIG.RETRY_DELAY * Math.pow(2, originalRequest._retryCount - 1);

      console.log(`= Retrying request (${originalRequest._retryCount}/${RETRY_CONFIG.MAX_RETRIES}) after ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return api(originalRequest);
    }

    // Show error notification (unless suppressed)
    if (!shouldSuppressError(error)) {
      const { notifyError } = useAppStore.getState();
      const message = getErrorMessage(error);
      const category = getCategoryFromUrl(originalRequest.url || '') as 'Portfolio' | 'Market' | 'News' | 'System';

      notifyError(message, {
        category,
        priority: status >= 500 ? 'critical' : 'high',
      });
    }

    // Handle specific error codes
    switch (status) {
      case HTTP_STATUS.UNAUTHORIZED:
        // Redirect to login (cookie will be cleared by backend logout or expiry)
        window.location.href = '/login';
        throw new ApiError({
          message: 'Session expired. Please login again.',
          status: HTTP_STATUS.UNAUTHORIZED,
          code: 'UNAUTHORIZED',
        });

      case HTTP_STATUS.FORBIDDEN:
        throw new ApiError({
          message: 'You do not have permission to access this resource.',
          status: HTTP_STATUS.FORBIDDEN,
          code: 'FORBIDDEN',
        });

      case HTTP_STATUS.NOT_FOUND:
        throw new ApiError({
          message: ERROR_MESSAGES.NOT_FOUND,
          status: HTTP_STATUS.NOT_FOUND,
          code: 'NOT_FOUND',
        });

      case HTTP_STATUS.TIMEOUT:
        throw new ApiError({
          message: ERROR_MESSAGES.TIMEOUT,
          status: HTTP_STATUS.TIMEOUT,
          code: 'TIMEOUT',
          isRetryable: true,
        });

      case HTTP_STATUS.SERVER_ERROR:
      case HTTP_STATUS.BAD_GATEWAY:
      case HTTP_STATUS.SERVICE_UNAVAILABLE: {
        // Use generic message but include error_id for support reference if available
        const errorId = data?.error_id;
        const serverErrorMsg = errorId
          ? `${ERROR_MESSAGES.SERVER_ERROR} Reference: ${errorId}`
          : ERROR_MESSAGES.SERVER_ERROR;
        throw new ApiError({
          message: serverErrorMsg,
          status,
          code: 'SERVER_ERROR',
          errorId,
          isRetryable: true,
        });
      }

      default:
        // For 4xx errors, detail is safe to show; for 5xx, use generic message
        if (status >= 500) {
          const genericErrorId = data?.error_id;
          const genericMsg = genericErrorId
            ? `An error occurred. Reference: ${genericErrorId}`
            : ERROR_MESSAGES.GENERIC;
          throw new ApiError({
            message: genericMsg,
            status,
            code: 'SERVER_ERROR',
            errorId: genericErrorId,
            isRetryable: true,
          });
        }
        // 4xx errors - detail is safe to expose
        throw new ApiError({
          message: data?.detail || ERROR_MESSAGES.GENERIC,
          status,
          code: status === 400 ? 'VALIDATION_ERROR' : 'UNKNOWN',
        });
    }
  }
);

/**
 * API Service Methods
 */
interface ApiService {
  // Generic HTTP methods
  get: <T = unknown>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<AxiosResponse<T>>;

  // Auth endpoints
  login: (username: string, password: string) => Promise<AxiosResponse>;
  signup: (username: string, password: string) => Promise<AxiosResponse>;

  // Stock endpoints
  getStockPrice: (ticker: string, timeframe?: string) => Promise<AxiosResponse>;
  getStockHistorical: (ticker: string, timeframe?: string) => Promise<AxiosResponse>;
  getStockSentiment: (ticker: string) => Promise<AxiosResponse>;
  getStockEvents: (ticker: string, timeframe?: string) => Promise<AxiosResponse>;
  getCompanyOverview: (ticker: string) => Promise<AxiosResponse>;

  // Price endpoint (for usePriceData.js)
  getPrice: (ticker: string, timeframe: string) => Promise<AxiosResponse>;

  // News endpoints
  getNews: (ticker: string, timeframe?: string) => Promise<AxiosResponse>;
  getCategorizedNews: (ticker: string, startDate?: string, endDate?: string) => Promise<AxiosResponse>;
  getDailySentiment: (ticker: string, timeframe?: string | null) => Promise<AxiosResponse>;
  getNewsModels: (ticker: string) => Promise<AxiosResponse>;
  getNewsSources: (ticker: string) => Promise<AxiosResponse>;
  getRollingSentiment: (ticker: string, timeframe?: string) => Promise<AxiosResponse>;

  // Earnings endpoints
  getEarningsCalendar: (ticker: string, horizon?: string) => Promise<AxiosResponse>;
  getEarningsQuarters: (ticker: string, yearsBack?: number) => Promise<AxiosResponse>;
  getEarningsTranscript: (ticker: string, quarter: string) => Promise<AxiosResponse>;

  // Sector endpoints
  getSectorConstituents: (sectorTicker: string) => Promise<AxiosResponse>;
  getSectorAggregatedNews: (sectorIdentifier: string, params?: Record<string, unknown>) => Promise<AxiosResponse>;
  getSectorDailySentiment: (sectorIdentifier: string, days?: number) => Promise<AxiosResponse>;

  // Search
  searchTicker: (query: string) => Promise<AxiosResponse>;

  // User endpoints
  getUsers: () => Promise<AxiosResponse>;
  getAccounts: (username: string) => Promise<AxiosResponse>;

  // Portfolio endpoints
  getPortfolioAccounts: (username: string, config?: AxiosRequestConfig) => Promise<AxiosResponse>;
  getPortfolioHoldings: (username: string, accountName: string, config?: AxiosRequestConfig) => Promise<AxiosResponse>;
  getPortfolioPerformance: (username: string, accountName: string, timeframe?: string, config?: AxiosRequestConfig) => Promise<AxiosResponse>;
  getPortfolioNews: (username: string, accountName: string, config?: AxiosRequestConfig) => Promise<AxiosResponse>;
  getPortfolioSentiment: (username: string, accountName: string) => Promise<AxiosResponse>;
  getPortfolioDailySentiment: (username: string, accountName: string, timeframe?: string | null, days?: number | null) => Promise<AxiosResponse>;
  getPortfolioRollingSentiment: (username: string, accountName: string, timeframe?: string) => Promise<AxiosResponse>;
  addPortfolio: (portfolioData: unknown) => Promise<AxiosResponse>;
  updatePortfolio: (portfolioData: unknown) => Promise<AxiosResponse>;
  deletePortfolio: (username: string, accountName: string) => Promise<AxiosResponse>;

  // Notification endpoints
  notifications: {
    getAll: (params?: { is_archived?: boolean; is_read?: boolean; category?: string; portfolio_id?: string; include_global?: boolean; limit?: number; offset?: number }) => Promise<AxiosResponse>;
    getPortfolio: (portfolioId: string, params?: Record<string, unknown>) => Promise<AxiosResponse>;
    getPortfolioUnreadCount: (portfolioId: string, includeGlobal?: boolean) => Promise<AxiosResponse>;
    getMultiPortfolio: (portfolioIds: string[], params?: Record<string, unknown>) => Promise<AxiosResponse>;
    create: (notification: unknown) => Promise<AxiosResponse>;
    getUnreadCount: () => Promise<AxiosResponse>;
    markAsRead: (notificationId: string) => Promise<AxiosResponse>;
    markAllAsRead: () => Promise<AxiosResponse>;
    archive: (notificationId: string) => Promise<AxiosResponse>;
    delete: (notificationId: string) => Promise<AxiosResponse>;
    clear: (isArchived?: boolean | null) => Promise<AxiosResponse>;
  };

  // Notification preferences
  preferences: {
    get: () => Promise<AxiosResponse>;
    update: (preferences: unknown) => Promise<AxiosResponse>;
  };

  // Price alerts
  priceAlerts: {
    getAll: (params?: { is_active?: boolean; ticker?: string; portfolio_id?: string; include_global?: boolean }) => Promise<AxiosResponse>;
    create: (alert: unknown) => Promise<AxiosResponse>;
    update: (alertId: string, updates: unknown) => Promise<AxiosResponse>;
    delete: (alertId: string) => Promise<AxiosResponse>;
    getForTicker: (ticker: string) => Promise<AxiosResponse>;
  };
}

const apiService: ApiService = {
  // Generic HTTP methods
  get: (url, params = {}, config = {}) => api.get(url, { params, ...config }),
  post: (url, data = {}, config = {}) => api.post(url, data, config),
  put: (url, data = {}, config = {}) => api.put(url, data, config),
  delete: (url, config = {}) => api.delete(url, config),
  patch: (url, data = {}, config = {}) => api.patch(url, data, config),

  // Stock endpoints
  getStockPrice: (ticker, timeframe = '1Y') =>
    api.get('/price', { params: { ticker, timeframe } }),

  getStockHistorical: (ticker, timeframe = '1M') =>
    api.get(`/stocks/${ticker}/historical-data`, { params: { timeframe } }),

  getStockSentiment: (ticker) =>
    api.get(`/stocks/${ticker}/sentiment`),

  getStockEvents: (ticker) =>
    api.get(`/stocks/${ticker}/significant-events`),

  // News endpoints
  getNews: (ticker) =>
    api.get('/news', { params: { ticker } }),

  getCategorizedNews: (ticker, startDate, endDate) =>
    api.get(`/news/${ticker}/categorized`, { params: { start_date: startDate, end_date: endDate } }),

  getDailySentiment: (ticker, timeframe = null) =>
    api.get('/daily-sentiment', { params: { ticker, ...(timeframe && { timeframe }) } }),

  getNewsModels: (ticker) =>
    api.get('/news-models', { params: { ticker } }),

  // Sector endpoints
  getSectorConstituents: (sectorTicker) =>
    api.get(`/sectors/${encodeURIComponent(sectorTicker)}/top-constituents`),

  getSectorAggregatedNews: (sectorIdentifier, params = {}) =>
    api.get(`/sectors/${encodeURIComponent(sectorIdentifier)}/aggregated-news`, { params }),

  getSectorDailySentiment: (sectorIdentifier, days = 30) =>
    api.get(`/sectors/${encodeURIComponent(sectorIdentifier)}/daily-sentiment`, { params: { days } }),

  // Search
  searchTicker: (query) =>
    api.get('/search-ticker', { params: { q: query } }),

  // Portfolio endpoints
  // Note: All paths are relative to API_BASE_URL which is '/api'
  // The proxy will rewrite '/api/*' to '/*' when forwarding to backend
  getPortfolioAccounts: (username, config = {}) =>
    api.get(`/accounts/${username}`, config),

  getPortfolioHoldings: (username, accountName, config = {}) =>
    api.get(`/portfolio/holdings/${username}/${encodeURIComponent(accountName)}`, config),

  getPortfolioPerformance: (username, accountName, timeframe = '1Y', config = {}) => {
    const params = timeframe ? { timeframe } : {};
    return api.get(`/portfolio/performance/${username}/${encodeURIComponent(accountName)}`, {
      ...config,
      params: { ...params, ...(config.params || {}) }
    });
  },

  getPortfolioNews: (username, accountName, config = {}) =>
    api.get(`/portfolio/news/${username}/${encodeURIComponent(accountName)}`, config),

  getPortfolioSentiment: (username, accountName) =>
    api.get(`/portfolio/sentiment/${username}/${encodeURIComponent(accountName)}`),

  getPortfolioDailySentiment: (username, accountName, timeframe = null, days = null) =>
    api.get(`/portfolio/daily-sentiment/${username}/${encodeURIComponent(accountName)}`, {
      params: {
        ...(timeframe && { timeframe }),
        ...(days && { days })
      }
    }),

  getPortfolioRollingSentiment: (username, accountName, timeframe = '1W') =>
    api.get(`/portfolio/rolling-sentiment/${username}/${encodeURIComponent(accountName)}`, {
      params: { timeframe }
    }),

  addPortfolio: (portfolioData) =>
    api.post('/portfolio/save', portfolioData),

  updatePortfolio: (portfolioData) =>
    api.put('/portfolio/update', portfolioData),

  deletePortfolio: (username, accountName) =>
    api.delete(`/portfolio/delete/${username}/${encodeURIComponent(accountName)}`),

  // Auth endpoints
  login: (username, password) =>
    api.post('/LoginAdmin', { username, password }),

  signup: (username, password) =>
    api.post('/signup', { username, password }),

  // Company overview
  getCompanyOverview: (ticker) =>
    api.get(`/stocks/${ticker}/company-overview`),

  // Price endpoint (for usePriceData.js)
  getPrice: (ticker, timeframe) =>
    api.get('/price', { params: { ticker, timeframe } }),

  // News sources (for useSourceReliability.js)
  getNewsSources: (ticker) =>
    api.get('/news/sources', { params: { ticker } }),

  // Rolling sentiment (for useRollingSentiment.js)
  getRollingSentiment: (ticker, timeframe = '1W') =>
    api.get('/rolling-sentiment', { params: { ticker, timeframe } }),

  // Earnings endpoints
  getEarningsCalendar: (ticker, horizon = '3month') =>
    api.get(`/stocks/${ticker}/earnings-calendar`, { params: { horizon } }),

  getEarningsQuarters: (ticker, yearsBack = 2) =>
    api.get(`/stocks/${ticker}/earnings-quarters`, { params: { years_back: yearsBack } }),

  getEarningsTranscript: (ticker, quarter) =>
    api.get(`/stocks/${ticker}/earnings-transcript`, { params: { quarter } }),

  // User endpoints
  getUsers: () => api.get('/users'),

  getAccounts: (username) => api.get(`/accounts/${username}`),

  // Notification endpoints
  notifications: {
    getAll: (params = {}) =>
      api.get('/notifications/', { params }),

    getPortfolio: (portfolioId, params = {}) =>
      api.get(`/notifications/portfolio/${portfolioId}`, { params }),

    getPortfolioUnreadCount: (portfolioId, includeGlobal = true) =>
      api.get(`/notifications/portfolio/${portfolioId}/unread-count`, {
        params: { include_global: includeGlobal }
      }),

    getMultiPortfolio: (portfolioIds, params = {}) =>
      api.post('/notifications/multi-portfolio', portfolioIds, { params }),

    create: (notification) =>
      api.post('/notifications/', notification),

    getUnreadCount: () =>
      api.get('/notifications/unread-count'),

    markAsRead: (notificationId) =>
      api.patch(`/notifications/${notificationId}/read`),

    markAllAsRead: () =>
      api.post('/notifications/mark-all-read'),

    archive: (notificationId) =>
      api.patch(`/notifications/${notificationId}/archive`),

    delete: (notificationId) =>
      api.delete(`/notifications/${notificationId}`),

    clear: (isArchived = null) =>
      api.post('/notifications/clear', null, {
        params: isArchived !== null ? { is_archived: isArchived } : {}
      }),
  },

  // Notification preferences
  preferences: {
    get: () => api.get('/notifications/preferences'),

    update: (preferences) =>
      api.put('/notifications/preferences', preferences),
  },

  // Price alerts
  priceAlerts: {
    getAll: (params = {}) =>
      api.get('/notifications/alerts', { params }),

    create: (alert) =>
      api.post('/notifications/alerts', alert),

    update: (alertId, updates) =>
      api.patch(`/notifications/alerts/${alertId}`, updates),

    delete: (alertId) =>
      api.delete(`/notifications/alerts/${alertId}`),

    getForTicker: (ticker) =>
      api.get(`/notifications/alerts/ticker/${ticker}`),
  },
};

export default apiService;
export { api };

// Re-export error utilities for convenience
export { ApiError, isApiError, isAuthError, isNetworkError, isServerError } from './errors';
export type { ApiErrorCode, ApiErrorOptions } from './errors';
