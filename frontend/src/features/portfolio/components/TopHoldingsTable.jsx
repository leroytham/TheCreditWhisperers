import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const TopHoldingsTable = () => {
  const [activeTab, setActiveTab] = useState('all-holdings');
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const tabs = [
    { id: 'all-holdings', label: 'All Holdings' },
    { id: 'top-gainers', label: 'Top Gainers' },
    { id: 'top-losers', label: 'Top Losers' },
  ];

  useEffect(() => {
    const fetchHoldings = async () => {
      setLoading(true);
      setError('');

      const username = sessionStorage.getItem('user');
      const accountName = sessionStorage.getItem('selectedAccountName');

      if (!username || !accountName) {
        setError('Please select an account first.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:8000/api/portfolio/holdings/${username}/${encodeURIComponent(
            accountName
          )}`
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to fetch holdings');
        }

        const data = await response.json();
        setHoldings(data.holdings || []);
      } catch (err) {
        console.error('Error fetching holdings:', err);
        setError('Failed to load holdings data.');
      } finally {
        setLoading(false);
      }
    };

    fetchHoldings();

    if (typeof window !== "undefined") {
      fetchHoldings();
      window.addEventListener("accountChanged", fetchHoldings);
      return () => window.removeEventListener("accountChanged", fetchHoldings);
    }
    
  }, []);

  // Filter holdings based on selected tab
  const filteredHoldings =
    activeTab === 'top-gainers'
      ? holdings
          .filter((h) => h.isPositive)
          .sort((a, b) => b.gainLossPercent - a.gainLossPercent)
      : activeTab === 'top-losers'
      ? holdings
          .filter((h) => !h.isPositive)
          .sort((a, b) => a.gainLossPercent - b.gainLossPercent)
      : holdings;

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
      {loading ? (
        <p className="text-center text-gray-500 mt-6">Loading holdings...</p>
      ) : error ? (
        <p className="text-center text-red-500 mt-6">{error}</p>
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
            {filteredHoldings.map((holding) => (
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
                      holding.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {holding.profitLoss !== null ? `$${holding.profitLoss}` : '-'}
                  </span>
                </td>
                <td className="py-4 text-right">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-medium ${
                      holding.isPositive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {holding.isPositive ? (
                      <TrendingUp className="w-4 h-4 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 mr-1" />
                    )}
                    {holding.gainLossPercent !== null
                      ? `${holding.gainLossPercent}%`
                      : '-'}
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
        <a href="#" className="text-sm font-semibold text-blue-600 hover:underline">
          VIEW ALL HOLDINGS
        </a>
        <button
          onClick={() => window.location.reload()}
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          REFRESH HOLDINGS
        </button>
      </div>
    </div>
  );
};

export default TopHoldingsTable;