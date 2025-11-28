import React, { useState, useMemo } from 'react';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { InlineError } from '../../../../components/ErrorDisplay';
import { usePortfolioOverview } from '../../hooks/usePortfolioOverview';
import { formatCurrency, formatPercentage, parseNumericString } from '../../../../utils/formatters';

/**
 * PortfolioHoldingsDetail Component
 *
 * Comprehensive holdings table with sorting, filtering, and analytics.
 * Displays all portfolio holdings with cost basis, market value, returns, and sentiment.
 *
 * Key Features:
 * - Multi-column sorting (weight, symbol, gain/loss, sentiment, etc.)
 * - Sector filtering (requires backend implementation - see BACKEND_REQUIREMENTS.md #2)
 * - Summary statistics (total value, top sector, best/worst performers)
 * - Performance metrics for each holding
 * - AI sentiment scores integration
 *
 * Data Transformation:
 * - Parses numeric strings from API
 * - Calculates derived metrics (portfolio weight, gain/loss %)
 * - Memoized data processing for performance
 *
 * @returns {React.ReactElement} Rendered portfolio holdings detail view
 *
 * @example
 * // Used in Portfolio page "Holdings" tab
 * <PortfolioHoldingsDetail />
 */
const PortfolioHoldingsDetail = () => {
  const [sortField, setSortField] = useState('weight');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterSector, setFilterSector] = useState('all');

  // BUG FIX: Use React Query cache for single source of truth across Overview and Holdings tabs
  const { holdings: rawHoldings, holdingsLoading: loading, holdingsError: error, refetchHoldings: refetch } = usePortfolioOverview();

  // Transform and process holdings data with memoization
  const holdings = useMemo(() => {
    if (!rawHoldings) return [];

    const apiHoldings = Array.isArray(rawHoldings) ? rawHoldings : rawHoldings.holdings || [];

    // Transform API response to component format
    const transformedHoldings = apiHoldings.map(holding => {
      // Parse numeric values from formatted strings
      // BUG FIX: Propagate null for missing cost basis instead of defaulting to 0
      const avgCost = holding.averageCostPrice ? parseNumericString(holding.averageCostPrice) : null;
      const currentPrice = holding.marketPrice ? parseNumericString(holding.marketPrice) : null;
      const marketValue = holding.position ? parseNumericString(holding.position) : null;
      const quantity = holding.quantity || 0;

      // Parse sentiment (keep raw -1..1 scale for consistency with overview)
      const sentiment = parseFloat(holding.sentiment || '0');

      return {
        ticker: holding.symbol,
        name: holding.symbol, // Use ticker as name since full company name not provided
        sector: holding.sector || 'N/A', // Use sector if provided, otherwise N/A
        shares: quantity,
        avgCost: avgCost,
        currentPrice: currentPrice,
        marketValue: marketValue,
        weight: 0, // Will calculate after all holdings are transformed
        dayChange: holding.day_change_percent ?? null,
        totalReturn: holding.gainLossPercent ?? null,
        sentiment: sentiment,
        sentimentMomentum: holding.sentimentMomentum ?? null, // TODO: Backend to populate
        priceRange52w: holding.range52week ?? null // TODO: Backend to populate
      };
    });

    // Calculate weights (exclude holdings with missing market values)
    const totalValue = transformedHoldings.reduce((sum, h) => {
      return h.marketValue !== null ? sum + h.marketValue : sum;
    }, 0);
    return transformedHoldings.map(h => ({
      ...h,
      weight: totalValue > 0 && h.marketValue !== null ? (h.marketValue / totalValue) * 100 : 0
    }));
  }, [rawHoldings]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Memoize sorted and filtered holdings
  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (sortField === 'name' || sortField === 'ticker' || sortField === 'sector') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [holdings, sortField, sortDirection]);

  const filteredHoldings = useMemo(() => {
    return filterSector === 'all'
      ? sortedHoldings
      : sortedHoldings.filter(h => h.sector === filterSector);
  }, [sortedHoldings, filterSector]);

  const sectors = useMemo(() => [...new Set(holdings.map(h => h.sector))] as string[], [holdings]);

  // Memoize summary calculations
  const summaryStats = useMemo(() => {
    // Exclude holdings with missing market values from calculations
    const totalValue = holdings.reduce((sum, h) => {
      return h.marketValue !== null ? sum + h.marketValue : sum;
    }, 0);
    // BUG FIX: Only include holdings with valid cost basis in gain/loss calculation
    const totalGainLoss = holdings.reduce((sum, h) => {
      if (h.marketValue !== null && h.avgCost !== null) {
        return sum + (h.marketValue - (h.shares * h.avgCost));
      }
      return sum;
    }, 0);

    // Calculate sector allocations by market value
    const sectorAllocations = {};
    holdings.forEach(h => {
      if (h.sector !== 'N/A' && h.marketValue !== null) {
        sectorAllocations[h.sector] = (sectorAllocations[h.sector] || 0) + h.marketValue;
      }
    });

    // Find top sector by market value
    let topSector = 'Diversified';
    let maxValue = 0;
    Object.entries(sectorAllocations).forEach(([sector, value]: [string, number]) => {
      if (value > maxValue) {
        maxValue = value;
        topSector = sector;
      }
    });

    // Guard against division by zero when holdings are empty or zero-weighted
    const totalWeight = holdings.reduce((sum, h) => sum + h.weight, 0);
    const avgSentiment = totalWeight > 0
      ? holdings.reduce((sum, h) => sum + h.sentiment * h.weight, 0) / totalWeight
      : 0;

    return { totalValue, totalGainLoss, avgSentiment, topSector };
  }, [holdings]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return <span className="text-gray-900">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <InlineError message={error?.message || String(error)} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-sm text-gray-500">Total Holdings</p>
            <p className="text-2xl font-bold text-gray-900">{holdings.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Portfolio Value</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summaryStats.totalValue)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Gain/Loss</p>
            <p className={`text-2xl font-bold ${summaryStats.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summaryStats.totalGainLoss)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Avg. Sentiment</p>
            <p className="text-2xl font-bold text-gray-900">{summaryStats.avgSentiment.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Top Sector</p>
            <p className="text-lg font-bold text-gray-900">
              {summaryStats.topSector}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by Sector:</label>
          <select
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
            className="block w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            <option value="all">All Sectors</option>
            {sectors.map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('ticker')}
                >
                  Symbol <SortIcon field="ticker" />
                </th>
                {/* BUG FIX: Removed redundant Company column - backend doesn't provide company names */}
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('shares')}
                >
                  Shares <SortIcon field="shares" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('currentPrice')}
                >
                  Price <SortIcon field="currentPrice" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('marketValue')}
                >
                  Market Value <SortIcon field="marketValue" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('weight')}
                >
                  Weight <SortIcon field="weight" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('dayChange')}
                >
                  Day Change <SortIcon field="dayChange" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalReturn')}
                >
                  Total Return <SortIcon field="totalReturn" />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('sentiment')}
                >
                  Sentiment <SortIcon field="sentiment" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredHoldings.map((holding) => (
                <tr key={holding.ticker} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{holding.ticker}</div>
                  </td>
                  {/* BUG FIX: Removed redundant Company column cell - it duplicated ticker */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {holding.shares.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900">
                        {holding.currentPrice !== null ? formatCurrency(holding.currentPrice) : <span className="text-gray-400">—</span>}
                      </div>
                      {holding.priceRange52w && (
                        <div className="text-xs text-gray-500">
                          {formatCurrency(holding.priceRange52w.low)} - {formatCurrency(holding.priceRange52w.high)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {holding.marketValue !== null ? formatCurrency(holding.marketValue) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(holding.weight, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">{holding.weight.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {holding.dayChange !== null ? (
                      <span className={holding.dayChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatPercentage(holding.dayChange)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {/* BUG FIX: Show N/A when cost basis is missing */}
                    {holding.totalReturn !== null && holding.avgCost !== null ? (
                      <div className={`flex items-center ${
                        holding.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <span className="mr-1">{holding.totalReturn >= 0 ? '▲' : '▼'}</span>
                        {formatPercentage(holding.totalReturn)}
                      </div>
                    ) : (
                      <span className="text-gray-400" title={holding.avgCost === null ? "Cost basis unavailable" : "No data"}>N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className={`text-sm font-medium ${
                        holding.sentiment >= 0.2 ? 'text-green-600' :
                        holding.sentiment >= -0.2 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {holding.sentiment.toFixed(2)}
                      </div>
                      {holding.sentimentMomentum !== null && (
                        <div className="text-xs text-gray-500" title="7-day sentiment change">
                          {holding.sentimentMomentum >= 0 ? '↑' : '↓'} {Math.abs(holding.sentimentMomentum).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PortfolioHoldingsDetail;