/**
 * PerformanceWarningBanners - Warning and info banners for performance chart
 *
 * Displays zero-baseline information and missing symbols warnings.
 */

import React from 'react';
import { parseExchangeDate } from '../../../shared/utils/formatters';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartDataPoint = any;

export interface PerformanceWarningBannersProps {
  displayMode: 'value' | 'percent';
  chartPriceData?: ChartDataPoint[];
  missingSymbols?: string[];
  exchange?: string;
}

export const PerformanceWarningBanners: React.FC<PerformanceWarningBannersProps> = ({
  displayMode,
  chartPriceData,
  missingSymbols = [],
  exchange = 'NYSE',
}) => {
  const firstPoint = chartPriceData?.[0];
  const isZeroBaseline = displayMode === 'percent' && firstPoint?.isZeroBaseline;
  const hasNoInvestments = firstPoint?.hasNoInvestments;
  const baselineValue = firstPoint?.baselineValue;
  const baselineDate = firstPoint?.baselineDate;

  const hasChartPoints = Array.isArray(chartPriceData) && chartPriceData.length > 0;
  const showMissingSymbolsWarning = hasChartPoints && missingSymbols.length > 0;

  return (
    <>
      {/* Zero-Baseline Information Banner */}
      {isZeroBaseline && (
        <>
          {hasNoInvestments ? (
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
          ) : (
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
                      <span> on {parseExchangeDate(baselineDate, exchange)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    )}.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Missing Symbols Warning */}
      {showMissingSymbolsWarning && (
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
      )}
    </>
  );
};

export default PerformanceWarningBanners;
