import React from 'react';

/**
 * ViewModeToggle Component
 *
 * Toggle switch for sentiment visualization modes
 * Switches between "Rolling 24h Windows" and "Daily Average" views
 *
 * @param {Object} props
 * @param {string} props.activeMode - Currently selected mode ('rolling' or 'daily')
 * @param {function} props.onModeChange - Callback when mode is changed
 * @param {string} props.className - Additional CSS classes for wrapper
 */
const ViewModeToggle = ({
  activeMode = 'rolling',
  onModeChange,
  className = ''
}) => {
  const modes = [
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
