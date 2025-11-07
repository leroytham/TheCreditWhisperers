import React, { useState, useEffect, useRef, useMemo } from 'react';
import PriceChart from '../../../shared/components/PriceChart';
import TimeRangeSelector from '../../../shared/components/TimeRangeSelector';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { InlineError } from '../../../../components/ErrorDisplay';
import { useAccountContext } from '../../../../hooks/usePortfolioData';
import { formatCurrency, formatPercentage, normalizeToPercentageReturn } from '../../../../utils/formatters';
import apiService from '../../../../services/api';

/**
 * PortfolioPerformanceDetail Component
 *
 * Comprehensive performance analysis view with interactive charts and metrics.
 * Displays portfolio value trends, benchmark comparison (S&P 500), and top contributors/detractors.
 *
 * Key Features:
 * - Interactive time-series chart with REAL historical data (1M, 3M, 6M, YTD, 1Y)
 * - Performance summary cards (value, return, S&P 500 benchmark, outperformance, holdings count)
 * - Top gainers and losers attribution
 * - Portfolio events (dividends, splits, purchases) displayed on chart
 *
 * @returns {React.ReactElement} Rendered portfolio performance detail view
 *
 * @example
 * // Used in Portfolio page "Performance" tab
 * <PortfolioPerformanceDetail />
 */
