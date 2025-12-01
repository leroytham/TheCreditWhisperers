import React from 'react';
import { PerformanceListViewProps } from './performanceTypes';

/**
 * List/table view for portfolio performance
 */
const PerformanceListView: React.FC<PerformanceListViewProps> = ({
  performanceData,
  showSP500
}) => {
  if (performanceData.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 sm:py-12 bg-gray-50 rounded-lg">
        No performance data available
      </div>
    );
  }

  return (
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
  );
};

export default PerformanceListView;
