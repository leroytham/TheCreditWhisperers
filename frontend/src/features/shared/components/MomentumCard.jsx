import React from 'react';
import { getMomentumDetails, getMomentumArrow, formatMomentumValue, getMomentumColor } from '../utils/sentimentHelpers';
import TooltipPortal from './TooltipPortal';

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
 * @param {string} props.context - Context: 'entity' (default) or 'sector'
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
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6',
  context = 'entity'
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
        <TooltipPortal>
          <p className="font-semibold mb-2">Sentiment Momentum</p>
          {context === 'entity' ? (
            <>
              <p className="mb-2">This metric measures the direction and speed of sentiment change.</p>
              <p className="mb-2">It answers: <em>"Is the news sentiment getting better or worse?"</em></p>
              <p className="mb-2">It is calculated by subtracting the "Slow" trend from the "Fast" trend:</p>
              <ul className="list-disc pl-4 mb-2 space-y-1">
                <li><strong>Fast ({halfLifeFastHours}h):</strong> A weighted average with a {halfLifeFastHours}-hour half-life. This reflects the most current, short-term mood.</li>
                <li><strong>Slow ({halfLifeSlowHours}h):</strong> A weighted average with a {halfLifeSlowHours}-hour half-life. This represents the established baseline trend.</li>
              </ul>
              <p className="font-semibold mb-1">How to Read the Score:</p>
              <ul className="list-disc pl-4 mb-1 space-y-1">
                <li><strong>Positive:</strong> The "Fast" score is higher than the "Slow" score. This signals that recent news is more positive than the trend, and sentiment is improving.</li>
                <li><strong>Negative:</strong> The "Fast" score is lower than the "Slow" score. This signals that recent news is more negative, and sentiment is worsening.</li>
                <li><strong>Near Zero:</strong> The sentiment is stable.</li>
              </ul>
            </>
          ) : (
            <>
              <p className="mb-2">This metric measures whether sector-wide sentiment is improving or declining.</p>
              <p className="mb-2">It answers: <em>"Is the overall sector sentiment trending up or down?"</em></p>
              <p className="mb-2">It is calculated by comparing short-term vs. long-term sector sentiment trends:</p>
              <ul className="list-disc pl-4 mb-2 space-y-1">
                <li><strong>Fast ({halfLifeFastHours}h):</strong> Recent sector sentiment aggregated from all companies (short-term trend).</li>
                <li><strong>Slow ({halfLifeSlowHours}h):</strong> Established sector baseline over a longer time period.</li>
              </ul>
              <p className="font-semibold mb-1">How to Read the Score:</p>
              <ul className="list-disc pl-4 mb-1 space-y-1">
                <li><strong>Positive:</strong> Recent sector news is more positive than the baseline. The sector sentiment is improving.</li>
                <li><strong>Negative:</strong> Recent sector news is more negative. The sector sentiment is deteriorating.</li>
                <li><strong>Near Zero:</strong> The sector sentiment is stable with no significant trend change.</li>
              </ul>
            </>
          )}
        </TooltipPortal>
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
          <div className="space-y-3">
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
            <div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${momentumDetails.colorClasses}`}>
                {momentumDetails.label || momentumLabel}
              </span>
            </div>
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
