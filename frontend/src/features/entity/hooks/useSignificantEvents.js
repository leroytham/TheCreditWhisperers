/**
 * useSignificantEvents Hook
 *
 * Custom hook for fetching significant events data
 */

import { useState, useEffect } from 'react';

export const useSignificantEvents = (ticker) => {
  const [significantEvents, setSignificantEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSignificantEvents = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/stocks/${ticker}/significant-events`);
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

    if (ticker) {
      fetchSignificantEvents();
    }
  }, [ticker]);

  return {
    significantEvents,
    loading,
    error
  };
};
