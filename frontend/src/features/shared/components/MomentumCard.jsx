import React from 'react';
import { getMomentumDetails, getMomentumArrow, formatMomentumValue, getMomentumColor } from '../utils/sentimentHelpers';

/**
 * MomentumCard Component
 *
 * Displays sentiment momentum using backend-calculated MACD-style metrics
 * (Fast 7h vs Slow 24h exponential moving averages)
 *
 * @param {Object} props
 * @param {number} props.sentimentMomentum - Momentum value (fast_score - slow_score)
 * @param {string} props.momentumLabel - Classification label (e.g., "Positive Momentum")
 * @param {string} props.momentumInterpretation - Human-readable interpretation
 * @param {string} props.momentumQuality - Data quality indicator
 * @param {number} props.fastScore - Fast score (short half-life, 7h)
 * @param {number} props.slowScore - Slow score (long half-life, 24h)
 * @param {number} props.halfLifeFastHours - Fast score half-life in hours
 * @param {number} props.halfLifeSlowHours - Slow score half-life in hours
 * @param {string} props.className - Additional CSS classes
 */
const MomentumCard = ({
  sentimentMomentum,
  momentumLabel,
  momentumInterpretation,
  momentumQuality,
  fastScore,
  slowScore,
  halfLifeFastHours = 7,
  halfLifeSlowHours = 24,
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6'
}) => {
  // Get momentum details
  const momentumDetails = getMomentumDetails(sentimentMomentum);
  const momentumArrow = getMomentumArrow(sentimentMomentum);

  // Determine if data is insufficient
  const isMomentumInsufficient = momentumQuality === 'insufficient_recent_data' || momentumQuality === null || sentimentMomentum === null;
  const isLowConfidence = momentumQuality === 'low_confidence';

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Sentiment Momentum</h3>
        {/* Tooltip explaining momentum */}
        <div className="group relative">
          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute right-0 top-6 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <p className="font-semibold mb-2">MACD-Style Momentum</p>
            <p className="mb-2">Momentum = Fast Score - Slow Score. Positive momentum means news is improving, negative means deteriorating.</p>
            <p className="font-semibold mb-1">Fast vs Slow Scores</p>
            <p>Fast ({halfLifeFastHours}h): Current intraday sentiment</p>
            <p>Slow ({halfLifeSlowHours}h): Daily trend baseline</p>
          </div>
        </div>
      </div>

      {isMomentumInsufficient ? (
        <div className="space-y-2">
          <div className="text-4xl font-bold text-gray-400">--</div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <strong>No Data</strong>
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Insufficient data for momentum calculation
            </p>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            <span>Fast ({halfLifeFastHours}h): --</span>
            <span className="mx-2">|</span>
            <span>Slow ({halfLifeSlowHours}h): --</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Momentum Value and Label */}
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className={`text-4xl font-semibold ${getMomentumColor(sentimentMomentum)}`}>
                {formatMomentumValue(sentimentMomentum)}
              </div>
              {momentumArrow.symbol && (
                <span className={`text-3xl ${momentumArrow.color}`} title={momentumDetails.interpretation}>
                  {momentumArrow.symbol}
                </span>
              )}
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${momentumDetails.colorClasses}`}>
              {momentumDetails.label || momentumLabel}
            </span>
          </div>

          {/* Interpretation */}
          <p className="text-sm text-gray-600">
            {momentumDetails.interpretation || momentumInterpretation}
          </p>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Fast and Slow Scores */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600 mb-2">Score Breakdown</div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs text-gray-500 mb-1">Fast ({halfLifeFastHours}h)</div>
                <div className={`text-xl font-bold ${fastScore !== null && fastScore !== undefined ? (fastScore >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>
                  {fastScore !== null && fastScore !== undefined ? fastScore.toFixed(3) : '--'}
                </div>
              </div>
              <div className="px-4 text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex-1 text-right">
                <div className="text-xs text-gray-500 mb-1">Slow ({halfLifeSlowHours}h)</div>
                <div className={`text-xl font-bold ${slowScore !== null && slowScore !== undefined ? (slowScore >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>
                  {slowScore !== null && slowScore !== undefined ? slowScore.toFixed(3) : '--'}
                </div>
              </div>
            </div>
          </div>

          {/* Low Confidence Warning */}
          {isLowConfidence && (
            <div className="text-xs text-yellow-600 mt-2">
              ⚠ Low confidence momentum
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MomentumCard;
