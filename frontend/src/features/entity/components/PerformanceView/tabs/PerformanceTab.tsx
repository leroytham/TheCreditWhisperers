import React from 'react';
import { PriceChart } from '../../../../shared/components';
import { TIMEFRAMES } from '../../../../shared/utils/constants';
import type { PriceDataPoint, NewsArticle, SignificantEvent, TimeframeOption } from '../../../../../types';

interface DisplayEvent {
  start_date: string;
  trend: string;
  total_move_pct?: number;
  link?: string;
  url?: string;
  news?: NewsArticle[];
  title?: string;
  description?: string;
}

interface PerformanceTabProps {
  priceData: PriceDataPoint[];
  ticker: string;
  currency: string;
  exchange: string;
  significantEvents: SignificantEvent[] | null;
  showSignificantEvents: boolean;
  setShowSignificantEvents: (show: boolean) => void;
  timeframe: TimeframeOption | string;
  setTimeframe: (tf: TimeframeOption | string) => void;
  activePrevClose: number | null;
  handleEventClick: (event: DisplayEvent) => void;
  mapToDisplayEvents: (events: SignificantEvent[] | null) => DisplayEvent[];
}

export const PerformanceTab: React.FC<PerformanceTabProps> = ({
  priceData,
  ticker,
  currency,
  exchange,
  significantEvents,
  showSignificantEvents,
  setShowSignificantEvents,
  timeframe,
  setTimeframe,
  activePrevClose,
  handleEventClick,
  mapToDisplayEvents
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Detailed Performance Analysis</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          {/* Events Toggle Switch - Bloomberg style */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Events</span>
            <button
              onClick={() => setShowSignificantEvents(!showSignificantEvents)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
                showSignificantEvents ? 'bg-gray-900' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={showSignificantEvents}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showSignificantEvents ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Timeframe Buttons */}
          <div className="flex flex-wrap gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded text-sm ${
                  timeframe === tf
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>
      <PriceChart
        priceData={priceData}
        ticker={ticker}
        currency={currency}
        exchange={exchange}
        significantEvents={showSignificantEvents ? mapToDisplayEvents(significantEvents) : []}
        timeframe={timeframe}
        prevClose={activePrevClose}
        onEventClick={handleEventClick}
      />
    </div>
  );
};

export default PerformanceTab;
