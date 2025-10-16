import React from 'react';
import { MAX_EVENTS_DISPLAY } from '../utils/constants';

/**
 * Shared SignificantEvents Component
 *
 * Displays significant price movement events with related news
 * Used by both Entity and Sector features
 *
 * @param {Object} props
 * @param {Array} props.events - Array of significant events
 * @param {string} props.ticker - Ticker symbol for display context
 * @param {string} props.sectorName - Sector name for display context
 * @param {string} props.className - Additional CSS classes for wrapper
 * @param {number} props.maxEvents - Maximum number of events to display (default from constants)
 */
const SignificantEvents = ({
  events,
  ticker,
  sectorName,
  className = 'bg-white border-l border-gray-200 rounded-lg shadow-sm p-4',
  maxEvents = MAX_EVENTS_DISPLAY
}) => {
  const displayName = sectorName || ticker;

  if (!events || events.length === 0) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Significant Events</h3>
          {displayName && <span className="text-sm text-gray-500">{displayName}</span>}
        </div>
        <div className="text-gray-400 text-sm">
          No significant events found{displayName ? ` for ${displayName}` : ''}.
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Significant Events</h3>
        {displayName && <span className="text-sm text-gray-500">{displayName}</span>}
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {events.slice(0, maxEvents).map((event, idx) => (
          <div key={idx} className="border-b border-gray-100 pb-3">
            {/* Event Header */}
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-semibold text-gray-800">
                <span
                  className={`inline-block w-3 h-3 rounded-full mr-2 ${
                    event.trend === 'Upward' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                ></span>
                {event.trend} Move · {event.total_move_pct.toFixed(2)}%
              </h4>
            </div>

            {/* Event Date */}
            <p className="text-xs text-gray-500 mb-2">{event.start_date}</p>

            {/* Related News */}
            {event.news && event.news.length > 0 && (
              <ul className="text-xs text-gray-600 space-y-1">
                {event.news.slice(0, 2).map((n, i) => (
                  <li key={i} className="pl-2 border-l-2 border-blue-200">
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600"
                    >
                      {n.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SignificantEvents;
