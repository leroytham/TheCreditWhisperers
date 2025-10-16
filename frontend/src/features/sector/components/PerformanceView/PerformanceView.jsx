import React, { useState } from 'react';
import { resolveSectorTicker } from '../../utils/tickerResolver';
import { useSectorData } from '../../hooks/useSectorData';
import { usePriceData } from '../../hooks/usePriceData';
import { useSentimentData } from '../../hooks/useSentimentData';
import { TIMEFRAMES } from '../../../shared/utils/constants';
import { PriceChart, SentimentChart, SignificantEvents, RelatedNews, OverallSentiment } from '../../../shared/components';
import PerformanceHeader from './PerformanceHeader';
import TopConstituents from './TopConstituents';

/**
 * PerformanceView component - orchestrates the sector performance dashboard
 */
const PerformanceView = ({ context, onBack }) => {
  const countryCode = context?.countryCode || '';
  const countryName = context?.countryName || '';
  const sector = context?.sector || null;
  const sectorName = sector?.name || '';
  const indexName = sector?.index || '';

  const [timeframe, setTimeframe] = useState('1M');
  const [showEvents, setShowEvents] = useState(true);

  // Resolve ticker
  const ticker = resolveSectorTicker(sector, countryCode);

  // Fetch all sector data
  const {
    priceData1Y,
    news,
    sentimentAvg,
    dailySentiment,
    topConstituents,
    topEvents,
    companyName,
    currency,
    loading,
    error
  } = useSectorData(ticker, timeframe);

  // Process price data based on timeframe
  const {
    chartData,
    priceRange,
    priceChange,
    priceChangePercent
  } = usePriceData(priceData1Y, timeframe);

  // Process sentiment data
  const { sentimentBars } = useSentimentData(dailySentiment, 7);

  // Current price from full dataset
  const currentPricePoint = priceData1Y && priceData1Y.length ? priceData1Y[priceData1Y.length - 1] : null;
  const displayPrice = currentPricePoint ? (currentPricePoint.close ?? currentPricePoint.price ?? null) : null;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-4">
      {/* Header */}
      <PerformanceHeader
        countryName={countryName}
        sectorName={sectorName}
        indexName={indexName}
        ticker={ticker}
        companyName={companyName}
        currentPrice={displayPrice}
        priceChange={priceChange}
        priceChangePercent={priceChangePercent}
        currency={currency}
        onBack={onBack}
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Price Chart Section */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <div>Loading performance data...</div>
              </div>
            </div>
          ) : (
            <>
              {/* Timeframe selector and controls */}
              <div className="flex items-center justify-between mb-4">
                {/* Left: timeframe buttons */}
                <div className="flex items-center space-x-2">
                  {TIMEFRAMES.map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2 py-1 text-sm rounded ${
                        timeframe === tf
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* Right: sentiment + toggle */}
                <div className="flex items-center space-x-4">
                  {/* Sentiment */}
                  {sentimentAvg !== null && (
                    <div
                      className={`text-sm font-medium ${
                        sentimentAvg >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      Avg Sentiment: {Number(sentimentAvg).toFixed(2)}
                    </div>
                  )}

                  {/* Major Events toggle */}
                  <div className="flex items-center space-x-2">
                    <label htmlFor="toggle-events" className="text-sm text-gray-600 select-none">
                      Major Events
                    </label>
                    <button
                      id="toggle-events"
                      onClick={() => setShowEvents(prev => !prev)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-200 ${
                        showEvents ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                          showEvents ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Price Chart */}
              <PriceChart
                chartData={chartData}
                priceRange={priceRange}
                priceChange={priceChange}
                companyName={companyName}
                ticker={ticker}
                topEvents={topEvents}
                showEvents={showEvents}
              />

              {/* Sentiment Chart */}
              <SentimentChart sentimentBars={sentimentBars} />
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="col-span-1 space-y-6">
          <SignificantEvents events={topEvents} sectorName={sectorName} />
          <RelatedNews news={news} companyName={companyName} error={error} />
          <OverallSentiment sentimentAvg={sentimentAvg} newsCount={news.length} />
        </div>

        {/* Top Constituents (full width) */}
        <TopConstituents constituents={topConstituents} sectorName={sectorName} />
      </div>
    </div>
  );
};

export default PerformanceView;
