/**
 * usePortfolioRollingSentiment Hook
 *
 * Custom hook for fetching aggregated portfolio rolling sentiment data from the backend.
 * Returns portfolio-weighted rolling averages with support for various timeframes.
 *
 * @param {string} username - Portfolio username
 * @param {string} accountName - Portfolio account name
 * @param {Array} holdings - Array of holdings (for display purposes)
 * @param {string} timeframe - Timeframe for sentiment data ('1D', '1W', '1M', '3M', '6M', 'YTD', '1Y')
 * @param {boolean} enabled - Whether to fetch data (for lazy loading)
 * @returns {Object} { data, hasData, loading, error, sourceEarliestDates }
 */

import { useState, useEffect } from 'react';
import apiService from '../../../services/api';
import { parseExchangeTimestamp, getExchangeTimezone } from '../../shared/utils/formatters';

// Type definitions
interface Holding {
  ticker: string;
  weight?: number;
}

interface SentimentHeadline {
  title?: string;
  sentiment_score?: number;
  source?: string;
}

export interface RollingSentimentDataPoint {
  timestamp: string;
  date: string;
  timezone: string | null;
  label: string;
  sentiment: number;
  fast_sentiment: number;
  slow_sentiment: number;
  volume: number;
  news_volume: number;
  momentum: number;
  confidence: number;
  headlines: SentimentHeadline[];
}

interface SourceEarliestDates {
  [source: string]: string;
}

interface RollingApiDataPoint {
  timestamp?: string;
  timezone?: string;
  score?: number;
  article_count?: number;
  momentum?: number;
  holdings_with_data?: number;
  headlines?: SentimentHeadline[];
}

interface RollingApiResponse {
  data?: RollingApiDataPoint[];
  holdings_count?: number;
  valid_holdings?: number;
  source_earliest_dates?: SourceEarliestDates;
}

// Hook return type
interface UsePortfolioRollingSentimentReturn {
  data: RollingSentimentDataPoint[];
  hasData: boolean;
  loading: boolean;
  error: string | null;
  sourceEarliestDates: SourceEarliestDates | null;
  failedHoldings: never[];
  successCount: number;
  totalCount: number;
}

// Default exchange for portfolio chart labels (portfolios can contain mixed exchanges)
const DEFAULT_EXCHANGE = 'NYSE';

export const usePortfolioRollingSentiment = (
  username: string | undefined,
  accountName: string | undefined,
  holdings: Holding[] | null,
  timeframe: string = '1D',
  enabled: boolean = true,
  exchange: string = DEFAULT_EXCHANGE
): UsePortfolioRollingSentimentReturn => {
  const [data, setData] = useState<RollingSentimentDataPoint[]>([]);
  const [hasData, setHasData] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceEarliestDates, setSourceEarliestDates] = useState<SourceEarliestDates | null>(null);

  const resolvedExchange = exchange || DEFAULT_EXCHANGE;

  useEffect(() => {
    // If not enabled (lazy loading - tab not active), set loading to false
    if (!enabled || !username || !accountName) {
      setLoading(false);
      setData([]);
      setHasData(false);
      setSourceEarliestDates(null);
      return;
    }

    // Set loading immediately when dependencies change
    setLoading(true);
    setError(null);

    const controller = new AbortController();

    /**
     * Fetches aggregated rolling sentiment from backend
     */
    const fetchPortfolioRollingSentiment = async () => {
      try {
        // Fetch aggregated rolling sentiment from backend
        const response = await apiService.getPortfolioRollingSentiment(
          username,
          accountName,
          timeframe
        );

        // Check if request was aborted
        if (controller.signal.aborted) {
          return;
        }

        const result = response.data;

        // Process the data from backend
        const getDisplayTimezone = (pointTimezone: string | null | undefined): string => {
          if (pointTimezone && pointTimezone.toUpperCase() === 'UTC') {
            return 'UTC';
          }
          return getExchangeTimezone(resolvedExchange);
        };

        const parseTimestampForDisplay = (timestamp: string | undefined, pointTimezone: string | null | undefined): Date | null => {
          if (!timestamp) return null;
          if (pointTimezone && pointTimezone.toUpperCase() === 'UTC') {
            return new Date(timestamp);
          }
          return parseExchangeTimestamp(timestamp, resolvedExchange);
        };

        const processedData = (result.data || []).map((point: RollingApiDataPoint) => {
          const pointTimezone = point.timezone || null;
          const displayDate = parseTimestampForDisplay(point.timestamp, pointTimezone);
          const displayTimezone = getDisplayTimezone(pointTimezone);

          return {
            timestamp: point.timestamp,
            date: point.timestamp,
            timezone: pointTimezone || null,
            label: displayDate
              ? new Intl.DateTimeFormat('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                  timeZone: displayTimezone
                }).format(displayDate)
              : point.timestamp,
            sentiment: point.score || 0,
            fast_sentiment: point.score || 0,  // Backend should provide these if available
            slow_sentiment: point.score || 0,  // Backend should provide these if available
            volume: point.article_count || 0,
            news_volume: point.article_count || 0,
            momentum: point.momentum || 0,
            confidence: point.holdings_with_data ?
              (point.holdings_with_data / result.holdings_count) : 0,
            headlines: point.headlines || []  // Headlines from rolling window (once backend implements aggregation)
          };
        });

        // Sort by timestamp to ensure ascending chronological order
        // Defensive: guards against backend changes and ensures consistency with chart expectations
        const sortedData = processedData.sort((a: RollingSentimentDataPoint, b: RollingSentimentDataPoint) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Check if we have meaningful data
        const hasValidData = sortedData.length > 0 && result.valid_holdings > 0;

        setData(sortedData);
        setHasData(hasValidData);

        // Source earliest dates might be included in future backend updates
        setSourceEarliestDates(result.source_earliest_dates || null);

      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          // Request was aborted, don't set error
          return;
        }
        console.error('Error fetching portfolio rolling sentiment:', err);
        setError('Failed to load portfolio rolling sentiment data');
        setData([]);
        setHasData(false);
        setSourceEarliestDates(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchPortfolioRollingSentiment();

    // Cleanup: abort fetch on unmount or dependency change
    return () => {
      controller.abort();
    };
  }, [username, accountName, timeframe, enabled, resolvedExchange]);

  return {
    data,
    hasData,
    loading,
    error,
    sourceEarliestDates,
    failedHoldings: [], // No longer tracking individual failures
    successCount: hasData ? (holdings?.length || 0) : 0,
    totalCount: holdings ? holdings.length : 0
  };
};