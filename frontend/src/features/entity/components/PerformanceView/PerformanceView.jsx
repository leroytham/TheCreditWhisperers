// src/features/entity/components/PerformanceView/PerformanceView.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { 
  PriceChart, 
  CombinedSentimentVolumeChart, 
  TimeRangeSelector, 
  ViewModeToggle, 
  OverallSentiment, 
  SignificantEvents, 
  RelatedNews,
  SentimentMetricsCard,
  SentimentTrendSummary,
  SentimentSourceBreakdown
} from '../../../shared/components';
import { useRollingSentiment } from '../../hooks/useRollingSentiment';
import { useSourceReliability } from '../../hooks/useSourceReliability';
import { TIMEFRAMES } from '../../../shared/utils/constants';
import { filterPriceDataByTimeframe } from '../../../shared/utils/chartHelpers';
import { formatPrice, getPriceChangeColor, getPriceChangeArrow, formatFullTimestamp } from '../../../shared/utils/formatters';
import { calculatePriceChange } from '../../../shared/utils/chartHelpers';
import { usePriceData } from '../../hooks/usePriceData';
import {
  calculateMomentum,
  calculateDistribution,
  calculateVolatility,
  calculateOverallSentiment,
  generateSentimentInsights
} from '../../../shared/utils/sentimentAnalysis';

/**
 * PerformanceView Component
 *
 * Main performance display container with charts and controls
 */

