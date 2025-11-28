import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import PriceChart from '../../../shared/components/PriceChart';
import TimeRangeSelector from '../../../shared/components/TimeRangeSelector';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { InlineError } from '../../../../components/ErrorDisplay';
import { useSelectedAccount } from '../../../../hooks/useSelectedAccount';
import { formatCurrency, formatPercentage, normalizeToPercentageReturn, normalizeToPercentageReturnWithCapitalFlows, normalizeToTWR, normalizeToHybridReturn } from '../../../../utils/formatters';
import { parseExchangeDate } from '../../../shared/utils/formatters';
import apiService from '../../../../services/api';
import useAppStore from '../../../../store/useAppStore';

// Types for price data points
interface PriceDataPoint {
  date: string;
  close: number;
  price: number;
  capital_flow?: number;
  portfolio_value?: number;
  lot_breakdown?: unknown[];
}

interface TWRData {
  twr_return?: number;
  has_cash_flows?: boolean;
  error?: string;
}

// Types for holding attribution data
interface HoldingAttribution {
  symbol: string;
  quantity: number;
  return_percent?: number;
  gain_loss?: number;
}

// Types for API data
interface ApiData {
  top_gainers?: HoldingAttribution[];
  top_losers?: HoldingAttribution[];
  holdings_count?: number;
}

// Types for events
interface PortfolioEvent {
  date: string;
  type: string;
  start_date?: string;
  label?: string;
  trend?: string;
}

// Performance data state interface
interface PerformanceDataState {
  priceData: PriceDataPoint[];
  benchmarkPriceData: PriceDataPoint[];
  events: PortfolioEvent[];
  timeframe: string;
  currentValue: number;
  previousClose: number;
  absoluteReturn: number;
  adjustedAbsoluteReturn: number;
  cumulativeCapitalFlow: number;
  percentReturn: number;
  twrReturn: number | null;
  hasCashFlows: boolean;
  displayReturn: number;
  twrData: TWRData | null;
  benchmarkReturn: number;
  outperformance: number;
  holdingsCount: number;
  period: string;
  apiData: ApiData;
  apiPeriod: string;
  missingSymbols: string[];
}

