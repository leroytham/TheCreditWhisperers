// frontend/src/services/api.js

import axios from 'axios';
import { API_BASE_URL, HTTP_STATUS, ERROR_MESSAGES, RETRY_CONFIG } from '../config/constants';

/**
 * Create axios instance with base configuration
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor - Add auth tokens, logging, etc.
 */
api.interceptors.request.use(
  (config) => {
    // Add timestamp for debugging
    config.metadata = { startTime: new Date() };

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log('=€ API Request:', {
        method: config.method.toUpperCase(),
        url: config.url,
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error) => {
    console.error('L Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle errors, retries, logging
 */
api.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const duration = new Date() - response.config.metadata.startTime;

    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(' API Response:', {
        url: response.config.url,
        status: response.status,
        duration: `${duration}ms`,
        data: response.data,
      });
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle network errors
    if (!error.response) {
      console.error('L Network Error:', error.message);
      throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
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

      console.log(`= Retrying request (${originalRequest._retryCount}/${RETRY_CONFIG.MAX_RETRIES}) after ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return api(originalRequest);
    }

    // Handle specific error codes
    switch (status) {
      case HTTP_STATUS.UNAUTHORIZED:
        // Clear token and redirect to login
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        throw new Error('Session expired. Please login again.');

      case HTTP_STATUS.FORBIDDEN:
        throw new Error('You do not have permission to access this resource.');

      case HTTP_STATUS.NOT_FOUND:
        throw new Error(ERROR_MESSAGES.NOT_FOUND);

      case HTTP_STATUS.TIMEOUT:
        throw new Error(ERROR_MESSAGES.TIMEOUT);

      case HTTP_STATUS.SERVER_ERROR:
      case HTTP_STATUS.BAD_GATEWAY:
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        throw new Error(ERROR_MESSAGES.SERVER_ERROR);

      default:
        throw new Error(data?.detail || ERROR_MESSAGES.GENERIC);
    }
  }
);

/**
 * API Service Methods
 */
const apiService = {
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

  getDailySentiment: (ticker) =>
    api.get('/daily-sentiment', { params: { ticker } }),

  getNewsModels: (ticker) =>
    api.get('/news-models', { params: { ticker } }),

  // Sector endpoints
  getSectorConstituents: (sectorTicker) =>
    api.get(`/sectors/${encodeURIComponent(sectorTicker)}/top-constituents`),

  // Search
  searchTicker: (query) =>
    api.get('/search-ticker', { params: { q: query } }),
};

export default apiService;
export { api };
