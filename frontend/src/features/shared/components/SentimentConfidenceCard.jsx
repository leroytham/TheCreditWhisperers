import React from 'react';
import TooltipPortal from './TooltipPortal';

/**
 * Sentiment Confidence Card for Sentiment Page
 *
 * Displays sentiment confidence/volatility metrics and data quality indicators
 *
 * @param {Object} props
 * @param {number} props.sentimentVolatility - Weighted standard deviation of sentiment scores
 * @param {string} props.volatilityQuality - Volatility data quality indicator
 * @param {string} props.dataQuality - Overall data quality indicator
 * @param {string} props.className - Additional CSS classes for wrapper
 */
const SentimentConfidenceCard = ({
  sentimentVolatility,
  volatilityQuality,
  dataQuality = 'good',
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6'
}) => {
  // Determine if data is insufficient
  const isInsufficientData = dataQuality === 'insufficient_recent_data' || dataQuality === 'no_data';
  const isVolatilityInsufficient = volatilityQuality === 'insufficient_recent_data' || volatilityQuality === null;

  // Get volatility level and color
  const getVolatilityDetails = (vol) => {
    if (vol === null || vol === undefined) return {
      label: 'N/A',
      color: 'text-gray-400',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-200'
    };
    if (vol < 0.1) return {
      label: 'Low Uncertainty',
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    };
    if (vol < 0.3) return {
      label: 'Medium Uncertainty',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    };
    return {
      label: 'High Uncertainty',
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    };
  };

  const volatilityDetails = getVolatilityDetails(sentimentVolatility);

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Sentiment Volatility</h3>
        {/* Tooltip explaining volatility/disagreement */}
        <TooltipPortal>
          <p className="font-semibold mb-2">Sentiment Volatility</p>
          <p className="mb-2">This metric measures the volatility (or disagreement) among news articles.</p>
          <p className="mb-2">It answers: <em>"Do all the articles agree?"</em></p>
          <p className="mb-2">It is calculated using the weighted standard deviation of all article sentiment scores.</p>
          <p className="mb-2">This measures the "uncertainty" or "noise" level in the news.</p>
          <p className="font-semibold mb-1">How to Read the Score:</p>
          <ul className="list-disc pl-4 mb-1 space-y-1">
            <li><strong>Low Score (Low Volatility):</strong> A low value (e.g., &lt; 0.15) indicates strong consensus. Most articles share a similar sentiment, making the "Overall Sentiment" score very reliable.</li>
            <li><strong>High Score (High Volatility):</strong> A high value (e.g., &gt; 0.30) indicates conflicting news. There is a wide mix of very positive and very negative articles, which means the "Overall Sentiment" is an average of a highly polarized debate.</li>
          </ul>
        </TooltipPortal>
      </div>

      <div className="space-y-4">
        {isInsufficientData ? (
          <div className="space-y-2">
            <div className="text-4xl font-bold text-gray-400">--</div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                <strong>Insufficient Data</strong>
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                No recent news with sufficient relevance to calculate volatility metrics.
              </p>
            </div>
          </div>
        ) : isVolatilityInsufficient ? (
          <div className="space-y-2">
            <div className="text-4xl font-bold text-gray-400">--</div>
            <div className="text-sm text-gray-500 italic">
              Insufficient data for volatility calculation
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="text-4xl font-semibold text-gray-900">
                {sentimentVolatility !== null && sentimentVolatility !== undefined
                  ? sentimentVolatility.toFixed(3)
                  : '--'}
              </div>
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${volatilityDetails.borderColor} ${volatilityDetails.bgColor} ${volatilityDetails.color}`}>
                  {volatilityDetails.label}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {volatilityDetails.label === 'Low Uncertainty' && 'News sentiment is consistent and reliable.'}
              {volatilityDetails.label === 'Medium Uncertainty' && 'News sentiment shows moderate variation.'}
              {volatilityDetails.label === 'High Uncertainty' && 'News sentiment is highly variable - interpret with caution.'}
            </p>
            {volatilityQuality === 'low_confidence' && (
              <div className="text-xs text-yellow-600 mt-1 flex items-start space-x-1">
                <span>⚠</span>
                <span>Low confidence volatility - limited data available</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SentimentConfidenceCard;
