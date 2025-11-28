import React from 'react';
import { getSentimentColor } from '../utils/formatters';
import { getSentimentDetails, getMomentumDetails, getMomentumArrow, formatMomentumValue, getMomentumColor } from '../utils/sentimentHelpers';

/**
 * Shared OverallSentiment Component
 *
 * Displays overall sentiment metrics with momentum analysis (MACD-style Fast vs. Slow)
 * Used by both Entity and Sector features
 *
 * @param {Object} props
 * @param {Object|number} props.sentiment - Sentiment object with avg_score property or direct number value
 * @param {number} props.sentimentAvg - Alternative: direct sentiment average value
 * @param {number} props.newsCount - Number of news articles analyzed
 * @param {string} props.dataQuality - Data quality indicator ("good", "low_confidence", "insufficient_recent_data", "no_data")
 * @param {number} props.halfLifeHours - Half-life of news recency decay in hours
 * @param {number} props.sentimentMomentum - Momentum value (fast_score - slow_score)
 * @param {string} props.momentumLabel - Momentum classification label
 * @param {string} props.momentumInterpretation - Human-readable momentum interpretation
 * @param {string} props.momentumQuality - Momentum data quality
 * @param {number} props.fastScore - Fast score (short half-life)
 * @param {number} props.slowScore - Slow score (long half-life)
 * @param {number} props.halfLifeFastHours - Fast score half-life in hours
 * @param {number} props.halfLifeSlowHours - Slow score half-life in hours
 * @param {number} props.sentimentVolatility - Weighted standard deviation of sentiment scores
 * @param {string} props.volatilityQuality - Volatility data quality indicator
 * @param {number} props.effectiveNewsVolume - Sum of all weighted news (quantity/coverage metric)
 * @param {string} props.volumeInterpretation - Coverage level interpretation
 * @param {string} props.className - Additional CSS classes for wrapper
 */
