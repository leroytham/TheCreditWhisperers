/**
 * Utility functions for PerformanceCard components
 */

// Chart display constants
export const MIN_BAR_HEIGHT_PX = 10;

/**
 * Format benchmark label with correct sign prefix
 */
export const formatBenchmarkLabel = (value: number): string => {
  if (value === 0) return '0%';
  if (value > 0) return `+${value}%`;
  return `${value}%`;
};

/**
 * Get color class based on value sign
 */
export const getBenchmarkColorClass = (value: number): string => {
  if (value === 0) return 'text-gray-600';
  return value > 0 ? 'text-green-600' : 'text-red-600';
};

/**
 * Calculate adaptive Y-axis maximum based on data range
 */
export const getAdaptiveYAxisMax = (maxAbsValue: number): number => {
  if (maxAbsValue === 0) return 10;
  if (maxAbsValue <= 1) return Math.ceil(maxAbsValue);
  if (maxAbsValue <= 5) return Math.ceil(maxAbsValue / 5) * 5;
  return Math.ceil(maxAbsValue / 10) * 10;
};

/**
 * Calculate dynamic bar height based on data range
 */
export const calculateBarHeight = (
  value: number,
  yAxisMax: number,
  containerHeight: number = 85
): number => {
  if (yAxisMax === 0) return MIN_BAR_HEIGHT_PX;

  const percentage = Math.abs(value) / yAxisMax;
  const calculatedHeight = percentage * containerHeight * 0.9;

  return Math.max(MIN_BAR_HEIGHT_PX, calculatedHeight);
};
