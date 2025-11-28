// frontend/src/features/shared/components/SentimentBadge.jsx

import React from 'react';
import { getSentimentDetails } from '../utils/sentimentHelpers';

/**
 * Reusable sentiment indicator badge with icon, color-coding, and tooltip.
 * @param {object} props
 * @param {number} props.score - The sentiment score.
 * @param {string} props.label - The sentiment label provided from the backend (optional).
 */
const SentimentBadge = ({ score = 0, label }: { score?: number; label?: any }) => {
  const { label: calculatedLabel, Icon, colorClasses } = getSentimentDetails(score);

  // Use the backend-provided label if available, otherwise use the one calculated from the score.
  const displayLabel = label || calculatedLabel;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${colorClasses}`}
      title={`Sentiment Score: ${score?.toFixed(3)}`}
    >
      <Icon className="h-3 w-3" />
      <span>{displayLabel}: {score.toFixed(2)}</span>
    </div>
  );
};

export default SentimentBadge;