// src/features/entity/components/PerformanceView/PerformanceView.jsx

import React, { useState, useEffect } from 'react';
import { PriceChart, SentimentChart, OverallSentiment, SignificantEvents, RelatedNews } from '../../../shared/components';
import { TIMEFRAMES } from '../../../shared/utils/constants';
import { filterPriceDataByTimeframe } from '../../../shared/utils/chartHelpers';
import { formatDateTime, formatPrice, getPriceChangeColor, getPriceChangeArrow, formatFullTimestamp } from '../../../shared/utils/formatters';
import { calculatePriceChange } from '../../../shared/utils/chartHelpers';

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
            {/* Timeframe Selector - Bloomberg Style */}
            <div className="flex items-center gap-4 pb-4 mb-6 border-b border-gray-200">
              <div className="flex gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                      timeframe === tf
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">News</span>
                <label className="relative inline-block w-12 h-6">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-12 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
              <button className="ml-auto flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add a comparison
              </button>
            </div>

            {/* Combined Grid: Chart + Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Significant Events - Sidebar on the right */}
              <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2 h-full">
                <SignificantEvents
                  events={significantEvents}
                  ticker={ticker}
                  className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full flex flex-col"
                />
              </div>

              {/* Price Chart - Takes 2 columns */}
              <div className="lg:col-start-1 lg:col-span-2 lg:row-start-1 bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
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

              {/* Overview Section - Condensed to fit below chart */}
              <div className="lg:col-start-1 lg:col-span-2 lg:row-start-2 bg-white pt-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
                
                {/* Metrics Grid - Condensed */}
                <div className="grid grid-cols-3 gap-x-12 gap-y-4">
                  {/* Row 1 */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">OPEN</div>
                    <div className="text-xl font-normal text-gray-900">
                      {priceData.length > 0 && priceData[0].open 
                        ? parseFloat(priceData[0].open).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : currentPrice 
                          ? parseFloat(currentPrice.y).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '—'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">VOLUME</div>
                    <div className="text-xl font-normal text-gray-900">
                      {priceData.length > 0 && priceData[priceData.length - 1].volume
                        ? parseFloat(priceData[priceData.length - 1].volume).toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : '—'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">DAY RANGE</div>
                    <div className="text-xl font-normal text-gray-900">
                      {priceData.length > 0 
                        ? (() => {
                            const todayData = priceData.filter(p => p.date === currentPrice?.date);
                            if (todayData.length > 0) {
                              const low = Math.min(...todayData.map(p => parseFloat(p.low || p.price || p.close)));
                              const high = Math.max(...todayData.map(p => parseFloat(p.high || p.price || p.close)));
                              return `${low.toFixed(2)} – ${high.toFixed(2)}`;
                            }
                            return '—';
                          })()
                        : '—'}
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">PREV. CLOSE</div>
                    <div className="text-xl font-normal text-gray-900">
                      {priceData.length > 1
                        ? parseFloat(priceData[priceData.length - 2].close || priceData[priceData.length - 2].price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '—'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">MARKET CAP</div>
                    <div className="text-xl font-normal text-gray-900">
                      {priceData.length > 0 && priceData[priceData.length - 1].market_cap
                        ? (() => {
                            const cap = parseFloat(priceData[priceData.length - 1].market_cap);
                            if (cap >= 1e12) return `${(cap / 1e12).toFixed(3)}T`;
                            if (cap >= 1e9) return `${(cap / 1e9).toFixed(2)}B`;
                            if (cap >= 1e6) return `${(cap / 1e6).toFixed(2)}M`;
                            return cap.toLocaleString();
                          })()
                        : '—'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">52 WEEK RANGE</div>
                    <div className="text-xl font-normal text-gray-900">
                      {priceData1Y && priceData1Y.length > 0
                        ? (() => {
                            const prices = priceData1Y.map(p => parseFloat(p.close || p.price || p.low || 0));
                            const low = Math.min(...prices.filter(p => p > 0));
                            const high = Math.max(...prices);
                            return `${low.toFixed(2)} – ${high.toFixed(2)}`;
                          })()
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Statistics Section - Condensed to Match Overview */}
<div className="bg-white pt-4 mb-8">
  <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Statistics</h2>
  
  <div className="grid grid-cols-2 gap-x-16 gap-y-4">
    {/* Left Column */}
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">P/E RATIO</div>
        <div className="text-xl font-normal text-gray-900">—</div>
      </div>
      
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">SHARES OUTSTANDING</div>
        <div className="text-xl font-normal text-gray-900">—</div>
      </div>
      
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">PRICE TO SALES RATIO</div>
        <div className="text-xl font-normal text-gray-900">—</div>
      </div>
      
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">30 DAY AVG VOLUME</div>
        <div className="text-xl font-normal text-gray-900">—</div>
      </div>
      
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">DIVIDEND</div>
        <div className="text-xl font-normal text-gray-900">—</div>
      </div>
    </div>
    
    {/* Right Column */}
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">PEGY RATIO</div>
        <div className="text-xl font-normal text-gray-900">—</div>
      </div>
      
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">PRICE TO BOOK RATIO</div>
        <div className="text-xl font-normal text-gray-900">—</div>
      </div>
      
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">1 YEAR RETURN</div>
        <div className="text-xl font-normal text-gray-900">—</div>
      </div>
      
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">EPS</div>
        <div className="text-xl font-normal text-gray-900">—</div>
      </div>
      
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">LAST DIVIDEND REPORTED</div>
        <div className="text-xl font-normal text-gray-900">—</div>
      </div>
    </div>
  </div>
</div>

            {/* Related News - NOW AT THE BOTTOM */}
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

      case 'companyinfo':
        return (
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Company Info</h3>
            <p className="text-gray-600">Company information and details will appear here.</p>
          </div>
        );

      case 'financials':
        return (
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Financials</h3>
            <p className="text-gray-600">Financial data and statements will appear here.</p>
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