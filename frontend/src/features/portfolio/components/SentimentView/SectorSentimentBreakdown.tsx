import React from 'react';

// Type definitions
interface SectorData {
  sector: string;
  sentiment: number;
  sentimentLabel: string;
  weight: number;
  holdingsCount: number;
}

interface SectorSentimentBreakdownProps {
  sectors: SectorData[] | null | undefined;
  loading: boolean;
  error: string | null;
}

/**
 * SectorSentimentBreakdown Component
 *
 * Displays portfolio sentiment breakdown by sector with visual indicators.
 *
 * @param {Array} sectors - Array of sector data with sentiment, weight, etc.
 * @param {boolean} loading - Loading state
 * @param {string} error - Error message if any
 * @returns {React.ReactElement} Rendered sector breakdown component
 */
const SectorSentimentBreakdown: React.FC<SectorSentimentBreakdownProps> = ({ sectors, loading, error }) => {
  // Helper function to get sentiment color
  const getSentimentColor = (score: number): string => {
    if (score > 0.15) return 'text-green-600 bg-green-50';
    if (score > 0.05) return 'text-green-500 bg-green-50';
    if (score > -0.05) return 'text-gray-600 bg-gray-50';
    if (score > -0.15) return 'text-red-500 bg-red-50';
    return 'text-red-600 bg-red-50';
  };

  // Helper function to get sentiment bar width and color
  const getSentimentBarStyle = (score: number): { width: string; bgColor: string } => {
    const maxScore = 0.5; // Maximum expected score for scaling
    const normalizedScore = Math.min(Math.abs(score), maxScore) / maxScore;
    const width = normalizedScore * 100;

    let bgColor = 'bg-gray-300';
    if (score > 0.05) bgColor = 'bg-green-500';
    else if (score < -0.05) bgColor = 'bg-red-500';

    return { width: `${width}%`, bgColor };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Sentiment by Sector</h4>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="flex justify-between mb-1">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-2 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Sentiment by Sector</h4>
          <div className="text-center py-8">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!sectors || sectors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Sentiment by Sector</h4>
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No sector data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Sentiment by Sector</h4>

        <div className="space-y-4">
          {sectors.map((sector: SectorData) => {
            const barStyle = getSentimentBarStyle(sector.sentiment);

            return (
              <div key={sector.sector} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {sector.sector}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({sector.holdingsCount} {sector.holdingsCount === 1 ? 'holding' : 'holdings'})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSentimentColor(sector.sentiment)}`}>
                      {sector.sentimentLabel}
                    </span>
                    <span className="text-sm font-medium text-gray-600">
                      {(sector.sentiment > 0 ? '+' : '')}{(sector.sentiment * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${barStyle.bgColor}`}
                        style={{ width: barStyle.width }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {sector.weight.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall portfolio sentiment summary */}
        {sectors.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Portfolio Weight Coverage</span>
              <span className="text-xs font-medium text-gray-900">
                {sectors.reduce((sum: number, s: SectorData) => sum + s.weight, 0).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SectorSentimentBreakdown;