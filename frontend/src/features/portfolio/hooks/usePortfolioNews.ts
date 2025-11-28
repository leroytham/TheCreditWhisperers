/**
 * usePortfolioNews Hook
 *
 * Custom hook for fetching portfolio-level news with full Alpha Vantage metadata
 * Compatible with DetailedRelatedNews component
 */

import { useState, useEffect, useCallback } from 'react';
import apiService from '../../../services/api';

export const usePortfolioNews = (username, accountName) => {
  const [news, setNews] = useState([]);
  const [apiMetadata, setApiMetadata] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPortfolioNews = useCallback(async (controller) => {
    try {
      const response = await apiService.getPortfolioNews(username, accountName, {
        signal: controller.signal
      });

      // Check if request was aborted
      if (controller.signal.aborted) {
        return;
      }

      const data = response.data;

      // Store full feed data from Alpha Vantage (compatible with DetailedRelatedNews)
      setNews(data.feed || data.news || []);

      // Store API metadata - include tickers_queried for portfolio context
      setApiMetadata({
        items: data.items,
        sentiment_score_definition: data.sentiment_score_definition,
        relevance_score_definition: data.relevance_score_definition,
        tickers_queried: data.tickers || [],  // Portfolio tickers
        is_portfolio: data.is_portfolio || true,  // Flag for portfolio context
        total_articles: data.total_articles,
      });

    } catch (err) {
      // Only set error if request wasn't aborted
      if (!controller.signal.aborted) {
        console.error('Error fetching portfolio news:', err);
        setError(err.message);
      }
    } finally {
      // Only clear loading if request wasn't aborted
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [username, accountName]);

  useEffect(() => {
    // If username or accountName is null (lazy loading), set loading to false immediately
    if (!username || !accountName) {
      setLoading(false);
      return;
    }

    // Set loading immediately when parameters change (before async fetch)
    setLoading(true);
    setError(null);

    // Create AbortController for request cancellation
    const controller = new AbortController();

    fetchPortfolioNews(controller);

    // Cleanup: abort fetch on unmount or dependency change
    return () => {
      controller.abort();
    };
  }, [username, accountName, fetchPortfolioNews]);

  // Provide refetch function for manual retries
  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    fetchPortfolioNews(controller);
  }, [fetchPortfolioNews]);

  return {
    news,
    apiMetadata,
    loading,
    error,
    refetch
  };
};
