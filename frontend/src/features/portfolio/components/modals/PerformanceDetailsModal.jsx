import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

/**
 * PerformanceDetailsModal Component
 *
 * Displays detailed performance metrics with chart/table toggle
 */
const PerformanceDetailsModal = ({ isOpen, onClose }) => {
  const [viewMode, setViewMode] = useState('graph');
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const performanceData = [
    { period: 'Month-to-Date (MTD)', return: 6.0, returnDollar: '+$37,949.79', sp500: 5.0 },
    { period: 'Quarter-to-Date (QTD)', return: -2.0, returnDollar: '-$12,649.93', sp500: -1.5 },
    { period: 'Year-to-Date (YTD)', return: 5.0, returnDollar: '+$31,624.83', sp500: 7.0 },
    { period: 'Inception-to-Date (ITD)', return: 8.0, returnDollar: '+$50,599.72', sp500: 4.0 },
  ];

  const generateData = (startValue, days, volatility) => {
    const data = [];
    let value = startValue;
    for (let i = 0; i < days; i++) {
      const fluctuation = (Math.random() - 0.48) * volatility;
      value *= 1 + fluctuation;
      data.push(value);
    }
    return data;
  };

  const generateLabels = (days) => {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return labels;
  };

  useEffect(() => {
    if (isOpen && viewMode === 'graph' && chartRef.current) {
      // Destroy existing chart
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      const labels = generateLabels(30);
      const portfolioData = generateData(632496, 30, 0.04);
      const sp500Data = generateData(5000, 30, 0.035);

      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Portfolio Value',
              data: portfolioData,
              borderColor: 'rgb(29, 78, 216)',
              backgroundColor: 'rgba(29, 78, 216, 0.1)',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.1,
              yAxisID: 'y',
            },
            {
              label: 'S&P 500',
              data: sp500Data,
              borderColor: 'rgb(252, 211, 77)',
              backgroundColor: 'rgba(252, 211, 77, 0.1)',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.1,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: { display: true, text: 'Portfolio Value ($)' },
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: { display: true, text: 'S&P 500 Index' },
              grid: { drawOnChartArea: false },
            },
          },
        },
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [isOpen, viewMode]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative mx-auto p-8 border w-full max-w-4xl shadow-lg rounded-md bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-semibold text-gray-900">Performance Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div>
          <div className="flex space-x-6 border-b text-sm mb-6">
            <button
              onClick={() => setViewMode('graph')}
              className={`pb-2 ${
                viewMode === 'graph'
                  ? 'text-black font-semibold border-b-2 border-black'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`pb-2 ${
                viewMode === 'list'
                  ? 'text-black font-semibold border-b-2 border-black'
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              List
            </button>
          </div>

          {/* View 1: Performance Line Chart */}
          {viewMode === 'graph' && (
            <div>
              <canvas ref={chartRef}></canvas>
            </div>
          )}

          {/* View 2: Performance Data Table */}
          {viewMode === 'list' && (
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs text-gray-500 font-semibold border-b">
                  <th className="py-3 font-medium">Period</th>
                  <th className="py-3 font-medium text-right">Return (%)</th>
                  <th className="py-3 font-medium text-right">Return ($)</th>
                  <th className="py-3 font-medium text-right">S&P 500 (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {performanceData.map((data) => (
                  <tr key={data.period}>
                    <td className="py-3 font-semibold">{data.period}</td>
                    <td
                      className={`py-3 text-right font-semibold ${
                        data.return >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {data.return > 0 ? '+' : ''}
                      {data.return.toFixed(2)}%
                    </td>
                    <td
                      className={`py-3 text-right ${
                        data.return >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {data.returnDollar}
                    </td>
                    <td className="py-3 text-right font-semibold">
                      {data.sp500 > 0 ? '+' : ''}
                      {data.sp500.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceDetailsModal;
