import React from 'react';
import {
  PriceChart,
  SentimentScoreCard,
  SignificantEvents,
  RelatedNews
} from '../../../../shared/components';
import { TIMEFRAMES } from '../../../../shared/utils/constants';
import { formatPrice, getPriceChangeColor, getPriceChangeArrow, formatFullTimestamp } from '../../../../shared/utils/formatters';
import type { NewsArticle, SignificantEvent, TimeframeOption } from '../../../../../types';

interface DisplayEvent {
  start_date: string;
  trend: string;
  total_move_pct?: number;
  link?: string;
  url?: string;
  news?: NewsArticle[];
  title?: string;
  description?: string;
}

interface CurrentPrice {
  x: number;
  y: number;
  date: string;
  time?: string;
  isRealtime?: boolean;
  isEstimate?: boolean;
}

interface SentimentData {
  avg_score?: number;
  sentiment_momentum?: number;
  fast_score?: number;
  slow_score?: number;
  data_quality?: string;
}

interface OverviewTabProps {
  // Price data
  priceData: any[];
  currentPrice: CurrentPrice | null;
  priceChange: number;
  priceChangePercent: number | null;
  currency: string;
  exchange: string;

  // Ticker/company info
  ticker: string;
  companyName: string;

  // Error states
  hasPrice1DError: boolean;
  hasPrice1YError: boolean;

  // Sentiment
  sentiment: SentimentData | null;
  news: NewsArticle[];
  newsLoading: boolean;
  newsError: string | null;

  // Events
  significantEvents: SignificantEvent[] | null;
  significantEventsLoading: boolean;
  significantEventsError: string | null;
  showSignificantEvents: boolean;
  setShowSignificantEvents: (show: boolean) => void;
  selectedEventDate: string | null;
  handleEventClick: (event: DisplayEvent) => void;

  // Timeframe
  timeframe: TimeframeOption | string;
  setTimeframe: (tf: TimeframeOption | string) => void;
  activePrevClose: number | null;

  // Navigation
  setActiveTab?: (tab: string) => void;

  // Map function
  mapToDisplayEvents: (events: SignificantEvent[] | null) => DisplayEvent[];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  priceData,
  currentPrice,
  priceChange,
  priceChangePercent,
  currency,
  exchange,
  ticker,
  companyName,
  hasPrice1DError,
  hasPrice1YError,
  sentiment,
  news,
  newsLoading,
  newsError,
  significantEvents,
  significantEventsLoading,
  significantEventsError,
  showSignificantEvents,
  setShowSignificantEvents,
  selectedEventDate,
  handleEventClick,
  timeframe,
  setTimeframe,
  activePrevClose,
  setActiveTab,
  mapToDisplayEvents
}) => {
  return (
    <>
      {/* Warning banners for partial price data failures */}
      {hasPrice1DError && !hasPrice1YError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Real-time intraday data is temporarily unavailable. Current price shown from latest historical close.
              </p>
            </div>
          </div>
        </div>
      )}
      {hasPrice1YError && !hasPrice1DError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Historical price data is temporarily unavailable. Only intraday view is available.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Combined Grid: Top & Middle Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8" style={{ gridTemplateRows: 'auto 1fr' }}>
        {/* Price Summary Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow p-6 lg:col-start-1 lg:row-start-1 h-full">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Current Price</h3>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-gray-900">
              {currentPrice ? formatPrice(currentPrice.y, currency) : '--'}
            </span>
            {currentPrice?.isEstimate && (
              <span className="text-xs text-gray-500 font-normal">(est.)</span>
            )}
            <span className="text-lg font-medium text-gray-500">{currency}</span>
          </div>
          <div className={`text-sm font-medium ${getPriceChangeColor(priceChange)}`}>
            {getPriceChangeArrow(priceChange)} {Math.abs(priceChange).toFixed(2)} ({priceChangePercent != null && priceChangePercent >= 0 ? '+' : ''}{priceChangePercent?.toFixed(2) ?? '0.00'}%)
          </div>
          <p className="text-xs text-gray-500 mt-2">
            As of {currentPrice ? formatFullTimestamp(currentPrice.date) : 'Loading...'}
          </p>
        </div>

        {/* Sentiment Score Card */}
        <div className="lg:col-start-2 lg:row-start-1 h-full">
          <SentimentScoreCard
            sentiment={sentiment}
            newsCount={news?.length || 0}
            dataQuality={sentiment?.data_quality}
            className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full"
          />
        </div>

        {/* Significant Events */}
        <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2 h-full">
          <SignificantEvents
            events={significantEvents ?? undefined}
            loading={significantEventsLoading}
            error={significantEventsError}
            ticker={ticker}
            className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full flex flex-col"
            selectedEventDate={selectedEventDate ?? undefined}
          />
        </div>

        {/* Price Chart */}
        <div className="lg:col-start-1 lg:col-span-2 lg:row-start-2 bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Price Performance</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              {/* Events Toggle Switch - Bloomberg style */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Events</span>
                <button
                  onClick={() => setShowSignificantEvents(!showSignificantEvents)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
                    showSignificantEvents ? 'bg-gray-900' : 'bg-gray-300'
                  }`}
                  role="switch"
                  aria-checked={showSignificantEvents}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showSignificantEvents ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Timeframe Buttons */}
              <div className="flex flex-wrap gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded text-sm ${
                      timeframe === tf
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <PriceChart
            priceData={priceData}
            ticker={ticker}
            currency={currency}
            exchange={exchange}
            significantEvents={showSignificantEvents ? mapToDisplayEvents(significantEvents) : []}
            timeframe={timeframe}
            prevClose={activePrevClose}
            onEventClick={handleEventClick}
          />
        </div>
      </div>

      {/* Bottom Row: News - Full Width */}
      <div className="mb-8">
        <RelatedNews
          news={news}
          displayName={companyName}
          loading={newsLoading}
          error={newsError}
          isOverview={true}
          onViewMore={setActiveTab ? () => setActiveTab('news') : undefined}
        />
      </div>
    </>
  );
};

export default OverviewTab;
