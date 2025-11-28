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
 * @param {Array} props.timeframes - Custom array of timeframes to display (optional)
 * @param {string} props.className - Additional CSS classes for wrapper
 */
interface TimeRangeSelectorProps {
  activeTimeframe?: string;
  onTimeframeChange: (timeframe: string) => void;
  timeframes?: string[];
  className?: string;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  activeTimeframe = '1W',
  onTimeframeChange,
  timeframes = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y'],
  className = ''
}) => {
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
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
