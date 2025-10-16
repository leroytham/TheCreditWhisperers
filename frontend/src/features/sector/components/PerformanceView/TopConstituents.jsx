import React from 'react';

/**
 * TopConstituents component - displays top holdings in the sector
 */
const TopConstituents = ({ constituents, sectorName }) => {
  if (!constituents || constituents.length === 0) {
    return (
      <div className="col-span-3 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top Constituents</h3>
          <span className="text-sm text-gray-500">{sectorName}</span>
        </div>
        <div className="text-gray-400 text-sm">No constituent data available.</div>
      </div>
    );
  }

  return (
    <div className="col-span-3 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Top Constituents</h3>
        <span className="text-sm text-gray-500">{sectorName}</span>
      </div>

      <table className="w-full text-sm">
        <thead className="text-gray-500 border-b border-gray-200">
          <tr>
            <th className="text-left py-2">Name</th>
            <th className="text-right py-2">Price</th>
            <th className="text-right py-2">Market Cap</th>
            <th className="text-right py-2">% Day</th>
          </tr>
        </thead>
        <tbody>
          {constituents.map((c, idx) => (
            <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 font-medium text-gray-900">{c.name || c.symbol}</td>
              <td className="py-2 text-right">
                {c.price ? `$${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '--'}
              </td>
              <td className="py-2 text-right">
                {c.marketCap ? `$${(c.marketCap / 1e9).toFixed(1)}B` : '--'}
              </td>
              <td
                className={`py-2 text-right ${
                  c.percentChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {c.percentChange !== null && c.percentChange !== undefined
                  ? `${c.percentChange > 0 ? '+' : ''}${c.percentChange.toFixed(2)}%`
                  : '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TopConstituents;
