/**
 * SentimentScore Value Object
 *
 * A lightweight value object for sentiment scores that encapsulates
 * classification logic and provides type-safe sentiment handling.
 *
 * Uses the centralized SENTIMENT_THRESHOLDS for classification.
 */

import { SENTIMENT_THRESHOLDS, SENTIMENT_COLORS, SENTIMENT_LABELS } from '../../config/constants';

/**
 * Sentiment classification labels
 */
export type SentimentLabel =
  | 'Bullish'
  | 'Somewhat-Bullish'
  | 'Neutral'
  | 'Somewhat-Bearish'
  | 'Bearish';

/**
 * SentimentScore interface - a lightweight value object
 * Immutable by convention (readonly properties)
 */
export interface SentimentScore {
  /** The raw sentiment score value, typically between -1 and 1 */
  readonly value: number;
  /** The classified sentiment label */
  readonly label: SentimentLabel;
  /** Whether the score indicates bullish sentiment (>= 0.15) */
  readonly isBullish: boolean;
  /** Whether the score indicates bearish sentiment (<= -0.15) */
  readonly isBearish: boolean;
  /** Whether the score indicates neutral sentiment */
  readonly isNeutral: boolean;
  /** Whether the score is a strong signal (bullish or bearish) */
  readonly isStrongSignal: boolean;
}

/**
 * Classify a sentiment score into a label using centralized thresholds.
 *
 * Classification Rules:
 * - score >= 0.35: Bullish
 * - 0.15 <= score < 0.35: Somewhat-Bullish
 * - -0.15 < score < 0.15: Neutral
 * - -0.35 < score <= -0.15: Somewhat-Bearish
 * - score <= -0.35: Bearish
 *
 * @param score - The sentiment score to classify
 * @returns The sentiment label
 */
export function classifySentiment(score: number): SentimentLabel {
  if (score >= SENTIMENT_THRESHOLDS.BULLISH) return 'Bullish';
  if (score >= SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH) return 'Somewhat-Bullish';
  if (score <= SENTIMENT_THRESHOLDS.BEARISH) return 'Bearish';
  if (score <= SENTIMENT_THRESHOLDS.SOMEWHAT_BEARISH) return 'Somewhat-Bearish';
  return 'Neutral';
}

/**
 * Create a SentimentScore value object from a raw score.
 *
 * @param value - The raw sentiment score (typically between -1 and 1)
 * @returns A SentimentScore value object with computed properties
 *
 * @example
 * ```typescript
 * const score = createSentimentScore(0.42);
 * console.log(score.label); // "Bullish"
 * console.log(score.isBullish); // true
 * ```
 */
export function createSentimentScore(value: number): SentimentScore {
  const label = classifySentiment(value);
  const isBullish = value >= SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH;
  const isBearish = value <= SENTIMENT_THRESHOLDS.SOMEWHAT_BEARISH;
  const isNeutral = !isBullish && !isBearish;
  const isStrongSignal =
    value >= SENTIMENT_THRESHOLDS.BULLISH || value <= SENTIMENT_THRESHOLDS.BEARISH;

  return {
    value,
    label,
    isBullish,
    isBearish,
    isNeutral,
    isStrongSignal,
  };
}

/**
 * Create a SentimentScore from a nullable value.
 * Returns a neutral score if the value is null or undefined.
 *
 * @param value - The raw sentiment score or null/undefined
 * @returns A SentimentScore value object
 */
export function createSentimentScoreOrNeutral(
  value: number | null | undefined
): SentimentScore {
  return createSentimentScore(value ?? 0);
}

/**
 * Get the color for a sentiment score using centralized color mappings.
 *
 * @param score - The SentimentScore or raw number
 * @returns The hex color string for the sentiment
 */
export function getSentimentColor(score: SentimentScore | number): string {
  const label = typeof score === 'number' ? classifySentiment(score) : score.label;
  return SENTIMENT_COLORS[label] ?? SENTIMENT_COLORS[SENTIMENT_LABELS.NEUTRAL];
}

/**
 * Get Tailwind CSS color classes for a sentiment score.
 *
 * @param score - The SentimentScore or raw number
 * @returns Object with text, background, and border color classes
 */
export function getSentimentColorClasses(score: SentimentScore | number): {
  text: string;
  bg: string;
  border: string;
  combined: string;
} {
  const label = typeof score === 'number' ? classifySentiment(score) : score.label;

  switch (label) {
    case 'Bullish':
      return {
        text: 'text-green-700',
        bg: 'bg-green-100',
        border: 'border-green-200',
        combined: 'text-green-700 bg-green-100 border-green-200',
      };
    case 'Somewhat-Bullish':
      return {
        text: 'text-green-600',
        bg: 'bg-green-50',
        border: 'border-green-100',
        combined: 'text-green-600 bg-green-50 border-green-100',
      };
    case 'Neutral':
      return {
        text: 'text-gray-600',
        bg: 'bg-gray-100',
        border: 'border-gray-200',
        combined: 'text-gray-600 bg-gray-100 border-gray-200',
      };
    case 'Somewhat-Bearish':
      return {
        text: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-100',
        combined: 'text-red-600 bg-red-50 border-red-100',
      };
    case 'Bearish':
      return {
        text: 'text-red-700',
        bg: 'bg-red-100',
        border: 'border-red-200',
        combined: 'text-red-700 bg-red-100 border-red-200',
      };
  }
}

/**
 * Format a sentiment score for display with sign and precision.
 *
 * @param score - The SentimentScore or raw number
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "+0.35", "-0.15")
 */
export function formatSentimentScore(
  score: SentimentScore | number,
  decimals: number = 2
): string {
  const value = typeof score === 'number' ? score : score.value;
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}