const OverallSentiment = ({
  sentiment,
  sentimentAvg,
  newsCount = 0,
  dataQuality = 'good',
  halfLifeHours = 24,
  sentimentMomentum,
  momentumLabel,
  momentumInterpretation,
  momentumQuality,
  fastScore,
  slowScore,
  halfLifeFastHours = 7,
  halfLifeSlowHours = 24,
  sentimentVolatility,
  volatilityQuality,
  effectiveNewsVolume,
  volumeInterpretation,
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

  // Get momentum details
  const momentumDetails = getMomentumDetails(sentimentMomentum);
  const momentumArrow = getMomentumArrow(sentimentMomentum);

  // Determine if data is insufficient
  const isInsufficientData = dataQuality === 'insufficient_recent_data' || dataQuality === 'no_data';
  const isLowConfidence = dataQuality === 'low_confidence';
  const isMomentumInsufficient = momentumQuality === 'insufficient_recent_data' || momentumQuality === null;
  const isVolatilityInsufficient = volatilityQuality === 'insufficient_recent_data' || volatilityQuality === null;

  // Get volatility level and color
  const getVolatilityDetails = (vol) => {
    if (vol === null || vol === undefined) return { label: 'N/A', color: 'text-gray-400', bgColor: 'bg-gray-100', borderColor: 'border-gray-200' };
    if (vol < 0.1) return { label: 'Low Uncertainty', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
    if (vol < 0.3) return { label: 'Medium Uncertainty', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' };
    return { label: 'High Uncertainty', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
  };

  const volatilityDetails = getVolatilityDetails(sentimentVolatility);

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Overall Sentiment</h3>
        {/* Tooltip explaining the weighting algorithm */}
        <div className="group relative">
          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute right-0 top-6 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <p className="font-semibold mb-2">Weighted Sentiment & Momentum</p>
            <p className="mb-2">Scores are weighted by both recency (exponential decay) and relevance. Recent, highly relevant news has more impact.</p>
            <p className="font-semibold mb-1">Momentum (MACD-Style)</p>
            <p>Momentum = Fast Score - Slow Score. Positive momentum means news is improving, negative means deteriorating.</p>
          </div>
        </div>
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
                {/* Inline momentum arrow for at-a-glance indication */}
                {momentumArrow.symbol && (
                  <span className={`text-2xl ${momentumArrow.color}`} title={momentumDetails.interpretation}>
                    {momentumArrow.symbol}
                  </span>
                )}
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

        {/* Sentiment Momentum */}
        {!isInsufficientData && (
          <div>
            <div className="text-sm font-medium text-gray-600 mb-2">Sentiment Momentum</div>
            {isMomentumInsufficient ? (
              <div className="text-sm text-gray-500 italic">Insufficient data for momentum calculation</div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className={`text-2xl font-semibold ${getMomentumColor(sentimentMomentum)}`}>
                    {formatMomentumValue(sentimentMomentum)}
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${momentumDetails.colorClasses}`}>
                    {momentumDetails.label}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {momentumDetails.interpretation || momentumInterpretation}
                </p>
                <div className="text-xs text-gray-500 mt-2">
                  <span>Fast ({halfLifeFastHours}h): {fastScore !== null && fastScore !== undefined ? fastScore.toFixed(3) : '--'}</span>
                  <span className="mx-2">|</span>
                  <span>Slow ({halfLifeSlowHours}h): {slowScore !== null && slowScore !== undefined ? slowScore.toFixed(3) : '--'}</span>
                </div>
                {momentumQuality === 'low_confidence' && (
                  <div className="text-xs text-yellow-600 mt-1">
                    ⚠ Low confidence momentum
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        {!isInsufficientData && <div className="border-t border-gray-200"></div>}

        {/* News Articles Count */}
        <div>
          <div className="text-sm font-medium text-gray-600 mb-2">News Articles Analyzed</div>
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-gray-900">{newsCount}</div>
            <div className="text-sm text-gray-500">articles</div>
          </div>
        </div>

        {/* Effective News Volume (Quantity/Coverage) */}
        {!isInsufficientData && effectiveNewsVolume !== null && effectiveNewsVolume !== undefined && (
          <>
            {/* Divider */}
            <div className="border-t border-gray-200"></div>
            
            <div>
              <div className="text-sm font-medium text-gray-600 mb-2">Effective News Coverage</div>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl font-semibold text-gray-900">
                    {effectiveNewsVolume.toFixed(2)}
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                    volumeInterpretation === 'High Coverage' 
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : volumeInterpretation === 'Medium Coverage'
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                  }`}>
                    {volumeInterpretation || 'Unknown'}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {volumeInterpretation === 'High Coverage' && 'Strong coverage with recent, relevant news. Sentiment metrics are highly reliable.'}
                  {volumeInterpretation === 'Medium Coverage' && 'Moderate coverage. Sentiment metrics are reasonably reliable.'}
                  {volumeInterpretation === 'Low Coverage' && 'Limited coverage. Sentiment metrics may be less reliable due to sparse news.'}
                </p>
                {effectiveNewsVolume < 1.0 && (
                  <div className="text-xs text-yellow-600 mt-1">
                    ⚠ Low effective volume - interpret all metrics with caution
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Sentiment Volatility (Confidence/Uncertainty Indicator) */}
        {!isInsufficientData && sentimentVolatility !== null && sentimentVolatility !== undefined && (
          <>
            {/* Divider */}
            <div className="border-t border-gray-200"></div>
            
            <div>
              <div className="text-sm font-medium text-gray-600 mb-2">Sentiment Confidence</div>
              {isVolatilityInsufficient ? (
                <div className="text-sm text-gray-500 italic">Insufficient data for volatility calculation</div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl font-semibold text-gray-900">
                      {sentimentVolatility.toFixed(3)}
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${volatilityDetails.borderColor} ${volatilityDetails.bgColor} ${volatilityDetails.color}`}>
                      {volatilityDetails.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {volatilityDetails.label === 'Low Uncertainty' && 'News sentiment is consistent and reliable.'}
                    {volatilityDetails.label === 'Medium Uncertainty' && 'News sentiment shows moderate variation.'}
                    {volatilityDetails.label === 'High Uncertainty' && 'News sentiment is highly variable - interpret with caution.'}
                  </p>
                  {volatilityQuality === 'low_confidence' && (
                    <div className="text-xs text-yellow-600 mt-1">
                      ⚠ Low confidence volatility
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OverallSentiment;
