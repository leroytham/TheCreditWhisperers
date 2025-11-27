/**
 * =============================================================================
 * k6 Test Data
 * =============================================================================
 * Centralized test data and endpoint definitions for all k6 load tests.
 */

// =============================================================================
// STOCK TICKERS
// =============================================================================

/** Tickers for market data tests */
export const marketTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];

/** Tickers for sentiment analysis tests */
export const sentimentTickers = ['AAPL', 'TSLA', 'NVDA'];

/** All available tickers */
export const allTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA'];

// =============================================================================
// API ENDPOINTS
// =============================================================================

export const endpoints = {
  health: {
    live: '/health/live',
    ready: '/health/ready',
    main: '/health',
    startup: '/health/startup',
  },
  market: {
    quote: (ticker) => `/api/market/quote/${ticker}`,
    history: (ticker) => `/api/market/history/${ticker}`,
  },
  sentiment: {
    ticker: (ticker) => `/api/sentiment/ticker/${ticker}`,
  },
  portfolio: {
    list: '/api/portfolios/',
  },
  notifications: {
    list: '/api/notifications/',
    unreadCount: '/api/notifications/unread-count',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a random ticker from an array
 * @param {string[]} tickers - Array of ticker symbols
 * @returns {string} Random ticker
 */
export function getRandomTicker(tickers = allTickers) {
  return tickers[Math.floor(Math.random() * tickers.length)];
}

/**
 * Get a random element from an array
 * @param {any[]} arr - Array to pick from
 * @returns {any} Random element
 */
export function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// =============================================================================
// SLEEP DURATIONS (respecting rate limits)
// =============================================================================

export const sleepDurations = {
  /** Sleep between health checks */
  health: 0.5,
  /** Sleep between market data requests (rate limited) */
  market: 2,
  /** Sleep between sentiment requests (rate limited) */
  sentiment: 3,
  /** Short sleep for spike tests */
  spike: 0.5,
  /** Standard sleep between iterations */
  standard: 1,
};