// Chart display data state
interface ChartDisplayDataState extends PerformanceDataState {
  chartPriceData: (PriceDataPoint & { isZeroBaseline?: boolean; hasNoInvestments?: boolean; baselineValue?: number; baselineDate?: string })[];
  chartBenchmarkData: PriceDataPoint[];
  chartDisplayReturn: number | null;
  chartOutperformance: number | null;
}

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
const PortfolioPerformanceDetail: React.FC = () => {
  // Default to NYSE timezone for portfolio data (US market standard)
  const DEFAULT_EXCHANGE = 'NYSE';

  const [timeframe, setTimeframe] = useState<string>('1M');
  const [showEvents, setShowEvents] = useState<boolean>(true);
  const [performanceData, setPerformanceData] = useState<PerformanceDataState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  // Display mode and benchmark preferences from Zustand (persisted via middleware)
  const {
    portfolioDisplayMode: displayMode,
    setPortfolioDisplayMode: setDisplayMode,
    portfolioShowBenchmark: showBenchmark,
    setPortfolioShowBenchmark: setShowBenchmark,
  } = useAppStore(
    useShallow(state => ({
      portfolioDisplayMode: state.portfolioDisplayMode,
      setPortfolioDisplayMode: state.setPortfolioDisplayMode,
      portfolioShowBenchmark: state.portfolioShowBenchmark,
      setPortfolioShowBenchmark: state.setPortfolioShowBenchmark,
    }))
  );

  // Use hooks for account selection
  const { selectedAccount } = useSelectedAccount();
  const abortControllerRef = useRef<AbortController | null>(null);

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
        interface RawDataPoint {
          date: string;
          portfolio_value: number;
          capital_flow?: number;
          lot_breakdown?: unknown[];
        }
        const priceData: PriceDataPoint[] = (historicalData.data_points || []).map((point: RawDataPoint) => ({
          date: point.date,
          close: point.portfolio_value, // Required by generateChartData
          price: point.portfolio_value,  // Fallback field
          capital_flow: point.capital_flow || 0,  // Track capital flows for normalization
          portfolio_value: point.portfolio_value,   // Preserve original for clarity
          lot_breakdown: point.lot_breakdown || []  // Preserve lot-level data for hybrid calculation
        }));

        // Backend provides two formats for benchmark data:
        // - point.close: Pre-normalized percentage (0%, 2.5%, 5%, etc.) - used for summary cards
        // - point.value: Absolute S&P 500 index value (4500, 4612, etc.) - used for charts
        const benchmarkReturn = benchmarkData.data_points?.length > 0
          ? (benchmarkData.data_points[benchmarkData.data_points.length - 1].close || 0)
          : 0;

        // Transform benchmark data using absolute values for chart display
        interface RawBenchmarkPoint {
          date: string;
          close?: number;
          value?: number;
        }
        const benchmarkPriceData: PriceDataPoint[] = (benchmarkData.data_points || []).map((point: RawBenchmarkPoint) => ({
          date: point.date,
          close: point.value || 0,  // Use absolute S&P 500 index value for proper normalization
          price: point.value || 0
        }));

        // Current value is the last data point
        const currentValue = priceData.length > 0 ? priceData[priceData.length - 1].close : 0;
        const previousClose = priceData.length > 0 ? priceData[0].close : 0;

        // Calculate cumulative capital flow across the period
        const cumulativeCapitalFlow = priceData.reduce((sum: number, point: PriceDataPoint) => sum + (point.capital_flow || 0), 0);

        // Always calculate simple return from chart data (first to last point)
        const absoluteReturn = currentValue - previousClose;
        // Adjust absolute return for capital flows (subtract deposits, add withdrawals)
        const adjustedAbsoluteReturn = absoluteReturn - cumulativeCapitalFlow;
        const percentReturn = previousClose > 0 ? ((currentValue - previousClose) / previousClose) * 100 : 0;

        // Extract TWR data if available
        const twrData = historicalData.twr || null;
        const twrReturn = twrData?.twr_return || null;
        const hasCashFlows = twrData?.has_cash_flows || false;

        // Use TWR return if available and has cash flows, otherwise use simple return
        const displayReturn = (hasCashFlows && twrReturn !== null) ? twrReturn : percentReturn;

        // Calculate outperformance for selected timeframe
        const outperformance = displayReturn - benchmarkReturn;

        // Map timeframe to closest API period for attribution data only
        // API provides: MTD, QTD, YTD, ITD (only used for top_gainers/top_losers)
        let periodForBenchmark = 'MTD';
        if (timeframe === '1M') periodForBenchmark = 'MTD';
        else if (timeframe === '3M' || timeframe === '6M') periodForBenchmark = 'QTD';
        else if (timeframe === 'YTD' || timeframe === '1Y') periodForBenchmark = 'YTD';

        interface PerformancePeriod {
          period: string;
          holdings_count?: number;
          top_gainers?: HoldingAttribution[];
          top_losers?: HoldingAttribution[];
        }
        const benchmarkApiData: ApiData = data.performance?.find((p: PerformancePeriod) => p.period === periodForBenchmark) || data.performance?.[0] || {};

        // Calculate trend for each event based on portfolio value movement
        interface RawEvent {
          date: string;
          type: string;
        }
        const eventsWithTrend: PortfolioEvent[] = events.map((e: RawEvent) => {
          const eventDate = parseExchangeDate(e.date, DEFAULT_EXCHANGE);

          // Find the event date in priceData
          const eventIndex = priceData.findIndex((p: PriceDataPoint) => {
            const pointDate = parseExchangeDate(p.date, DEFAULT_EXCHANGE);
            return pointDate?.toISOString().slice(0, 10) === eventDate?.toISOString().slice(0, 10);
          });

          let trend = 'Upward'; // Default to upward

          if (eventIndex >= 0) {
            // Look at the day-over-day change at the event date
            const currentValue = priceData[eventIndex].close || 0;
            const prevValue = eventIndex > 0 ? (priceData[eventIndex - 1].close || 0) : currentValue;

            // Calculate percentage move
            const movePct = prevValue > 0 ? ((currentValue - prevValue) / prevValue) * 100 : 0;
            trend = movePct >= 0 ? 'Upward' : 'Downward';
          }

          return {
            ...e,
            start_date: e.date, // PriceChart expects 'start_date' field
            label: e.type === 'dividend' ? '💰' : e.type === 'split' ? '📊' : '🛒',
            trend
          };
        });

        setPerformanceData({
          priceData,                    // Raw $ values
          benchmarkPriceData,           // Raw benchmark data
          events: eventsWithTrend,
          timeframe,
          currentValue,
          previousClose,
          absoluteReturn,
          adjustedAbsoluteReturn,       // Absolute return adjusted for capital flows
          cumulativeCapitalFlow,        // Total capital flows during period
          percentReturn,                // Simple return (money-weighted)
          twrReturn,                    // Time-weighted return (accurate with cash flows)
          hasCashFlows,                 // Flag indicating if TWR is different from simple
          displayReturn,                // The return to display (TWR if available, else simple)
          twrData,                      // Full TWR data including sub-periods for visualization
          benchmarkReturn: benchmarkReturn,  // Calculated from actual timeframe data
          outperformance: outperformance,    // Calculated from actual timeframe data
          holdingsCount: benchmarkApiData?.holdings_count || 0,  // Actual number of holdings from API
          period: timeframe, // Show actual timeframe, not API period
          apiData: benchmarkApiData,         // Only used for attribution (top_gainers/losers)
          apiPeriod: periodForBenchmark,     // Track which API period attribution data is from
          missingSymbols: historicalData.missing_price_symbols || []
        });

        setLoading(false);
      } catch (err: unknown) {
        // Don't show error for aborted requests
        const error = err as { name?: string; response?: { data?: { detail?: string } }; message?: string };
        if (error.name === 'AbortError' || error.name === 'CanceledError') {
          return;
        }

        setLoading(false);
        setError(error.response?.data?.detail || error.message || 'Failed to load performance data');
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartDisplayData = useMemo((): ChartDisplayDataState | null => {
    if (!performanceData) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chartPriceData: any[] = performanceData.priceData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chartBenchmarkData: any[] = performanceData.benchmarkPriceData;

    // Normalize to percentage if in percent mode
    if (displayMode === 'percent') {
      if (performanceData.priceData.length > 0) {
        // Check for available normalization methods
        // Check actual capital flow data instead of relying on hasCashFlows flag (which requires TWR success)
        const hasCapitalFlows = performanceData.priceData.some((p) => p.capital_flow && p.capital_flow !== 0);
        const hasTWRData = performanceData.twrData && !performanceData.twrData.error;

        // Calculate lot coverage to avoid using hybrid mode prematurely
        const pointsWithLots = performanceData.priceData.filter((p) => p.lot_breakdown && p.lot_breakdown.length > 0).length;
        const totalPoints = performanceData.priceData.length;
        const lotCoveragePercent = totalPoints > 0 ? (pointsWithLots / totalPoints) * 100 : 0;
        const hasAdequateLotCoverage = lotCoveragePercent > 80;

        if (hasAdequateLotCoverage) {
          // Best: Use hybrid normalization with lot-level tracking
          // This correctly handles pre-period vs in-period purchases
          // Only used when >80% of points have lot data to avoid chart collapse
          const periodStartDate = performanceData.priceData[0]?.date;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          chartPriceData = normalizeToHybridReturn(performanceData.priceData as any[], periodStartDate, performanceData.twrData as any);
        } else if (hasTWRData && hasCapitalFlows) {
          // Good: Use TWR-based normalization if available
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          chartPriceData = normalizeToTWR(
            performanceData.priceData as any[],
            performanceData.twrData as any
          );
        } else if (hasCapitalFlows) {
          // Decent: Use capital flow adjustment
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          chartPriceData = normalizeToPercentageReturnWithCapitalFlows(performanceData.priceData as any[]);
        } else {
          // Simple: No capital flows, use basic normalization
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          chartPriceData = normalizeToPercentageReturn(performanceData.priceData as any[]);
        }
      }

      // Benchmark always uses simple normalization (no capital flows in S&P 500)
      if (performanceData.benchmarkPriceData.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chartBenchmarkData = normalizeToPercentageReturn(performanceData.benchmarkPriceData as any[]);
      }

      // Filter out pre-baseline points (close: null) to prevent hard zero-line rendering
      // normalizeToPercentageReturn emits close: null for points before first investment
      chartPriceData = chartPriceData.filter((point) => point.close !== null && point.close !== undefined);

      // Synchronize benchmark to match portfolio's date range
      // Without this, portfolio and benchmark cover different date ranges after filtering,
      // causing misleading comparisons (e.g., portfolio shows Jun-Dec while benchmark shows Jan-Dec)
      if (chartPriceData.length > 0) {
        // Create set of valid dates from filtered portfolio data
        const validDates = new Set(chartPriceData.map((p) => p.date));

        // Filter benchmark to only include dates present in portfolio data
        chartBenchmarkData = chartBenchmarkData.filter((point) => validDates.has(point.date));

        // Re-normalize benchmark to start from 0% at the new first point
        // This ensures portfolio and benchmark have matching baselines for visual comparison
        // Without this, benchmark retains its percentage relative to the original first date,
        // causing visual and numerical comparison errors
        if (chartBenchmarkData.length > 0) {
          const benchmarkStartValue = chartBenchmarkData[0].close || 0;
          chartBenchmarkData = chartBenchmarkData.map((point) => ({
            ...point,
            close: point.close !== null ? point.close - benchmarkStartValue : 0
          }));
        }
      }
    }

    // Extract final chart return value to align summary cards with chart
    // This ensures the "Period Return" card shows the same value as the chart endpoint
    const chartDisplayReturn = displayMode === 'percent' && chartPriceData.length > 0
      ? chartPriceData[chartPriceData.length - 1]?.close || 0
      : null;

    // Calculate chart-based outperformance when using normalized chart data
    // This ensures outperformance matches the chart's calculation method (hybrid/TWR/capital-adjusted)
    const chartOutperformance = displayMode === 'percent' &&
      chartDisplayReturn !== null &&
      chartBenchmarkData.length > 0
        ? chartDisplayReturn - (chartBenchmarkData[chartBenchmarkData.length - 1]?.close || 0)
        : null;

    return {
      ...performanceData,
      chartPriceData,
      chartBenchmarkData,
      chartDisplayReturn,  // Chart's calculated return for summary card alignment
      chartOutperformance,  // Chart-based outperformance for consistency
      twrData: performanceData.twrData  // Ensure TWR data is available for display
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
            {performanceData?.adjustedAbsoluteReturn !== undefined && (
              <p className={`text-sm mt-1 ${performanceData.adjustedAbsoluteReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {performanceData.adjustedAbsoluteReturn >= 0 ? '+' : ''}
                {formatCurrency(performanceData.adjustedAbsoluteReturn)}
                {performanceData?.cumulativeCapitalFlow !== 0 && (
                  <span className="text-gray-500 text-xs ml-1" title="Capital flows netted out">
                    (net of {formatCurrency(Math.abs(performanceData.cumulativeCapitalFlow))} {performanceData.cumulativeCapitalFlow > 0 ? 'deposits' : 'withdrawals'})
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">{performanceData?.period || 'Period'} Return</p>
              {performanceData?.hasCashFlows && performanceData?.twrReturn !== null && (
                <span
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
                  title="Time-Weighted Return: accounts for deposits/withdrawals"
                >
                  TWR
                </span>
              )}
            </div>
            <p className={`text-2xl font-bold ${(() => {
              // Use chart's calculated value when in percent mode for alignment
              const returnValue = displayMode === 'percent' && chartDisplayData?.chartDisplayReturn !== null && chartDisplayData?.chartDisplayReturn !== undefined
                ? chartDisplayData.chartDisplayReturn
                : (performanceData?.displayReturn || performanceData?.percentReturn || 0);
              return returnValue >= 0 ? 'text-green-600' : 'text-red-600';
            })()}`}>
              {(() => {
                // Use chart's calculated value when in percent mode for alignment
                const returnValue = displayMode === 'percent' && chartDisplayData?.chartDisplayReturn !== null && chartDisplayData?.chartDisplayReturn !== undefined
                  ? chartDisplayData.chartDisplayReturn
                  : (performanceData?.displayReturn || performanceData?.percentReturn || 0);
                return formatPercentage(returnValue);
              })()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatCurrency(performanceData?.absoluteReturn || 0)}
              {performanceData?.hasCashFlows && performanceData?.twrReturn !== performanceData?.percentReturn && (
                <span className="ml-2 text-xs text-gray-400">
                  (Simple: {formatPercentage(performanceData?.percentReturn || 0)})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div>
            <p className="text-sm text-gray-500">S&P 500 Return</p>
            <p className={`text-2xl font-bold ${(performanceData?.benchmarkReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(performanceData?.benchmarkReturn || 0)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div>
            <p className="text-sm text-gray-500">Outperformance</p>
            <p className={`text-2xl font-bold ${(() => {
              // Use chart-based outperformance when available (e.g., hybrid mode), otherwise use original
              const outperformanceValue = chartDisplayData?.chartOutperformance !== null && chartDisplayData?.chartOutperformance !== undefined
                ? chartDisplayData.chartOutperformance
                : (performanceData?.outperformance || 0);
              return outperformanceValue >= 0 ? 'text-green-600' : 'text-red-600';
            })()}`}>
              {formatPercentage((() => {
                // Use chart-based outperformance when available (e.g., hybrid mode), otherwise use original
                const outperformanceValue = chartDisplayData?.chartOutperformance !== null && chartDisplayData?.chartOutperformance !== undefined
                  ? chartDisplayData.chartOutperformance
                  : (performanceData?.outperformance || 0);
                return outperformanceValue;
              })())}
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
                      <div className={`w-4 h-0.5 ${(() => {
                        // Use chart's calculated return for legend color to match actual plotted line
                        const returnValue = displayMode === 'percent' && chartDisplayData?.chartDisplayReturn !== null && chartDisplayData?.chartDisplayReturn !== undefined
                          ? chartDisplayData.chartDisplayReturn
                          : (performanceData?.percentReturn || 0);
                        return returnValue >= 0 ? 'bg-green-600' : 'bg-red-600';
                      })()}`}></div>
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

          {/* Zero-Baseline Information Banner */}
          {displayMode === 'percent' && chartDisplayData?.chartPriceData?.[0]?.isZeroBaseline && (() => {
            const firstPoint = chartDisplayData.chartPriceData[0];
            const hasNoInvestments = firstPoint.hasNoInvestments;
            const baselineValue = firstPoint.baselineValue;
            const baselineDate = firstPoint.baselineDate;

            // If no investments at all, show warning
            if (hasNoInvestments) {
              return (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900">No Investments Found</h4>
                      <p className="text-xs text-amber-700 mt-1">
                        Portfolio has no non-zero values in this period. Switch to "Value" mode to see absolute dollar amounts.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            // Otherwise, show informational banner with baseline details
            return (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900">Percentage Returns Re-based</h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Portfolio started at $0. Percentage returns are calculated from the first investment of{' '}
                      <span className="font-semibold">${baselineValue?.toFixed(2)}</span>
                      {baselineDate && (
                        <span> on {parseExchangeDate(baselineDate, DEFAULT_EXCHANGE)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      )}.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Missing Symbols Warning - Shows when chart has partial data */}
          {chartDisplayData && (() => {
            const missingSymbols = chartDisplayData?.missingSymbols || performanceData?.missingSymbols || [];
            const hasChartPoints = Array.isArray(chartDisplayData.chartPriceData)
              && chartDisplayData.chartPriceData.length > 0;

            // Show warning when chart renders but some symbols are missing
            if (hasChartPoints && missingSymbols.length > 0) {
              return (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-amber-900">Incomplete Price Data</h4>
                      <p className="text-xs text-amber-700 mt-1">
                        Missing historical prices for: <span className="font-semibold">{missingSymbols.join(', ')}</span>.
                        Performance shown reflects only holdings with available data.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Chart Container */}
          <div className="h-96">
            {(() => {
              if (!chartDisplayData) {
                return (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      <div>Loading chart data...</div>
                    </div>
                  </div>
                );
              }

              const missingSymbols = chartDisplayData?.missingSymbols || performanceData?.missingSymbols || [];

              const hasChartPoints = Array.isArray(chartDisplayData.chartPriceData)
                && chartDisplayData.chartPriceData.length > 0;

              if (!hasChartPoints) {
                return (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center max-w-md">
                      <p className="text-sm font-medium text-gray-700">
                        No performance history available
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        We couldn’t find any historical values for this portfolio in the selected timeframe.
                        Try a longer timeframe or confirm the holdings have market data.
                      </p>
                      {missingSymbols.length > 0 && (
                        <p className="mt-3 text-xs text-gray-500">
                          Missing price data for: {missingSymbols.join(', ')}. We’ll show the chart as soon as
                          we can retrieve pricing for these holdings.
                        </p>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <PriceChart
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  priceData={chartDisplayData.chartPriceData as any}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  benchmarkData={(chartDisplayData.chartBenchmarkData || []) as any}
                  showBenchmark={displayMode === 'percent' && showBenchmark}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  significantEvents={(showEvents ? chartDisplayData.events : []) as any}
                  ticker={selectedAccount?.accountNumber || 'Portfolio'}
                  companyName={selectedAccount?.accountName || 'Portfolio'}
                  timeframe={timeframe}
                  showSignificantEvents={showEvents}
                  currency="USD"
                  displayMode={displayMode}
                  prevClose={timeframe === '1D' ? chartDisplayData.previousClose : null}
                  mode="entity"
                />
              );
            })()}
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
                  performanceData.apiData.top_gainers.slice(0, 3).map((holding, index) => (
                    <div key={`gainer-${holding.symbol}-${index}`} className="flex justify-between items-center">
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
                  performanceData.apiData.top_losers.slice(0, 3).map((holding, index) => (
                    <div key={`loser-${holding.symbol}-${index}`} className="flex justify-between items-center">
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