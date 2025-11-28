import React from 'react';
import { BarChart3, AlertTriangle, CheckCircle, Info } from 'lucide-react';

/**
 * TickerCoverageCard Component
 *
 * Displays ticker coverage for sector sentiment
 * Shows how many companies in the sector are mentioned in recent news
 *
 * @param {Object} props
 * @param {Object} props.tickerCoverage - Sector ticker coverage object {tickers_mentioned, total_tickers_in_sector, coverage_percentage, mentioned_ticker_list}
 * @param {number} props.totalTickers - Total tickers in sector (alternative to tickerCoverage.total_tickers_in_sector)
 * @param {string} props.className - Additional CSS classes
 */
interface TickerCoverage {
  tickers_mentioned?: number;
  total_tickers_in_sector?: number;
  coverage_percentage?: number;
  mentioned_ticker_list?: string[];
}

interface TickerCoverageCardProps {
  tickerCoverage?: TickerCoverage | null;
  totalTickers?: number;
  className?: string;
}

const TickerCoverageCard: React.FC<TickerCoverageCardProps> = ({
  tickerCoverage,
  totalTickers,
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6'
}) => {
  const hasData = tickerCoverage && (
    tickerCoverage.tickers_mentioned !== undefined || 
    tickerCoverage.coverage_percentage !== undefined
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
        description: 'Insufficient data to calculate ticker coverage'
      };
    }

    const coveragePercent = tickerCoverage?.coverage_percentage || 0;
    
    if (coveragePercent >= 70) {
      return {
        label: 'Excellent Coverage',
        color: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        description: 'News covers majority of sector companies - comprehensive sector view'
      };
    }
    if (coveragePercent >= 40) {
      return {
        label: 'Good Coverage',
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: Info,
        description: 'News covers a substantial portion of the sector'
      };
    }
    if (coveragePercent >= 20) {
      return {
        label: 'Moderate Coverage',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: Info,
        description: 'News covers some sector companies - sentiment may not represent full sector'
      };
    }
    return {
      label: 'Limited Coverage',
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: AlertTriangle,
      description: 'News concentrated in few companies - limited sector representation'
    };
  };

  const details = getCoverageDetails();
  const IconComponent = details.icon;

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Ticker Coverage</h3>
        </div>
        {/* Tooltip explaining ticker coverage */}
        <div className="group relative">
          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute right-0 top-6 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <p className="font-semibold mb-2">Ticker Coverage</p>
            <p className="mb-2">Measures how many companies in the sector are mentioned in recent news.</p>
            <p className="font-semibold mb-1">Interpretation</p>
            <ul className="space-y-1">
              <li>• <strong>Excellent (&gt;70%):</strong> News covers most sector companies</li>
              <li>• <strong>Good (40-70%):</strong> Substantial sector coverage</li>
              <li>• <strong>Moderate (20-40%):</strong> Partial sector coverage</li>
              <li>• <strong>Limited (&lt;20%):</strong> News limited to few companies</li>
            </ul>
            <p className="mt-2 font-semibold">Why It Matters</p>
            <p>Higher coverage means the sector sentiment represents more companies, not just a few large-caps. This helps ensure that the sector-wide metrics reflect the broader market rather than being dominated by a handful of major players.</p>
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
              Ticker coverage metrics will appear when sector news data is available
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
                  {tickerCoverage?.coverage_percentage?.toFixed(1) || '--'}%
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
                <div className="text-xs text-gray-500 mb-1">Tickers Mentioned</div>
                <div className="text-3xl font-bold text-gray-900">
                  {tickerCoverage?.tickers_mentioned || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">companies with news</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Total in Sector</div>
                <div className="text-3xl font-bold text-gray-600">
                  {tickerCoverage?.total_tickers_in_sector || totalTickers || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">total companies</div>
              </div>
            </div>
          </div>

          {/* Coverage Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-gray-600">Coverage Progress</div>
              <div className="text-sm text-gray-500">
                {tickerCoverage?.tickers_mentioned || 0} / {tickerCoverage?.total_tickers_in_sector || totalTickers || 0} companies
              </div>
            </div>
            <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 flex items-center justify-end pr-3 ${
                  (tickerCoverage?.coverage_percentage || 0) >= 70 ? 'bg-green-500' :
                  (tickerCoverage?.coverage_percentage || 0) >= 40 ? 'bg-blue-500' :
                  (tickerCoverage?.coverage_percentage || 0) >= 20 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${tickerCoverage?.coverage_percentage || 0}%` }}
              >
                {(tickerCoverage?.coverage_percentage || 0) > 10 && (
                  <span className="text-xs font-semibold text-white">
                    {tickerCoverage?.coverage_percentage?.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mentioned Tickers List */}
          {tickerCoverage?.mentioned_ticker_list && tickerCoverage.mentioned_ticker_list.length > 0 && (
            <>
              <div className="border-t border-gray-200"></div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700">
                    Companies with News Coverage
                  </div>
                  <div className="text-xs text-gray-500">
                    {tickerCoverage.mentioned_ticker_list.length} companies
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                  <div className="flex flex-wrap gap-2">
                    {tickerCoverage.mentioned_ticker_list.map((ticker: string, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200"
                      >
                        {ticker}
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
                    {(tickerCoverage?.coverage_percentage || 0) >= 70 && (
                      <>Excellent sector coverage. The sentiment metrics represent a comprehensive view of the sector, including both large-cap and smaller companies.</>
                    )}
                    {(tickerCoverage?.coverage_percentage || 0) >= 40 && (tickerCoverage?.coverage_percentage || 0) < 70 && (
                      <>Good sector coverage. Most major companies are represented in the news, providing a reliable sector-wide view.</>
                    )}
                    {(tickerCoverage?.coverage_percentage || 0) >= 20 && (tickerCoverage?.coverage_percentage || 0) < 40 && (
                      <>Moderate coverage. Sentiment may be influenced by a subset of sector companies. Consider this when interpreting sector-wide metrics.</>
                    )}
                    {(tickerCoverage?.coverage_percentage || 0) < 20 && (
                      <>⚠️ Limited coverage - sentiment reflects only a few companies and may not represent the full sector. Use caution when extrapolating to the entire sector.</>
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

export default TickerCoverageCard;
