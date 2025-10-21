// src/components/layout/Sidebar.jsx

import React, { useState } from 'react';
import { Search } from 'lucide-react';

const Sidebar = ({ currentTicker, onTickerSelect, watchlist = [] }) => {
  const [activeSection, setActiveSection] = useState('watchlist');

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Markets Data Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-900">Markets</h2>
        <p className="text-xs text-gray-500">Data</p>
      </div>

      {/* Search Box */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search for quotes"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
          />
        </div>
      </div>

      {/* Section Toggle */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveSection('watchlist')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${
            activeSection === 'watchlist'
              ? 'text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Watchlist ({watchlist.length})
        </button>
        <button
          onClick={() => setActiveSection('recent')}
          className={`flex-1 py-2 text-xs font-semibold transition-colors ${
            activeSection === 'recent'
              ? 'text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Recent
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'watchlist' ? (
          <div className="p-4">
            {watchlist.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-2">No stocks in watchlist</p>
                <p className="text-xs text-gray-400">Click "+ Follow" to add stocks</p>
              </div>
            ) : (
              <div className="space-y-2">
                {watchlist.map((item) => (
                  <button
                    key={item.ticker}
                    onClick={() => onTickerSelect(item.ticker)}
                    className={`w-full text-left p-2.5 rounded hover:bg-gray-50 transition-colors ${
                      currentTicker === item.ticker ? 'bg-gray-50 border border-gray-200' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-gray-900">{item.ticker}</div>
                        <div className="text-xs text-gray-600 truncate">{item.companyName}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Recently viewed stocks will appear here</p>
            </div>
          </div>
        )}
      </div>

      {/* View Your Watchlist */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <button className="w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center justify-between group">
          <span>Manage Watchlist</span>
          <span className="text-base group-hover:translate-x-0.5 transition-transform">→</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;