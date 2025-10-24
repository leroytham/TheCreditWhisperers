// src/features/sector/components/PerformanceView/PerformanceView.jsx

import React, { useState } from 'react';
import { resolveSectorTicker } from '../../utils/tickerResolver';
import { useSectorData } from '../../hooks/useSectorData';
import { usePriceData } from '../../hooks/usePriceData';
import { useRollingSentiment } from '../../../entity/hooks/useRollingSentiment';
import { TIMEFRAMES } from '../../../shared/utils/constants';
import { PriceChart, CombinedSentimentVolumeChart, TimeRangeSelector, ViewModeToggle, EventsToggle, SignificantEvents, RelatedNews, OverallSentiment } from '../../../shared/components';
import { formatFullTimestamp } from '../../../shared/utils/formatters';
import PerformanceHeader from './PerformanceHeader';
import TopConstituents from './TopConstituents';

/**
 * PerformanceView component - orchestrates the sector performance dashboard
 */
const PerformanceView = ({ context, onBack, activeTab = 'overview', setActiveTab }) => {
  const countryCode = context?.countryCode || '';
  const countryName = context?.countryName || '';
  const sector = context?.sector || null;
  const sectorName = sector?.name || '';
  const indexName = sector?.index || '';

  const [timeframe, setTimeframe] = useState('1M');
  const [showEvents, setShowEvents] = useState(true);
  const [sentimentTimeframe, setSentimentTimeframe] = useState('1W');
  const [viewMode, setViewMode] = useState('rolling');

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
    error,
    lastFetched
  } = useSectorData(ticker, timeframe);

  // Fetch rolling sentiment data for the combined chart
  const { data: rollingData, hasData: hasRollingData, sourceEarliestDates } = useRollingSentiment(ticker, sentimentTimeframe);

  // Map sentiment timeframe to days for existing charts
  const getDaysToShow = (tf) => {
    const map = { '1W': 7, '1M': 30 };
    return map[tf] || 7;
  };

  // Process price data based on timeframe
  const {
    chartData,
    priceRange,
    priceChange,
    priceChangePercent,
    currentPrice
  } = usePriceData(priceData1Y, timeframe);

  // Render content based on active tab
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <div className="text-lg font-medium text-gray-700">Loading performance data...</div>
            <div className="text-sm text-gray-500 mt-2">Please wait while we fetch the latest information</div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-md">
            <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Data</h3>
            <p className="text-sm text-gray-600 mb-4">
              {error || 'An error occurred while fetching sector performance data. Please try again later.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Reload Page
            </button>
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
                  {currentPrice ? `${currency} ${currentPrice.toFixed(2)}` : '--'}
                </div>
                <div className={`text-sm font-medium ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  As of {lastFetched ? formatFullTimestamp(lastFetched) : 'Loading...'}
                </p>
              </div>

              {/* Overall Sentiment Card - Row 1, Col 2 */}
              <div className="lg:col-start-2 lg:row-start-1 h-full">
                <OverallSentiment
                  sentimentAvg={sentimentAvg}
                  newsCount={news?.length || 0}
                  className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full"
                />
              </div>

              {/* Significant Events - Spans 2 rows, Col 3 */}
              <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2 h-full">
                <SignificantEvents
                  events={topEvents}
                  sectorName={sectorName}
                  className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full flex flex-col"
                />
              </div>

              {/* Price Chart - Row 2, Spans 2 columns */}
              <div className="lg:col-start-1 lg:col-span-2 lg:row-start-2 bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-gray-900">Price Performance</h3>
                    <EventsToggle
                      showEvents={showEvents}
                      onToggle={setShowEvents}
                    />
                  </div>
                  <div className="flex space-x-2">
                    {TIMEFRAMES.map(tf => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                          timeframe === tf
                            ? 'bg-gray-900 text-white rounded-md'
                            : 'text-gray-600 hover:text-gray-900 bg-transparent'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <PriceChart
                  chartData={chartData}
                  priceRange={priceRange}
                  priceChange={priceChange}
                  companyName={companyName}
                  ticker={ticker}
                  topEvents={topEvents}
                  showEvents={showEvents}
                  timeframe={timeframe}
                  prevClose={chartData.length > 1 ? chartData[chartData.length - 2]?.y : null}
                />
              </div>
            </div>

            {/* Bottom Row: [News - Full Width] */}
            <div className="mb-8">
              <RelatedNews
                news={news}
                displayName={companyName}
                error={error}
                isOverview={true}
                onViewMore={() => setActiveTab('news')}
              />
            </div>

            {/* Top Holdings Section - Full Width */}
            <TopConstituents constituents={topConstituents} sectorName={sectorName} />
          </>
        );

      case 'performance':
        return (
          <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold text-gray-900">Detailed Performance</h3>
                <EventsToggle
                  showEvents={showEvents}
                  onToggle={setShowEvents}
                />
              </div>
              <div className="flex space-x-2">
                {TIMEFRAMES.map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                      timeframe === tf
                        ? 'bg-gray-900 text-white rounded-md'
                        : 'text-gray-600 hover:text-gray-900 bg-transparent'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart
              chartData={chartData}
              priceRange={priceRange}
              priceChange={priceChange}
              companyName={companyName}
              ticker={ticker}
              topEvents={topEvents}
              showEvents={showEvents}
              timeframe={timeframe}
              prevClose={chartData.length > 1 ? chartData[chartData.length - 2]?.y : null}
            />
          </div>
        );

      case 'sentiment':
        return (
          <div className="space-y-8">
            {/* Time Range + View Mode Selectors */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Sentiment Analysis</h3>
              <div className="flex items-center space-x-4">
                <TimeRangeSelector
                  activeTimeframe={sentimentTimeframe}
                  onTimeframeChange={setSentimentTimeframe}
                />
                <ViewModeToggle
                  activeMode={viewMode}
                  onModeChange={setViewMode}
                />
              </div>
            </div>

            {/* Combined Sentiment + Volume Chart */}
            <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
              <CombinedSentimentVolumeChart
                data={viewMode === 'rolling' ? rollingData : Object.entries(dailySentiment).map(([date, data]) => ({
                  timestamp: date,
                  label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  volume: data.count || 0,
                  sentiment: data.score || 0,
                  headlines: data.headlines || []
                }))}
                timeframe={sentimentTimeframe}
                viewMode={viewMode}
                hasData={viewMode === 'rolling' ? hasRollingData : Object.keys(dailySentiment).length > 0}
                sourceEarliestDates={viewMode === 'rolling' ? sourceEarliestDates : null}
              />
            </div>

            {/* Bottom Row: Overall Sentiment + Key Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <OverallSentiment 
                sentimentAvg={sentimentAvg} 
                newsCount={news?.length || 0}
                className="bg-white border border-gray-200 rounded-lg shadow p-6 h-full"
              />
              <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Key Insights</h3>
                <p className="text-gray-600">
                  {viewMode === 'rolling'
                    ? 'Rolling 24-hour windows provide granular insight into how sentiment evolves over time for this sector.'
                    : 'Daily averages show overall sentiment trends across the selected time period for this sector.'}
                </p>
              </div>
            </div>
          </div>
        );

      case 'constituents':
        return <TopConstituents constituents={topConstituents} sectorName={sectorName} />;

      case 'news':
        return (
          <div className="grid grid-cols-1 gap-8">
            <RelatedNews
                news={news}
                displayName={companyName}
                error={error}
                isOverview={false}
            />
          </div>
        );

      case 'events':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <SignificantEvents events={topEvents} sectorName={sectorName} />
            <RelatedNews news={news} companyName={companyName} error={error} />
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
