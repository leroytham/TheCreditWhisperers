import React, { useState } from 'react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { InlineError } from '../../../components/ErrorDisplay';
import { usePortfolioOverview } from '../hooks/usePortfolioOverview';
import { PerformanceBarChart, PerformanceListView } from './PerformanceCard/index';
import type { PerformanceCardProps, PerformanceDataPoint } from './PerformanceCard/performanceTypes';

/**
 * PerformanceCard Component
 *
 * Displays REAL portfolio performance metrics with graph/list toggle
 * Compares your ACTUAL portfolio holdings against S&P 500 benchmark
 */
const PerformanceCard: React.FC<PerformanceCardProps> = ({ onViewPerformance }) => {
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [showSP500, setShowSP500] = useState(true);

  const { performance, performanceLoading, performanceError, refetchPerformance } = usePortfolioOverview();

  const loading = performanceLoading;
  const error = performanceError;
  const refetch = refetchPerformance;

  const performanceData: PerformanceDataPoint[] = performance?.performance || [];
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

      {/* Graph View */}
      {!loading && !error && viewMode === 'graph' && (
        <div className="mt-8">
          <PerformanceBarChart performanceData={performanceData} showSP500={showSP500} />
        </div>
      )}

      {/* List View */}
      {!loading && !error && viewMode === 'list' && (
        <div className="mt-4 sm:mt-6">
          <PerformanceListView performanceData={performanceData} showSP500={showSP500} />
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
      <style>{`
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

export default PerformanceCard;
