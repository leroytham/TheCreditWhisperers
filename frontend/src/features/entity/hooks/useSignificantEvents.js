/**
 * useSignificantEvents Hook
 *
 * Custom hook for fetching significant events data with background prefetching
 */

import { useState, useEffect, useRef } from 'react';

export const useSignificantEvents = (ticker, timeframe = '1D') => {
  const [significantEvents, setSignificantEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const prefetchInitiated = useRef(new Set());

  useEffect(() => {
    // If ticker is null (lazy loading - tab not active), set loading to false immediately
    if (!ticker) {
      setLoading(false);
      return;
    }

    // Set loading immediately when ticker changes (before async fetch)
    setLoading(true);
    setError(null);

    const fetchSignificantEvents = async () => {
      try {
        const response = await fetch(`/api/stocks/${ticker}/significant-events?timeframe=${timeframe}`);
        const data = await response.json();

        const rawEvents = data.events || [];
        // Transform events to match UI expectations
        const transformedEvents = rawEvents.map(event => {
          const movePct = event.total_move_pct * 100;
          return {
            ...event,
            trend: movePct >= 0 ? 'Upward' : 'Downward',
            total_move_pct: movePct,
            end_date: event.start_date,
            days: 1
          };
        });

        setSignificantEvents(transformedEvents);
      } catch (err) {
        console.error('Error fetching significant events:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Background prefetch for all timeframes (only once per ticker)
    const prefetchAllTimeframes = async () => {
      if (!prefetchInitiated.current.has(ticker)) {
        prefetchInitiated.current.add(ticker);

        try {
          console.log(`[PREFETCH] Initiating background fetch for all timeframes: ${ticker}`);
          await fetch(`/api/stocks/${ticker}/prefetch-events`, {
            method: 'POST'
          });
        } catch (err) {
          console.error('Error initiating prefetch:', err);
        }
      }
    };

    fetchSignificantEvents();
    prefetchAllTimeframes();
  }, [ticker, timeframe]);

  return {
    significantEvents,
    loading,
    error
  };
};
