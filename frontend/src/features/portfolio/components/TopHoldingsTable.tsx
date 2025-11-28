import React, { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { usePortfolioOverview } from '../hooks/usePortfolioOverview';
import LoadingSpinner from '../../../components/LoadingSpinner';

// Type definitions
interface Holding {
  symbol: string;
  quantity: number;
  averageCostPrice?: string;
  marketPrice?: string;
  profitLoss: number | null;
  gainLossPercent: number | null;
  isPositive: boolean | null;
  newsVolume: number;
  sentiment: number;
  position: string;
}

interface TopHoldingsTableProps {
  onViewAllHoldings?: () => void;
}

/**
 * TopHoldingsTable Component
 *
 * Displays portfolio holdings in a tabbed table with three views:
 * - All Holdings: Complete list of portfolio holdings
 * - Top Gainers: Holdings with positive returns sorted by gain percentage
 * - Top Losers: Holdings with negative returns sorted by loss percentage
 *
 * OPTIMIZED VERSION: Uses React Query via usePortfolioOverview hook for:
 * - Automatic request deduplication (no duplicate API calls)
 * - Caching and background refetching
 * - Parallel data loading with other portfolio components
 *
 * @param {Object} props - Component props
 * @param {Function} [props.onViewAllHoldings] - Callback when "VIEW ALL HOLDINGS" is clicked
 * @returns {React.ReactElement} Rendered holdings table component with tabs
 *
 * @example
 * // Used in portfolio page to display holdings overview
 * <TopHoldingsTable onViewAllHoldings={() => setActiveTab('holdings')} />
 */
const TopHoldingsTable: React.FC<TopHoldingsTableProps> = ({ onViewAllHoldings }) => {
  const [activeTab, setActiveTab] = useState('all-holdings');

  // Use unified portfolio data hook - automatically handles caching and deduplication
  const { holdings, holdingsLoading, holdingsError, refetchHoldings } = usePortfolioOverview();

  const tabs = [
    { id: 'all-holdings', label: 'All Holdings' },
    { id: 'top-gainers', label: 'Top Gainers' },
    { id: 'top-losers', label: 'Top Losers' },
  ];

  // Filter holdings based on selected tab
  const filteredHoldings: Holding[] =
    activeTab === 'top-gainers'
      ? (holdings as Holding[])
          .filter((h: Holding) => h.isPositive === true)
          .sort((a: Holding, b: Holding) => (b.gainLossPercent ?? 0) - (a.gainLossPercent ?? 0))
      : activeTab === 'top-losers'
      ? (holdings as Holding[])
          .filter((h: Holding) => h.isPositive === false)
          .sort((a: Holding, b: Holding) => (a.gainLossPercent ?? 0) - (b.gainLossPercent ?? 0))
      : (holdings as Holding[]);

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Holdings Portfolio</h2>
      </div>

      {/* Tabs */}
      <div className="flex space-x-6 text-sm mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 ${
              activeTab === tab.id
                ? 'text-black font-semibold border-b-2 border-black'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading / Error / Empty states */}
      {holdingsLoading ? (
        <div className="flex justify-center items-center mt-6">
          <LoadingSpinner />
        </div>
      ) : holdingsError ? (
        <p className="text-center text-red-500 mt-6">
          {holdingsError?.message || 'Failed to load holdings. Please try again.'}
        </p>
      ) : holdings.length === 0 ? (
        <p className="text-center text-gray-400 mt-6">No holdings found for this account.</p>
      ) : (
        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="text-left text-xs text-gray-500 font-semibold border-b-2 border-gray-200">
              <th className="py-2 font-medium">SYMBOL</th>
              <th className="py-2 font-medium text-right">QUANTITY</th>
              <th className="py-2 font-medium text-right">AVERAGE COST PRICE ($)</th>
              <th className="py-2 font-medium text-right">MARKET PRICE ($)</th>
              <th className="py-2 font-medium text-right">P/L ($)</th>
              <th className="py-2 font-medium text-right">(%) P/L</th>
              <th className="py-2 font-medium text-right">NEWS VOLUME</th>
              <th className="py-2 font-medium text-right">SENTIMENT</th>
              <th className="py-2 font-medium text-right">POSITION ($)</th>
            </tr>
          </thead>
          <tbody>
            {filteredHoldings.map((holding: Holding) => (
              <tr key={holding.symbol} className="border-b hover:bg-gray-50">
                <td className="py-4">
                  <div className="inline-flex items-center justify-center h-8 w-16 rounded bg-gray-100 text-gray-800 text-sm font-semibold">
                    {holding.symbol}
                  </div>
                </td>
                <td className="py-4 text-right">{holding.quantity}</td>
                <td className="py-4 text-right">
                  {holding.averageCostPrice ? `$${holding.averageCostPrice}` : '-'}
                </td>
                <td className="py-4 text-right">
                  {holding.marketPrice ? `$${holding.marketPrice}` : '-'}
                </td>
                <td className="py-4 text-right">
                  <span
                    className={`text-sm font-medium ${
                      holding.isPositive === true ? 'text-green-600' :
                      holding.isPositive === false ? 'text-red-600' :
                      'text-gray-400'
                    }`}
                  >
                    {holding.profitLoss !== null ? `$${holding.profitLoss}` : '—'}
                  </span>
                </td>
                <td className="py-4 text-right">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-medium ${
                      holding.isPositive === true
                        ? 'bg-green-100 text-green-800'
                        : holding.isPositive === false
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {holding.isPositive === true ? (
                      <TrendingUp className="w-4 h-4 mr-1" />
                    ) : holding.isPositive === false ? (
                      <TrendingDown className="w-4 h-4 mr-1" />
                    ) : null}
                    {holding.gainLossPercent !== null
                      ? `${holding.gainLossPercent}%`
                      : '—'}
                  </span>
                </td>
                <td className="py-4 text-right">{holding.newsVolume}</td>
                <td className="py-4 text-right">{holding.sentiment}</td>
                <td className="py-4 text-right">${holding.position}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="text-center mt-4 flex justify-center gap-4">
        {onViewAllHoldings && (
          <button
            onClick={onViewAllHoldings}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            VIEW ALL HOLDINGS
          </button>
        )}
        <button
          onClick={() => refetchHoldings()}
          disabled={holdingsLoading}
          className="text-sm font-semibold text-blue-600 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {holdingsLoading ? 'REFRESHING...' : 'REFRESH HOLDINGS'}
        </button>
      </div>
    </div>
  );
};

export default TopHoldingsTable;