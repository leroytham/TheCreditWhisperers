/**
 * Currency & Number Formatting Utilities
 *
 * Functions for formatting prices, currencies, and percentages.
 */

/**
 * Format price/number with optional currency
 */
export const formatPrice = (
  price: number | null | undefined,
  currency: string = 'USD',
  decimals: number = 2
): string => {
  if (price === null || price === undefined) return '--';

  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Alias for formatPrice for currency-specific formatting
 */
export const formatCurrency = (
  value: number | null | undefined,
  currency: string = 'USD',
  decimals: number = 2
): string => {
  return formatPrice(value, currency, decimals);
};

/**
 * Format percentage change
 */
export const formatPercentage = (
  value: number | null | undefined,
  decimals: number = 2,
  includeSign: boolean = true
): string => {
  if (value === null || value === undefined) return '--';

  const sign = includeSign && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
};
