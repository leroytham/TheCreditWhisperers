/**
 * PerformanceChartControls - Chart control buttons and toggles
 *
 * Includes display mode toggle (Value/Percent), S&P 500 toggle, events toggle, and timeframe selector.
 */

import React from 'react';
import TimeRangeSelector from '../../../shared/components/TimeRangeSelector';

export interface PerformanceChartControlsProps {
  displayMode: 'value' | 'percent';
  setDisplayMode: (mode: 'value' | 'percent') => void;
  showBenchmark: boolean;
  setShowBenchmark: (show: boolean) => void;
  showEvents: boolean;
  setShowEvents: (show: boolean) => void;
  timeframe: string;
  setTimeframe: (timeframe: string) => void;
  timeframes?: string[];
}

export const PerformanceChartControls: React.FC<PerformanceChartControlsProps> = ({
  displayMode,
  setDisplayMode,
  showBenchmark,
  setShowBenchmark,
  showEvents,
  setShowEvents,
  timeframe,
  setTimeframe,
  timeframes = ['1M', '3M', '6M', 'YTD', '1Y'],
}) => {
  return (
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
        timeframes={timeframes}
      />
    </div>
  );
};

export default PerformanceChartControls;
