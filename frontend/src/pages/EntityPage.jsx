import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EntityHeader from '../features/entity/components/EntityHeader/EntityHeader';
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
  const [searchParams] = useSearchParams();
  const [ticker, setTicker] = useState(DEFAULT_TICKER);

  // Session management
  useEffect(() => {
    const user = searchParams.get('user');
    if (user) {
      sessionStorage.setItem('user', user);
    } else if (!sessionStorage.getItem('user')) {
      navigate('/login');
    }
  }, [navigate, searchParams]);

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
    setTicker(symbol.toUpperCase().trim());
  };

  // Fetch all data using custom hooks
  const { priceData1Y, companyName, currency, lastFetched } = usePriceData(ticker);
  const { news, sentiment } = useNewsData(ticker);
  const { dailySentiment } = useDailySentiment(ticker);
  const { significantEvents } = useSignificantEvents(ticker);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <EntityHeader onLogout={handleLogout} onTickerSelect={handleTickerSelect} />

      <div className="flex">
        {/* Main Content */}
        <div className="w-2/3 p-6">
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
          />
        </div>

        {/* Right Sidebar - Significant Events & Related News */}
        <div className="w-1/3 p-6 space-y-6">
          <SignificantEvents events={significantEvents} ticker={ticker} />
          <RelatedNews news={news} ticker={ticker} />
        </div>
      </div>
    </div>
  );
};

export default EntityPage;
