/**
 * Color Formatting Utilities
 *
 * Functions for getting colors based on sentiment, price changes, etc.
 */

/**
 * Get sentiment text color class
 */
export const getSentimentColor = (score: number | null | undefined): string => {
  if (score == null) return 'text-gray-600';
  if (score >= 0.15) return 'text-green-600';
  if (score <= -0.15) return 'text-red-600';
  return 'text-gray-600';
};

/**
 * Get sentiment background color class
 */
export const getSentimentBgColor = (score: number | null | undefined): string => {
  if (score == null) return 'bg-gray-50 border-gray-600';
  if (score > 0) return 'bg-green-50 border-green-600';
  if (score < 0) return 'bg-red-50 border-red-600';
  return 'bg-gray-50 border-gray-600';
};

/**
 * Get price change color class
 */
export const getPriceChangeColor = (change: number | null | undefined): string => {
  return (change ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';
};

/**
 * Get price change arrow symbol
 */
export const getPriceChangeArrow = (change: number | null | undefined): string => {
  return (change ?? 0) >= 0 ? '▲' : '▼';
};

/**
 * Get chart line color (hex value)
 */
export const getChartLineColor = (change: number | null | undefined): string => {
  return (change ?? 0) >= 0 ? '#16a34a' : '#dc2626';
};

/**
 * Get bar color for sentiment chart (hex value)
 */
export const getBarColor = (score: number | null | undefined): string => {
  if (score == null) return '#9ca3af';
  if (score > 0) return '#22c55e';
  if (score < 0) return '#ef4444';
  return '#9ca3af';
};
