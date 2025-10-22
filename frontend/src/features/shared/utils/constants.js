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
  // Dynamic Y-axis range - will be calculated based on data
  // But these are the threshold markers to display
  yAxisThresholds: [0.35, 0.15, 0, -0.15, -0.35],
  yAxisDefaultValues: [0.5, 0.25, 0, -0.25, -0.5], // Default if data range is within this
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

  // Sentiment bar colors (hex) - now with 5 levels
  sentimentBullish: '#22c55e',         // Strong green
  sentimentSomewhatBullish: '#10b981', // Moderate green
  sentimentNeutral: '#9ca3af',         // Gray
  sentimentSomewhatBearish: '#f87171', // Moderate red
  sentimentBearish: '#ef4444',         // Strong red

  // Legacy colors (backward compatibility)
  sentimentPositive: '#22c55e',
  sentimentNegative: '#ef4444',

  // Tailwind color classes - updated for new labels
  textBullish: 'text-green-600',
  textSomewhatBullish: 'text-green-500',
  textNeutral: 'text-gray-600',
  textSomewhatBearish: 'text-red-500',
  textBearish: 'text-red-600',

  // Legacy tailwind classes (backward compatibility)
  textPositive: 'text-green-600',
  textNegative: 'text-red-600',

  // Background color classes
  bgBullish: 'bg-green-50 border-green-600',
  bgSomewhatBullish: 'bg-green-50 border-green-500',
  bgNeutral: 'bg-gray-50 border-gray-600',
  bgSomewhatBearish: 'bg-red-50 border-red-500',
  bgBearish: 'bg-red-50 border-red-600',

  // Legacy background classes
  bgPositive: 'bg-green-50 border-green-600',
  bgNegative: 'bg-red-50 border-red-600',

  // Threshold marker colors
  thresholdLine: '#d1d5db', // Light gray for threshold markers
  thresholdText: '#6b7280'  // Medium gray for threshold labels
};

// API polling interval (milliseconds) - entity specific
export const PRICE_POLL_INTERVAL = 5000; // 5 seconds

// Search debounce delay (milliseconds) - entity specific
export const SEARCH_DEBOUNCE_DELAY = 300;

// Minimum search term length - entity specific
export const MIN_SEARCH_LENGTH = 2;

// Default ticker - entity specific
export const DEFAULT_TICKER = 'UBS';