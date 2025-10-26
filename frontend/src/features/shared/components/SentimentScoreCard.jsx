import React from 'react';
import { getSentimentColor } from '../utils/formatters';
import { getSentimentDetails } from '../utils/sentimentHelpers';
import TooltipPortal from './TooltipPortal';

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
 * @param {string} props.context - Context: 'entity' (default) or 'sector'
 */
const SentimentScoreCard = ({
  sentiment,
  sentimentAvg,
  newsCount = 0,
  dataQuality = 'good',
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6',
  context = 'entity'
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
        {/* Tooltip explaining Overall Sentiment */}
        <TooltipPortal>
          <p className="font-semibold mb-2">Overall Sentiment</p>
          {context === 'entity' ? (
            <>
              <p className="mb-2">This is the average sentiment score, weighted by recency and relevance.</p>
              <p className="mb-2">It is not a simple average. Each article's sentiment score is weighted by:</p>
              <ul className="list-disc pl-4 mb-2 space-y-1">
                <li><strong>Relevance:</strong> How much the article is about the ticker (an article with 0.9 relevance has more impact than one with 0.1).</li>
                <li><strong>Recency:</strong> How new the article is. This uses an exponential decay model with a 24-hour half-life. This means an article from yesterday has 50% of the weight of a brand-new article.</li>
              </ul>
              <p className="mb-2">The final score ranges from <strong>-1.0 (Bearish)</strong> to <strong>+1.0 (Bullish)</strong>.</p>
              <p className="text-gray-300 text-[11px]">The "News Articles Analyzed" is the total number of articles processed before filtering and weighting. For the weighted impact of this news, see the "News Coverage" metric.</p>
            </>
          ) : (
            <>
              <p className="mb-2">This is the sector-wide average sentiment score, aggregated from news across all companies in the sector.</p>
              <p className="mb-2"><strong>Data Preprocessing:</strong></p>
              <ul className="list-disc pl-4 mb-2 space-y-1">
                <li><strong>De-duplication:</strong> First, duplicate articles are identified and removed. If the same press release appears across 100 outlets, we analyze it only once to prevent artificially inflating its impact.</li>
              </ul>
              <p className="mb-2"><strong>After de-duplication,</strong> each unique article's sentiment is weighted by:</p>
              <ul className="list-disc pl-4 mb-2 space-y-1">
                <li><strong>Ticker Weight:</strong> The company's proportional market cap weight in the sector (e.g., if AAPL is 20% of the tech sector, its news has 20% weight).</li>
                <li><strong>Article Relevance:</strong> How much the article focuses on the ticker (deeply analytical articles get more weight than brief mentions).</li>
                <li><strong>Recency:</strong> Newer articles get more weight using exponential decay (24-hour half-life).</li>
              </ul>
              <p className="mb-2">The final score ranges from <strong>-1.0 (Bearish)</strong> to <strong>+1.0 (Bullish)</strong>.</p>
              <p className="text-gray-300 text-[11px]">This represents the market-cap-weighted sentiment toward the sector, giving larger companies proportionally more influence.</p>
            </>
          )}
        </TooltipPortal>
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
            <div className="space-y-3">
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
              {isLowConfidence && (
                <div className="text-xs text-yellow-600">
                  ⚠ Low confidence - limited recent data
                </div>
              )}
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
