import React, { useState } from 'react';
import { Star, Info } from 'lucide-react';

interface Source {
  name: string;
  sentiment: number;
  reliability?: number;
  articles?: number;
  consistency?: number;
}

interface SentimentSourceBreakdownProps {
  sources?: Source[];
  timeframe?: string;
  loading?: boolean;
  className?: string;
}

/**
 * SentimentSourceBreakdown Component
 *
 * Displays sentiment and reliability metrics by news source
 * Helps users understand which sources are contributing to overall sentiment
 */
const SentimentSourceBreakdown: React.FC<SentimentSourceBreakdownProps> = ({
  sources = [],
  timeframe = '1W',
  loading = false,
  className = ''
}) => {
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Sort sources by reliability (descending)
  const sortedSources = [...sources].sort((a, b) => (b.reliability || 0) - (a.reliability || 0));
  
  // Limit to top 3 sources by default
  const displaySources = showAll ? sortedSources : sortedSources.slice(0, 3);
  const hasMore = sortedSources.length > 3;

  const getSentimentLabel = (score: number): string => {
    if (score >= 0.5) return 'Very Bullish';
    if (score >= 0.2) return 'Bullish';
    if (score >= -0.2) return 'Neutral';
    if (score >= -0.5) return 'Bearish';
    return 'Very Bearish';
  };

  const getSentimentColor = (score: number): string => {
    if (score >= 0.5) return 'text-green-700';
    if (score >= 0.2) return 'text-green-600';
    if (score >= -0.2) return 'text-gray-600';
    if (score >= -0.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBarColor = (score: number): string => {
    if (score >= 0.5) return 'bg-green-600';
    if (score >= 0.2) return 'bg-green-500';
    if (score >= -0.2) return 'bg-gray-400';
    if (score >= -0.5) return 'bg-orange-500';
    return 'bg-red-600';
  };

  const getReliabilityBadge = (reliability: number): string => {
    if (reliability >= 0.9) return 'bg-green-100 text-green-800';
    if (reliability >= 0.75) return 'bg-blue-100 text-blue-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow flex flex-col h-[400px] ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Source Breakdown</h3>
              <div className="relative">
                <Info 
                  className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                />
                {showTooltip && (
                  <div className="absolute right-0 top-6 w-80 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 z-50">
                    <p className="font-semibold mb-2">Source Reliability Scoring</p>
                    <p className="mb-2">Each news source is scored on three criteria:</p>
                    <div className="bg-gray-800 p-2 rounded mb-2 space-y-1">
                      <p className="font-mono text-[10px]">• Volume: 0-0.4 points (article count)</p>
                      <p className="font-mono text-[10px]">• Consistency: 0-0.3 points (stability)</p>
                      <p className="font-mono text-[10px]">• Base Quality: 0.3 points (reputation)</p>
                    </div>
                    <p className="text-gray-300 mb-1">Total: out of 1.0 (shown as %)</p>
                    <div className="bg-gray-800 p-2 rounded space-y-1">
                      <p className="font-mono text-[10px] text-green-400">≥90%: Highly Reliable</p>
                      <p className="font-mono text-[10px] text-blue-400">≥75%: Reliable</p>
                      <p className="font-mono text-[10px] text-yellow-400">&lt;75%: Moderate</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">News sentiment over {timeframe}</p>
          </div>
          <Star className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="divide-y divide-gray-200">
        {loading ? (
          <div className="px-6 py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-3"></div>
            <p className="text-gray-600">Loading source data...</p>
          </div>
        ) : sortedSources.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-gray-600">No source data available</p>
          </div>
        ) : (
          displaySources.map((source, idx) => (
            <div key={idx} className="px-6 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
              {/* Source Header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedSource(expandedSource === idx ? null : idx)}
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Source Name */}
                  <div className="w-28">
                    <p className="text-sm font-semibold text-gray-900 truncate">{source.name}</p>
                    <p className="text-xs text-gray-500">{source.articles} articles</p>
                  </div>

                  {/* Sentiment Bar */}
                  <div className="flex-1 max-w-xs">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getBarColor(source.sentiment)}`}
                        style={{ width: `${((source.sentiment + 1) / 2) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Sentiment Label & Score */}
                  <div className="text-right min-w-max">
                    <p className={`text-sm font-semibold ${getSentimentColor(source.sentiment)}`}>
                      {getSentimentLabel(source.sentiment)}
                    </p>
                    <p className="text-xs text-gray-500">{source.sentiment > 0 ? '+' : ''}{(source.sentiment * 100).toFixed(0)}%</p>
                  </div>
                </div>

                {/* Reliability Badge */}
                <div className="ml-4">
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${getReliabilityBadge(source.reliability || 0)}`}>
                    {Math.round((source.reliability || 0) * 100)}%
                  </span>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedSource === idx && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                  {/* Article Count */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Total Articles</span>
                    <span className="text-sm font-bold text-gray-900">{source.articles || 0}</span>
                  </div>

                  {/* Consistency Score */}
                  {source.consistency !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Consistency</span>
                      <span className="text-sm font-bold text-gray-900">
                        {Math.round((source.consistency || 0) * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Assessment */}
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {(source.reliability || 0) >= 0.9 && '✓ Highly reliable source with consistent reporting'}
                      {(source.reliability || 0) >= 0.75 && (source.reliability || 0) < 0.9 && '✓ Trustworthy source with good coverage'}
                      {(source.reliability || 0) < 0.75 && '⚠ Monitor this source - limited data or inconsistent'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        </div>
      </div>

      {/* Footer with Show More/Less */}
      {sortedSources.length > 0 && !loading && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {displaySources.length} of {sortedSources.length} {sortedSources.length === 1 ? 'source' : 'sources'}
            </p>
            {hasMore && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {showAll ? 'Show Less' : `Show All (${sortedSources.length})`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SentimentSourceBreakdown;
