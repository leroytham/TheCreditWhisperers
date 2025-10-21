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
  if (score > 0.5) {
    return {
      label: 'Very Positive',
      Icon: ArrowUp,
      colorClasses: 'text-green-700 bg-green-100 border-green-200',
    };
  }
  if (score > 0.1) {
    return {
      label: 'Positive',
      Icon: ArrowUpRight,
      colorClasses: 'text-green-600 bg-green-50 border-green-100',
    };
  }
  if (score > -0.1) {
    return {
      label: 'Neutral',
      Icon: ArrowRight,
      colorClasses: 'text-gray-600 bg-gray-100 border-gray-200',
    };
  }
  if (score > -0.5) {
    return {
      label: 'Negative',
      Icon: ArrowDownRight,
      colorClasses: 'text-red-600 bg-red-50 border-red-100',
    };
  }
  return {
    label: 'Very Negative',
    Icon: ArrowDown,
    colorClasses: 'text-red-700 bg-red-100 border-red-200',
  };
};
