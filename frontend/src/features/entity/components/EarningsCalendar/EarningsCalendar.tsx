// frontend/src/features/entity/components/EarningsCalendar/EarningsCalendar.tsx

import React from 'react';
import { useEarningsCalendar } from '../../hooks/useEarningsCalendar';
import type { EarningsEvent } from '../../../../types';
import {
  Calendar,
  TrendingUp,
  Clock,
  DollarSign,
  AlertCircle,
  Loader2,
  ChevronRight
} from 'lucide-react';

interface EarningsCalendarProps {
  ticker: string;
  className?: string;
  maxEvents?: number;
}

/**
 * EarningsCalendar Component
 *
 * Displays upcoming earnings calendar events with dates, EPS estimates, and time indicators.
 * Features:
 * - Timeline view of upcoming earnings events
 * - Color-coded status indicators (this week, this month, upcoming)
 * - EPS estimates and fiscal period information
 * - Time until earnings display (e.g., "in 5 days", "in 2 weeks")
 * - Past earnings events (for reference)
 * - Empty state handling
 * - Loading skeleton
 */
const EarningsCalendar: React.FC<EarningsCalendarProps> = ({ ticker, className = '', maxEvents = 10 }) => {
  const {
    earningsEvents,
    groupedEvents,
    loading,
    error,
    metadata,
    formatTimeUntil,
    formatDate,
    getStatusColor,
    getStatusLabel
  } = useEarningsCalendar(ticker);

  // Filter to show only upcoming events (past events can be shown separately if needed)
  const upcomingEvents = earningsEvents
    .filter(event => event.days_until >= 0)
    .slice(0, maxEvents);

  if (loading) {
    return (
      <div className={`${className} bg-white border border-gray-200 rounded-lg shadow p-6`}>
        <div className="flex items-center space-x-3 mb-6">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Earnings</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">Loading earnings calendar...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isPremiumError = error.includes('premium') || error.includes('subscription');
    const isRateLimitError = error.includes('rate limit');

    return (
      <div className={`${className} bg-white border border-gray-200 rounded-lg shadow p-6`}>
        <div className="flex items-center space-x-3 mb-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Earnings</h3>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900">Unable to Load Earnings Calendar</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>

              {isPremiumError && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-900">
                    <strong>Note:</strong> The Earnings Calendar API requires a premium Alpha Vantage subscription.
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    You can view past earnings transcripts in the Earnings tab.
                  </p>
                </div>
              )}

              {isRateLimitError && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-900">
                    <strong>Tip:</strong> Please wait a minute and refresh the page.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!earningsEvents || earningsEvents.length === 0) {
    return (
      <div className={`${className} bg-white border border-gray-200 rounded-lg shadow p-6`}>
        <div className="flex items-center space-x-3 mb-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Earnings</h3>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">No Upcoming Earnings</p>
          <p className="text-gray-600 text-sm mt-1">
            No earnings calendar data available for {ticker}
          </p>
        </div>
      </div>
    );
  }

  if (upcomingEvents.length === 0) {
    return (
      <div className={`${className} bg-white border border-gray-200 rounded-lg shadow p-6`}>
        <div className="flex items-center space-x-3 mb-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Earnings</h3>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">No Upcoming Earnings</p>
          <p className="text-gray-600 text-sm mt-1">
            All earnings events for {ticker} are in the past
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} bg-white border border-gray-200 rounded-lg shadow`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Earnings</h3>
          </div>
          <div className="text-sm text-gray-600">
            {upcomingEvents.length} event{upcomingEvents.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="divide-y divide-gray-200">
        {upcomingEvents.map((event: EarningsEvent, idx: number) => {
          const isImminent = event.days_until <= 7;
          const statusColor = getStatusColor(event.days_until);
          const statusLabel = getStatusLabel(event.days_until);

          return (
            <div
              key={`${event.earnings_date}-${idx}`}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                isImminent ? 'bg-red-50/30' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Date and Status Badge */}
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="flex items-center space-x-2">
                      <Clock className={`w-4 h-4 ${isImminent ? 'text-red-600' : 'text-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(event.earnings_date)}
                      </span>
                    </div>
                    <span
                      className={`
                        px-2 py-1 rounded-full text-xs font-medium border
                        ${statusColor}
                      `}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {/* Time Until */}
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`text-sm font-semibold ${
                      isImminent ? 'text-red-700' : 'text-blue-700'
                    }`}>
                      {formatTimeUntil(event.days_until)}
                    </span>
                  </div>

                  {/* EPS Estimate */}
                  {event.estimated_eps && (
                    <div className="flex items-center space-x-2 mb-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        Est. EPS: <span className="font-medium">${event.estimated_eps}</span>
                        {event.currency && event.currency !== 'USD' && (
                          <span className="text-xs text-gray-500 ml-1">({event.currency})</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Reported EPS (for past events that might be included) */}
                  {event.reported_eps && (
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-700">
                        Reported EPS: <span className="font-medium">${event.reported_eps}</span>
                      </span>
                      {event.surprise && (
                        <span className={`text-xs font-medium ${
                          Number(event.surprise) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ({Number(event.surprise) > 0 ? '+' : ''}{event.surprise})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Fiscal Period */}
                  {event.fiscal_period_ending && (
                    <div className="text-xs text-gray-500 mt-1">
                      Fiscal period ending: {formatDate(event.fiscal_period_ending)}
                    </div>
                  )}
                </div>

                {/* Arrow Icon for emphasis on imminent events */}
                {isImminent && (
                  <ChevronRight className="w-5 h-5 text-red-600 flex-shrink-0 ml-2" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      {metadata && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Showing next {upcomingEvents.length} of {metadata.totalEvents} total events
            {metadata.totalEvents > maxEvents && ` (next 12 months)`}
          </p>
        </div>
      )}
    </div>
  );
};

export default EarningsCalendar;
