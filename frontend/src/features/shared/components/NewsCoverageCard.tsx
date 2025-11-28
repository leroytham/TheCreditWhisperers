import React from 'react';
import TooltipPortal from './TooltipPortal';

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
 * @param {string} props.context - Context: 'entity' (default) or 'sector'
 */
const NewsCoverageCard = ({
  effectiveNewsVolume,
  volumeInterpretation,
  dataQuality = 'good',
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6',
  context = 'entity',
  loading,
  error
}: {
  effectiveNewsVolume: any;
  volumeInterpretation: any;
  dataQuality?: string;
  className?: string;
  context?: string;
  loading?: boolean;
  error?: any;
}) => {
  // Determine if data is insufficient
  const isInsufficientData = dataQuality === 'insufficient_recent_data' || dataQuality === 'no_data';

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">News Coverage</h3>
        {/* Tooltip explaining the coverage metric */}
        <TooltipPortal>
          <p className="font-semibold mb-2">News Coverage</p>
          {context === 'entity' ? (
            <>
              <p className="mb-2">This metric measures the weighted impact of all news, not just the article count.</p>
              <p className="mb-2">This score, also called <em>"Effective News Volume,"</em> is the denominator used to calculate the "Overall Sentiment."</p>
              <p className="mb-2">It is the sum of all CombinedWeight values from every article, where:</p>
              <p className="font-mono text-[11px] bg-gray-800 p-2 rounded mb-2">CombinedWeight = Relevance Score × Recency Weight</p>
              <p className="font-semibold mb-1">How to Read the Score:</p>
              <p className="mb-1">This value tells you how reliable the "Overall Sentiment" score is.</p>
              <ul className="list-disc pl-4 mb-1 space-y-1">
                <li><strong>High Coverage (e.g., &gt; 10):</strong> The sentiment score is highly reliable and based on a large volume of recent, relevant news.</li>
                <li><strong>Medium Coverage (e.g., 2-10):</strong> The score is reasonably reliable.</li>
                <li><strong>Low Coverage (e.g., &lt; 2):</strong> The score is based on very few, old, or irrelevant articles and should be treated with caution.</li>
              </ul>
            </>
          ) : (
            <>
              <p className="mb-2">This metric measures the weighted impact of sector-wide news coverage across all companies.</p>
              <p className="mb-2">It represents the total "Effective News Volume" aggregated from all tickers in the sector.</p>
              <p className="mb-2"><strong>How it's calculated:</strong></p>
              <p className="mb-3">First, duplicate articles are removed (if the same press release appears on 100 sites, we count it once). Then, each unique article contributes based on:</p>
              <p className="font-mono text-[11px] bg-gray-800 p-2 rounded mb-2">Weight = Ticker Weight × Article Relevance × Recency</p>
              <p className="text-gray-300 text-[11px] mb-2">Where "Ticker Weight" is the company's market cap proportion in the sector, "Article Relevance" is how much the article focuses on that company, and "Recency" gives more weight to newer news.</p>
              <p className="font-semibold mb-1">How to Read the Score:</p>
              <p className="mb-1">This indicates the breadth and recency of sector news coverage.</p>
              <ul className="list-disc pl-4 mb-1 space-y-1">
                <li><strong>High Coverage:</strong> The sector is receiving significant news attention across many companies. Sentiment is highly reliable.</li>
                <li><strong>Medium Coverage:</strong> Moderate sector news flow. Sentiment is reasonably reliable.</li>
                <li><strong>Low Coverage:</strong> Limited sector news. Sentiment may reflect only a few companies or older news.</li>
              </ul>
            </>
          )}
        </TooltipPortal>
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
            <div className="space-y-3">
              <div className="text-4xl font-semibold text-gray-900">
                {effectiveNewsVolume.toFixed(2)}
              </div>
              <div>
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
