/**
 * usePortfolioSectorSentiment Hook
 *
 * Custom hook for fetching portfolio sentiment breakdown by sector.
 * Returns sector-level sentiment scores with position weighting.
 *
 * @param {string} username - Portfolio username
 * @param {string} accountName - Portfolio account name
 * @param {boolean} enabled - Whether to fetch data (for lazy loading)
 * @returns {Object} { sectorData, loading, error }
 */

import { useState, useEffect } from 'react';
import apiService from '../../../services/api';

export const usePortfolioSectorSentiment = (username, accountName, enabled = true) => {
  const [sectorData, setSectorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If not enabled (lazy loading - tab not active), set loading to false
    if (!enabled || !username || !accountName) {
      setLoading(false);
      setSectorData(null);
      return;
    }

    // Set loading immediately when dependencies change
    setLoading(true);
    setError(null);

    const controller = new AbortController();

    /**
     * Fetches sector sentiment breakdown from backend
     */
    const fetchSectorSentiment = async () => {
      try {
        // Fetch sector sentiment from backend
        const response = await apiService.getPortfolioSentiment(username, accountName);

        // Check if request was aborted
        if (controller.signal.aborted) {
          return;
        }

        const data = response.data;

        // Process sector breakdown data
        const sectors = Object.entries(data.sentiment_by_sector || {}).map(([sector, info]) => ({
          sector,
          sentiment: info.sentiment_score || 0,
          holdingsCount: info.holdings_count || 0,
          totalValue: info.total_value || 0,
          weight: (info.weight_in_portfolio || 0) * 100, // Convert to percentage
          sentimentLabel: getSentimentLabel(info.sentiment_score || 0)
        })).sort((a, b) => b.weight - a.weight); // Sort by weight descending

        setSectorData({
          sectors,
          overallSentiment: data.overall_sentiment || 0,
          totalValue: data.total_portfolio_value || 0
        });
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Error fetching portfolio sector sentiment:', err);
          setError('Failed to load sector sentiment data');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchSectorSentiment();

    // Cleanup: abort fetch on unmount or dependency change
    return () => {
      controller.abort();
    };
  }, [username, accountName, enabled]);

  return {
    sectorData,
    loading,
    error
  };
};

// Helper function to get sentiment label
function getSentimentLabel(score) {
  if (score > 0.15) return 'Very Bullish';
  if (score > 0.05) return 'Bullish';
  if (score > -0.05) return 'Neutral';
  if (score > -0.15) return 'Bearish';
  return 'Very Bearish';
}