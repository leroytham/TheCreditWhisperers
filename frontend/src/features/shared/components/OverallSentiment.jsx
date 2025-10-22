import React from 'react';
import { getSentimentColor } from '../utils/formatters';
import { getSentimentDetails } from '../utils/sentimentHelpers';

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

  // Get sentiment details using the standardized classification
  const sentimentDetails = avgScore !== null && avgScore !== undefined
    ? getSentimentDetails(avgScore)
    : { label: 'N/A' };

  // Version marker to force cache invalidation - if you see v1, clear browser cache!
  const LABEL_VERSION = 'v2-bullish-bearish-finbert-fix';

  // DEBUG: Enhanced logging to verify new labels are being used
  console.log('🔍 Overall Sentiment Debug - Full Details:', {
    version: LABEL_VERSION,
    sentimentProp: sentiment,
    sentimentAvgProp: sentimentAvg,
    extractedAvgScore: avgScore,
    getSentimentDetailsFunction: typeof getSentimentDetails,
    calculatedSentimentDetails: sentimentDetails,
    displayLabel: sentimentDetails.label,
    expectedLabels: 'Bullish/Somewhat-Bullish/Neutral/Somewhat-Bearish/Bearish',
    thresholds: 'Bullish: >=0.35, Somewhat-Bullish: >=0.15, Neutral: -0.15 to 0.15, Somewhat-Bearish: >-0.35, Bearish: <=-0.35'
  });

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
                {sentimentDetails.label}
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
