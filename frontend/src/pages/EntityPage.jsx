import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/layout/AppHeader';
import PerformanceView from '../features/entity/components/PerformanceView/PerformanceView';
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
 *   - EntityHeader/: Top navigation bar
 *   - EntitySearch/: Ticker search with autocomplete
 *   - PerformanceView/: Charts and metrics display container
 *   - PriceChart/: Interactive price chart
 *   - SentimentChart/: Daily sentiment bar chart
 *   - OverallSentiment/: Sentiment summary metrics
 *   - SignificantEvents/: Event list sidebar
 *   - RelatedNews/: News feed sidebar
 */
const EntityPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ticker, setTicker] = useState(searchParams.get('ticker') || DEFAULT_TICKER);
  const [activeSubTab, setActiveSubTab] = useState('overview');

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
  ];

  // Fetch all data using custom hooks
  const { priceData1Y, companyName, currency, lastFetched } = usePriceData(ticker);
  const { news, sentiment } = useNewsData(ticker);
  const { dailySentiment } = useDailySentiment(ticker);
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
        <section className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {companyName || ticker}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {companyName && ticker !== companyName ? ticker : `${currency} Currency`}
            </p>
          </div>
        </section>

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
        />
      </main>
    </div>
  );
};

export default EntityPage;
