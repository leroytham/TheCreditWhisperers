// frontend/src/config/constants.js

/**
 * Application-wide constants and configuration
 */

// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export const API_ENDPOINTS = {
  // Stock endpoints
  STOCK_PRICE: '/price',
  STOCK_HISTORICAL: '/stocks/:ticker/historical-data',
  STOCK_SENTIMENT: '/stocks/:ticker/sentiment',
  STOCK_EVENTS: '/stocks/:ticker/significant-events',

  // News endpoints
  NEWS: '/news',
  NEWS_CATEGORIZED: '/news/:ticker/categorized',
  NEWS_MODELS: '/news-models',
  DAILY_SENTIMENT: '/daily-sentiment',

  // Sector endpoints
  SECTOR_CONSTITUENTS: '/sectors/:sector/top-constituents',

  // Search
  SEARCH_TICKER: '/search-ticker',
};

// Query keys for React Query
export const QUERY_KEYS = {
  STOCK_PRICE: 'stockPrice',
  STOCK_HISTORICAL: 'stockHistorical',
  STOCK_SENTIMENT: 'stockSentiment',
  STOCK_EVENTS: 'stockEvents',
  NEWS: 'news',
  NEWS_CATEGORIZED: 'newsCategorized',
  DAILY_SENTIMENT: 'dailySentiment',
  SECTOR_CONSTITUENTS: 'sectorConstituents',
  SEARCH_TICKER: 'searchTicker',
};

// Cache/stale times (in milliseconds)
export const CACHE_TIMES = {
  STOCK_PRICE: 5 * 60 * 1000,      // 5 minutes
  NEWS: 10 * 60 * 1000,             // 10 minutes
  SENTIMENT: 15 * 60 * 1000,        // 15 minutes
  SECTOR: 60 * 60 * 1000,           // 1 hour
  COMPANY_INFO: 24 * 60 * 60 * 1000, // 24 hours
};

// Timeframe options
export const TIMEFRAMES = [
  { value: '5D', label: '5 Days' },
  { value: '1M', label: '1 Month' },
  { value: '3M', label: '3 Months' },
  { value: '6M', label: '6 Months' },
  { value: '1Y', label: '1 Year' },
  { value: 'YTD', label: 'Year to Date' },
];

// Sentiment labels (new standardized Bullish/Bearish terminology)
export const SENTIMENT_LABELS = {
  BULLISH: 'Bullish',
  SOMEWHAT_BULLISH: 'Somewhat-Bullish',
  NEUTRAL: 'Neutral',
  SOMEWHAT_BEARISH: 'Somewhat-Bearish',
  BEARISH: 'Bearish',
};

// Legacy sentiment labels (for backward compatibility)
export const LEGACY_SENTIMENT_LABELS = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative',
};

// Sentiment colors (mapped to new labels)
export const SENTIMENT_COLORS = {
  [SENTIMENT_LABELS.BULLISH]: '#22c55e',         // green (stronger)
  [SENTIMENT_LABELS.SOMEWHAT_BULLISH]: '#10b981', // green (moderate)
  [SENTIMENT_LABELS.NEUTRAL]: '#6b7280',          // gray
  [SENTIMENT_LABELS.SOMEWHAT_BEARISH]: '#f87171', // red (moderate)
  [SENTIMENT_LABELS.BEARISH]: '#ef4444',          // red (stronger)
};

// Legacy sentiment colors (for backward compatibility)
export const LEGACY_SENTIMENT_COLORS = {
  [LEGACY_SENTIMENT_LABELS.POSITIVE]: '#10b981', // green
  [LEGACY_SENTIMENT_LABELS.NEUTRAL]: '#6b7280',  // gray
  [LEGACY_SENTIMENT_LABELS.NEGATIVE]: '#ef4444', // red
};

// Score definitions
export const SCORE_DEFINITIONS = {
  SENTIMENT: 'x <= -0.35: Bearish; -0.35 < x <= -0.15: Somewhat-Bearish; -0.15 < x < 0.15: Neutral; 0.15 <= x < 0.35: Somewhat-Bullish; x >= 0.35: Bullish',
  RELEVANCE: '0 < x <= 1, with a higher score indicating higher relevance.'
};

// Sentiment thresholds
export const SENTIMENT_THRESHOLDS = {
  BULLISH: 0.35,
  SOMEWHAT_BULLISH: 0.15,
  NEUTRAL_UPPER: 0.15,
  NEUTRAL_LOWER: -0.15,
  SOMEWHAT_BEARISH: -0.15,
  BEARISH: -0.35,
};

// Relevance score range
export const RELEVANCE_SCORE_RANGE = {
  MIN: 0,    // Exclusive (0 < x)
  MAX: 1.0,  // Inclusive (x <= 1)
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Invalid input. Please check your data.',
  TIMEOUT: 'Request timeout. Please try again.',
  GENERIC: 'An unexpected error occurred. Please try again.',
};

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  RETRY_STATUS_CODES: [408, 429, 500, 502, 503, 504],
};

// Debounce delays
export const DEBOUNCE_DELAYS = {
  SEARCH: 300,
  INPUT: 500,
  SCROLL: 150,
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};
