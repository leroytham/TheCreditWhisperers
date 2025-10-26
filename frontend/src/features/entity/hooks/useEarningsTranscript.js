/**
 * useEarningsTranscript Hook
 *
 * Custom hook for fetching earnings call transcript data from Alpha Vantage
 */

import { useState, useEffect, useCallback } from 'react';

export const useEarningsTranscript = (ticker, quarter) => {
  const [transcript, setTranscript] = useState([]);
  const [transcriptData, setTranscriptData] = useState(null);
  const [availableQuarters, setAvailableQuarters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch available quarters for the ticker
  const fetchAvailableQuarters = useCallback(async () => {
    if (!ticker) return;

    try {
      const response = await fetch(
        `/api/stocks/${ticker}/earnings-quarters?years_back=5`
      );
      const data = await response.json();
      setAvailableQuarters(data.quarters || []);
    } catch (err) {
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

      const response = await fetch(
        `/api/stocks/${ticker}/earnings-transcript?quarter=${quarter}`
      );

      if (!response.ok) {
        // Handle different error status codes
        if (response.status === 404) {
          // No data available - this is expected for some quarters
          setError(`No earnings transcript available for ${ticker} in ${quarter}`);
        } else if (response.status === 500) {
          // Server error - try to get detail from response
          try {
            const errorData = await response.json();
            setError(errorData.detail || 'Server error fetching transcript');
          } catch {
            setError('Server error fetching transcript');
          }
        } else {
          setError(`Failed to fetch earnings transcript (${response.status})`);
        }
        setTranscript([]);
        setTranscriptData(null);
        return;
      }

      const data = await response.json();

      setTranscript(data.transcript || []);
      setTranscriptData({
        symbol: data.symbol,
        quarter: data.quarter,
        totalSegments: data.total_segments,
        fetchedAt: data.fetched_at
      });
    } catch (err) {
      console.error('Error fetching earnings transcript:', err);
      setError(err.message || 'Network error fetching transcript');
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
  const getSentimentColor = (sentiment) => {
    const score = parseFloat(sentiment);
    if (score >= 0.6) return 'text-green-600';
    if (score >= 0.4) return 'text-green-500';
    if (score >= 0.2) return 'text-yellow-600';
    if (score >= -0.2) return 'text-gray-600';
    if (score >= -0.4) return 'text-orange-500';
    return 'text-red-600';
  };

  // Utility function to get sentiment label
  const getSentimentLabel = (sentiment) => {
    const score = parseFloat(sentiment);
    if (score >= 0.6) return 'Very Positive';
    if (score >= 0.4) return 'Positive';
    if (score >= 0.2) return 'Slightly Positive';
    if (score >= -0.2) return 'Neutral';
    if (score >= -0.4) return 'Slightly Negative';
    if (score >= -0.6) return 'Negative';
    return 'Very Negative';
  };

  // Calculate aggregate statistics
  const statistics = transcript.length > 0 ? {
    avgSentiment: (transcript.reduce((sum, seg) => sum + parseFloat(seg.sentiment || 0), 0) / transcript.length).toFixed(2),
    totalWordCount: transcript.reduce((sum, seg) => sum + (seg.word_count || 0), 0),
    speakerCount: new Set(transcript.map(seg => seg.speaker)).size,
    mostPositive: transcript.reduce((max, seg) => 
      parseFloat(seg.sentiment) > parseFloat(max.sentiment || 0) ? seg : max, 
      { sentiment: 0 }
    ),
    mostNegative: transcript.reduce((min, seg) => 
      parseFloat(seg.sentiment) < parseFloat(min.sentiment || 0) ? seg : min, 
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
