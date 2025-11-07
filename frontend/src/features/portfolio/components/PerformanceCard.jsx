import React, { useState } from 'react';
import PropTypes from 'prop-types';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { InlineError } from '../../../components/ErrorDisplay';
import { useAccountContext } from '../../../hooks/usePortfolioData';
import { usePortfolioOverview } from '../hooks/usePortfolioOverview';

// Chart display constants
const MIN_BAR_HEIGHT_PX = 10; // Minimum visible bar height in pixels

/**
 * Format benchmark label with correct sign prefix
 * @param {number} value - The percentage value
 * @returns {string} Formatted label (e.g., "+5.23%", "0%", or "-3.45%")
 */
const formatBenchmarkLabel = (value) => {
  if (value === 0) return '0%'; // Plain zero without sign
  if (value > 0) return `+${value}%`;
  return `${value}%`; // Already has minus sign
};

/**
 * Get color class based on value sign
 * @param {number} value - The percentage value
 * @returns {string} Tailwind color class
 */
const getBenchmarkColorClass = (value) => {
  if (value === 0) return 'text-gray-600'; // Neutral color for zero
  return value > 0 ? 'text-green-600' : 'text-red-600';
};

/**
 * Calculate adaptive Y-axis maximum based on data range
 * Uses smaller rounding increments for small values to prevent misleading scales
 * @param {number} maxAbsValue - Maximum absolute value in dataset
 * @returns {number} Rounded Y-axis maximum
 */
const getAdaptiveYAxisMax = (maxAbsValue) => {
  if (maxAbsValue === 0) return 10; // Default scale
  if (maxAbsValue <= 1) return Math.ceil(maxAbsValue); // Round to nearest 1%
  if (maxAbsValue <= 5) return Math.ceil(maxAbsValue / 5) * 5; // Round to nearest 5%
  return Math.ceil(maxAbsValue / 10) * 10; // Round to nearest 10%
};

/**
 * Calculate dynamic bar height based on data range
 * @param {number} value - The percentage value
 * @param {number} yAxisMax - Y-axis maximum (scale) for consistent visual representation
 * @param {number} containerHeight - Height of half the chart container in px
 * @returns {number} Bar height in pixels
 */
const calculateBarHeight = (value, yAxisMax, containerHeight = 85) => {
  if (yAxisMax === 0) return MIN_BAR_HEIGHT_PX;

  const percentage = Math.abs(value) / yAxisMax;
  const calculatedHeight = percentage * containerHeight * 0.9; // Use 90% of container

  return Math.max(MIN_BAR_HEIGHT_PX, calculatedHeight);
};

/**
 * PerformanceCard Component
 *
 * Displays REAL portfolio performance metrics with graph/list toggle
 * Compares your ACTUAL portfolio holdings against S&P 500 benchmark
 *
 * HOW IT WORKS:
 * 1. Gets all stocks you currently own (e.g., 10 AAPL, 5 MSFT)
 * 2. For each time period (MTD, YTD, etc.):
 *    - Smart logic: Uses YOUR cost if bought in period, market price if before
 *    - Compares to what they're worth NOW
 *    - Shows the % gain/loss
 * 3. Compares your portfolio performance to S&P 500 for same period
 */
