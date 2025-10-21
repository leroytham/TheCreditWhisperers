/**
 * useNewsData Hook
 *
 * Custom hook for fetching news and sentiment data
 */

import { useState, useEffect } from 'react';

export const useNewsData = (ticker) => {
  const [news, setNews] = useState([]);
  const [sentiment, setSentiment] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNewsData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/news?ticker=${ticker}`);
        const data = await response.json();

        setNews(data.news || []);
        setSentiment({ avg_score: data.avg_score });
      } catch (err) {
        console.error('Error fetching news:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (ticker) {
      fetchNewsData();
    }
  }, [ticker]);

  return {
    news,
    sentiment,
    loading,
    error
  };
};
