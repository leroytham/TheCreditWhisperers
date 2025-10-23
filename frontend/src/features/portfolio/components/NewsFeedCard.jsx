import React, { useState, useEffect } from "react";

const NewsFeedCard = () => {
  const [newsItems, setNewsItems] = useState([]);
  const [tickers, setTickers] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch holdings and related news
  const fetchNewsForHoldings = async () => {
    setLoading(true);
    setError("");
    try {
      const username = sessionStorage.getItem("user");
      const accountName = sessionStorage.getItem("selectedAccountName");

      if (!username || !accountName) {
        setError("Please select an account first.");
        setLoading(false);
        return;
      }

      const holdingsRes = await fetch(
        `http://localhost:8000/portfolio/holdings/${username}/${encodeURIComponent(
          accountName
        )}`
      );
      const holdingsData = await holdingsRes.json();
      const symbols = holdingsData?.holdings?.map((h) => h.symbol) || [];

      if (symbols.length === 0) {
        setError("No holdings found.");
        setLoading(false);
        return;
      }

      setTickers(symbols);

      const newsPromises = symbols.map(async (ticker) => {
        try {
          const res = await fetch(
            `/api/news?ticker=${ticker}`
          );
          const data = await res.json();
          return data.news.map((n) => ({ ...n, ticker }));
        } catch (err) {
          console.error(`Failed to fetch news for ${ticker}:`, err);
          return [];
        }
      });

      const allNews = (await Promise.all(newsPromises)).flat();
      const sortedNews = allNews.sort(
        (a, b) => new Date(b.publish_date) - new Date(a.publish_date)
      );
      setNewsItems(sortedNews);
    } catch (err) {
      console.error("Error fetching news:", err);
      setError("Failed to load news feed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewsForHoldings();

    const handleAccountChange = () => fetchNewsForHoldings();
    window.addEventListener("accountChanged", handleAccountChange);
    return () => window.removeEventListener("accountChanged", handleAccountChange);
  }, []);

  const filteredNews =
    selectedTicker === "all"
      ? newsItems
      : newsItems.filter((n) => n.ticker === selectedTicker);

  return (
    <div
      className="bg-white rounded-lg shadow-sm flex flex-col"
      style={{
        height: "100%",
        minHeight: "350px",
        maxHeight: "595px",
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-200 px-5 py-3">
        <h3 className="text-lg font-semibold text-gray-900">My Holdings News</h3>
        {tickers.length > 0 && (
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
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

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto px-5 py-3"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#cbd5e1 transparent",
        }}
      >
        {loading ? (
          <p className="text-gray-500 text-center mt-6">Loading news...</p>
        ) : error ? (
          <p className="text-red-500 text-center mt-6">{error}</p>
        ) : filteredNews.length === 0 ? (
          <p className="text-gray-400 text-center mt-6">
            No recent news available.
          </p>
        ) : (
          filteredNews.map((news, idx) => (
            <div
              key={idx}
              className="border-b border-gray-100 pb-3 mb-3 hover:bg-gray-50 transition rounded-md p-2"
            >
              <div className="flex justify-between items-center">
                <p className="text-[11px] text-gray-500">
                  <span className="font-semibold text-gray-800">{news.ticker}</span>{" "}
                  •{" "}
                  {news.publish_date
                    ? new Date(news.publish_date).toLocaleString()
                    : "No date"}
                </p>
                <span
                  className={`text-[11px] font-semibold ${
                    news.sentiment_label === "Bullish" || news.sentiment_label === "Somewhat-Bullish"
                      ? "text-green-600"
                      : news.sentiment_label === "Bearish" || news.sentiment_label === "Somewhat-Bearish"
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
                className="text-sm font-semibold text-gray-900 mt-1 hover:text-blue-600 leading-snug"
              >
                {news.title}
              </a>

              <p className="text-[11px] text-gray-500 mt-1">
                {news.provider || "Unknown Source"}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NewsFeedCard;