const PerformanceCard = ({ onViewPerformance }) => {
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'list'
  const [showSP500, setShowSP500] = useState(true); // Toggle S&P 500 visibility

  // Use hooks for context and data fetching
  const { selectedAccount } = useAccountContext();
  const { performance, performanceLoading, performanceError, refetchPerformance } = usePortfolioOverview();

  const loading = performanceLoading;
  const error = performanceError;
  const refetch = refetchPerformance;

  const performanceData = performance?.performance || [];
  const portfolioInfo = performance ? {
    account_name: performance.account_name,
    calculation_date: performance.calculation_date
  } : null;

  return (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow-md border border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">Performance</h2>
          {portfolioInfo && (
            <p className="text-[10px] sm:text-xs text-slate-600">
              Based on current holdings • Real-time data
            </p>
          )}
        </div>

        {/* S&P 500 Toggle Button - Responsive */}
        {!loading && !error && performanceData.length > 0 && (
          <button
            onClick={() => setShowSP500(!showSP500)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-bold transition-all duration-200 ${
              showSP500
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {showSP500 ? '✓ S&P 500 Comparison' : 'Show S&P 500'}
          </button>
        )}
      </div>

      <div className="flex space-x-4 sm:space-x-6 text-sm border-b-2 border-gray-200 mb-1">
        <button
          onClick={() => setViewMode('graph')}
          className={`pb-2 sm:pb-3 px-1 transition-all duration-200 ${
            viewMode === 'graph'
              ? 'text-slate-900 font-bold border-b-3 border-slate-900'
              : 'text-slate-500 hover:text-slate-700 border-b-3 border-transparent'
          }`}
        >
          Graph
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`pb-2 sm:pb-3 px-1 transition-all duration-200 ${
            viewMode === 'list'
              ? 'text-slate-900 font-bold border-b-3 border-slate-900'
              : 'text-slate-500 hover:text-slate-700 border-b-3 border-transparent'
          }`}
        >
          List
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="mt-10 flex justify-center items-center h-40">
          <div className="text-center">
            <LoadingSpinner size="md" />
            <p className="text-gray-600 mb-1 font-medium mt-3">Calculating performance...</p>
            <p className="text-xs text-gray-400">Fetching historical prices</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="mt-10 flex justify-center items-center h-40">
          <InlineError message={error?.message || String(error)} onRetry={refetch} />
        </div>
      )}

      {/* Performance View 1: Enhanced Bar Chart */}
      {!loading && !error && viewMode === 'graph' && (
        <div className="mt-8">
          {performanceData.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">
              No performance data available
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Calculate maximum absolute value for dynamic scaling */}
              {(() => {
                // Conditionally include S&P 500 in scale calculation based on toggle state
                const maxAbsValue = Math.max(
                  ...performanceData.map(d => {
                    const values = [Math.abs(d.return)];
                    if (showSP500) {
                      values.push(Math.abs(d.sp500));
                    }
                    return Math.max(...values);
                  })
                );
                const yAxisMax = getAdaptiveYAxisMax(maxAbsValue); // Adaptive rounding based on scale

                return (
                  <>
                    {/* Main Chart Area - Responsive */}
                    <div className="relative h-48 sm:h-52 bg-white rounded-lg border border-gray-300 shadow-sm p-2 sm:p-4 mb-2 overflow-hidden">
                      {/* Y-axis labels - Dynamic based on data */}
                      <div className="absolute left-1 top-4 sm:top-6 bottom-4 sm:bottom-6 flex flex-col justify-between text-[9px] sm:text-[10px] text-gray-600 font-semibold">
                        <span>+{yAxisMax}%</span>
                        <span className="text-gray-800 font-bold">0%</span>
                        <span>-{yAxisMax}%</span>
                      </div>

                      {/* Chart Container with proper centering */}
                      <div className="absolute left-8 sm:left-10 md:left-12 right-1 sm:right-2 md:right-4 top-4 sm:top-6 bottom-4 sm:bottom-6 flex flex-col">
                        {/* Top half (positive) */}
                        <div className="flex-1 relative flex justify-around items-end">
                          {performanceData.map((data, index) => {
                            const portfolioIsPositive = data.return > 0;
                            const portfolioIsZero = data.return === 0;
                            const sp500IsPositive = data.sp500 > 0;
                            const sp500IsZero = data.sp500 === 0;
                            const portfolioHeightPx = calculateBarHeight(data.return, yAxisMax);
                            const sp500HeightPx = calculateBarHeight(data.sp500, yAxisMax);

                            return (
                              <div
                                key={`${data.period}-pos`}
                                className="flex gap-0.5 items-end"
                                style={{ animation: `slideUp 0.5s ease-out ${index * 0.1}s both` }}
                              >
                                {/* Portfolio Bar - Show if positive or zero */}
                                {portfolioIsPositive ? (
                                  <div className="relative flex flex-col items-center">
                                    <p className="text-[9px] sm:text-[10px] font-bold mb-0.5 text-green-700">
                                      +{data.return}%
                                    </p>
                                    <div
                                      className="w-5 sm:w-7 md:w-8 rounded-t transition-all duration-200 hover:opacity-80 cursor-pointer group"
                                      style={{
                                        height: `${portfolioHeightPx}px`,
                                        backgroundColor: '#16a34a',
                                        border: '1px solid #15803d',
                                        transition: 'height 300ms ease'
                                      }}
                                      title={`Portfolio: +${data.return}%`}
                                    >
                                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[9px] sm:text-[10px] px-2 py-1 rounded font-semibold whitespace-nowrap z-30">
                                        Portfolio: +{data.return}%
                                      </div>
                                    </div>
                                  </div>
                                ) : portfolioIsZero ? (
                                  <div className="relative flex flex-col items-center">
                                    <p className="text-[9px] sm:text-[10px] font-bold mb-0.5 text-gray-600">
                                      0%
                                    </p>
                                    <div
                                      className="w-5 sm:w-7 md:w-8 bg-gray-400"
                                      style={{ height: '2px', transition: 'height 300ms ease' }}
                                      title="Portfolio: 0%"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-5 sm:w-7 md:w-8"></div>
                                )}

                                {/* S&P 500 Bar - Show if positive, zero, or toggle enabled */}
                                {showSP500 && sp500IsPositive ? (
                                  <div className="relative flex flex-col items-center">
                                    <p className={`text-[9px] sm:text-[10px] font-bold mb-0.5 ${getBenchmarkColorClass(data.sp500)}`}>
                                      {formatBenchmarkLabel(data.sp500)}
                                    </p>
                                    <div
                                      className="w-5 sm:w-7 md:w-8 rounded-t transition-all duration-200 hover:opacity-80 cursor-pointer group"
                                      style={{
                                        height: `${sp500HeightPx}px`,
                                        backgroundColor: '#86efac',
                                        border: '1px solid #4ade80',
                                        transition: 'height 300ms ease'
                                      }}
                                      title={`S&P 500: ${formatBenchmarkLabel(data.sp500)}`}
                                    >
                                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[9px] sm:text-[10px] px-2 py-1 rounded font-semibold whitespace-nowrap z-30">
                                        S&P 500: {formatBenchmarkLabel(data.sp500)}
                                      </div>
                                    </div>
                                  </div>
                                ) : showSP500 && sp500IsZero ? (
                                  <div className="relative flex flex-col items-center">
                                    <p className="text-[9px] sm:text-[10px] font-bold mb-0.5 text-gray-600">
                                      0%
                                    </p>
                                    <div
                                      className="w-5 sm:w-7 md:w-8 bg-gray-400"
                                      style={{ height: '2px', transition: 'height 300ms ease' }}
                                      title="S&P 500: 0%"
                                    />
                                  </div>
                                ) : showSP500 ? (
                                  <div className="w-5 sm:w-7 md:w-8"></div>
                                ) : null}
                              </div>
                            );
                          })}
                  </div>

                  {/* Zero Line */}
                  <div className="border-t-2 sm:border-t-3 border-gray-600" style={{ borderTopWidth: '2.5px' }}></div>

                        {/* Bottom half (negative) */}
                        <div className="flex-1 relative flex justify-around items-start">
                          {performanceData.map((data, index) => {
                            const portfolioIsNegative = data.return < 0;
                            const sp500IsNegative = data.sp500 < 0;
                            const portfolioHeightPx = calculateBarHeight(data.return, yAxisMax);
                            const sp500HeightPx = calculateBarHeight(data.sp500, yAxisMax);

                            return (
                              <div
                                key={`${data.period}-neg`}
                                className="flex gap-0.5 items-start"
                                style={{ animation: `slideUp 0.5s ease-out ${index * 0.1}s both` }}
                              >
                                {/* Portfolio Bar - Only show if negative */}
                                {portfolioIsNegative ? (
                                  <div className="relative flex flex-col items-center">
                                    <div
                                      className="w-5 sm:w-7 md:w-8 rounded-b transition-all duration-200 hover:opacity-80 cursor-pointer group"
                                      style={{
                                        height: `${portfolioHeightPx}px`,
                                        backgroundColor: '#dc2626',
                                        border: '1px solid #b91c1c',
                                        transition: 'height 300ms ease'
                                      }}
                                      title={`Portfolio: ${data.return}%`}
                                    >
                                      <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[9px] sm:text-[10px] px-2 py-1 rounded font-semibold whitespace-nowrap z-30">
                                        Portfolio: {data.return}%
                                      </div>
                                    </div>
                                    <p className="text-[9px] sm:text-[10px] font-bold mt-0.5 text-red-700">
                                      {data.return}%
                                    </p>
                                  </div>
                                ) : (
                                  <div className="w-5 sm:w-7 md:w-8"></div>
                                )}

                                {/* S&P 500 Bar - Only show if negative and toggle enabled */}
                                {showSP500 && sp500IsNegative ? (
                                  <div className="relative flex flex-col items-center">
                                    <div
                                      className="w-5 sm:w-7 md:w-8 rounded-b transition-all duration-200 hover:opacity-80 cursor-pointer group"
                                      style={{
                                        height: `${sp500HeightPx}px`,
                                        backgroundColor: '#fca5a5',
                                        border: '1px solid #f87171',
                                        transition: 'height 300ms ease'
                                      }}
                                      title={`S&P 500: ${formatBenchmarkLabel(data.sp500)}`}
                                    >
                                      <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[9px] sm:text-[10px] px-2 py-1 rounded font-semibold whitespace-nowrap z-30">
                                        S&P 500: {formatBenchmarkLabel(data.sp500)}
                                      </div>
                                    </div>
                                    <p className={`text-[9px] sm:text-[10px] font-bold mt-0.5 ${getBenchmarkColorClass(data.sp500)}`}>
                                      {formatBenchmarkLabel(data.sp500)}
                                    </p>
                                  </div>
                                ) : showSP500 ? (
                                  <div className="w-5 sm:w-7 md:w-8"></div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Period Labels - Responsive */}
                    <div className="flex justify-around items-start px-0 sm:px-2">
                      {performanceData.map((data) => (
                        <div key={data.period} className="flex-1 text-center">
                          <p className="text-xs sm:text-sm font-bold text-gray-800">{data.period}</p>
                          {data.holdings_count > 0 && (
                            <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">
                              {data.holdings_count} {data.holdings_count === 1 ? 'stock' : 'stocks'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Performance View 2: Enhanced List View - Responsive */}
      {!loading && !error && viewMode === 'list' && (
        <div className="mt-4 sm:mt-6">
          {performanceData.length === 0 ? (
            <div className="text-center text-gray-500 py-8 sm:py-12 bg-gray-50 rounded-lg">
              No performance data available
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-300 shadow-sm">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-[10px] sm:text-xs text-slate-700 font-bold border-b-2 border-slate-200">
                    <th className="py-2 sm:py-3 px-2 sm:px-4 text-left">Period</th>
                    <th className="py-2 sm:py-3 px-2 sm:px-4 text-right">Portfolio</th>
                    {showSP500 && (
                      <>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-right hidden sm:table-cell">S&P 500</th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-right">+/- S&P</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {performanceData.map((data, index) => (
                    <tr
                      key={data.period}
                      className="hover:bg-slate-50 transition-colors duration-150"
                      style={{ animation: `fadeIn 0.3s ease-out ${index * 0.1}s both` }}
                    >
                      <td className="py-3 sm:py-4 px-2 sm:px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{data.period}</span>
                          {data.portfolio_value_current && (
                            <span className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                              ${data.portfolio_value_current.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 sm:py-4 px-2 sm:px-4 text-right">
                        <span
                          className={`inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-bold text-[10px] sm:text-sm ${
                            data.isPositive
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {data.return > 0 ? '+' : ''}
                          {data.return.toFixed(2)}%
                        </span>
                      </td>
                      {showSP500 && (
                        <>
                          <td className="py-3 sm:py-4 px-2 sm:px-4 text-right hidden sm:table-cell">
                            <span className="font-semibold text-slate-600">
                              {data.sp500 > 0 ? '+' : ''}
                              {data.sp500.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 sm:py-4 px-2 sm:px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-0.5 sm:gap-1 font-bold text-[10px] sm:text-sm ${
                                data.outperformance >= 0 ? 'text-green-700' : 'text-red-700'
                              }`}
                            >
                              {data.outperformance >= 0 ? '↗' : '↘'}
                              {data.outperformance > 0 ? '+' : ''}
                              {data.outperformance.toFixed(2)}%
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Legend & Action Link - Responsive */}
      {!loading && !error && performanceData.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-gray-200">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <div
                className="w-4 h-4 sm:w-5 sm:h-5 rounded"
                style={{ backgroundColor: '#16a34a', border: '1px solid #15803d' }}
              ></div>
              <span className="text-gray-800 font-semibold">Your Portfolio</span>
            </div>
            {showSP500 && (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                <div
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded"
                  style={{ backgroundColor: '#86efac', border: '1px solid #4ade80' }}
                ></div>
                <span className="text-gray-800 font-semibold">S&P 500</span>
              </div>
            )}
          </div>
          <button
            onClick={onViewPerformance}
            className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-all flex items-center gap-1"
          >
            VIEW DETAIL →
          </button>
        </div>
      )}

      {/* Add keyframes for animations */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .border-b-3 {
          border-bottom-width: 3px;
        }
      `}</style>
    </div>
  );
};

PerformanceCard.propTypes = {
  onViewPerformance: PropTypes.func.isRequired,
};

export default PerformanceCard;
