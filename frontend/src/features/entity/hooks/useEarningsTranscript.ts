/**
 * useEarningsTranscript Hook
 *
 * Custom hook for fetching earnings call transcript data from Alpha Vantage
 */

import { useState, useEffect, useCallback } from 'react';
import apiService from '../../../services/api';
import type { TranscriptSegment } from '../../../types';

interface TranscriptMetadata {
  symbol: string;
  quarter: string;
  totalSegments?: number;
  fetchedAt?: string;
}

interface TranscriptStatistics {
  avgSentiment: string;
  totalWordCount: number;
  speakerCount: number;
  mostPositive: TranscriptSegment | { sentiment: number };
  mostNegative: TranscriptSegment | { sentiment: number };
}

interface UseEarningsTranscriptReturn {
  transcript: TranscriptSegment[];
  transcriptData: TranscriptMetadata | null;
  availableQuarters: string[];
  loading: boolean;
  error: string | null;
  statistics: TranscriptStatistics | null;
  getSentimentColor: (sentiment: number | string) => string;
  getSentimentLabel: (sentiment: number | string) => string;
  refetch: () => Promise<void>;
}

export const useEarningsTranscript = (
  ticker: string,
  quarter?: string
): UseEarningsTranscriptReturn => {
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [transcriptData, setTranscriptData] = useState<TranscriptMetadata | null>(null);
  const [availableQuarters, setAvailableQuarters] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available quarters for the ticker
  const fetchAvailableQuarters = useCallback(async () => {
    if (!ticker) return;

    try {
      const response = await apiService.getEarningsQuarters(ticker, 5);
      const data = response.data;
      setAvailableQuarters(data.quarters || []);
    } catch (err: unknown) {
      console.error('Error fetching available quarters:', err);
      // Don't set error state here - this is just for UI convenience
    }
  }, [ticker]);

  // Fetch transcript for specific quarter
  const fetchTranscript = useCallback(async () => {
    if (!ticker || !quarter) {
      setTranscript([]);
      setTranscriptData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getEarningsTranscript(ticker, quarter);
      const data = response.data;

      setTranscript(data.transcript || []);
      setTranscriptData({
        symbol: data.symbol,
        quarter: data.quarter,
        totalSegments: data.total_segments,
        fetchedAt: data.fetched_at
      });
    } catch (err: unknown) {
      console.error('Error fetching earnings transcript:', err);
      setError(err instanceof Error ? err.message : 'Network error fetching transcript');
      setTranscript([]);
      setTranscriptData(null);
    } finally {
      setLoading(false);
    }
  }, [ticker, quarter]);

  // Fetch quarters when ticker changes
  useEffect(() => {
    fetchAvailableQuarters();
  }, [fetchAvailableQuarters]);

  // Fetch transcript when ticker or quarter changes
  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  // Utility function to get sentiment color
  const getSentimentColor = (sentiment: number | string): string => {
    const score = typeof sentiment === 'string' ? parseFloat(sentiment) : sentiment;
    if (score >= 0.6) return 'text-green-600';
    if (score >= 0.4) return 'text-green-500';
    if (score >= 0.2) return 'text-yellow-600';
    if (score >= -0.2) return 'text-gray-600';
    if (score >= -0.4) return 'text-orange-500';
    return 'text-red-600';
  };

  // Utility function to get sentiment label
  const getSentimentLabel = (sentiment: number | string): string => {
    const score = typeof sentiment === 'string' ? parseFloat(sentiment) : sentiment;
    if (score >= 0.6) return 'Very Positive';
    if (score >= 0.4) return 'Positive';
    if (score >= 0.2) return 'Slightly Positive';
    if (score >= -0.2) return 'Neutral';
    if (score >= -0.4) return 'Slightly Negative';
    if (score >= -0.6) return 'Negative';
    return 'Very Negative';
  };

  // Calculate aggregate statistics
  const statistics: TranscriptStatistics | null = transcript.length > 0 ? {
    avgSentiment: (transcript.reduce((sum, seg) => sum + Number(seg.sentiment || 0), 0) / transcript.length).toFixed(2),
    totalWordCount: transcript.reduce((sum, seg) => sum + (seg.word_count || 0), 0),
    speakerCount: new Set(transcript.map(seg => seg.speaker)).size,
    mostPositive: transcript.reduce<TranscriptSegment | { sentiment: number }>((max, seg) =>
      Number(seg.sentiment) > Number(max.sentiment || 0) ? seg : max,
      { sentiment: 0 }
    ),
    mostNegative: transcript.reduce<TranscriptSegment | { sentiment: number }>((min, seg) =>
      Number(seg.sentiment) < Number(min.sentiment || 0) ? seg : min,
      { sentiment: 0 }
    )
  } : null;

  return {
    transcript,
    transcriptData,
    availableQuarters,
    loading,
    error,
    statistics,
    getSentimentColor,
    getSentimentLabel,
    refetch: fetchTranscript
  };
};