const PortfolioPerformanceDetail = () => {
  const [timeframe, setTimeframe] = useState('1M');
  const [showEvents, setShowEvents] = useState(true);
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Display mode: 'value' (Portfolio Value $) or 'percent' (% Return)
  const [displayMode, setDisplayMode] = useState(
    localStorage.getItem('portfolioDisplayMode') || 'value'
  );
  // Show S&P 500 benchmark overlay (only in percent mode)
  const [showBenchmark, setShowBenchmark] = useState(
    localStorage.getItem('portfolioShowBenchmark') === 'true'
  );

  // Use hooks for context
  const { selectedAccount } = useAccountContext();
  const abortControllerRef = useRef(null);

  // Persist display preferences to localStorage
  useEffect(() => {
    localStorage.setItem('portfolioDisplayMode', displayMode);
  }, [displayMode]);

  useEffect(() => {
    localStorage.setItem('portfolioShowBenchmark', showBenchmark.toString());
  }, [showBenchmark]);

  // Fetch portfolio performance data with real historical time-series
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedAccount) {
        return;
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        // Fetch performance data with the selected timeframe
        const response = await apiService.getPortfolioPerformance(
          selectedAccount.username,
          selectedAccount.accountName,
          timeframe,
          { signal: abortControllerRef.current.signal }
        );

        const data = response.data;

        // Extract historical data, benchmark data, and events from response
        const historicalData = data.historical_data || {};
        const benchmarkData = data.benchmark_data || {};
        const events = data.events || [];

        // Transform historical data points for chart
        // PriceChart expects 'close' or 'price' field, not 'value'
        const priceData = (historicalData.data_points || []).map(point => ({
          date: point.date,
          close: point.portfolio_value, // Required by generateChartData
          price: point.portfolio_value  // Fallback field
        }));

        // Backend provides two formats for benchmark data:
        // - point.close: Pre-normalized percentage (0%, 2.5%, 5%, etc.) - used for summary cards
        // - point.value: Absolute S&P 500 index value (4500, 4612, etc.) - used for charts
        const benchmarkReturn = benchmarkData.data_points?.length > 0
          ? (benchmarkData.data_points[benchmarkData.data_points.length - 1].close || 0)
          : 0;

        // Transform benchmark data using absolute values for chart display
        const benchmarkPriceData = (benchmarkData.data_points || []).map(point => ({
          date: point.date,
          close: point.value || 0,  // Use absolute S&P 500 index value for proper normalization
          price: point.value || 0
        }));

        // Current value is the last data point
        const currentValue = priceData.length > 0 ? priceData[priceData.length - 1].close : 0;
        const previousClose = priceData.length > 0 ? priceData[0].close : 0;

        // Always calculate return from chart data (first to last point)
        const absoluteReturn = currentValue - previousClose;
        const percentReturn = previousClose > 0 ? ((currentValue - previousClose) / previousClose) * 100 : 0;

        // Calculate outperformance for selected timeframe
        const outperformance = percentReturn - benchmarkReturn;

        // Map timeframe to closest API period for attribution data only
        // API provides: MTD, QTD, YTD, ITD (only used for top_gainers/top_losers)
        let periodForBenchmark = 'MTD';
        if (timeframe === '1M') periodForBenchmark = 'MTD';
        else if (timeframe === '3M' || timeframe === '6M') periodForBenchmark = 'QTD';
        else if (timeframe === 'YTD' || timeframe === '1Y') periodForBenchmark = 'YTD';

        const benchmarkApiData = data.performance?.find(p => p.period === periodForBenchmark) || data.performance?.[0] || {};

        setPerformanceData({
          priceData,                    // Raw $ values
          benchmarkPriceData,           // Raw benchmark data
          events: events.map(e => ({
            ...e,
            start_date: e.date, // PriceChart expects 'start_date' field
            label: e.type === 'dividend' ? '💰' : e.type === 'split' ? '📊' : '🛒'
          })),
          timeframe,
          currentValue,
          previousClose,
          absoluteReturn,
          percentReturn,
          benchmarkReturn: benchmarkReturn,  // Calculated from actual timeframe data
          outperformance: outperformance,    // Calculated from actual timeframe data
          holdingsCount: benchmarkApiData?.holdings_count || 0,  // Actual number of holdings from API
          period: timeframe, // Show actual timeframe, not API period
          apiData: benchmarkApiData,         // Only used for attribution (top_gainers/losers)
          apiPeriod: periodForBenchmark      // Track which API period attribution data is from
        });

        setLoading(false);
      } catch (err) {
        // Don't show error for aborted requests
        if (err.name === 'AbortError' || err.name === 'CanceledError') {
          return;
        }

        setLoading(false);
        setError(err.response?.data?.detail || err.message || 'Failed to load performance data');
        console.error('Error fetching performance data:', err);
      }
    };

    fetchData();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [timeframe, selectedAccount, retryTrigger]);

  // Retry function for error state
  const handleRetry = () => {
    setError(null);
    // Trigger refetch by incrementing retry counter
    setRetryTrigger(prev => prev + 1);
  };

  // Compute chart display data based on displayMode (client-side only, no refetch)
  const chartDisplayData = useMemo(() => {
    if (!performanceData) return null;

    let chartPriceData = performanceData.priceData;
    let chartBenchmarkData = performanceData.benchmarkPriceData;

    // Normalize to percentage if in percent mode
    if (displayMode === 'percent') {
      if (performanceData.priceData.length > 0) {
        chartPriceData = normalizeToPercentageReturn(performanceData.priceData);
      }
      if (performanceData.benchmarkPriceData.length > 0) {
        chartBenchmarkData = normalizeToPercentageReturn(performanceData.benchmarkPriceData);
      }
    }

    return {
      ...performanceData,
      chartPriceData,
      chartBenchmarkData
    };
  }, [performanceData, displayMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <InlineError message={error} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div>
            <p className="text-sm text-gray-500">Portfolio Value</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(performanceData?.currentValue || 0)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div>
            <p className="text-sm text-gray-500">{performanceData?.period || 'Period'} Return</p>
            <p className={`text-2xl font-bold ${performanceData?.percentReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(performanceData?.percentReturn || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatCurrency(performanceData?.absoluteReturn || 0)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div>
            <p className="text-sm text-gray-500">S&P 500 Return</p>
            <p className={`text-2xl font-bold ${performanceData?.benchmarkReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(performanceData?.benchmarkReturn || 0)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div>
            <p className="text-sm text-gray-500">Outperformance</p>
            <p className={`text-2xl font-bold ${performanceData?.outperformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(performanceData?.outperformance || 0)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div>
            <p className="text-sm text-gray-500">Holdings</p>
            <p className="text-2xl font-bold text-gray-900">
              {performanceData?.holdingsCount || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Main Performance Chart */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Portfolio Performance
              </h3>
              <div className="flex items-center space-x-4 mt-1">
                <p className="text-sm text-gray-500">
                  {selectedAccount?.accountName} • {selectedAccount?.accountNumber}
                </p>
                {displayMode === 'percent' && showBenchmark && (
                  <div className="flex items-center space-x-3 text-xs">
                    <div className="flex items-center space-x-1">
                      <div className={`w-4 h-0.5 ${performanceData?.percentReturn >= 0 ? 'bg-green-600' : 'bg-red-600'}`}></div>
                      <span className="text-gray-600">Portfolio</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-4 h-0.5 bg-gray-500"></div>
                      <span className="text-gray-600">S&P 500</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-4">
              {/* Display Mode Toggle - Button Group */}
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => setDisplayMode('value')}
                  className={`px-4 py-2 text-sm font-medium border ${
                    displayMode === 'value'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } rounded-l-md focus:z-10 focus:ring-2 focus:ring-gray-500`}
                >
                  $ Value
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('percent')}
                  className={`px-4 py-2 text-sm font-medium border-t border-b border-r ${
                    displayMode === 'percent'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } rounded-r-md focus:z-10 focus:ring-2 focus:ring-gray-500`}
                >
                  % Return
                </button>
              </div>

              {/* Show S&P 500 Benchmark Toggle - Only visible in percent mode */}
              {displayMode === 'percent' && (
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-700">S&P 500</label>
                  <button
                    onClick={() => setShowBenchmark(!showBenchmark)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
                      showBenchmark ? 'bg-gray-900' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showBenchmark ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Show Events Toggle */}
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700">Events</label>
                <button
                  onClick={() => setShowEvents(!showEvents)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
                    showEvents ? 'bg-gray-900' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showEvents ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Timeframe Selector */}
              <TimeRangeSelector
                activeTimeframe={timeframe}
                onTimeframeChange={setTimeframe}
                timeframes={['1M', '3M', '6M', 'YTD', '1Y']}
              />
            </div>
          </div>

          {/* Chart Container */}
          <div className="h-96">
            {chartDisplayData && (
              <PriceChart
                priceData={chartDisplayData.chartPriceData}
                benchmarkData={chartDisplayData.chartBenchmarkData || []}
                showBenchmark={displayMode === 'percent' && showBenchmark}
                significantEvents={showEvents ? chartDisplayData.events : []}
                ticker={selectedAccount?.accountNumber || 'Portfolio'}
                companyName={selectedAccount?.accountName || 'Portfolio'}
                timeframe={timeframe}
                showSignificantEvents={showEvents}
                currency="USD"
                displayMode={displayMode}
                prevClose={timeframe === '1D' ? chartDisplayData.previousClose : null}
              />
            )}
          </div>
        </div>
      </div>

      {/* Performance Attribution - Uses actual top gainers/losers from portfolio */}
      {performanceData && (() => {
        // Only show attribution when timeframe exactly matches API period
        // 1M maps to MTD (mismatch), 1Y maps to YTD (mismatch), only YTD is exact match
        const hasMatchingAttribution = timeframe === 'YTD';

        if (!hasMatchingAttribution) {
          return (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Performance Attribution
              </h3>
              <p className="text-gray-500 text-sm">
                Detailed holding-level attribution is available for standard reporting periods (YTD).
                The current view shows a {timeframe} rolling period. Switch to YTD view to see top contributors and detractors.
              </p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Top Contributors
              </h3>
              <div className="space-y-3">
                {performanceData.apiData?.top_gainers && performanceData.apiData.top_gainers.length > 0 ? (
                  performanceData.apiData.top_gainers.slice(0, 3).map((holding) => (
                    <div key={holding.symbol} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900">{holding.symbol}</p>
                        <p className="text-sm text-gray-500">{holding.quantity} shares</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">
                          {formatPercentage(holding.return_percent || 0)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatCurrency(holding.gain_loss || 0)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No attribution data available for this period</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Top Detractors
              </h3>
              <div className="space-y-3">
                {performanceData.apiData?.top_losers && performanceData.apiData.top_losers.length > 0 ? (
                  performanceData.apiData.top_losers.slice(0, 3).map((holding) => (
                    <div key={holding.symbol} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900">{holding.symbol}</p>
                        <p className="text-sm text-gray-500">{holding.quantity} shares</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-red-600">
                          {formatPercentage(holding.return_percent || 0)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatCurrency(holding.gain_loss || 0)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No attribution data available for this period</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PortfolioPerformanceDetail;