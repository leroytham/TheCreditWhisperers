import React from 'react';

/**
 * News Coverage Card for Sentiment Page
 *
 * Displays effective news coverage metric (weighted quantity/coverage metric)
 *
 * @param {Object} props
 * @param {number} props.effectiveNewsVolume - Sum of all weighted news (quantity/coverage metric)
 * @param {string} props.volumeInterpretation - Coverage level interpretation
 * @param {string} props.dataQuality - Data quality indicator
 * @param {string} props.className - Additional CSS classes for wrapper
 */
const NewsCoverageCard = ({
  effectiveNewsVolume,
  volumeInterpretation,
  dataQuality = 'good',
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6'
}) => {
  // Determine if data is insufficient
  const isInsufficientData = dataQuality === 'insufficient_recent_data' || dataQuality === 'no_data';

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">News Coverage</h3>
        {/* Tooltip explaining the coverage metric */}
        <div className="group relative">
          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute right-0 top-6 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <p className="font-semibold mb-2">Effective News Coverage</p>
            <p>Sum of weighted news articles. Recent and highly relevant news contributes more to this metric. Higher values indicate stronger news coverage.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {isInsufficientData || effectiveNewsVolume === null || effectiveNewsVolume === undefined ? (
          <div className="space-y-2">
            <div className="text-4xl font-bold text-gray-400">--</div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                <strong>Insufficient Data</strong>
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                No recent news with sufficient relevance to calculate coverage.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-3">
              <div className="text-4xl font-semibold text-gray-900">
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
            <p className="text-sm text-gray-600">
              {volumeInterpretation === 'High Coverage' && 'Strong coverage with recent, relevant news. Sentiment metrics are highly reliable.'}
              {volumeInterpretation === 'Medium Coverage' && 'Moderate coverage. Sentiment metrics are reasonably reliable.'}
              {volumeInterpretation === 'Low Coverage' && 'Limited coverage. Sentiment metrics may be less reliable due to sparse news.'}
            </p>
            {effectiveNewsVolume < 1.0 && (
              <div className="text-xs text-yellow-600 mt-1">
                ⚠ Low effective volume - interpret all metrics with caution
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NewsCoverageCard;
