import React, { useState } from 'react';

/**
 * PerformanceCard Component
 *
 * Displays portfolio performance metrics with graph/list toggle
 */
const PerformanceCard = ({ onViewPerformance }) => {
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'list'

  const performanceData = [
    { period: 'MTD', return: 6.0, sp500: 5.0, isPositive: true },
    { period: 'QTD', return: -2.0, sp500: -1.5, isPositive: false },
    { period: 'YTD', return: 5.0, sp500: 7.0, isPositive: true },
    { period: 'ITD', return: 8.0, sp500: 4.0, isPositive: true },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance</h2>
      <div className="flex space-x-6 text-sm">
        <button
          onClick={() => setViewMode('graph')}
          className={`pb-2 ${
            viewMode === 'graph'
              ? 'text-black font-semibold border-b-2 border-black'
              : 'text-gray-500 hover:text-black border-b-2 border-transparent'
          }`}
        >
          Graph
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`pb-2 ${
            viewMode === 'list'
              ? 'text-black font-semibold border-b-2 border-black'
              : 'text-gray-500 hover:text-black border-b-2 border-transparent'
          }`}
        >
          List
        </button>
      </div>

      {/* Performance View 1: Bar Chart */}
      {viewMode === 'graph' && (
        <div className="mt-8">
          <div className="flex flex-col">
            {/* Main Chart Area */}
            <div className="relative flex justify-around items-center h-32">
              {/* X-Axis Line */}
              <div className="absolute w-full top-1/2 border-t border-gray-300 -translate-y-px"></div>

              {performanceData.map((data) => (
                <div key={data.period} className="relative w-1/4 h-full">
                  {data.isPositive ? (
                    <div
                      className="absolute bottom-1/2 w-full flex justify-center items-end space-x-1"
                      style={{ height: '50%' }}
                    >
                      <div
                        className="relative w-5 bg-amber-400"
                        style={{ height: `${Math.abs(data.return) * 10}%` }}
                      >
                        <p className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap">
                          +{data.return}%
                        </p>
                      </div>
                      <div
                        className="w-5 striped-bar"
                        style={{ height: `${Math.abs(data.sp500) * 10}%` }}
                      ></div>
                    </div>
                  ) : (
                    <>
                      <div className="absolute bottom-1/2 w-full flex justify-center items-end space-x-1 mb-1">
                        <p className="w-5 text-center text-xs font-semibold text-red-500">
                          {data.return}%
                        </p>
                        <div className="w-5"></div>
                      </div>
                      <div
                        className="absolute top-1/2 w-full flex justify-center items-start space-x-1 pt-px"
                        style={{ height: '50%' }}
                      >
                        <div
                          className="w-5 bg-red-500"
                          style={{ height: `${Math.abs(data.return) * 10}%` }}
                        ></div>
                        <div
                          className="w-5 striped-bar-red"
                          style={{ height: `${Math.abs(data.sp500) * 10}%` }}
                        ></div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Period Labels */}
            <div className="flex justify-around items-start pt-1">
              {performanceData.map((data) => (
                <p key={data.period} className="text-xs text-gray-500 w-1/4 text-center">
                  {data.period}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Performance View 2: List View */}
      {viewMode === 'list' && (
        <div className="mt-6">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-gray-500 font-semibold border-b">
                <th className="py-2 font-medium">Period</th>
                <th className="py-2 font-medium text-right">Return (%)</th>
                <th className="py-2 font-medium text-right">S&P 500 (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {performanceData.map((data) => (
                <tr key={data.period}>
                  <td className="py-2 font-semibold">{data.period}</td>
                  <td
                    className={`py-2 text-right font-semibold ${
                      data.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {data.return > 0 ? '+' : ''}
                    {data.return.toFixed(2)}%
                  </td>
                  <td className="py-2 text-right font-semibold">
                    {data.sp500 > 0 ? '+' : ''}
                    {data.sp500.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Chart Legend & Action Link */}
      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center space-x-2 text-sm">
          <div className="w-3 h-3 striped-bar"></div>
          <span className="text-gray-600">S&P 500</span>
        </div>
        <button
          onClick={onViewPerformance}
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          VIEW DETAIL
        </button>
      </div>
    </div>
  );
};

export default PerformanceCard;
