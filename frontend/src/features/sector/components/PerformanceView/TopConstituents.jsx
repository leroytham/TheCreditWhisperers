import React from 'react';

/**
 * TopConstituents component - displays top holdings in the sector
 */
const TopConstituents = ({ constituents, sectorName }) => {
  if (!constituents || constituents.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Top Constituents</h3>
          {sectorName && <span className="text-sm text-gray-600">{sectorName}</span>}
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="font-medium">No constituent data available</p>
          <p className="text-sm mt-1">Constituent information is not available for this sector</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Top Constituents</h3>
          {sectorName && <p className="text-sm text-gray-600 mt-1">{sectorName}</p>}
        </div>
        <span className="text-sm font-medium text-gray-600">{constituents.length} companies</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Company
              </th>
              <th className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Price
              </th>
              <th className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Market Cap
              </th>
              <th className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Change %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {constituents.map((c, idx) => {
              const percentChange = c.percentChange ?? c.percent_change ?? c.change_percent;
              const hasChange = percentChange !== null && percentChange !== undefined;

              return (
                <tr
                  key={idx}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div>
                      <div className="font-medium text-gray-900">{c.name || c.symbol || '--'}</div>
                      {c.symbol && c.name && c.symbol !== c.name && (
                        <div className="text-xs text-gray-500">{c.symbol}</div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right font-medium text-gray-900">
                    {c.price
                      ? `$${Number(c.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '--'}
                  </td>
                  <td className="py-4 px-6 text-right text-gray-900">
                    {c.marketCap || c.market_cap
                      ? `$${(Number(c.marketCap || c.market_cap) / 1e9).toFixed(2)}B`
                      : '--'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    {hasChange ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                        percentChange >= 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {percentChange >= 0 ? '▲' : '▼'}
                        {Math.abs(percentChange).toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopConstituents;
