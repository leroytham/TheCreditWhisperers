import React from 'react';
import { getSentimentColor } from '../utils/formatters';
import { getSentimentDetails } from '../utils/sentimentHelpers';

/**
 * Simplified Sentiment Score Card for Overview Page
 *
 * Displays only the core sentiment metrics:
 * - Average Sentiment Score
 * - Sentiment Label (Bullish/Bearish/Neutral)
 * - News Articles Count
 *
 * @param {Object} props
 * @param {Object|number} props.sentiment - Sentiment object with avg_score property or direct number value
 * @param {number} props.sentimentAvg - Alternative: direct sentiment average value
 * @param {number} props.newsCount - Number of news articles analyzed
 * @param {string} props.dataQuality - Data quality indicator ("good", "low_confidence", "insufficient_recent_data", "no_data")
 * @param {string} props.className - Additional CSS classes for wrapper
 */
const SentimentScoreCard = ({
  sentiment,
  sentimentAvg,
  newsCount = 0,
  dataQuality = 'good',
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6'
}) => {
  // Support both sentiment.avg_score (entity) and sentimentAvg (sector) patterns
  const avgScore = typeof sentiment === 'number'
    ? sentiment
    : sentiment?.avg_score ?? sentimentAvg ?? null;

  // Get sentiment details using the standardized classification
  const sentimentDetails = avgScore !== null && avgScore !== undefined
    ? getSentimentDetails(avgScore)
    : { label: 'N/A' };

  // Determine if data is insufficient
  const isInsufficientData = dataQuality === 'insufficient_recent_data' || dataQuality === 'no_data';
  const isLowConfidence = dataQuality === 'low_confidence';

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Overall Sentiment</h3>
      </div>

      <div className="space-y-6">
        {/* Average Sentiment Score */}
        <div>
          <div className="text-sm font-medium text-gray-600 mb-2">Average Sentiment Score</div>
          {isInsufficientData ? (
            <div className="space-y-2">
              <div className="text-4xl font-bold text-gray-400">--</div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Insufficient Recent Data</strong>
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  No recent news with sufficient relevance to calculate a reliable sentiment score.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="flex items-baseline space-x-2">
                <div className={`text-4xl font-bold ${getSentimentColor(avgScore)}`}>
                  {avgScore !== null && avgScore !== undefined ? avgScore.toFixed(2) : '--'}
                </div>
              </div>
              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  avgScore > 0
                    ? 'bg-green-100 text-green-800'
                    : avgScore < 0
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {sentimentDetails.label}
                </span>
                {isLowConfidence && (
                  <div className="mt-2 text-xs text-yellow-600">
                    ⚠ Low confidence - limited recent data
                  </div>
                )}
              </div>
            </div>
          )}
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

export default SentimentScoreCard;
