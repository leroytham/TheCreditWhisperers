import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import PriceChart from '../../../shared/components/PriceChart';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { InlineError } from '../../../../components/ErrorDisplay';
import { useSelectedAccount } from '../../../../hooks/useSelectedAccount';
import { normalizeToPercentageReturn, normalizeToPercentageReturnWithCapitalFlows, normalizeToTWR, normalizeToHybridReturn } from '../../../../utils/formatters';
import { parseExchangeDate } from '../../../shared/utils/formatters';
import apiService from '../../../../services/api';
import useAppStore from '../../../../store/useAppStore';
import { PerformanceSummaryCards } from './PerformanceSummaryCards';
import { PerformanceChartControls } from './PerformanceChartControls';
import { PerformanceWarningBanners } from './PerformanceWarningBanners';
import { PerformanceAttribution } from './PerformanceAttribution';

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
      <PerformanceSummaryCards
        currentValue={performanceData?.currentValue || 0}
        adjustedAbsoluteReturn={performanceData?.adjustedAbsoluteReturn}
        cumulativeCapitalFlow={performanceData?.cumulativeCapitalFlow}
        period={performanceData?.period}
        hasCashFlows={performanceData?.hasCashFlows}
        twrReturn={performanceData?.twrReturn}
        displayReturn={performanceData?.displayReturn}
        percentReturn={performanceData?.percentReturn}
        absoluteReturn={performanceData?.absoluteReturn}
        benchmarkReturn={performanceData?.benchmarkReturn}
        outperformance={performanceData?.outperformance}
        holdingsCount={performanceData?.holdingsCount}
        chartDisplayReturn={chartDisplayData?.chartDisplayReturn}
        chartOutperformance={chartDisplayData?.chartOutperformance}
        displayMode={displayMode}
      />

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
            <PerformanceChartControls
              displayMode={displayMode}
              setDisplayMode={setDisplayMode}
              showBenchmark={showBenchmark}
              setShowBenchmark={setShowBenchmark}
              showEvents={showEvents}
              setShowEvents={setShowEvents}
              timeframe={timeframe}
              setTimeframe={setTimeframe}
            />
          </div>

          {/* Warning Banners */}
          <PerformanceWarningBanners
            displayMode={displayMode}
            chartPriceData={chartDisplayData?.chartPriceData}
            missingSymbols={chartDisplayData?.missingSymbols || performanceData?.missingSymbols}
            exchange={DEFAULT_EXCHANGE}
          />

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

      {/* Performance Attribution */}
      {performanceData && (
        <PerformanceAttribution
          timeframe={timeframe}
          topGainers={performanceData.apiData?.top_gainers}
          topLosers={performanceData.apiData?.top_losers}
        />
      )}
    </div>
  );
};

export default PortfolioPerformanceDetail;