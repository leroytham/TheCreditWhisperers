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

export const usePortfolioRollingSentiment = (username, accountName, holdings, timeframe = '1D', enabled = true) => {
  const [data, setData] = useState([]);
  const [hasData, setHasData] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sourceEarliestDates, setSourceEarliestDates] = useState(null);

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
        const processedData = (result.data || []).map(point => ({
          timestamp: point.timestamp,
          date: point.timestamp,
          label: new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sentiment: point.score || 0,
          fast_sentiment: point.score || 0,  // Backend should provide these if available
          slow_sentiment: point.score || 0,  // Backend should provide these if available
          volume: point.article_count || 0,
          news_volume: point.article_count || 0,
          momentum: point.momentum || 0,
          confidence: point.holdings_with_data ?
            (point.holdings_with_data / result.holdings_count) : 0,
          headlines: []  // Rolling data doesn't have individual headlines (aggregated across holdings)
        }));

        // Check if we have meaningful data
        const hasValidData = processedData.length > 0 && result.valid_holdings > 0;

        setData(processedData);
        setHasData(hasValidData);

        // Source earliest dates might be included in future backend updates
        setSourceEarliestDates(result.source_earliest_dates || null);

      } catch (err) {
        if (err.name === 'AbortError' || controller.signal.aborted) {
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
  }, [username, accountName, timeframe, enabled]);

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