/**
 * PerformanceAttribution - Top contributors and detractors section
 *
 * Shows top gainers and losers with their return percentages and gain/loss amounts.
 */

import React from 'react';
import { formatCurrency, formatPercentage } from '../../../../utils/formatters';

interface HoldingAttribution {
  symbol: string;
  quantity: number;
  return_percent?: number;
  gain_loss?: number;
}

export interface PerformanceAttributionProps {
  timeframe: string;
  topGainers?: HoldingAttribution[];
  topLosers?: HoldingAttribution[];
}

export const PerformanceAttribution: React.FC<PerformanceAttributionProps> = ({
  timeframe,
  topGainers,
  topLosers,
}) => {
  // Only show attribution when timeframe exactly matches API period
  // 1M maps to MTD (mismatch), 1Y maps to YTD (mismatch), only YTD is exact match
  const hasMatchingAttribution = timeframe === 'YTD';

  if (!hasMatchingAttribution) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Performance Attribution
        </h3>
        <p className="text-gray-500 text-sm">
          Detailed holding-level attribution is available for standard reporting periods (YTD).
          The current view shows a {timeframe} rolling period. Switch to YTD view to see top contributors and detractors.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Contributors */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Top Contributors
        </h3>
        <div className="space-y-3">
          {topGainers && topGainers.length > 0 ? (
            topGainers.slice(0, 3).map((holding, index) => (
              <div key={`gainer-${holding.symbol}-${index}`} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{holding.symbol}</p>
                  <p className="text-sm text-gray-500">{holding.quantity} shares</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">
                    {formatPercentage(holding.return_percent || 0)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(holding.gain_loss || 0)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No attribution data available for this period</p>
          )}
        </div>
      </div>

      {/* Top Detractors */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Top Detractors
        </h3>
        <div className="space-y-3">
          {topLosers && topLosers.length > 0 ? (
            topLosers.slice(0, 3).map((holding, index) => (
              <div key={`loser-${holding.symbol}-${index}`} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{holding.symbol}</p>
                  <p className="text-sm text-gray-500">{holding.quantity} shares</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-red-600">
                    {formatPercentage(holding.return_percent || 0)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(holding.gain_loss || 0)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No attribution data available for this period</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceAttribution;
