import React from 'react';
import { getSentimentColor } from '../utils/formatters';

/**
 * Shared OverallSentiment Component
 *
 * Displays overall sentiment metrics and statistics
 * Used by both Entity and Sector features
 *
 * @param {Object} props
 * @param {Object|number} props.sentiment - Sentiment object with avg_score property or direct number value
 * @param {number} props.sentimentAvg - Alternative: direct sentiment average value
 * @param {number} props.newsCount - Number of news articles analyzed
 * @param {string} props.className - Additional CSS classes for wrapper
 */
const OverallSentiment = ({
  sentiment,
  sentimentAvg,
  newsCount,
  className = 'px-6 pb-6'
}) => {
  // Support both sentiment.avg_score (entity) and sentimentAvg (sector) patterns
  const avgScore = typeof sentiment === 'number'
    ? sentiment
    : sentiment?.avg_score ?? sentimentAvg ?? 0;

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-4">Overall Sentiment</h3>

      <div className="flex items-center space-x-8">
        {/* Average Sentiment Score */}
        <div>
          <div className="text-sm text-gray-600">Average Sentiment Score</div>
          <div className={`text-4xl font-bold ${getSentimentColor(avgScore)}`}>
            {avgScore !== null && avgScore !== undefined ? avgScore.toFixed(2) : '--'}
          </div>
        </div>

        {/* News Articles Count */}
        <div>
          <div className="text-sm text-gray-600">News Articles</div>
          <div className="text-lg font-semibold">{newsCount || 0}</div>
        </div>
      </div>
    </div>
  );
};

export default OverallSentiment;
