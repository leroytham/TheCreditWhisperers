import React from 'react';
import { PerformanceBarChartProps } from './performanceTypes';
import {
  formatBenchmarkLabel,
  getBenchmarkColorClass,
  getAdaptiveYAxisMax,
  calculateBarHeight
} from './performanceUtils';

/**
 * Bar chart visualization for portfolio performance
 */
const PerformanceBarChart: React.FC<PerformanceBarChartProps> = ({
  performanceData,
  showSP500
}) => {
  if (performanceData.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">
        No performance data available
      </div>
    );
  }

  // Calculate maximum absolute value for dynamic scaling
  const maxAbsValue = Math.max(
    ...performanceData.map(d => {
      const values = [Math.abs(d.return)];
      if (showSP500) {
        values.push(Math.abs(d.sp500));
      }
      return Math.max(...values);
    })
  );
  const yAxisMax = getAdaptiveYAxisMax(maxAbsValue);

  return (
    <div className="flex flex-col">
      {/* Main Chart Area */}
      <div className="relative h-48 sm:h-52 bg-white rounded-lg border border-gray-300 shadow-sm p-2 sm:p-4 mb-2 overflow-hidden">
        {/* Y-axis labels */}
        <div className="absolute left-1 top-4 sm:top-6 bottom-4 sm:bottom-6 flex flex-col justify-between text-[9px] sm:text-[10px] text-gray-600 font-semibold">
          <span>+{yAxisMax}%</span>
          <span className="text-gray-800 font-bold">0%</span>
          <span>-{yAxisMax}%</span>
        </div>

        {/* Chart Container */}
        <div className="absolute left-8 sm:left-10 md:left-12 right-1 sm:right-2 md:right-4 top-4 sm:top-6 bottom-4 sm:bottom-6 flex flex-col">
          {/* Top half (positive) */}
          <div className="flex-1 relative flex justify-around items-end">
            {performanceData.map((data, index) => (
              <PositiveBar
                key={`${data.period}-pos`}
                data={data}
                index={index}
                yAxisMax={yAxisMax}
                showSP500={showSP500}
              />
            ))}
          </div>

          {/* Zero Line */}
          <div className="border-t-2 sm:border-t-3 border-gray-600" style={{ borderTopWidth: '2.5px' }} />

          {/* Bottom half (negative) */}
          <div className="flex-1 relative flex justify-around items-start">
            {performanceData.map((data, index) => (
              <NegativeBar
                key={`${data.period}-neg`}
                data={data}
                index={index}
                yAxisMax={yAxisMax}
                showSP500={showSP500}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Period Labels */}
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
    </div>
  );
};

// Positive bar sub-component
interface BarProps {
  data: { period: string; return: number; sp500: number };
  index: number;
  yAxisMax: number;
  showSP500: boolean;
}

const PositiveBar: React.FC<BarProps> = ({ data, index, yAxisMax, showSP500 }) => {
  const portfolioIsPositive = data.return > 0;
  const portfolioIsZero = data.return === 0;
  const sp500IsPositive = data.sp500 > 0;
  const sp500IsZero = data.sp500 === 0;
  const portfolioHeightPx = calculateBarHeight(data.return, yAxisMax);
  const sp500HeightPx = calculateBarHeight(data.sp500, yAxisMax);

  return (
    <div
      className="flex gap-0.5 items-end"
      style={{ animation: `slideUp 0.5s ease-out ${index * 0.1}s both` }}
    >
      {/* Portfolio Bar */}
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
          <p className="text-[9px] sm:text-[10px] font-bold mb-0.5 text-gray-600">0%</p>
          <div
            className="w-5 sm:w-7 md:w-8 bg-gray-400"
            style={{ height: '2px', transition: 'height 300ms ease' }}
            title="Portfolio: 0%"
          />
        </div>
      ) : (
        <div className="w-5 sm:w-7 md:w-8" />
      )}

      {/* S&P 500 Bar */}
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
          <p className="text-[9px] sm:text-[10px] font-bold mb-0.5 text-gray-600">0%</p>
          <div
            className="w-5 sm:w-7 md:w-8 bg-gray-400"
            style={{ height: '2px', transition: 'height 300ms ease' }}
            title="S&P 500: 0%"
          />
        </div>
      ) : showSP500 ? (
        <div className="w-5 sm:w-7 md:w-8" />
      ) : null}
    </div>
  );
};

const NegativeBar: React.FC<BarProps> = ({ data, index, yAxisMax, showSP500 }) => {
  const portfolioIsNegative = data.return < 0;
  const sp500IsNegative = data.sp500 < 0;
  const portfolioHeightPx = calculateBarHeight(data.return, yAxisMax);
  const sp500HeightPx = calculateBarHeight(data.sp500, yAxisMax);

  return (
    <div
      className="flex gap-0.5 items-start"
      style={{ animation: `slideUp 0.5s ease-out ${index * 0.1}s both` }}
    >
      {/* Portfolio Bar */}
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
        <div className="w-5 sm:w-7 md:w-8" />
      )}

      {/* S&P 500 Bar */}
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
        <div className="w-5 sm:w-7 md:w-8" />
      ) : null}
    </div>
  );
};

export default PerformanceBarChart;
