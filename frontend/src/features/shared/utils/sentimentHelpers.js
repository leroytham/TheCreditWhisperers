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
