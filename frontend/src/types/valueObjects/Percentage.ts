/**
 * Percentage Value Object
 *
 * A lightweight value object for percentage values that provides
 * consistent formatting and conversion between decimal and display forms.
 */

/**
 * Percentage interface - a lightweight value object
 * Immutable by convention (readonly properties)
 */
export interface Percentage {
  /** The decimal representation (0.5 for 50%) */
  readonly decimal: number;
  /** The display representation (50 for 50%) */
  readonly display: number;
  /** The formatted string representation (e.g., "50.00%") */
  readonly formatted: string;
  /** Whether the percentage is positive */
  readonly isPositive: boolean;
  /** Whether the percentage is negative */
  readonly isNegative: boolean;
  /** Whether the percentage is zero */
  readonly isZero: boolean;
}

/**
 * Create a Percentage value object from a decimal value.
 *
 * @param decimalValue - The decimal representation (e.g., 0.5 for 50%)
 * @param decimals - Number of decimal places in formatted string (default: 2)
 * @returns A Percentage value object
 *
 * @example
 * ```typescript
 * const pct = createPercentage(0.5);
 * console.log(pct.decimal);   // 0.5
 * console.log(pct.display);   // 50
 * console.log(pct.formatted); // "50.00%"
 * ```
 */
export function createPercentage(decimalValue: number, decimals: number = 2): Percentage {
  const display = decimalValue * 100;
  return {
    decimal: decimalValue,
    display,
    formatted: `${display.toFixed(decimals)}%`,
    isPositive: decimalValue > 0,
    isNegative: decimalValue < 0,
    isZero: decimalValue === 0,
  };
}

/**
 * Create a Percentage value object from a display value (already multiplied by 100).
 *
 * @param displayValue - The display representation (e.g., 50 for 50%)
 * @param decimals - Number of decimal places in formatted string (default: 2)
 * @returns A Percentage value object
 *
 * @example
 * ```typescript
 * const pct = createPercentageFromDisplay(50);
 * console.log(pct.decimal);   // 0.5
 * console.log(pct.display);   // 50
 * console.log(pct.formatted); // "50.00%"
 * ```
 */
export function createPercentageFromDisplay(
  displayValue: number,
  decimals: number = 2
): Percentage {
  const decimal = displayValue / 100;
  return {
    decimal,
    display: displayValue,
    formatted: `${displayValue.toFixed(decimals)}%`,
    isPositive: displayValue > 0,
    isNegative: displayValue < 0,
    isZero: displayValue === 0,
  };
}

/**
 * Format a percentage for display.
 *
 * @param pct - The Percentage value object or decimal number
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "50.00%")
 */
export function formatPercentage(pct: Percentage | number, decimals: number = 2): string {
  const display = typeof pct === 'number' ? pct * 100 : pct.display;
  return `${display.toFixed(decimals)}%`;
}

/**
 * Format a percentage with a sign prefix.
 *
 * @param pct - The Percentage value object or decimal number
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string with sign (e.g., "+50.00%", "-25.00%")
 */
export function formatPercentageWithSign(
  pct: Percentage | number,
  decimals: number = 2
): string {
  const decimal = typeof pct === 'number' ? pct : pct.decimal;
  const display = decimal * 100;
  const sign = decimal >= 0 ? '+' : '';
  return `${sign}${display.toFixed(decimals)}%`;
}

/**
 * Get Tailwind CSS color classes for a percentage (gain/loss styling).
 *
 * @param pct - The Percentage value object or decimal number
 * @returns Object with text color class
 */
export function getPercentageColorClass(pct: Percentage | number): string {
  const decimal = typeof pct === 'number' ? pct : pct.decimal;
  if (decimal > 0) return 'text-green-600';
  if (decimal < 0) return 'text-red-600';
  return 'text-gray-600';
}
