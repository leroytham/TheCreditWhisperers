import React from 'react';

interface EventsToggleProps {
  showEvents?: boolean;
  onToggle: (value: boolean) => void;
  className?: string;
}

/**
 * EventsToggle Component
 *
 * Toggle switch for showing/hiding significant events on price chart
 */
const EventsToggle: React.FC<EventsToggleProps> = ({
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
