import React from 'react';

/**
 * TimeRangeSelector Component
 *
 * Reusable time range selector with buttons for different timeframes
 * Used across sentiment and volume charts for synchronized time range selection
 *
 * @param {Object} props
 * @param {string} props.activeTimeframe - Currently selected timeframe
 * @param {function} props.onTimeframeChange - Callback when timeframe is changed
 * @param {string} props.className - Additional CSS classes for wrapper
 */
const TimeRangeSelector = ({
  activeTimeframe = '1W',
  onTimeframeChange,
  className = ''
}) => {
  const timeframes = ['1W', '1M'];

  return (
    <div className={`flex space-x-1 ${className}`}>
      {timeframes.map((tf) => (
        <button
          key={tf}
          onClick={() => onTimeframeChange(tf)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            activeTimeframe === tf
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-100 bg-white border border-gray-300'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
};

export default TimeRangeSelector;
