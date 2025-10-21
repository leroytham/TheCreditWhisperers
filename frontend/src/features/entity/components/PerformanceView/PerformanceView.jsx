// src/features/entity/components/PerformanceView/PerformanceView.jsx

import React, { useState, useEffect } from 'react';
import { PriceChart, SentimentChart, OverallSentiment, SignificantEvents, RelatedNews } from '../../../shared/components';
import { TIMEFRAMES } from '../../../shared/utils/constants';
import { filterPriceDataByTimeframe } from '../../../shared/utils/chartHelpers';
import { formatDateTime, formatPrice, getPriceChangeColor, getPriceChangeArrow, formatFullTimestamp } from '../../../shared/utils/formatters';
import { calculatePriceChange } from '../../../shared/utils/chartHelpers';

/**
 * PerformanceView Component
 *
 * Main performance display container with charts and controls
 */

const PerformanceView = ({
  ticker,
  companyName,
  currency,
  priceData1Y,
  dailySentiment,
  sentiment,
  news,
  significantEvents,
  activeTab = 'overview',
  setActiveTab,
}) => {
  const [timeframe, setTimeframe] = useState('1Y');
  const [priceData, setPriceData] = useState([]);

  // Filter price data based on timeframe
  useEffect(() => {
    const filtered = filterPriceDataByTimeframe(priceData1Y, timeframe);
    setPriceData(filtered);
  }, [priceData1Y, timeframe]);
  
  // Create chart data from price data
  const chartData = priceData.map((point, i) => ({
    x: i,
    y: parseFloat(point.close) || parseFloat(point.price) || 0,
    date: point.date,
    time: point.time
  }));

  // Calculate price changes
  const { priceChange, priceChangePercent } = calculatePriceChange(chartData);

  // Get current price object (includes y, date, time)
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // Check if data is loading
  const isLoading = !priceData1Y || priceData1Y.length === 0;

  // Render content based on active tab
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <div className="text-lg font-medium text-gray-700">Loading entity data...</div>
            <div className="text-sm text-gray-500 mt-2">Please wait while we fetch the latest information</div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* Combined Grid: Top & Middle Rows */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8" style={{ gridTemplateRows: 'auto 1fr' }}>
              {/* Price Summary Card - Row 1, Col 1 */}
              <div className="bg-white border border-gray-200 rounded-lg shadow p-6 lg:col-start-1 lg:row-start-1 h-full">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Current Price</h3>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {currentPrice ? formatPrice(currentPrice.y, currency) : '--'}
                </div>
                <div className={`text-sm font-medium ${getPriceChangeColor(priceChange)}`}>
                  {getPriceChangeArrow(priceChange)} {Math.abs(priceChange).toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  As of {currentPrice ? formatFullTimestamp(currentPrice.date) : 'Loading...'}
                </p>
              </div>

              {/* Overall Sentiment Card - Row 1, Col 2 */}
              <div className="lg:col-start-2 lg:row-start-1 h-full">
                <OverallSentiment
                  sentiment={sentiment}
                  newsCount={news?.length || 0}
                  className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full"
                />
              </div>

              {/* Significant Events - Spans 2 rows, Col 3 */}
              <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2 h-full">
                <SignificantEvents
                  events={significantEvents}
                  ticker={ticker}
                  className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full flex flex-col"
                />
              </div>

              {/* Price Chart - Row 2, Spans 2 columns */}
              <div className="lg:col-start-1 lg:col-span-2 lg:row-start-2 bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Price Performance</h3>
                  <div className="flex space-x-1">
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
                <PriceChart
                  priceData={priceData}
                  ticker={ticker}
                  currency={currency}
                  significantEvents={significantEvents}
                />
              </div>
            </div>

            {/* Bottom Row: [News - Full Width] */}
            <div className="mb-8">
              <RelatedNews
                news={news}
                displayName={companyName}
                loading={!news}
                error={null}
                isOverview={true}
                onViewMore={() => setActiveTab('news')}
              />
            </div>
          </>
        );

      case 'performance':
        return (
          <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Detailed Performance Analysis</h3>
              <div className="flex space-x-1">
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
            <PriceChart
              priceData={priceData}
              ticker={ticker}
              currency={currency}
              significantEvents={significantEvents}
            />
          </div>
        );

      case 'sentiment':
        return (
          <div className="space-y-8">
            <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
              <SentimentChart dailySentiment={dailySentiment} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <OverallSentiment sentiment={sentiment} newsCount={news?.length || 0} />
              <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Sentiment Analysis</h3>
                <p className="text-gray-600">Detailed sentiment breakdown and trends will appear here.</p>
              </div>
            </div>
          </div>
        );

      case 'news':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <RelatedNews
                news={news}
                displayName={companyName}
                loading={!news}
                error={null}
                isOverview={false}
            />
          </div>
        );

      case 'events':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <SignificantEvents events={significantEvents} ticker={ticker} />
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Event Timeline</h3>
              <p className="text-gray-600">Detailed event timeline visualization coming soon...</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Tab Content */}
      {renderContent()}
    </div>
  );
};

export default PerformanceView;
