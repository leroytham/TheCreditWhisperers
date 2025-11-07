import React, { useState, useEffect, useRef } from "react";
import apiService from "../../../services/api";
import { usePortfolio } from "../../../context/PortfolioContext";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { formatDate } from "../../../utils/formatters";

/**
 * NewsFeedCard Component
 *
 * Displays aggregated news articles for all holdings in the selected portfolio.
 * Features ticker filtering and configurable date range (1 day to all time).
 * Uses optimized portfolio-level API endpoint to fetch all news in a single request.
 *
 * Key Features:
 * - Ticker-based filtering (show all or specific holding news)
 * - Date range selector (24h, 7d, 30d, all time)
 * - Request cancellation via AbortController
 * - Cached data from PortfolioContext
 *
 * @returns {React.ReactElement} Rendered news feed card component
 *
 * @example
 * // Used in portfolio overview page
 * <NewsFeedCard />
 */
const NewsFeedCard = () => {
  const [newsItems, setNewsItems] = useState([]);
  const [tickers, setTickers] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState("all");
  const [dateRange, setDateRange] = useState(7); // Days to show (7 = last 7 days)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const abortControllerRef = useRef(null);
  const { selectedAccount } = usePortfolio();

  // Fetch portfolio news using optimized endpoint
  const fetchPortfolioNews = async () => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError("");

    try {
      if (!selectedAccount?.username || !selectedAccount?.accountName) {
        setError("Please select an account first.");
        setLoading(false);
        return;
      }

      // Use portfolio-level news endpoint for better performance
      // This fetches aggregated news for all holdings in a single API call
      const response = await apiService.getPortfolioNews(
        selectedAccount.username,
        selectedAccount.accountName,
        { signal: abortControllerRef.current.signal }
      );

      const data = response.data;

      // Extract tickers and news items from response
      const newsData = data.news || [];
      const uniqueTickers = [...new Set(newsData.map(n => n.ticker))].filter(Boolean);

      // Note: Empty newsData is valid - component will show empty state
      setTickers(uniqueTickers);

      // Sort news by date (newest first)
      const sortedNews = newsData.sort(
        (a, b) => new Date(b.publish_date || b.publish_timestamp) - new Date(a.publish_date || a.publish_timestamp)
      );

      setNewsItems(sortedNews);
    } catch (err) {
      // Ignore aborted requests
      if (err.name === 'AbortError' || apiService.api?.isCancel?.(err)) {
        return;
      }

      // Error notification already handled by apiService interceptor
      setError("Failed to load news. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
      setSelectedTicker("all"); // Reset filter when account changes
      fetchPortfolioNews();
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount]);

  const filteredNews =
    selectedTicker === "all"
      ? newsItems
      : newsItems.filter((n) => n.ticker === selectedTicker);

  // Group news by date, filtered by selected date range
  const groupedNews = Object.entries(
    filteredNews.reduce((acc, item) => {
      // Use publish_timestamp if available, otherwise fall back to publish_date
      const dateStr = item.publish_timestamp || item.publish_date;
      const date = new Date(dateStr);
      const now = new Date();

      // Filter based on selected date range using actual duration (not calendar days)
      if (dateRange !== null) {
        const hoursSincePublish = (now - date) / (1000 * 60 * 60);
        const daysSincePublish = hoursSincePublish / 24;
        if (daysSincePublish > dateRange) return acc;
      }

      // Calculate calendar days difference for grouping labels
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const itemDate = new Date(date);
      itemDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today - itemDate) / (1000 * 60 * 60 * 24));

      // Determine label
      let label;
      if (daysDiff === 0) {
        label = "Today";
      } else if (daysDiff === 1) {
        label = "Yesterday";
      } else if (daysDiff <= 7) {
        label = `${daysDiff} days ago`;
      } else {
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (!acc[label]) acc[label] = [];
      acc[label].push(item);
      return acc;
    }, {})
  ).map(([label, items]) => [
    label,
    // Sort items by timestamp, newest first
    items.sort((a, b) => {
      const dateA = new Date(a.publish_timestamp || a.publish_date);
      const dateB = new Date(b.publish_timestamp || b.publish_date);
      return dateB - dateA; // Descending order (newest first)
    })
  ]);

  return (
    <div
      className="bg-white rounded-lg shadow-sm flex flex-col"
      style={{
        height: "100%",
        minHeight: "350px",
        maxHeight: "595px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-black px-6 py-3">
        <h3 className="text-lg font-semibold text-gray-900">Feed</h3>
        <div className="flex items-center space-x-2">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value === 'null' ? null : Number(e.target.value))}
            className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
            aria-label="Select date range"
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="null">All time</option>
          </select>

          {/* Ticker Selector */}
          {tickers.length > 0 && (
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
              aria-label="Filter by ticker"
            >
              <option value="all">All Tickers</option>
              {tickers.map((ticker) => (
                <option key={ticker} value={ticker}>
                  {ticker}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>


      {/* Feed Content */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {loading ? (
          <div className="flex justify-center items-center mt-6">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <p className="text-red-500 text-center mt-6">{error}</p>
        ) : filteredNews.length === 0 ? (
          <p className="text-gray-400 text-center mt-6">
            No recent news available.
          </p>
        ) : (
          groupedNews.map(([label, items]) => (
            <div key={label} className="mb-6">
              {label === "Yesterday" && (
                <div className="-mx-6 px-6 border-b-2 border-gray-300 pb-2 mb-4">
                  <h3 className="text-gray-900 font-semibold text-sm">
                    {label}
                  </h3>
                </div>
              )}

              <div className="flex">
                {/* Striped pattern column for Today */}
                {label === "Today" && (
                  <div className="w-24 flex-shrink-0 flex items-start gap-2 pt-4">
                    <span className="text-gray-900 font-semibold text-sm">Today</span>
                    {/* Diagonal striped pattern that spans all Today items */}
                    <svg width="20" height={items.length * 100} className="flex-shrink-0">
                      <defs>
                        <pattern id="diagonalStripes" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                          <line x1="0" y1="0" x2="0" y2="4" stroke="#9ca3af" strokeWidth="2" />
                        </pattern>
                      </defs>
                      <rect width="20" height={items.length * 100} fill="url(#diagonalStripes)" />
                    </svg>
                  </div>
                )}

                {/* News items column */}
                <div className="flex-1">
                  {items.map((news, idx) => (
                    <div
                      key={idx}
                      className="flex items-start py-4"
                    >
                      {/* Left Column: Empty for Today (pattern is now outside), Time for Yesterday */}
                      {label === "Yesterday" && (
                        <div className="w-24 text-sm flex-shrink-0"></div>
                      )}

                  {/* Middle Column: Time */}
                  <div className="w-32 text-xs text-gray-500 flex-shrink-0">
                    {formatDate(news.publish_timestamp || news.publish_date, { includeTime: true })}
                  </div>

                      {/* Right Column: Content */}
                      <div className="flex-1 ml-6">
                        <h4 className="text-sm font-semibold text-gray-900 leading-snug">
                          {news.title}
                        </h4>

                        <div className="flex items-center text-xs text-gray-600 mt-1">
                          <span>{news.provider || "Unknown Source"}</span>
                          <span className="mx-2 text-gray-400">|</span>
                          <span
                            className={`font-semibold ${
                              news.sentiment_label === "Bullish" ||
                              news.sentiment_label === "Somewhat-Bullish"
                                ? "text-green-600"
                                : news.sentiment_label === "Bearish" ||
                                  news.sentiment_label === "Somewhat-Bearish"
                                ? "text-red-600"
                                : "text-gray-600"
                            }`}
                          >
                            {news.sentiment_label || "Neutral"}
                          </span>
                        </div>

                        <a
                          href={news.link || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-600 hover:underline mt-1 block"
                        >
                          View Article
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NewsFeedCard;
