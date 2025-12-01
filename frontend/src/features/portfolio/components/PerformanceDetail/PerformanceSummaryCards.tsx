/**
 * PerformanceSummaryCards - Performance metrics summary cards
 *
 * Displays 5 cards: Portfolio Value, Period Return, S&P 500 Return, Outperformance, Holdings
 */

import React from 'react';
import { formatCurrency, formatPercentage } from '../../../../utils/formatters';

export interface PerformanceSummaryCardsProps {
  currentValue: number;
  adjustedAbsoluteReturn?: number;
  cumulativeCapitalFlow?: number;
  period?: string;
  hasCashFlows?: boolean;
  twrReturn?: number | null;
  displayReturn?: number;
  percentReturn?: number;
  absoluteReturn?: number;
  benchmarkReturn?: number;
  outperformance?: number;
  holdingsCount?: number;
  // Chart-derived values for alignment in percent mode
  chartDisplayReturn?: number | null;
  chartOutperformance?: number | null;
  displayMode: 'value' | 'percent';
}

export const PerformanceSummaryCards: React.FC<PerformanceSummaryCardsProps> = ({
  currentValue,
  adjustedAbsoluteReturn,
  cumulativeCapitalFlow,
  period,
  hasCashFlows,
  twrReturn,
  displayReturn,
  percentReturn,
  absoluteReturn,
  benchmarkReturn,
  outperformance,
  holdingsCount,
  chartDisplayReturn,
  chartOutperformance,
  displayMode,
}) => {
  // Calculate the return value to display
  const getDisplayReturnValue = () => {
    if (displayMode === 'percent' && chartDisplayReturn !== null && chartDisplayReturn !== undefined) {
      return chartDisplayReturn;
    }
    return displayReturn || percentReturn || 0;
  };

  const returnValue = getDisplayReturnValue();

  // Calculate the outperformance value to display
  const getOutperformanceValue = () => {
    if (chartOutperformance !== null && chartOutperformance !== undefined) {
      return chartOutperformance;
    }
    return outperformance || 0;
  };

  const outperformanceValue = getOutperformanceValue();

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {/* Portfolio Value Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div>
          <p className="text-sm text-gray-500">Portfolio Value</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(currentValue || 0)}
          </p>
          {adjustedAbsoluteReturn !== undefined && (
            <p className={`text-sm mt-1 ${adjustedAbsoluteReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {adjustedAbsoluteReturn >= 0 ? '+' : ''}
              {formatCurrency(adjustedAbsoluteReturn)}
              {cumulativeCapitalFlow !== 0 && cumulativeCapitalFlow !== undefined && (
                <span className="text-gray-500 text-xs ml-1" title="Capital flows netted out">
                  (net of {formatCurrency(Math.abs(cumulativeCapitalFlow))} {cumulativeCapitalFlow > 0 ? 'deposits' : 'withdrawals'})
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Period Return Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500">{period || 'Period'} Return</p>
            {hasCashFlows && twrReturn !== null && (
              <span
                className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded"
                title="Time-Weighted Return: accounts for deposits/withdrawals"
              >
                TWR
              </span>
            )}
          </div>
          <p className={`text-2xl font-bold ${returnValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercentage(returnValue)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(absoluteReturn || 0)}
            {hasCashFlows && twrReturn !== percentReturn && (
              <span className="ml-2 text-xs text-gray-400">
                (Simple: {formatPercentage(percentReturn || 0)})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* S&P 500 Return Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div>
          <p className="text-sm text-gray-500">S&P 500 Return</p>
          <p className={`text-2xl font-bold ${(benchmarkReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercentage(benchmarkReturn || 0)}
          </p>
        </div>
      </div>

      {/* Outperformance Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div>
          <p className="text-sm text-gray-500">Outperformance</p>
          <p className={`text-2xl font-bold ${outperformanceValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercentage(outperformanceValue)}
          </p>
        </div>
      </div>

      {/* Holdings Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div>
          <p className="text-sm text-gray-500">Holdings</p>
          <p className="text-2xl font-bold text-gray-900">
            {holdingsCount || 0}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PerformanceSummaryCards;
