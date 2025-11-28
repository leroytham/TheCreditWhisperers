// frontend/src/features/shared/utils/sentimentHelpers.js

import {
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  ArrowDown,
} from 'lucide-react';

/**
 * Maps sentiment score to a descriptive label, icon, and color classes.
 * Uses the standardized Bullish/Bearish classification system.
 *
 * Classification Rules:
 * - x >= 0.35: Bullish
 * - 0.15 <= x < 0.35: Somewhat-Bullish
 * - -0.15 < x < 0.15: Neutral
 * - -0.35 < x <= -0.15: Somewhat-Bearish
 * - x <= -0.35: Bearish
 *
 * @param {number} score - The sentiment score, typically between -1 and 1.
 * @returns {object} An object containing the label, Icon component, and Tailwind CSS color classes.
 */
export const getSentimentDetails = (score) => {
  if (score === null || score === undefined) {
    return {
      label: 'Neutral',
      Icon: ArrowRight,
      colorClasses: 'text-gray-600 bg-gray-100 border-gray-200',
    };
  }
  if (score >= 0.35) {
    return {
      label: 'Bullish',
      Icon: ArrowUp,
      colorClasses: 'text-green-700 bg-green-100 border-green-200',
    };
  }
  if (score >= 0.15) {
    return {
      label: 'Somewhat-Bullish',
      Icon: ArrowUpRight,
      colorClasses: 'text-green-600 bg-green-50 border-green-100',
    };
  }
  if (score > -0.15) {
    return {
      label: 'Neutral',
      Icon: ArrowRight,
      colorClasses: 'text-gray-600 bg-gray-100 border-gray-200',
    };
  }
  if (score > -0.35) {
    return {
      label: 'Somewhat-Bearish',
      Icon: ArrowDownRight,
      colorClasses: 'text-red-600 bg-red-50 border-red-100',
    };
  }
  return {
    label: 'Bearish',
    Icon: ArrowDown,
    colorClasses: 'text-red-700 bg-red-100 border-red-200',
  };
};

/**
 * Gets the display details for a relevance score.
 * Relevance scores range from 0 < x <= 1, with higher indicating more relevant.
 *
 * @param {number} score - The relevance score (0 < x <= 1)
 * @returns {object} An object containing the formatted display value and color classes.
 */
export const getRelevanceDetails = (score) => {
  if (score === null || score === undefined || score <= 0 || score > 1) {
    return null; // Invalid or missing relevance score
  }

  // Determine color intensity based on relevance
  // Higher relevance = stronger color
  let colorClasses;
  if (score >= 0.8) {
    colorClasses = 'text-blue-700 bg-blue-100 border-blue-200';
  } else if (score >= 0.6) {
    colorClasses = 'text-blue-600 bg-blue-50 border-blue-100';
  } else if (score >= 0.4) {
    colorClasses = 'text-blue-500 bg-blue-50 border-blue-100';
  } else {
    colorClasses = 'text-gray-600 bg-gray-50 border-gray-100';
  }

  return {
    value: score.toFixed(2),
    displayValue: `${(score * 100).toFixed(0)}%`,
    colorClasses,
    label: score >= 0.7 ? 'High Relevance' : score >= 0.4 ? 'Medium Relevance' : 'Low Relevance'
  };
};

/**
 * Gets the display details for sentiment momentum.
 * Momentum measures the rate of change of sentiment (Fast Score - Slow Score).
 *
 * Classification Rules:
 * - momentum >= +0.20: Strong Positive Momentum
 * - momentum >= +0.10: Positive Momentum
 * - -0.10 < momentum < +0.10: Neutral Momentum
 * - momentum <= -0.10: Negative Momentum
 * - momentum <= -0.20: Strong Negative Momentum
 *
 * @param {number} momentum - The momentum value (fast_score - slow_score)
 * @param {number} thresholdWeak - Weak momentum threshold (default: 0.10)
 * @param {number} thresholdStrong - Strong momentum threshold (default: 0.20)
 * @returns {object} Object containing label, Icon, colorClasses, arrow, and interpretation
 */
