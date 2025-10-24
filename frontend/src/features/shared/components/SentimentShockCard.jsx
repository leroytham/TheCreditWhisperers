import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import TooltipPortal from './TooltipPortal';

/**
 * SentimentShockCard Component
 *
 * Displays sentiment Z-Score (shock metric) - how unusual the current sentiment is
 * compared to its historical baseline calculated from available news articles
 *
 * @param {Object} props
 * @param {number} props.sentimentZScore - Z-Score value
 * @param {string} props.zScoreInterpretation - Human-readable interpretation
 * @param {number} props.zScoreHistoricalMean - Historical mean sentiment
 * @param {number} props.zScoreHistoricalStd - Historical standard deviation
 * @param {number} props.zScoreDaysOfHistory - Number of days in historical baseline
 * @param {string} props.zScoreQuality - Quality indicator
 * @param {number} props.currentScore - Current slow score (for comparison)
 * @param {string} props.className - Additional CSS classes
 */
const SentimentShockCard = ({
  sentimentZScore,
  zScoreInterpretation,
  zScoreHistoricalMean,
  zScoreHistoricalStd,
  zScoreDaysOfHistory = 0,
  zScoreQuality,
  currentScore,
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6'
}) => {
  // Determine if data is insufficient
  const isInsufficientData = zScoreQuality === 'no_data' || zScoreQuality === 'insufficient_history';
  const isLowConfidence = zScoreQuality === 'low_confidence';

  // Get Z-Score details for display
  const getZScoreDetails = (zScore) => {
    if (zScore === null || zScore === undefined) {
      return { 
        label: 'N/A', 
        color: 'text-gray-400', 
        bgColor: 'bg-gray-100', 
        borderColor: 'border-gray-200',
        icon: Activity
      };
    }
    
    const absZ = Math.abs(zScore);
    
    if (absZ > 2.0) {
      return { 
        label: 'Extreme Shock', 
        color: zScore > 0 ? 'text-red-700' : 'text-red-700', 
        bgColor: 'bg-red-50', 
        borderColor: 'border-red-200',
        icon: AlertTriangle
      };
    }
    if (absZ > 1.5) {
      return { 
        label: 'Strong Signal', 
        color: zScore > 0 ? 'text-orange-700' : 'text-orange-700', 
        bgColor: 'bg-orange-50', 
        borderColor: 'border-orange-200',
        icon: zScore > 0 ? TrendingUp : TrendingDown
      };
    }
    if (absZ > 1.0) {
      return { 
        label: 'Moderate Deviation', 
        color: zScore > 0 ? 'text-yellow-700' : 'text-yellow-700', 
        bgColor: 'bg-yellow-50', 
        borderColor: 'border-yellow-200',
        icon: zScore > 0 ? TrendingUp : TrendingDown
      };
    }
    if (absZ > 0.5) {
      return { 
        label: 'Slight Deviation', 
        color: 'text-blue-700', 
        bgColor: 'bg-blue-50', 
        borderColor: 'border-blue-200',
        icon: Activity
      };
    }
    return { 
      label: 'Normal Range', 
      color: 'text-green-700', 
      bgColor: 'bg-green-50', 
      borderColor: 'border-green-200',
      icon: Activity
    };
  };

  const zScoreDetails = getZScoreDetails(sentimentZScore);
  const IconComponent = zScoreDetails.icon;

  // Format Z-Score with sign
  const formatZScore = (zScore) => {
    if (zScore === null || zScore === undefined) return '--';
    const sign = zScore > 0 ? '+' : '';
    return `${sign}${zScore.toFixed(2)}σ`;
  };

  // Generate contextual explanation
  const generateExplanation = () => {
    if (!sentimentZScore || !zScoreHistoricalMean || currentScore === null || currentScore === undefined) return null;

    const diff = currentScore - zScoreHistoricalMean;
    const diffPercent = ((diff / Math.abs(zScoreHistoricalMean)) * 100).toFixed(0);
    const direction = diff > 0 ? 'higher' : 'lower';

    return `Current sentiment is ${Math.abs(diffPercent)}% ${direction} than ${zScoreDaysOfHistory}-day average`;
  };

  const explanation = generateExplanation();

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Sentiment Shock</h3>
        {/* Tooltip explaining Z-Score */}
        <TooltipPortal>
          <p className="font-semibold mb-2">Sentiment Shock</p>
          <p className="mb-2">This metric measures how statistically unusual the current sentiment is compared to its recent history.</p>
          <p className="mb-2">It answers the question: <em>"Is this sentiment normal, or is it an extreme, newsworthy event?"</em></p>

          <p className="font-semibold mb-1">How it's Calculated:</p>
          <p className="mb-2">It is a Z-Score that measures how many standard deviations the "Current Sentiment" is from its "15-Day Average."</p>
          <p className="font-mono text-[11px] bg-gray-800 p-2 rounded mb-2">
            Z-Score = (Current Sentiment - 15-Day Average) / Historical Volatility (Std. Dev.)
          </p>

          <p className="font-semibold mb-1">Why it's Important:</p>
          <p className="mb-2">A raw sentiment score of +0.15 might be a massive shock for one stable stock but completely normal for another. This metric provides that context.</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Score Near Zero (e.g., -1.0σ to +1.0σ):</strong> This is a "Normal Range." The current sentiment is within its typical, expected boundaries.</li>
            <li><strong>High Positive Score (e.g., &gt; +2.0σ):</strong> This is an "Extreme Positive Shock." The sentiment is significantly more positive than its 15-day norm. This could signal a major positive event or a new trend.</li>
            <li><strong>High Negative Score (e.g., &lt; -2.0σ):</strong> This is an "Extreme Negative Shock," signaling a statistically significant drop in sentiment.</li>
          </ul>
        </TooltipPortal>
      </div>

      {isInsufficientData ? (
        <div className="space-y-2">
          <div className="text-4xl font-bold text-gray-400">--</div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <strong>{zScoreInterpretation || 'No Data'}</strong>
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              {zScoreDaysOfHistory < 3 
                ? `Need at least 3 days of news history (currently ${zScoreDaysOfHistory} days)`
                : 'Insufficient historical data for Z-Score calculation'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Z-Score Value */}
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className={`text-4xl font-semibold ${zScoreDetails.color}`}>
                {formatZScore(sentimentZScore)}
              </div>
              <IconComponent className={`w-10 h-10 ${zScoreDetails.color}`} />
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${zScoreDetails.borderColor} ${zScoreDetails.bgColor} ${zScoreDetails.color}`}>
              {zScoreDetails.label}
            </span>
          </div>

          {/* Interpretation */}
          {zScoreInterpretation && (
            <p className="text-sm font-medium text-gray-700">
              {zScoreInterpretation}
            </p>
          )}

          {/* Explanation */}
          {explanation && (
            <p className="text-xs text-gray-600">
              {explanation}
            </p>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Historical Context */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-600">Historical Context</div>
            
            {/* Current vs Mean */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Current Sentiment</div>
                <div className="text-lg font-bold text-gray-900">
                  {currentScore !== null && currentScore !== undefined ? currentScore.toFixed(3) : '--'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">{zScoreDaysOfHistory}-Day Average</div>
                <div className="text-lg font-bold text-gray-600">
                  {zScoreHistoricalMean !== null && zScoreHistoricalMean !== undefined 
                    ? zScoreHistoricalMean.toFixed(3) 
                    : '--'}
                </div>
              </div>
            </div>

            {/* Visual Comparison */}
            {currentScore !== null && zScoreHistoricalMean !== null && (
              <div className="relative pt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Bearish</span>
                  <span>Neutral</span>
                  <span>Bullish</span>
                </div>
                <div className="w-full h-3 bg-gradient-to-r from-red-200 via-gray-200 to-green-200 rounded-full relative">
                  {/* Historical Mean Marker */}
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-gray-600"
                    style={{ left: `${((zScoreHistoricalMean + 1) / 2) * 100}%` }}
                    title={`Historical Mean: ${zScoreHistoricalMean.toFixed(3)}`}
                  ></div>
                  {/* Current Score Marker */}
                  <div 
                    className="absolute -top-1 w-3 h-5 bg-blue-600 rounded"
                    style={{ left: `${((currentScore + 1) / 2) * 100}%` }}
                    title={`Current: ${currentScore.toFixed(3)}`}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>-1.0</span>
                  <span>0.0</span>
                  <span>+1.0</span>
                </div>
              </div>
            )}

            {/* Standard Deviation */}
            <div className="text-xs text-gray-500">
              Historical Volatility (σ): {zScoreHistoricalStd !== null && zScoreHistoricalStd !== undefined 
                ? zScoreHistoricalStd.toFixed(3) 
                : '--'}
            </div>

            <div className="text-xs text-gray-500">
              Based on {zScoreDaysOfHistory} days of historical data
            </div>
          </div>

          {/* Severity Indicator for Extreme Cases */}
          {sentimentZScore !== null && Math.abs(sentimentZScore) > 2.0 && (
            <>
              <div className="border-t border-gray-200"></div>
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Statistical Anomaly Detected</p>
                    <p className="text-xs text-red-700 mt-1">
                      This sentiment level is {Math.abs(sentimentZScore).toFixed(1)} standard deviations from normal. 
                      Such extreme deviations are rare and may indicate a significant market event or news catalyst.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Quality warning */}
          {isLowConfidence && (
            <div className="text-xs text-yellow-600 mt-1">
              ⚠ Low confidence - limited historical data (less than 5 days)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SentimentShockCard;
