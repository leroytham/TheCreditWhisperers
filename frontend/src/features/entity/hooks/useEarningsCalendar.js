/**
 * useEarningsCalendar Hook
 *
 * Custom hook for fetching upcoming earnings calendar events from Alpha Vantage
 */

import { useState, useEffect, useCallback } from 'react';

export const useEarningsCalendar = (ticker, horizon = '12month') => {
  const [earningsEvents, setEarningsEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState(null);

  // Fetch earnings calendar events
  const fetchEarningsCalendar = useCallback(async () => {
    if (!ticker) {
      setEarningsEvents([]);
      setMetadata(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/stocks/${ticker}/earnings-calendar?horizon=${horizon}`
      );

      if (!response.ok) {
        // Handle different error status codes
        if (response.status === 404) {
          setError(`No earnings calendar data available for ${ticker}`);
        } else if (response.status === 403) {
          // Premium endpoint
          try {
            const errorData = await response.json();
            setError(errorData.detail || 'Earnings calendar requires premium subscription');
          } catch {
            setError('Earnings calendar requires premium subscription');
          }
        } else if (response.status === 429) {
          setError('API rate limit reached. Please try again later.');
        } else if (response.status === 500) {
          try {
            const errorData = await response.json();
            setError(errorData.detail || 'Server error fetching earnings calendar');
          } catch {
            setError('Server error fetching earnings calendar');
          }
        } else {
          setError(`Failed to fetch earnings calendar (${response.status})`);
        }
        setEarningsEvents([]);
        setMetadata(null);
        return;
      }

      const data = await response.json();

      setEarningsEvents(data.earnings_events || []);
      setMetadata({
        ticker: data.ticker,
        totalEvents: data.total_events,
        fetchedAt: data.fetched_at
      });
    } catch (err) {
      console.error('Error fetching earnings calendar:', err);
      setError(err.message || 'Network error fetching earnings calendar');
      setEarningsEvents([]);
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  }, [ticker, horizon]);

  // Fetch earnings calendar when ticker or horizon changes
  useEffect(() => {
    fetchEarningsCalendar();
  }, [fetchEarningsCalendar]);

  // Group events by time period
  const groupedEvents = {
    upcoming: earningsEvents.filter(event => event.days_until >= 0 && event.days_until <= 7),
    thisMonth: earningsEvents.filter(event => event.days_until > 7 && event.days_until <= 30),
    nextMonth: earningsEvents.filter(event => event.days_until > 30 && event.days_until <= 60),
    later: earningsEvents.filter(event => event.days_until > 60),
    past: earningsEvents.filter(event => event.days_until < 0)
  };

  // Utility function to format time until earnings
  const formatTimeUntil = (daysUntil) => {
    const days = parseInt(daysUntil);

    if (days < 0) {
      const absDays = Math.abs(days);
      if (absDays === 0) return 'Today';
      if (absDays === 1) return 'Yesterday';
      if (absDays < 7) return `${absDays} days ago`;
      if (absDays < 30) {
        const weeks = Math.floor(absDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
      }
      const months = Math.floor(absDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    }

    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `In ${days} days`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `In ${weeks} week${weeks > 1 ? 's' : ''}`;
    }
    if (days < 365) {
      const months = Math.floor(days / 30);
      return `In ${months} month${months > 1 ? 's' : ''}`;
    }
    return `In ${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? 's' : ''}`;
  };

  // Utility function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Utility function to get status badge color
  const getStatusColor = (daysUntil) => {
    const days = parseInt(daysUntil);

    if (days < 0) return 'bg-gray-100 text-gray-700 border-gray-300';
    if (days <= 7) return 'bg-red-100 text-red-700 border-red-300';
    if (days <= 30) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-blue-100 text-blue-700 border-blue-300';
  };

  // Utility function to get status label
  const getStatusLabel = (daysUntil) => {
    const days = parseInt(daysUntil);

    if (days < 0) return 'Past';
    if (days === 0) return 'Today';
    if (days <= 7) return 'This Week';
    if (days <= 30) return 'This Month';
    return 'Upcoming';
  };

  return {
    earningsEvents,
    groupedEvents,
    loading,
    error,
    metadata,
    formatTimeUntil,
    formatDate,
    getStatusColor,
    getStatusLabel,
    refetch: fetchEarningsCalendar
  };
};
