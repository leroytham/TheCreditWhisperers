// src/pages/EntityPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AppHeader from '../components/layout/AppHeader';
import apiService from '../services/api';
import PerformanceView from '../features/entity/components/PerformanceView/PerformanceView';
import EarningsTranscript from '../features/entity/components/EarningsTranscript';
import { usePriceData } from '../features/entity/hooks/usePriceData';
import { useNewsData } from '../features/entity/hooks/useNewsData';
import { useDailySentiment } from '../features/entity/hooks/useDailySentiment';
import { useSignificantEvents } from '../features/entity/hooks/useSignificantEvents';
import { DEFAULT_TICKER } from '../features/shared/utils/constants';
import useAppStore from '../store/useAppStore';

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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ticker, setTicker] = useState(searchParams.get('ticker') || DEFAULT_TICKER);
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [sentimentTimeframe, setSentimentTimeframe] = useState('1M');
  const [priceTimeframe, setPriceTimeframe] = useState('1D'); // Add price chart timeframe state
  const setUser = useAppStore((state) => state.setUser);
  const zustandLogout = useAppStore((state) => state.logout);

  // Session management - verify authentication via httpOnly cookie
  useEffect(() => {
    const user = searchParams.get('user');
    if (user) {
      setUser(user);  // Update Zustand store
    }

    // Verify authentication by calling /auth/me endpoint
    const checkAuth = async () => {
      try {
        const { default: apiService } = await import('../services/api');
        await apiService.get('/auth/me');
      } catch (error) {
        if (error.response?.status === 401 || error.message?.includes('Session expired')) {
          navigate('/login');
        }
      }
    };

    checkAuth();
  }, [navigate, searchParams, setUser]);

  // Update ticker from URL parameter
  useEffect(() => {
    const tickerParam = searchParams.get('ticker');
    if (tickerParam) {
      setTicker(tickerParam.toUpperCase().trim());
    }
  }, [searchParams]);

  // Logout handler - calls backend to clear httpOnly cookie
  const handleLogout = async () => {
    const confirmLogout = window.confirm('Are you sure you want to log out?');
    if (confirmLogout) {
      try {
        const { default: apiService } = await import('../services/api');
        await apiService.post('/auth/logout');
      } catch (error) {
        console.error('Logout API error:', error);
      }
      zustandLogout();  // Clears user, isAuthenticated, AND selectedAccount
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
    { id: 'earnings', label: 'Earnings' },
  ];

  // Fetch all data using custom hooks
  // With React Query caching, all hooks can be called unconditionally
  // Data persists in cache when switching tabs for instant loading
  const { priceData1Y, companyName, currency, lastFetched, exchange, market, marketState, prevClose, loading: priceLoading1Y, error: priceError1Y } = usePriceData(ticker, '1Y');

  // Fetch real-time 1D data for current price display
  const { priceData1Y: priceData1D, prevClose: prevClose1D, loading: priceLoading1D, error: priceError1D } = usePriceData(ticker, '1D');

  // Fetch all tab data unconditionally - React Query caches results
  const { news, sentiment, apiMetadata, loading: newsLoading, error: newsError } = useNewsData(ticker, '1Y');

  const { dailySentiment, loading: dailySentimentLoading, error: dailySentimentError } = useDailySentiment(
    ticker,
    sentimentTimeframe
  );

  const { significantEvents, loading: significantEventsLoading, error: significantEventsError } = useSignificantEvents(
    ticker,
    priceTimeframe
  );

  // Cache warming: Pre-fetch data for all tabs when Overview tab loads
  // This ensures instant tab switching with no loading spinners
  useEffect(() => {
    if (ticker && activeSubTab === 'overview') {
      // Already fetched by hooks above, but we can prefetch alternate timeframes
      // that users might switch to later

      // Prefetch daily sentiment data for common timeframes
      const sentimentTimeframes = ['1W', '3M', '6M', '1Y'].filter(tf => tf !== sentimentTimeframe);
      sentimentTimeframes.forEach(tf => {
        queryClient.prefetchQuery({
          queryKey: ['dailySentiment', ticker, tf],
          queryFn: async () => {
            try {
              const response = await apiService.getDailySentiment(ticker, tf);
              return response.data;
            } catch {
              return { daily: {} };
            }
          },
          staleTime: 5 * 60 * 1000,
        });
      });

      // Prefetch price data for alternate timeframes
      const priceTimeframes = ['1W', '1M', '3M', '6M', 'YTD', '1Y'].filter(tf => tf !== priceTimeframe);
      priceTimeframes.forEach(tf => {
        queryClient.prefetchQuery({
          queryKey: ['price', ticker, tf],
          queryFn: async () => {
            try {
              const response = await apiService.getPrice(ticker, tf);
              return response.data;
            } catch {
              return { prices: [] };
            }
          },
          staleTime: 5 * 60 * 1000,
        });
      });

      console.log(`[CACHE WARMING] Pre-fetching data for ${ticker}`);
    }
  }, [ticker, activeSubTab, sentimentTimeframe, priceTimeframe, queryClient]);

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
          {companyName ? (
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {companyName}
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
          ) : (
            <div className="animate-pulse">
              <div className="h-9 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-5 bg-gray-200 rounded w-40"></div>
            </div>
          )}
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
            priceLoading1Y={priceLoading1Y}
            priceError1Y={priceError1Y}
            priceLoading1D={priceLoading1D}
            priceError1D={priceError1D}
            lastFetched={lastFetched}
            dailySentiment={dailySentiment}
            dailySentimentLoading={dailySentimentLoading}
            dailySentimentError={dailySentimentError}
            sentiment={sentiment}
            news={news}
            newsLoading={newsLoading}
            newsError={newsError}
            apiMetadata={apiMetadata}
            significantEvents={significantEvents}
            significantEventsLoading={significantEventsLoading}
            significantEventsError={significantEventsError}
            prevClose={prevClose}
            prevClose1D={prevClose1D}
            activeTab={activeSubTab}
            setActiveTab={setActiveSubTab}
            sentimentTimeframe={sentimentTimeframe}
            setSentimentTimeframe={setSentimentTimeframe}
            priceTimeframe={priceTimeframe}
            setPriceTimeframe={setPriceTimeframe}
          />
        )}
      </main>
    </div>
  );
};

export default EntityPage;