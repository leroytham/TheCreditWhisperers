import React, { useState, useEffect } from 'react';

// Type definitions
interface Constituent {
  name?: string;
  symbol?: string;
  industry?: string;
  price?: number;
  currentPrice?: number;
  marketCap?: number;
  market_cap?: number;
  percentOfAssets?: number;
  percent_of_assets?: number;
  volume?: number;
  sentimentScore?: number;
  sentiment_score?: number;
  sentimentMomentum?: number;
  sentiment_momentum?: number;
  fiftyTwoWeekHigh?: number;
  fifty_two_week_high?: number;
  fiftyTwoWeekLow?: number;
  fifty_two_week_low?: number;
}

interface TopConstituentsProps {
  constituents: Constituent[] | null;
  sectorName?: string;
}

/**
 * TopConstituents component - displays all holdings in the sector
 */
const TopConstituents: React.FC<TopConstituentsProps> = ({ constituents, sectorName }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'percentOfAssets', direction: 'desc' });

  // Debug: Log constituent data
  useEffect(() => {
    if (constituents && constituents.length > 0) {
      console.log('TopConstituents received data:', constituents);
      console.log('First constituent:', constituents[0]);
    }
  }, [constituents]);

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
  const constituentsWithSentiment = constituents.filter(c => {
    const score = c.sentimentScore ?? c.sentiment_score;
    return score !== null && score !== undefined;
  });
  const avgSentiment = constituentsWithSentiment.length > 0
    ? constituentsWithSentiment.reduce((sum, c) => sum + (c.sentimentScore ?? c.sentiment_score ?? 0), 0) / constituentsWithSentiment.length
    : 0;
  const bullishCount = constituents.filter(c => {
    const score = c.sentimentScore ?? c.sentiment_score;
    return (score || 0) > 0.15;
  }).length;
  const bearishCount = constituents.filter(c => {
    const score = c.sentimentScore ?? c.sentiment_score;
    return (score || 0) < -0.15;
  }).length;

  // Sort function
  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc'
    });
  };

  const numericSortKeys = new Set([
    'price',
    'marketCap',
    'percentOfAssets',
    'volume',
    'sentimentScore',
    'sentimentMomentum'
  ]);

  const getSortValue = (item: Constituent, key: string): string | number | null => {
    let rawValue;
    switch (key) {
      case 'price':
        rawValue = item.price ?? item.currentPrice;
        break;
      case 'marketCap':
        rawValue = item.marketCap ?? item.market_cap;
        break;
      case '% of Assets': // not used but guard
      case 'percentOfAssets':
        rawValue = item.percentOfAssets ?? item.percent_of_assets;
        break;
      case 'volume':
        rawValue = item.volume;
        break;
      case 'sentimentScore':
        rawValue = item.sentimentScore ?? item.sentiment_score;
        break;
      case 'sentimentMomentum':
        rawValue = item.sentimentMomentum ?? item.sentiment_momentum;
        break;
      default:
        rawValue = (item as Record<string, unknown>)[key];
        break;
    }

    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    if (numericSortKeys.has(key)) {
      const numeric = Number(rawValue);
      return Number.isNaN(numeric) ? null : numeric;
    }

    if (typeof rawValue === 'string') {
      return rawValue.toLowerCase();
    }

    // For any other types, return null
    return null;
  };

  const sortedConstituents = [...constituents].sort((a, b) => {
    const aVal = getSortValue(a, sortConfig.key);
    const bVal = getSortValue(b, sortConfig.key);

    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortConfig.direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (aVal === bVal) return 0;

    if (sortConfig.direction === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
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
          <div className="text-sm text-gray-600 mb-1">Avg Sentiment</div>
          <div className={`text-2xl font-bold ${avgSentiment >= 0.15 ? 'text-green-600' : avgSentiment >= -0.15 ? 'text-gray-600' : 'text-red-600'}`}>
            {avgSentiment >= 0 ? '+' : ''}{avgSentiment.toFixed(3)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1">Bullish / Bearish</div>
          <div className="text-2xl font-bold text-gray-900">
            <span className="text-green-600">{bullishCount}</span> / <span className="text-red-600">{bearishCount}</span>
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
                  Price &amp; 52W Range <SortIcon columnKey="price" />
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
                  onClick={() => handleSort('sentimentScore')}
                >
                  Sentiment Score <SortIcon columnKey="sentimentScore" />
                </th>
                <th 
                  className="text-right py-3 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('sentimentMomentum')}
                >
                  Sentiment Momentum <SortIcon columnKey="sentimentMomentum" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedConstituents.map((c, idx) => {
                const percentOfAssets = c.percentOfAssets ?? c.percent_of_assets;
                const priceRaw = c.price ?? c.currentPrice ?? null;
                const price = priceRaw !== null && priceRaw !== undefined ? Number(priceRaw) : null;
                const fiftyTwoWeekHighRaw = c.fiftyTwoWeekHigh ?? c.fifty_two_week_high;
                const fiftyTwoWeekLowRaw = c.fiftyTwoWeekLow ?? c.fifty_two_week_low;
                const fiftyTwoWeekHigh = fiftyTwoWeekHighRaw !== null && fiftyTwoWeekHighRaw !== undefined
                  ? Number(fiftyTwoWeekHighRaw)
                  : null;
                const fiftyTwoWeekLow = fiftyTwoWeekLowRaw !== null && fiftyTwoWeekLowRaw !== undefined
                  ? Number(fiftyTwoWeekLowRaw)
                  : null;

                let fiftyTwoWeekRange = null;
                if (
                  price !== null && !Number.isNaN(price) &&
                  fiftyTwoWeekHigh !== null && !Number.isNaN(fiftyTwoWeekHigh) &&
                  fiftyTwoWeekLow !== null && !Number.isNaN(fiftyTwoWeekLow) &&
                  fiftyTwoWeekHigh > fiftyTwoWeekLow
                ) {
                  const rangeSpan = fiftyTwoWeekHigh - fiftyTwoWeekLow;
                  const clampedPrice = Math.min(Math.max(price, fiftyTwoWeekLow), fiftyTwoWeekHigh);
                  fiftyTwoWeekRange = ((clampedPrice - fiftyTwoWeekLow) / rangeSpan) * 100;
                }

                const rangePercent = fiftyTwoWeekRange !== null
                  ? Math.max(0, Math.min(100, fiftyTwoWeekRange))
                  : null;
                const showRangeMarkers = rangePercent !== null &&
                  price !== null && !Number.isNaN(price) &&
                  fiftyTwoWeekLow !== null && !Number.isNaN(fiftyTwoWeekLow) &&
                  fiftyTwoWeekHigh !== null && !Number.isNaN(fiftyTwoWeekHigh);

                const sentimentScoreRaw = c.sentimentScore ?? c.sentiment_score;
                const sentimentMomentumRaw = c.sentimentMomentum ?? c.sentiment_momentum;
                const sentimentScore = sentimentScoreRaw !== null && sentimentScoreRaw !== undefined
                  ? Number(sentimentScoreRaw)
                  : null;
                const sentimentMomentum = sentimentMomentumRaw !== null && sentimentMomentumRaw !== undefined
                  ? Number(sentimentMomentumRaw)
                  : null;
                let momentumArrow = '→';
                if (sentimentMomentum !== null && !Number.isNaN(sentimentMomentum)) {
                  if (Math.abs(sentimentMomentum) < 0.001) {
                    momentumArrow = '→';
                  } else {
                    momentumArrow = sentimentMomentum >= 0 ? '▲' : '▼';
                  }
                }

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
                        {price !== null && !Number.isNaN(price)
                          ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '--'}
                      </div>
                      {rangePercent !== null ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 relative">
                              <div
                                className={`absolute top-0 left-0 h-2 rounded-full ${
                                  rangePercent > 70 ? 'bg-green-500' :
                                  rangePercent > 30 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${rangePercent}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">
                              {Math.round(rangePercent)}%
                            </span>
                          </div>
                          {showRangeMarkers && (
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>${fiftyTwoWeekLow.toFixed(2)}</span>
                              <span className="text-gray-700 font-semibold">${price.toFixed(2)}</span>
                              <span>${fiftyTwoWeekHigh.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-gray-400">--</div>
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
                    <td className="py-4 px-6 text-right">
                      {sentimentScore !== null && sentimentScore !== undefined ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                          sentimentScore >= 0.35 ? 'bg-green-100 text-green-800' :
                          sentimentScore >= 0.15 ? 'bg-green-50 text-green-700' :
                          sentimentScore >= -0.15 ? 'bg-gray-100 text-gray-700' :
                          sentimentScore >= -0.35 ? 'bg-red-50 text-red-700' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {sentimentScore >= 0 ? '+' : ''}{sentimentScore.toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {sentimentMomentum !== null && sentimentMomentum !== undefined ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                          sentimentMomentum >= 0.05 ? 'bg-green-100 text-green-800' :
                          sentimentMomentum >= 0.01 ? 'bg-green-50 text-green-700' :
                          sentimentMomentum >= -0.01 ? 'bg-gray-100 text-gray-700' :
                          sentimentMomentum >= -0.05 ? 'bg-red-50 text-red-700' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {momentumArrow}
                          {Math.abs(sentimentMomentum).toFixed(3)}
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
    </div>
  );
};

export default TopConstituents;
