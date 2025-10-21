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
  newsCount = 0,
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6'
}) => {
  // Support both sentiment.avg_score (entity) and sentimentAvg (sector) patterns
  const avgScore = typeof sentiment === 'number'
    ? sentiment
    : sentiment?.avg_score ?? sentimentAvg ?? null;

  // Determine sentiment label
  const getSentimentLabel = (score) => {
    if (score === null || score === undefined) return 'N/A';
    if (score > 0.5) return 'Very Positive';
    if (score > 0.1) return 'Positive';
    if (score > -0.1) return 'Neutral';
    if (score > -0.5) return 'Negative';
    return 'Very Negative';
  };

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Overall Sentiment</h3>

      <div className="space-y-6">
        {/* Average Sentiment Score */}
        <div>
          <div className="text-sm font-medium text-gray-600 mb-2">Average Sentiment Score</div>
          <div className="flex items-center space-x-4">
            <div className={`text-4xl font-bold ${getSentimentColor(avgScore)}`}>
              {avgScore !== null && avgScore !== undefined ? avgScore.toFixed(2) : '--'}
            </div>
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                avgScore > 0
                  ? 'bg-green-100 text-green-800'
                  : avgScore < 0
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {getSentimentLabel(avgScore)}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200"></div>

        {/* News Articles Count */}
        <div>
          <div className="text-sm font-medium text-gray-600 mb-2">News Articles Analyzed</div>
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-gray-900">{newsCount}</div>
            <div className="text-sm text-gray-500">articles</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverallSentiment;
