import React from 'react';
import { BarChart3, AlertTriangle, CheckCircle, Info } from 'lucide-react';

/**
 * HoldingsCoverageCard Component
 *
 * Displays holdings coverage for portfolio sentiment
 * Shows how many holdings in the portfolio have sentiment data available
 *
 * @param {Object} props
 * @param {Object} props.holdingsCoverage - Portfolio holdings coverage object {holdings_with_data, total_holdings, coverage_percentage, holdings_list}
 * @param {number} props.totalHoldings - Total holdings in portfolio (alternative)
 * @param {string} props.className - Additional CSS classes
 */
const HoldingsCoverageCard = ({
  holdingsCoverage,
  totalHoldings,
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6'
}) => {
  const hasData = holdingsCoverage && (
    holdingsCoverage.holdings_with_data !== undefined ||
    holdingsCoverage.coverage_percentage !== undefined
  );

  // Get coverage interpretation details
  const getCoverageDetails = () => {
    if (!hasData) {
      return {
        label: 'No Data',
        color: 'text-gray-400',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-200',
        icon: Info,
        description: 'Insufficient data to calculate holdings coverage'
      };
    }

    const coveragePercent = holdingsCoverage?.coverage_percentage || 0;

    if (coveragePercent >= 80) {
      return {
        label: 'Excellent Coverage',
        color: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        description: 'Sentiment data available for most holdings - comprehensive portfolio view'
      };
    }
    if (coveragePercent >= 50) {
      return {
        label: 'Good Coverage',
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: Info,
        description: 'Sentiment data available for majority of holdings'
      };
    }
    if (coveragePercent >= 30) {
      return {
        label: 'Moderate Coverage',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: Info,
        description: 'Sentiment data available for some holdings - may not represent full portfolio'
      };
    }
    return {
      label: 'Limited Coverage',
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: AlertTriangle,
      description: 'Sentiment data limited to few holdings - limited portfolio representation'
    };
  };

  const details = getCoverageDetails();
  const IconComponent = details.icon;

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Holdings Coverage</h3>
        </div>
        {/* Tooltip explaining holdings coverage */}
        <div className="group relative">
          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute right-0 top-6 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <p className="font-semibold mb-2">Holdings Coverage</p>
            <p className="mb-2">Measures how many holdings in your portfolio have recent news and sentiment data.</p>
            <p className="font-semibold mb-1">Interpretation</p>
            <ul className="space-y-1">
              <li>• <strong>Excellent (&gt;80%):</strong> Most holdings have sentiment data</li>
              <li>• <strong>Good (50-80%):</strong> Majority of holdings covered</li>
              <li>• <strong>Moderate (30-50%):</strong> Partial portfolio coverage</li>
              <li>• <strong>Limited (&lt;30%):</strong> Data for only a few holdings</li>
            </ul>
            <p className="mt-2 font-semibold">Why It Matters</p>
            <p>Higher coverage means the portfolio sentiment metrics are weighted across more holdings, providing a more accurate representation of your overall portfolio sentiment rather than being dominated by a few positions with recent news.</p>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="space-y-2">
          <div className="text-4xl font-bold text-gray-400">--</div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-sm text-gray-600">
              <strong>No Data Available</strong>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Holdings coverage metrics will appear when sentiment data is available
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Section: Stats and Coverage Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coverage Percentage */}
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className={`text-5xl font-semibold ${details.color}`}>
                  {holdingsCoverage?.coverage_percentage?.toFixed(1) || '--'}%
                </div>
                <IconComponent className={`w-10 h-10 ${details.color}`} />
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${details.borderColor} ${details.bgColor} ${details.color}`}>
                {details.label}
              </span>
              <p className="text-sm text-gray-600 mt-2">
                {details.description}
              </p>
            </div>

            {/* Coverage Stats */}
            <div className="grid grid-cols-2 gap-4 lg:col-span-2">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Holdings with Data</div>
                <div className="text-3xl font-bold text-gray-900">
                  {holdingsCoverage?.holdings_with_data || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">positions with sentiment</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Total Holdings</div>
                <div className="text-3xl font-bold text-gray-600">
                  {holdingsCoverage?.total_holdings || totalHoldings || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">total positions</div>
              </div>
            </div>
          </div>

          {/* Coverage Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-gray-600">Coverage Progress</div>
              <div className="text-sm text-gray-500">
                {holdingsCoverage?.holdings_with_data || 0} / {holdingsCoverage?.total_holdings || totalHoldings || 0} holdings
              </div>
            </div>
            <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 flex items-center justify-end pr-3 ${
                  (holdingsCoverage?.coverage_percentage || 0) >= 80 ? 'bg-green-500' :
                  (holdingsCoverage?.coverage_percentage || 0) >= 50 ? 'bg-blue-500' :
                  (holdingsCoverage?.coverage_percentage || 0) >= 30 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${holdingsCoverage?.coverage_percentage || 0}%` }}
              >
                {(holdingsCoverage?.coverage_percentage || 0) > 10 && (
                  <span className="text-xs font-semibold text-white">
                    {holdingsCoverage?.coverage_percentage?.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Holdings with Data List */}
          {holdingsCoverage?.holdings_list && holdingsCoverage.holdings_list.length > 0 && (
            <>
              <div className="border-t border-gray-200"></div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700">
                    Holdings with Sentiment Data
                  </div>
                  <div className="text-xs text-gray-500">
                    {holdingsCoverage.holdings_list.length} holdings
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                  <div className="flex flex-wrap gap-2">
                    {holdingsCoverage.holdings_list.map((holding, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200"
                      >
                        {holding}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Actionable Insights */}
          <div className="border-t border-gray-200 pt-4">
            <div className={`${details.bgColor} border ${details.borderColor} rounded-lg p-4`}>
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0">
                  <span className="text-lg">💡</span>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${details.color} mb-1`}>Insight:</p>
                  <p className="text-sm text-gray-700">
                    {(holdingsCoverage?.coverage_percentage || 0) >= 80 && (
                      <>Excellent coverage. The sentiment metrics represent a comprehensive view of your portfolio, including most positions.</>
                    )}
                    {(holdingsCoverage?.coverage_percentage || 0) >= 50 && (holdingsCoverage?.coverage_percentage || 0) < 80 && (
                      <>Good coverage. Most major positions are represented in the sentiment analysis, providing a reliable portfolio-wide view.</>
                    )}
                    {(holdingsCoverage?.coverage_percentage || 0) >= 30 && (holdingsCoverage?.coverage_percentage || 0) < 50 && (
                      <>Moderate coverage. Sentiment may be influenced by a subset of your holdings. Consider this when interpreting portfolio-wide metrics.</>
                    )}
                    {(holdingsCoverage?.coverage_percentage || 0) < 30 && (
                      <>⚠️ Limited coverage - sentiment reflects only a few holdings and may not represent your full portfolio. Use caution when making portfolio-wide assessments.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HoldingsCoverageCard;
