// src/pages/EntityPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import PerformanceView from '../features/entity/components/PerformanceView/PerformanceView';
import EarningsTranscript from '../features/entity/components/EarningsTranscript';
import { SignificantEvents, RelatedNews } from '../features/shared/components';
import { usePriceData } from '../features/entity/hooks/usePriceData';
import { useNewsData } from '../features/entity/hooks/useNewsData';
import { useDailySentiment } from '../features/entity/hooks/useDailySentiment';
import { useSignificantEvents } from '../features/entity/hooks/useSignificantEvents';
import { DEFAULT_TICKER } from '../features/shared/utils/constants';

/**
 * EntityPage - Main entity analysis page
 *
 * This file has been refactored from a monolithic 845-line file into a modular,
 * entity-based architecture for better maintainability and scalability.
 *
 * New directory structure:
 * - features/entity/config/: Constants and configuration
 * - features/entity/utils/: Chart helpers, timeframe filters, formatters
 * - features/entity/hooks/: Data fetching hooks (usePriceData, useNewsData, useDailySentiment, useSignificantEvents, useTickerSearch)
 * - features/entity/components/: UI components organized by feature
 * - EntityHeader/: Top navigation bar
 * - EntitySearch/: Ticker search with autocomplete
 * - PerformanceView/: Charts and metrics display container
 * - PriceChart/: Interactive price chart
 * - SentimentChart/: Daily sentiment bar chart
 * - OverallSentiment/: Sentiment summary metrics
 * - SignificantEvents/: Event list sidebar
 * - RelatedNews/: News feed sidebar
 */
const EntityPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ticker, setTicker] = useState(searchParams.get('ticker') || DEFAULT_TICKER);
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [sentimentTimeframe, setSentimentTimeframe] = useState('1W');

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
    setActiveSubTab('overview'); // Reset to overview when ticker changes
  };

  // Sub-navigation items
  const subNavItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'performance', label: 'Performance' },
    { id: 'sentiment', label: 'Sentiment' },
    { id: 'news', label: 'News' },
    { id: 'events', label: 'Events' },
    { id: 'earnings', label: 'Earnings' },
  ];

  // Fetch all data using custom hooks
  const { priceData1Y, companyName, currency, lastFetched, exchange, market, marketState, prevClose } = usePriceData(ticker, '1Y');

  // Fetch real-time 1D data for current price display
  const { priceData1Y: priceData1D, prevClose: prevClose1D } = usePriceData(ticker, '1D');

  const { news, sentiment } = useNewsData(ticker);
  const { dailySentiment } = useDailySentiment(ticker, sentimentTimeframe);
  const { significantEvents } = useSignificantEvents(ticker);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AppHeader
        activeTab="entity"
        onLogout={handleLogout}
        onTickerSelect={handleTickerSelect}
        showEntitySearch={true}
      />

      {/* Sub Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {subNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`py-3 px-1 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeSubTab === item.id
                    ? 'border-gray-900 text-gray-900 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-4 sm:p-6 lg:p-8">
        {/* Page Header */}
        <section className="py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {companyName || `${ticker} - Company Name Not Available`}
            </h1>
            <div className="mt-1 flex items-center space-x-2 text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{ticker}</span>
              {exchange && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{exchange}</span>
                </>
              )}
              {marketState && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    marketState === 'REGULAR' 
                      ? 'bg-green-100 text-green-800' 
                      : marketState === 'CLOSED'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {marketState === 'REGULAR' ? 'Market Open' : 
                     marketState === 'CLOSED' ? 'Market Closed' :
                     marketState === 'PRE' || marketState === 'PREPRE' ? 'Pre-Market' :
                     marketState === 'POST' || marketState === 'POSTPOST' ? 'After Hours' : marketState}
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Conditional Content Based on Active Tab */}
        {activeSubTab === 'earnings' ? (
          <EarningsTranscript ticker={ticker} />
        ) : (
          <PerformanceView
            ticker={ticker}
            companyName={companyName}
            currency={currency}
            exchange={exchange}
            priceData1Y={priceData1Y}
            priceData1D={priceData1D}
            lastFetched={lastFetched}
            dailySentiment={dailySentiment}
            sentiment={sentiment}
            news={news}
            significantEvents={significantEvents}
            prevClose={prevClose}
            prevClose1D={prevClose1D}
            activeTab={activeSubTab}
            setActiveTab={setActiveSubTab}
            sentimentTimeframe={sentimentTimeframe}
            setSentimentTimeframe={setSentimentTimeframe}
          />
        )}
      </main>
    </div>
  );
};

export default EntityPage;