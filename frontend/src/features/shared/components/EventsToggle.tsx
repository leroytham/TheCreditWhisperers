import React from 'react';

/**
 * EventsToggle Component
 *
 * Toggle switch for showing/hiding significant events on price chart
 *
 * @param {Object} props
 * @param {boolean} props.showEvents - Whether events are currently shown
 * @param {function} props.onToggle - Callback when toggle is changed
 * @param {string} props.className - Additional CSS classes for wrapper
 */
const EventsToggle = ({
  showEvents = true,
  onToggle,
  className = ''
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm font-medium text-gray-700">Significant Events</span>
      <button
        onClick={() => onToggle(!showEvents)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          showEvents ? 'bg-blue-600' : 'bg-gray-300'
        }`}
        role="switch"
        aria-checked={showEvents}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            showEvents ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};

export default EventsToggle;
