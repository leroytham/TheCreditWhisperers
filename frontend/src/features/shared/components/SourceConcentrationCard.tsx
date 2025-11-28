import React from 'react';
import { BarChart3, AlertTriangle, CheckCircle, Info } from 'lucide-react';

/**
 * SourceConcentrationCard Component
 *
 * Displays source concentration using Herfindahl-Hirschman Index (HHI)
 * Shows whether news is diverse or concentrated from a few sources
 *
 * @param {Object} props
 * @param {number} props.sourceConcentrationHhi - HHI score from 0-10000
 * @param {string} props.concentrationInterpretation - Low/Moderate/High Concentration
 * @param {Array} props.topSources - Array of top news sources with percentages
 * @param {string} props.className - Additional CSS classes
 */
const SourceConcentrationCard = ({
  sourceConcentrationHhi: sourceConcentrationHhiProp,
  source_concentration_hhi,
  concentrationInterpretation: concentrationInterpretationProp,
  concentration_interpretation,
  topSources: topSourcesProp,
  top_sources,
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6',
  loading,
  error
}: {
  sourceConcentrationHhi?: any;
  source_concentration_hhi?: any;
  concentrationInterpretation?: any;
  concentration_interpretation?: any;
  topSources?: any;
  top_sources?: any;
  className?: string;
  context?: string;
  loading?: boolean;
  error?: any;
}) => {
  // Support both camelCase and snake_case prop names
  const sourceConcentrationHhi = sourceConcentrationHhiProp ?? source_concentration_hhi;
  const concentrationInterpretation = concentrationInterpretationProp ?? concentration_interpretation;
  const topSources = topSourcesProp ?? top_sources ?? [];

  // Determine if data is available
  const hasData = sourceConcentrationHhi !== null && 
                  sourceConcentrationHhi !== undefined && 
                  topSources && topSources.length > 0;

  // Get HHI interpretation details
  const getHhiDetails = (hhi, interpretation) => {
    if (!hasData) {
      return { 
        label: 'No Data', 
        color: 'text-gray-400', 
        bgColor: 'bg-gray-100', 
        borderColor: 'border-gray-200',
        icon: Info,
        description: 'Insufficient data to calculate source concentration'
      };
    }

    // Low Concentration (HHI < 1500) - Diverse sources
    if (interpretation === 'Low Concentration' || hhi < 1500) {
      return {
        label: 'Low Concentration',
        color: 'text-green-700',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        description: 'News from diverse sources - more reliable and balanced coverage'
      };
    }

    // Moderate Concentration (1500 ≤ HHI < 2500)
    if (interpretation === 'Moderate Concentration' || (hhi >= 1500 && hhi < 2500)) {
      return {
        label: 'Moderate Concentration',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: Info,
        description: 'Some concentration in news sources - verify information across sources'
      };
    }

    // High Concentration (HHI ≥ 2500) - Few dominant sources
    return {
      label: 'High Concentration',
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: AlertTriangle,
      description: 'News dominated by few sources - limited perspective, exercise caution'
    };
  };

  const hhiDetails = getHhiDetails(sourceConcentrationHhi, concentrationInterpretation);
  const IconComponent = hhiDetails.icon;

  // Format HHI score for display
  const formatHhiScore = (hhi) => {
    if (hhi === null || hhi === undefined) return '--';
    return Math.round(hhi).toLocaleString();
  };

  // Get color for source bar based on percentage
  const getSourceBarColor = (percentage) => {
    if (percentage >= 50) return 'bg-red-500'; // Dominant source
    if (percentage >= 30) return 'bg-yellow-500'; // Major source
    return 'bg-blue-500'; // Normal source
  };

  return (
    <div className={className}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Source Concentration</h3>
        </div>
        {/* Tooltip explaining HHI */}
        <div className="group relative">
          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute right-0 top-6 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <p className="font-semibold mb-2">Herfindahl-Hirschman Index (HHI)</p>
            <p className="mb-2">Measures news source diversity. Low HHI = many sources, High HHI = few dominant sources.</p>
            <p className="font-semibold mb-1">Interpretation</p>
            <ul className="space-y-1">
              <li>• <strong>Low (&lt;1500):</strong> Diverse sources, balanced coverage</li>
              <li>• <strong>Moderate (1500-2500):</strong> Some concentration</li>
              <li>• <strong>High (≥2500):</strong> Dominated by few sources</li>
            </ul>
            <p className="mt-2 font-semibold">Why It Matters</p>
            <p>Diverse sources provide more reliable sentiment. High concentration may indicate echo chamber or limited information flow.</p>
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
              Source concentration metrics will appear when news data is available
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* HHI Score */}
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className={`text-4xl font-semibold ${hhiDetails.color}`}>
                {formatHhiScore(sourceConcentrationHhi)}
              </div>
              <IconComponent className={`w-8 h-8 ${hhiDetails.color}`} />
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${hhiDetails.borderColor} ${hhiDetails.bgColor} ${hhiDetails.color}`}>
              {hhiDetails.label}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600">
            {hhiDetails.description}
          </p>

          {/* HHI Scale Reference */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">HHI Scale</div>
            <div className="relative w-full h-3 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full">
              {/* Marker showing current position */}
              {sourceConcentrationHhi !== null && (
                <div 
                  className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-gray-800 rounded-full shadow-lg"
                  style={{ left: `${Math.min(100, (sourceConcentrationHhi / 10000) * 100)}%` }}
                ></div>
              )}
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>0 (Perfect Diversity)</span>
              <span>10000 (Single Source)</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Top Sources */}
          {topSources && topSources.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-gray-600">
                Top News Sources (by weight)
              </div>

              {/* Scrollable container for sources list */}
              <div className="max-h-64 overflow-y-auto pr-2 space-y-3">
                {topSources.map((source, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 truncate" title={source.source}>
                        {index + 1}. {source.source}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 ml-2">
                        {source.percentage.toFixed(1)}%
                      </span>
                    </div>
                    {/* Visual bar */}
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getSourceBarColor(source.percentage)} transition-all duration-300`}
                        style={{ width: `${source.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {topSources.length > 0 && (
                <div className="text-xs text-gray-500 text-center pt-2">
                  Showing top {topSources.length} source{topSources.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Actionable Insights */}
          <div className="border-t border-gray-200 pt-4">
            <div className={`text-xs ${hhiDetails.color} bg-opacity-10 rounded-md p-3`}>
              <strong>💡 Insight:</strong>
              {sourceConcentrationHhi < 1500 && (
                <span> News from diverse sources suggests balanced market perspective. High reliability for sentiment analysis.</span>
              )}
              {sourceConcentrationHhi >= 1500 && sourceConcentrationHhi < 2500 && (
                <span> Moderate concentration detected. Cross-reference with multiple sources before making decisions.</span>
              )}
              {sourceConcentrationHhi >= 2500 && (
                <span> ⚠️ High concentration - sentiment may be biased. Seek additional sources for confirmation.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceConcentrationCard;
