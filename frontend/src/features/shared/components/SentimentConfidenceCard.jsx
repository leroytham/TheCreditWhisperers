import React from 'react';

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
        <h3 className="text-lg font-semibold text-gray-900">Sentiment Confidence</h3>
        {/* Tooltip explaining volatility/confidence */}
        <div className="group relative">
          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute right-0 top-6 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <p className="font-semibold mb-2">Sentiment Confidence</p>
            <p>Measures the consistency of news sentiment. Lower volatility (uncertainty) means more consistent and reliable sentiment signals.</p>
          </div>
        </div>
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
                No recent news with sufficient relevance to calculate confidence metrics.
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
            <div className="flex items-center space-x-3">
              <div className="text-4xl font-semibold text-gray-900">
                {sentimentVolatility !== null && sentimentVolatility !== undefined
                  ? sentimentVolatility.toFixed(3)
                  : '--'}
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${volatilityDetails.borderColor} ${volatilityDetails.bgColor} ${volatilityDetails.color}`}>
                {volatilityDetails.label}
              </span>
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
