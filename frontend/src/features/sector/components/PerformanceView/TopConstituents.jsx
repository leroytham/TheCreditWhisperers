import React, { useState } from 'react';

/**
 * TopConstituents component - displays all holdings in the sector
 */
const TopConstituents = ({ constituents, sectorName }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'percentOfAssets', direction: 'desc' });

  if (!constituents || constituents.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">All Constituents</h3>
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

  // Calculate summary statistics
  const totalMarketCap = constituents.reduce((sum, c) => sum + (c.marketCap || 0), 0);
  const avgChange = constituents.reduce((sum, c) => sum + (c.percentChange || 0), 0) / constituents.length;
  const gainers = constituents.filter(c => (c.percentChange || 0) > 0).length;
  const losers = constituents.filter(c => (c.percentChange || 0) < 0).length;

  // Sort function
  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const sortedConstituents = [...constituents].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    if (sortConfig.direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span className="ml-1 text-gray-400">↕</span>;
    }
    return <span className="ml-1">{sortConfig.direction === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Total Holdings</div>
          <div className="text-2xl font-bold text-gray-900">{constituents.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Total Market Cap</div>
          <div className="text-2xl font-bold text-gray-900">
            ${(totalMarketCap / 1e12).toFixed(2)}T
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Avg Change</div>
          <div className={`text-2xl font-bold ${avgChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Gainers / Losers</div>
          <div className="text-2xl font-bold text-gray-900">
            <span className="text-green-600">{gainers}</span> / <span className="text-red-600">{losers}</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">All Constituents</h3>
            {sectorName && <p className="text-sm text-gray-600 mt-1">{sectorName}</p>}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  Company <SortIcon columnKey="name" />
                </th>
                <th 
                  className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('price')}
                >
                  Price <SortIcon columnKey="price" />
                </th>
                <th 
                  className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('percentChange')}
                >
                  Change % <SortIcon columnKey="percentChange" />
                </th>
                <th 
                  className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('marketCap')}
                >
                  Market Cap <SortIcon columnKey="marketCap" />
                </th>
                <th 
                  className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('percentOfAssets')}
                >
                  % of Assets <SortIcon columnKey="percentOfAssets" />
                </th>
                <th 
                  className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('volume')}
                >
                  Volume <SortIcon columnKey="volume" />
                </th>
                <th 
                  className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('peRatio')}
                >
                  P/E Ratio <SortIcon columnKey="peRatio" />
                </th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  52W Range
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedConstituents.map((c, idx) => {
                const percentChange = c.percentChange ?? c.percent_change ?? c.change_percent;
                const hasChange = percentChange !== null && percentChange !== undefined;
                const percentOfAssets = c.percentOfAssets ?? c.percent_of_assets;
                const fiftyTwoWeekRange = c.fiftyTwoWeekLow && c.fiftyTwoWeekHigh
                  ? ((c.price - c.fiftyTwoWeekLow) / (c.fiftyTwoWeekHigh - c.fiftyTwoWeekLow)) * 100
                  : null;

                return (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-medium text-gray-900">{c.name || c.symbol || '--'}</div>
                        <div className="text-xs text-gray-500">{c.symbol}</div>
                        {c.industry && (
                          <div className="text-xs text-gray-400 mt-0.5">{c.industry}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="font-medium text-gray-900">
                        {c.price
                          ? `$${Number(c.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '--'}
                      </div>
                      {c.dayHigh && c.dayLow && (
                        <div className="text-xs text-gray-500">
                          ${c.dayLow.toFixed(2)} - ${c.dayHigh.toFixed(2)}
                        </div>
                      )}
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
                    <td className="py-4 px-6 text-right text-gray-900">
                      {c.marketCap || c.market_cap
                        ? `$${(Number(c.marketCap || c.market_cap) / 1e9).toFixed(2)}B`
                        : '--'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="font-medium text-gray-900">
                        {percentOfAssets
                          ? `${(percentOfAssets * 100).toFixed(2)}%`
                          : '--'}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right text-gray-900">
                      {c.volume
                        ? `${(c.volume / 1e6).toFixed(2)}M`
                        : '--'}
                    </td>
                    <td className="py-4 px-6 text-right text-gray-900">
                      {c.peRatio
                        ? c.peRatio.toFixed(2)
                        : '--'}
                    </td>
                    <td className="py-4 px-6">
                      {fiftyTwoWeekRange !== null ? (
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 relative">
                            <div
                              className={`absolute top-0 left-0 h-2 rounded-full ${
                                fiftyTwoWeekRange > 70 ? 'bg-green-500' :
                                fiftyTwoWeekRange > 30 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${fiftyTwoWeekRange}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {fiftyTwoWeekRange.toFixed(0)}%
                          </span>
                        </div>
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
    </div>
  );
};

export default TopConstituents;
