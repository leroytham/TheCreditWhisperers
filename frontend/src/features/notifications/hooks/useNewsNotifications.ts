import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import useAppStore from '../../../store/useAppStore';
import apiService from '../../../services/api';
import { formatNewsNotification } from '../utils/notificationHelpers';

// Type definitions
interface NewsDataItem {
  ticker: string;
  count: number;
  sentiment: number;
  latestTimestamp: string | null;
}

interface Article {
  sentiment?: number;
  publishedAt?: string;
}

/**
 * Custom hook for news update notifications
 *
 * Monitors watchlist tickers for new news articles and triggers notifications
 *
 * @param {Object} options - Configuration options
 */
export const useNewsNotifications = (options: { pollingInterval?: number; enabled?: boolean } = {}) => {
  const {
    pollingInterval = 300000, // Check every 5 minutes by default
    enabled = true,
  } = options;

  const {
    watchlist,
    addToast,
  } = useAppStore();

  // Keep track of last news counts to detect new articles
  const lastNewsCountsRef = useRef<Record<string, number>>({});

  // Query to fetch news for watchlist tickers
  const { data: newsData } = useQuery({
    queryKey: ['watchlist-news', watchlist],
    queryFn: async () => {
      if (watchlist.length === 0) return {};

      // Fetch news for all watchlist tickers
      const newsPromises = watchlist.map((ticker) =>
        apiService.getNews(ticker)
          .then((response) => {
            const articles: Article[] = response.data?.articles || [];
            const sentiments = articles.map((a: Article) => a.sentiment || 0);
            const avgSentiment = sentiments.length > 0
              ? sentiments.reduce((a: number, b: number) => a + b, 0) / sentiments.length
              : 0;

            return {
              ticker,
              count: articles.length,
              sentiment: avgSentiment,
              latestTimestamp: articles[0]?.publishedAt || null,
            };
          })
          .catch(() => ({
            ticker,
            count: 0,
            sentiment: 0,
            latestTimestamp: null,
          }))
      );

      const newsResults = await Promise.all(newsPromises);

      // Convert to object for easy lookup
      return newsResults.reduce<Record<string, NewsDataItem>>((acc, data) => {
        acc[data.ticker] = data;
        return acc;
      }, {});
    },
    enabled: enabled && watchlist.length > 0,
    refetchInterval: pollingInterval,
  });

  // Check for new news articles
  useEffect(() => {
    if (!newsData) return;

    Object.entries(newsData).forEach(([ticker, data]) => {
      const newsItem = data as NewsDataItem;
      const lastCount = lastNewsCountsRef.current[ticker] || 0;
      const newCount = newsItem.count;

      // Only notify if there are new articles (and we have a baseline)
      if (lastCount > 0 && newCount > lastCount) {
        const newArticles = newCount - lastCount;

        // Send notification
        const notification = formatNewsNotification(
          ticker,
          newArticles,
          newsItem.sentiment
        );

        addToast(notification);

        console.log(`📰 New news notification: ${newArticles} article(s) for ${ticker}`);
      }

      // Update the reference
      lastNewsCountsRef.current[ticker] = newCount;
    });
  }, [newsData, addToast]);

  // Clean up counts for removed watchlist items
  useEffect(() => {
    const currentTickers = new Set(watchlist);
    Object.keys(lastNewsCountsRef.current).forEach((ticker) => {
      if (!currentTickers.has(ticker)) {
        delete lastNewsCountsRef.current[ticker];
      }
    });
  }, [watchlist]);

  return {
    newsData,
  };
};

/**
 * Example usage:
 *
 * // In a component or App.js
 * const { newsData } = useNewsNotifications({
 *   pollingInterval: 180000, // Check every 3 minutes
 * });
 */
