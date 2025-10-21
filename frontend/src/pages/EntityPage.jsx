// src/pages/EntityPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import Sidebar from '../components/layout/Sidebar';
import PerformanceView from '../features/entity/components/PerformanceView/PerformanceView';
import { usePriceData } from '../features/entity/hooks/usePriceData';
import { useNewsData } from '../features/entity/hooks/useNewsData';
import { useDailySentiment } from '../features/entity/hooks/useDailySentiment';
import { useSignificantEvents } from '../features/entity/hooks/useSignificantEvents';
import { DEFAULT_TICKER } from '../features/shared/utils/constants';
import { useWatchlist } from '../hooks/useWatchlist';
import { formatPrice, getPriceChangeColor, getPriceChangeArrow } from '../features/shared/utils/formatters';
import { calculatePriceChange } from '../features/shared/utils/chartHelpers';

const EntityPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ticker, setTicker] = useState(searchParams.get('ticker') || DEFAULT_TICKER);
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Watchlist functionality
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();
  const isFollowing = isInWatchlist(ticker);

  const handleFollowClick = () => {
    if (isFollowing) {
      removeFromWatchlist(ticker);
    } else {
      addToWatchlist(ticker, companyName);
    }
  };

  // Session management
  useEffect(() => {
    const user = searchParams.get('user');
    if (user) {
      sessionStorage.setItem('user', user);
    } else if (!sessionStorage.getItem('user')) {
      navigate('/login');
    }
  }, [navigate, searchParams]);

  // Update ticker from URL parameter
  useEffect(() => {
    const tickerParam = searchParams.get('ticker');
    if (tickerParam) {
      setTicker(tickerParam.toUpperCase().trim());
    }
  }, [searchParams]);

  // Logout handler
  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    if (confirmLogout) {
      sessionStorage.removeItem('user');
      navigate('/login');
    }
  };

  // Ticker selection handler
  const handleTickerSelect = (symbol) => {
    const newTicker = symbol.toUpperCase().trim();
    setTicker(newTicker);
    setSearchParams({ ticker: newTicker });
    setActiveSubTab('overview');
  };

  // Sub-navigation items
const subNavItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'news', label: 'News' },
  { id: 'events', label: 'Events' },
];

  // Fetch all data using custom hooks
  const { priceData1Y, companyName, currency, lastFetched } = usePriceData(ticker);
  const { news, sentiment } = useNewsData(ticker);
  const { dailySentiment } = useDailySentiment(ticker);
  const { significantEvents } = useSignificantEvents(ticker);

  // Calculate current price and changes for header
  const chartData = priceData1Y?.map((point, i) => ({
    x: i,
    y: parseFloat(point.close) || parseFloat(point.price) || 0,
    date: point.date,
    time: point.time
  })) || [];

  const { priceChange, priceChangePercent } = calculatePriceChange(chartData);
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Header */}
      <AppHeader
        activeTab="entity"
        onLogout={handleLogout}
        onTickerSelect={handleTickerSelect}
        showEntitySearch={true}
      />

      {/* Dashboard Layout: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          currentTicker={ticker}
          onTickerSelect={handleTickerSelect}
          watchlist={watchlist}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-white">
          {/* Company Header - Bloomberg Style */}
          <div className="border-b border-gray-200 px-6 py-4">
            {/* Company Name Row */}
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl font-bold text-gray-900">
                {companyName || ticker}
              </h1>
              <button 
                onClick={handleFollowClick}
                className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                  isFollowing 
                    ? 'bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200' 
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                {isFollowing ? '✓ Following' : '+ Follow'}
              </button>
            </div>

            {/* Ticker and Exchange Info */}
            <p className="text-sm text-gray-600 mb-4">
              {ticker}:{currency} · Nasdaq GS (USD) · Market closed
            </p>

            {/* Large Price Display */}
            <div className="flex items-baseline gap-3 mb-2">
              <div className="text-5xl font-bold text-gray-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {currentPrice ? formatPrice(currentPrice.y, currency) : '--'}
              </div>
              <div className={`flex items-center gap-2 text-xl font-semibold ${getPriceChangeColor(priceChange)}`}>
                <span>{getPriceChangeArrow(priceChange)}</span>
                <span>{Math.abs(priceChange).toFixed(2)}</span>
                <span className="text-lg">
                  {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Timestamp */}
            <p className="text-sm text-gray-500 italic">
              As of {currentPrice?.date ? new Date(currentPrice.date).toLocaleString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true,
                timeZoneName: 'short',
                month: 'numeric',
                day: 'numeric',
                year: '2-digit'
              }) : 'Loading...'}
            </p>
          </div>

          {/* Sub Navigation */}
          <nav className="bg-white border-b border-gray-200 px-6">
            <div className="flex space-x-8">
              {subNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSubTab(item.id)}
                  className={`py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeSubTab === item.id
                      ? 'text-gray-900 border-gray-900'
                      : 'text-gray-600 hover:text-gray-900 border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content Area */}
          <div className="p-6">
            <PerformanceView
              ticker={ticker}
              companyName={companyName}
              currency={currency}
              priceData1Y={priceData1Y}
              lastFetched={lastFetched}
              dailySentiment={dailySentiment}
              sentiment={sentiment}
              news={news}
              significantEvents={significantEvents}
              activeTab={activeSubTab}
              setActiveTab={setActiveSubTab}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default EntityPage;