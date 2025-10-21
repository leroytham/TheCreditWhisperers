// src/features/shared/utils/constants.js

/**
 * Shared Constants
 *
 * Centralized configuration constants used by both Entity and Sector features
 */

// Available timeframe options
export const TIMEFRAMES = ['5D', '1M', '3M', '6M', 'YTD', '1Y'];

// Default timeframe
export const DEFAULT_TIMEFRAME = '1Y';

// Chart configuration
export const NUM_X_AXIS_POINTS = 6;

// Chart dimensions (entity default)
export const CHART_CONFIG = {
  height: 384, // h-96 in pixels
  width: 660,
  padding: {
    left: 60,
    right: 60,
    top: 40,
    bottom: 50
  }
};

// Sentiment chart configuration
export const SENTIMENT_CHART_CONFIG = {
  height: 384,
  width: 750,
  padding: {
    left: 70,
    right: 50,
    top: 40,
    bottom: 80
  },
  yAxisValues: [0.4, 0.2, 0, -0.2, -0.4],
  barWidth: 70,
  daysToShow: 7
};

// Sector-specific responsive chart configuration
export const SECTOR_CHART_CONFIG = {
  NUM_X_AXIS_POINTS: 6,
  DEFAULT_WIDTH: 660,
  MIN_WIDTH: 300,
  MAX_WIDTH: 1000,
  HEIGHT: 250,
  SENTIMENT_CHART_HEIGHT: 350,
};

// Price range padding percentage
export const PRICE_RANGE_PADDING = 0.1;

// Default visible headlines in sentiment tooltip
export const DEFAULT_VISIBLE_HEADLINES = 5;

// Max events to display
export const MAX_EVENTS_DISPLAY = 5;

// Color constants
export const COLORS = {
  // Chart line colors (hex)
  chartPositive: '#16a34a',
  chartNegative: '#dc2626',

  // Sentiment bar colors (hex)
  sentimentPositive: '#22c55e',
  sentimentNegative: '#ef4444',
  sentimentNeutral: '#9ca3af',

  // Tailwind color classes
  textPositive: 'text-green-600',
  textNegative: 'text-red-600',
  textNeutral: 'text-gray-600',

  // Background color classes
  bgPositive: 'bg-green-50 border-green-600',
  bgNegative: 'bg-red-50 border-red-600',
  bgNeutral: 'bg-gray-50 border-gray-600'
};

// API polling interval (milliseconds) - entity specific
export const PRICE_POLL_INTERVAL = 5000; // 5 seconds

// Search debounce delay (milliseconds) - entity specific
export const SEARCH_DEBOUNCE_DELAY = 300;

// Minimum search term length - entity specific
export const MIN_SEARCH_LENGTH = 2;

// Default ticker - entity specific
export const DEFAULT_TICKER = 'UBS';