const PerformanceView = ({
  ticker,
  companyName,
  currency,
  exchange,
  priceData1Y,
  priceData1D,
  dailySentiment,
  sentiment,
  news,
  significantEvents,
  prevClose: prevCloseFromParent,
  prevClose1D,
  activeTab = 'overview',
  setActiveTab,
  sentimentTimeframe,
  setSentimentTimeframe,
}) => {
  const [timeframe, setTimeframe] = useState('1Y');
  const [viewMode, setViewMode] = useState('rolling');
  const [priceData, setPriceData] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Fetch data based on selected timeframe (only for 5Y, since 1D comes from parent)
  const {
    priceData1Y: timeframeSpecificData,
    prevClose: timeframeSpecificPrevClose,
    loading: timeframeLoading,
    error: timeframeError
  } = usePriceData(ticker, timeframe === '5Y' ? '5Y' : '1Y');

  // Use timeframe-specific data if available, otherwise fall back to parent data
  const activePriceData = timeframe === '1D'
    ? priceData1D
    : timeframe === '5Y'
      ? timeframeSpecificData
      : priceData1Y;

  const activePrevClose = timeframe === '1D'
    ? prevClose1D
    : timeframe === '5Y'
      ? timeframeSpecificPrevClose
      : prevCloseFromParent;

  // Only show loading on initial page load, not on timeframe switches
  const isTimeframeSpecificLoading = isInitialLoad && timeframe === '5Y' && timeframeLoading;

  // Mark initial load as complete once we have data
  useEffect(() => {
    if (priceData1Y && priceData1Y.length > 0) {
      setIsInitialLoad(false);
    }
  }, [priceData1Y]);

  // Fetch rolling sentiment data for the combined chart
  const { data: rollingData, hasData: hasRollingData, sourceEarliestDates } = useRollingSentiment(ticker, sentimentTimeframe);

  // Fetch real source reliability data from backend
  const { sources: sourcesData, loading: sourcesLoading } = useSourceReliability(ticker);

  // Calculate sentiment metrics using useMemo for performance
  const metrics = useMemo(() => {
    // Determine which data source to use based on viewMode
    let sentimentData = [];
    
    if (viewMode === 'rolling') {
      // Use rolling data
      if (!rollingData || rollingData.length === 0) {
        return {
          overall: { label: 'Neutral', value: 0, color: 'gray', confidence: 0 },
          momentum: { value: 0, trend: 'stable', period: '7d' },
          distribution: { bullish: 20, somewhatBullish: 20, neutral: 20, somewhatBearish: 20, bearish: 20 },
          volatility: { level: 'Medium', score: 5 },
          insights: { 
            summary: 'Insufficient data for sentiment analysis', 
            keyPoints: ['Not enough sentiment data available'], 
            trend: 'NEUTRAL' 
          }
        };
      }
      
      // Transform rolling data
      sentimentData = rollingData.map(d => ({
        date: d.timestamp,
        sentiment: d.sentiment || 0,
        volume: d.volume || 0,
        headlines: d.headlines || []
      }));
    } else {
      // Use daily data
      if (!dailySentiment || Object.keys(dailySentiment).length === 0) {
        return {
          overall: { label: 'Neutral', value: 0, color: 'gray', confidence: 0 },
          momentum: { value: 0, trend: 'stable', period: '7d' },
          distribution: { bullish: 20, somewhatBullish: 20, neutral: 20, somewhatBearish: 20, bearish: 20 },
          volatility: { level: 'Medium', score: 5 },
          insights: { 
            summary: 'Insufficient data for sentiment analysis', 
            keyPoints: ['Not enough sentiment data available'], 
            trend: 'NEUTRAL' 
          }
        };
      }

      // Transform dailySentiment into array format for calculations
      sentimentData = Object.entries(dailySentiment).map(([date, data]) => ({
        date,
        sentiment: data.score || 0,
        volume: data.count || 0,
        headlines: data.headlines || []
      }));
    }

    // Calculate all metrics
    const overall = calculateOverallSentiment(sentimentData);
    const momentum = calculateMomentum(sentimentData, 7);
    const distribution = calculateDistribution(sentimentData);
    const volatility = calculateVolatility(sentimentData);
    const insights = generateSentimentInsights(overall, momentum, distribution, volatility);

    return { overall, momentum, distribution, volatility, insights };
  }, [dailySentiment, rollingData, viewMode]);

  // Map sentiment timeframe to days for existing charts
  const getDaysToShow = (tf) => {
    const map = { '1W': 7, '1M': 30 };
    return map[tf] || 7;
  };

  // Filter price data based on timeframe
  useEffect(() => {
    console.log('[PerformanceView] Timeframe changed:', timeframe);
    console.log('[PerformanceView] Active price data length:', activePriceData?.length);
    console.log('[PerformanceView] prevClose1D:', prevClose1D);
    console.log('[PerformanceView] prevCloseFromParent:', prevCloseFromParent);
    console.log('[PerformanceView] Active prevClose:', activePrevClose);
    console.log('[PerformanceView] Loading:', timeframeLoading);
    console.log('[PerformanceView] Error:', timeframeError);

    // Debug 5Y data
    if (timeframe === '5Y' && activePriceData && activePriceData.length > 0) {
      console.log('[PerformanceView] 5Y - First date in activePriceData:', activePriceData[0].date);
      console.log('[PerformanceView] 5Y - Last date in activePriceData:', activePriceData[activePriceData.length - 1].date);
      console.log('[PerformanceView] 5Y - timeframeSpecificData length:', timeframeSpecificData?.length);
      console.log('[PerformanceView] 5Y - priceData1Y length:', priceData1Y?.length);
    }

    const filtered = filterPriceDataByTimeframe(activePriceData, timeframe);
    console.log('[PerformanceView] Filtered data length:', filtered?.length);
    if (timeframe === '5Y' && filtered && filtered.length > 0) {
      console.log('[PerformanceView] 5Y - First date after filtering:', filtered[0].date);
      console.log('[PerformanceView] 5Y - Last date after filtering:', filtered[filtered.length - 1].date);
    }
    setPriceData(filtered);
  }, [activePriceData, timeframe, activePrevClose, timeframeLoading, timeframeError, timeframeSpecificData, priceData1Y]);

  // Create chart data from price data
  const chartData = priceData.map((point, i) => ({
    x: i,
    y: parseFloat(point.close) || parseFloat(point.price) || 0,
    date: point.date,
    time: point.time
  }));

  // Calculate price changes for the selected timeframe
  const { priceChange, priceChangePercent } = calculatePriceChange(chartData);

  // Get current price from real-time 1D data (always use latest intraday price)
  const realtimeChartData = priceData1D ? priceData1D.map((point, i) => ({
    x: i,
    y: parseFloat(point.close) || parseFloat(point.price) || 0,
    date: point.date,
    time: point.time
  })) : [];
  const currentPrice = realtimeChartData.length > 0 ? realtimeChartData[realtimeChartData.length - 1] : null;

  // Check if data is loading
  const isLoading = !priceData1Y || priceData1Y.length === 0;

  // Render content based on active tab
  const renderContent = () => {
    // Show loading for initial data or timeframe-specific data
    if (isLoading || isTimeframeSpecificLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <div className="text-lg font-medium text-gray-700">Loading {timeframe} data...</div>
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
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {currentPrice ? formatPrice(currentPrice.y, currency) : '--'}
                  </span>
                  <span className="text-lg font-medium text-gray-500">{currency}</span>
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
                  exchange={exchange}
                  significantEvents={significantEvents}
                  timeframe={timeframe}
                  prevClose={activePrevClose}
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
              exchange={exchange}
              significantEvents={significantEvents}
              timeframe={timeframe}
              prevClose={activePrevClose}
            />
          </div>
        );

      case 'sentiment':
        return (
          <div className="space-y-6">
            {/* Controls Bar */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
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
            </div>

            {/* Sentiment Metrics Dashboard */}
            {metrics && (
              <SentimentMetricsCard
                overall={metrics.overall}
                momentum={metrics.momentum}
                distribution={metrics.distribution}
                volatility={metrics.volatility}
              />
            )}

            {/* Combined Sentiment + Volume Chart */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Trend</h3>
              <CombinedSentimentVolumeChart
                data={viewMode === 'rolling' ? rollingData : Object.entries(dailySentiment || {}).map(([date, data]) => ({
                  timestamp: date,
                  label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  volume: data.count || 0,
                  sentiment: data.score || 0,
                  headlines: data.headlines || []
                }))}
                timeframe={sentimentTimeframe}
                viewMode={viewMode}
                hasData={viewMode === 'rolling' ? hasRollingData : Object.keys(dailySentiment || {}).length > 0}
                sourceEarliestDates={viewMode === 'rolling' ? sourceEarliestDates : null}
              />
            </div>

            {/* Enhanced Layout with Trend Summary and Source Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trend Summary - Takes 2/3 width on large screens */}
              <div className="lg:col-span-2">
                {metrics && (
                  <SentimentTrendSummary
                    trend={metrics.overall.label.toUpperCase()}
                    confidence={metrics.overall.confidence}
                    momentum={metrics.momentum.trend.toUpperCase()}
                    summary={metrics.insights.summary}
                    keyPoints={metrics.insights.keyPoints}
                    dataSource={`${sentimentTimeframe} ${viewMode === 'rolling' ? 'rolling' : 'daily'} data`}
                  />
                )}
              </div>

              {/* Source Breakdown - Takes 1/3 width on large screens */}
              <div>
                <SentimentSourceBreakdown
                  sources={sourcesData}
                  timeframe={sentimentTimeframe}
                  loading={sourcesLoading}
                />
              </div>
            </div>
          </div>
        );

      case 'news':
        return (
          <div className="">
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
