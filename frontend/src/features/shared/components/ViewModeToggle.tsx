import React from 'react';

/**
 * ViewModeToggle Component
 *
 * Toggle switch for sentiment visualization modes
 * Switches between "Rolling 24h Windows" and "Daily Average" views
 * Hides toggle completely for aggregated timeframes (shows read-only indicator instead)
 *
 * @param {Object} props
 * @param {string} props.activeMode - Currently selected mode ('rolling', 'daily', 'weekly', or 'monthly')
 * @param {function} props.onModeChange - Callback when mode is changed
 * @param {string} props.timeframe - Current timeframe (affects which modes are available)
 * @param {string} props.className - Additional CSS classes for wrapper
 */
export type ViewModeType = 'rolling' | 'daily' | 'weekly' | 'monthly';

interface ViewModeToggleProps {
  activeMode?: ViewModeType;
  onModeChange: (mode: ViewModeType) => void;
  timeframe?: string;
  className?: string;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  activeMode = 'rolling',
  onModeChange,
  timeframe = '1W',
  className = ''
}) => {
  // For long timeframes, show read-only aggregation indicator instead of toggle
  if (['1Y'].includes(timeframe)) {
    return (
      <div className={`inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 ${className}`}>
        <span className="text-sm font-medium text-gray-700">Monthly Averages</span>
      </div>
    );
  }

  if (['3M', '6M', 'YTD'].includes(timeframe)) {
    return (
      <div className={`inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 ${className}`}>
        <span className="text-sm font-medium text-gray-700">Weekly Averages</span>
      </div>
    );
  }

  // For 1D, 1W, 1M: show toggle between rolling and daily
  const modes: { id: ViewModeType; label: string }[] = [
    { id: 'rolling', label: 'Rolling 24h Windows' },
    { id: 'daily', label: 'Daily Average' }
  ];

  return (
    <div className={`inline-flex rounded-lg border border-gray-300 bg-white ${className}`}>
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            activeMode === mode.id
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-50'
          } ${
            mode.id === 'rolling'
              ? 'rounded-l-lg'
              : 'rounded-r-lg border-l border-gray-300'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
};

export default ViewModeToggle;
