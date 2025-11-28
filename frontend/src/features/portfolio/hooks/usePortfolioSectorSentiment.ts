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

// Type definitions
interface SectorInfo {
  sector: string;
  sentiment: number;
  holdingsCount: number;
  totalValue: number;
  weight: number;
  sentimentLabel: string;
}

export interface SectorSentimentData {
  sectors: SectorInfo[];
  overallSentiment: number;
  totalValue: number;
}

interface SectorApiInfo {
  sentiment_score?: number;
  holdings_count?: number;
  total_value?: number;
  weight_in_portfolio?: number;
}

// Helper function to get sentiment label
function getSentimentLabel(score: number): string {
  if (score > 0.15) return 'Very Bullish';
  if (score > 0.05) return 'Bullish';
  if (score > -0.05) return 'Neutral';
  if (score > -0.15) return 'Bearish';
  return 'Very Bearish';
}

export const usePortfolioSectorSentiment = (
  username: string | undefined,
  accountName: string | undefined,
  enabled: boolean = true
) => {
  const [sectorData, setSectorData] = useState<SectorSentimentData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
        const sectors: SectorInfo[] = Object.entries(data.sentiment_by_sector || {}).map(([sector, info]: [string, unknown]) => {
          const sectorInfo = info as SectorApiInfo;
          return {
            sector,
            sentiment: sectorInfo.sentiment_score || 0,
            holdingsCount: sectorInfo.holdings_count || 0,
            totalValue: sectorInfo.total_value || 0,
            weight: (sectorInfo.weight_in_portfolio || 0) * 100, // Convert to percentage
            sentimentLabel: getSentimentLabel(sectorInfo.sentiment_score || 0)
          };
        }).sort((a, b) => b.weight - a.weight); // Sort by weight descending

        setSectorData({
          sectors,
          overallSentiment: data.overall_sentiment || 0,
          totalValue: data.total_portfolio_value || 0
        });
      } catch (err: unknown) {
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
