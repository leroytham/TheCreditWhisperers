import React, { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * TopHoldingsTable Component
 *
 * Displays portfolio holdings with performance metrics
 */
const TopHoldingsTable = () => {
  const [activeTab, setActiveTab] = useState('all-holdings');

  const tabs = [
    { id: 'all-holdings', label: 'All Holdings' },
    { id: 'top-gainers', label: 'Top Gainers' },
    { id: 'top-losers', label: 'Top Losers' },
  ];

  const holdings = [
    {
      symbol: 'AMZN',
      description: 'Amazon.com Inc.',
      quantity: '35.445',
      value: 'USD 400.08',
      gainLoss: '+3.12',
      gainLossPercent: '0.78',
      isPositive: true,
      newsVolume: 'High',
      sentiment: 'Positive',
      percentTotal: '6.95',
    },
    {
      symbol: 'AAPL',
      description: 'Apple Inc.',
      quantity: '24.676',
      value: 'USD 103.09',
      gainLoss: '+2.21',
      gainLossPercent: '2.15',
      isPositive: true,
      newsVolume: 'High',
      sentiment: 'Positive',
      percentTotal: '6.72',
    },
    {
      symbol: 'GOOGL',
      description: 'Alphabet Inc.',
      quantity: '31.723',
      value: 'USD 159.86',
      gainLoss: '-0.88',
      gainLossPercent: '0.55',
      isPositive: false,
      newsVolume: 'High',
      sentiment: 'Negative',
      percentTotal: '6.30',
    },
    {
      symbol: 'MDSO',
      description: 'Medidata Solutions',
      quantity: '6.955',
      value: 'USD 67.60',
      gainLoss: '+1.28',
      gainLossPercent: '1.89',
      isPositive: true,
      newsVolume: 'Medium',
      sentiment: 'Positive',
      percentTotal: '2.97',
    },
    {
      symbol: 'UBS',
      description: 'UBS Group AG',
      quantity: '5.269',
      value: 'USD 12.98',
      gainLoss: '+0.20',
      gainLossPercent: '1.52',
      isPositive: true,
      newsVolume: 'High',
      sentiment: 'Positive',
      percentTotal: '2.16',
    },
    {
      symbol: 'ZG',
      description: 'Zillow Group, Inc.',
      quantity: '7.128',
      value: 'USD 32.46',
      gainLoss: '-0.39',
      gainLossPercent: '1.20',
      isPositive: false,
      newsVolume: 'Low',
      sentiment: 'Neutral',
      percentTotal: '1.62',
    },
  ];

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Top Holdings</h2>
      </div>

      {/* Holdings Tabs */}
      <div className="flex space-x-6 text-sm">
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

      {/* Holdings Table */}
      <table className="w-full text-sm mt-4">
        <thead>
          <tr className="text-left text-xs text-gray-500 font-semibold border-b-2 border-gray-200">
            <th className="py-2 font-medium">Symbol</th>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 font-medium text-right">Quantity</th>
            <th className="py-2 font-medium text-right">Value</th>
            <th className="py-2 font-medium text-right">G/L</th>
            <th className="py-2 font-medium text-right">(%) G/L</th>
            <th className="py-2 font-medium text-right">News Volume</th>
            <th className="py-2 font-medium text-right">Sentiment</th>
            <th className="py-2 font-medium text-right">% Total</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.symbol}>
              <td className="py-4">
                <div className="inline-flex items-center justify-center h-8 w-16 rounded bg-gray-200 text-gray-800 text-sm font-semibold">
                  {holding.symbol}
                </div>
              </td>
              <td className="py-4">{holding.description}</td>
              <td className="py-4 text-right">{holding.quantity}</td>
              <td className="py-4 text-right">{holding.value}</td>
              <td className="py-4 text-right">
                <span
                  className={`text-sm font-medium ${
                    holding.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {holding.gainLoss}
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
                  {holding.gainLossPercent}%
                </span>
              </td>
              <td className="py-4 text-right">{holding.newsVolume}</td>
              <td className="py-4 text-right">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                    holding.sentiment === 'Positive'
                      ? 'bg-green-100 text-green-800'
                      : holding.sentiment === 'Negative'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {holding.sentiment}
                </span>
              </td>
              <td className="py-4 text-right">{holding.percentTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-center mt-4">
        <a href="#" className="text-sm font-semibold text-blue-600 hover:underline">
          VIEW ALL HOLDINGS
        </a>
      </div>
    </div>
  );
};

export default TopHoldingsTable;