export const getMomentumDetails = (momentum, thresholdWeak = 0.10, thresholdStrong = 0.20) => {
  if (momentum === null || momentum === undefined) {
    return {
      label: 'No Data',
      Icon: ArrowRight,
      colorClasses: 'text-gray-400 bg-gray-50 border-gray-200',
      arrow: '→',
      interpretation: 'Insufficient data for momentum',
      direction: null,
      strength: null
    };
  }

  // Strong Positive Momentum
  if (momentum >= thresholdStrong) {
    return {
      label: 'Strong Positive',
      Icon: ArrowUp,
      colorClasses: 'text-green-700 bg-green-100 border-green-200',
      arrow: '⬆⬆',
      interpretation: 'News is getting much better',
      direction: 'improving',
      strength: 'strong'
    };
  }

  // Positive Momentum
  if (momentum >= thresholdWeak) {
    return {
      label: 'Positive',
      Icon: ArrowUpRight,
      colorClasses: 'text-green-600 bg-green-50 border-green-100',
      arrow: '⬆',
      interpretation: 'News is getting better',
      direction: 'improving',
      strength: 'weak'
    };
  }

  // Strong Negative Momentum
  if (momentum <= -thresholdStrong) {
    return {
      label: 'Strong Negative',
      Icon: ArrowDown,
      colorClasses: 'text-red-700 bg-red-100 border-red-200',
      arrow: '⬇⬇',
      interpretation: 'News is getting much worse',
      direction: 'deteriorating',
      strength: 'strong'
    };
  }

  // Negative Momentum
  if (momentum <= -thresholdWeak) {
    return {
      label: 'Negative',
      Icon: ArrowDownRight,
      colorClasses: 'text-red-600 bg-red-50 border-red-100',
      arrow: '⬇',
      interpretation: 'News is getting worse',
      direction: 'deteriorating',
      strength: 'weak'
    };
  }

  // Neutral Momentum
  return {
    label: 'Neutral',
    Icon: ArrowRight,
    colorClasses: 'text-gray-600 bg-gray-100 border-gray-200',
    arrow: '→',
    interpretation: 'Sentiment is stable',
    direction: 'stable',
    strength: 'neutral'
  };
};

/**
 * Gets Tailwind color classes for momentum value display.
 * @param {number} momentum - The momentum value
 * @returns {string} Tailwind CSS classes for text color
 */
export const getMomentumColor = (momentum) => {
  if (momentum === null || momentum === undefined) return 'text-gray-400';
  if (momentum >= 0.20) return 'text-green-600';      // Strong positive
  if (momentum >= 0.10) return 'text-green-500';      // Positive
  if (momentum <= -0.20) return 'text-red-600';       // Strong negative
  if (momentum <= -0.10) return 'text-red-500';       // Negative
  return 'text-gray-500';                              // Neutral
};

/**
 * Formats momentum value with appropriate sign and precision.
 * @param {number} momentum - The momentum value
 * @returns {string} Formatted momentum string (e.g., "+0.15", "-0.08", "~0.00")
 */
export const formatMomentumValue = (momentum) => {
  if (momentum === null || momentum === undefined) return '--';

  const absValue = Math.abs(momentum);

  // For very small values, show as neutral
  if (absValue < 0.001) {
    return '~0.00';
  }

  const sign = momentum >= 0 ? '+' : '';
  return `${sign}${momentum.toFixed(3)}`;
};

/**
 * Gets the inline arrow symbol for at-a-glance momentum indication.
 * @param {number} momentum - The momentum value
 * @param {number} thresholdWeak - Weak momentum threshold (default: 0.10)
 * @returns {object} Object with arrow symbol and color class
 */
export const getMomentumArrow = (momentum, thresholdWeak = 0.10) => {
  if (momentum === null || momentum === undefined) {
    return { symbol: '', color: 'text-gray-400' };
  }

  if (momentum >= thresholdWeak) {
    return { symbol: '⬆', color: 'text-green-600' };
  }

  if (momentum <= -thresholdWeak) {
    return { symbol: '⬇', color: 'text-red-600' };
  }

  return { symbol: '→', color: 'text-gray-400' };
};
