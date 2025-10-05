import React, { useState, useEffect } from 'react';
import { useRef } from 'react';
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Bell, User, Menu, LogOut } from 'lucide-react';
import RelatedNewsList from "../components/RelatedNewsList";

const NUM_X_AXIS_POINTS = 6;
const TIMEFRAMES = ['5D', '1M', '3M', '6M', 'YTD', '1Y'];

const FinancialDashboard = () => {
  // Backend integration state
  const [ticker, setTicker] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1Y');
  const [priceData1Y, setPriceData1Y] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [news, setNews] = useState([]);
  const [sentiment, setSentiment] = useState({});
  const [dailySentiment, setDailySentiment] = useState({});
  const [lastFetched, setLastFetched] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // UI state
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [visibleHeadlines, setVisibleHeadlines] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  useEffect(() => {
    const user = searchParams.get("user");
    if (user) {
      sessionStorage.setItem("user", user);
    } else if (!sessionStorage.getItem("user")) {
      navigate("/login");
    }
  }, [navigate, searchParams]);

  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      sessionStorage.removeItem("user");
      navigate("/login");
    }
  };

  // Backend API calls
  useEffect(() => {
    // Fetch 1Y price data
    fetch(`/api/price?ticker=${ticker}&timeframe=1Y`)
      .then(res => res.json())
      .then(data => {
        setPriceData1Y(data.prices || []);
        setCompanyName(data.company_name || '');
        setCurrency(data.currency || 'USD');
        setLastFetched(new Date());
      })
      .catch(err => console.error('Error fetching price data:', err));

    // Fetch news
    fetch(`/api/news?ticker=${ticker}`)
      .then(res => res.json())
      .then(data => {
        setNews(data.news || []);
        setSentiment({ avg_score: data.avg_score });
      })
      .catch(err => console.error('Error fetching news:', err));

    // Fetch daily sentiment data
    fetch(`/api/daily-sentiment?ticker=${ticker}`)
      .then(res => res.json())
      .then(data => {
        setDailySentiment(data.daily || {});
      })
      .catch(err => console.error('Error fetching daily sentiment:', err));
  }, [ticker]);

  // Filter priceData for selected timeframe
  useEffect(() => {
    if (!priceData1Y || priceData1Y.length === 0) {
      setPriceData([]);
      return;
    }
    const now = new Date();
    let filtered = priceData1Y;
    if (timeframe === '5D') {
      filtered = priceData1Y.slice(-5);
    } else if (timeframe === '1M') {
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(now.getMonth() - 1);
      filtered = priceData1Y.filter(pt => new Date(pt.date) >= oneMonthAgo);
    } else if (timeframe === '3M') {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      filtered = priceData1Y.filter(pt => new Date(pt.date) >= threeMonthsAgo);
    } else if (timeframe === '6M') {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      filtered = priceData1Y.filter(pt => new Date(pt.date) >= sixMonthsAgo);
    } else if (timeframe === 'YTD') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      filtered = priceData1Y.filter(pt => new Date(pt.date) >= startOfYear);
    } else {
      filtered = priceData1Y;
    }
    setPriceData(filtered);
  }, [priceData1Y, timeframe]);

  // Poll for real-time price updates every 15 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetch(`/api/price?ticker=${ticker}&timeframe=1Y`)
        .then(res => res.json())
        .then(data => {
          setPriceData1Y(data.prices || []);
          setCompanyName(data.company_name || '');
          setCurrency(data.currency || 'USD');
          setLastFetched(new Date());
        })
        .catch(err => console.error('Error polling price data:', err));
    }, 15000);
    return () => clearInterval(intervalId);
  }, [ticker]);

  // Suggestions for ticker search
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setSuggestionsLoading(true);
    fetch(`/api/search-ticker?q=${searchTerm}`)
      .then(res => res.json())
      .then(data => {
        setSuggestions(data.quotes || []);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false));
  }, [searchTerm]);

  // Generate chart coordinates from backend data
  const generateChartData = () => {
    if (!priceData || priceData.length === 0) {
      return [];
    }

    return priceData.map((point, i) => ({
      x: i,
      y: parseFloat(point.close) || parseFloat(point.price) || 0,
      date: point.date,
      time: point.time,
      volume: point.volume || 0
    }));
  };

  const chartData = generateChartData();
  
  // Calculate price range for chart scaling
  const getPriceRange = () => {
    if (chartData.length === 0) return { min: 0, max: 100 };
    const prices = chartData.map(d => d.y);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    return { min: min - padding, max: max + padding };
  };

  const priceRange = getPriceRange();

  // Generate timeline points from data based on timeframe
  const generateTimelinePoints = () => {
    if (chartData.length === 0) return [];
    
    const step = Math.max(1, Math.floor((chartData.length - 1) / (NUM_X_AXIS_POINTS - 1)));
    const chartWidth = 660;
    const selectedIndices = [];
    for (let i = 0; i < NUM_X_AXIS_POINTS - 1; i++) {
      selectedIndices.push(i * step);
    }
    selectedIndices.push(chartData.length - 1);
    const selectedPoints = selectedIndices.map(index => chartData[index]).filter(Boolean);
    return selectedPoints.map((point, i, arr) => {
      const xPosition = 60 + (i * (chartWidth / Math.max(1, arr.length - 1)));
      let label = '';
      if (point.date) {
        const date = new Date(point.date);
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        label = `Point ${i + 1}`;
      }
      return { label, x: xPosition };
    });
  };

  const timelinePoints = generateTimelinePoints();

  // Current price info
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const startPrice = chartData.length > 0 ? chartData[0] : null;
  const priceChange = currentPrice && startPrice ? (currentPrice.y - startPrice.y) : 0;
  const priceChangePercent = startPrice ? ((priceChange / startPrice.y) * 100) : 0;

  const handleTickerSelect = (symbol) => {
    setTicker(symbol.toUpperCase().trim());
    setSearchTerm('');
    setSuggestions([]);
  };

  // Generate daily sentiment bar chart data
  const generateDailySentimentBars = () => {
    if (!dailySentiment || Object.keys(dailySentiment).length === 0) {
      return [];
    }

    // Sort by date and get last 7 days
    const sortedDates = Object.keys(dailySentiment).sort();
    const last7Days = sortedDates.slice(-7);

    return last7Days.map((date, index) => {
      const dayData = dailySentiment[date];
      const score = dayData.score || 0;
      const count = dayData.count || 0;
      const headlines = dayData.headlines || [];
      const dateObj = new Date(date);
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      return {
        date: date,
        label: label,
        score: score,
        count: count,
        headlines: headlines,
        index: index
      };
    });
  };

  // ---- keep everything above this line unchanged ----
const dailySentimentBars = generateDailySentimentBars();

// Map backend news -> props for RelatedNewsList
const relatedNews = (news || []).map((a, i) => ({
  id: a.id ?? a.link ?? String(i),
  title: a.title,
  source: a.provider ?? "Unknown",
  publishedAt: a.publish_date ?? new Date().toISOString(),
  summary: a.description ?? "",
  tickers: [ticker],
  sentimentScore: Number(a.sentiment_score ?? 0),
  link: a.link ?? a.url ?? null,
})); // <-- IMPORTANT: close with )); and a semicolon

return (
  <div className="min-h-screen bg-gray-50">
    {/* Header */}
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <nav className="flex space-x-8">
            <button
              className="text-gray-600 hover:text-gray-900"
              onClick={() => navigate("/portfolio_page")}
            >
              PORTFOLIO
            </button>
            <button className="text-gray-900 font-semibold border-b-2 border-blue-500 pb-2">
              ENTITY
            </button>
          </nav>
        </div>
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by entity"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm.length > 1 && suggestions.length > 0 && (
              <div className="absolute left-0 top-full w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 z-30 max-h-96 overflow-y-auto">
                {suggestionsLoading && (
                  <div className="p-4 text-center text-gray-500">Loading...</div>
                )}
                {!suggestionsLoading &&
                  Array.from(
                    new Map(
                      suggestions
                        .filter((q) => q.quoteType === "EQUITY")
                        .map((q) => [q.symbol, q])
                    ).values()
                  ).map((q, idx) => (
                    <div
                      key={q.symbol + "-" + idx}
                      onClick={() => handleTickerSelect(q.symbol)}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-100"
                    >
                      <p className="font-bold text-sm">{q.symbol}</p>
                      <p className="text-xs text-gray-600 truncate">
                        {q.shortname || q.longname}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Bell className="w-6 h-6 text-gray-600" />
          <User className="w-6 h-6 text-gray-600" />
          <button onClick={handleLogout}>
            <LogOut className="w-6 h-6 text-gray-600 hover:text-gray-600 transition" />
          </button>
        </div>
      </div>
    </header>

    <div className="flex">
      {/* Main Content */}
      <div className="w-2/3 p-6">
        <div className="bg-white rounded-lg shadow-sm">
          {/* Chart Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">
                  {companyName ? `${companyName}` : `${ticker} `}
                </h1>
                <p className="text-gray-600">{ticker}</p>
                <p className="text-gray-600">({currency})</p>
              </div>
              <div className="text-xs text-gray-500 text-right">
                {lastFetched && (
                  <span>
                    Data retrieved:{" "}
                    {lastFetched.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                      timeZoneName: "short",
                    })}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-end space-x-4 mb-4">
              <span className="text-4xl font-bold">
                {currentPrice
                  ? currentPrice.y.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "--"}
              </span>
              <span
                className={`flex items-center text-xl ${
                  priceChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {priceChange >= 0 ? "▲" : "▼"} {Math.abs(priceChange).toFixed(2)}
                <span className="ml-1">
                  {priceChangePercent >= 0 ? "+" : ""}
                  {priceChangePercent.toFixed(2)}%
                </span>
              </span>
            </div>
            <p className="text-gray-600 text-sm">
              As of{" "}
              {currentPrice
                ? new Date(currentPrice.date).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZoneName: "short",
                  })
                : "Loading..."}
            </p>
          </div>

          {/* Chart Controls */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex space-x-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded text-sm ${
                      timeframe === tf
                        ? "bg-blue-500 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Price Chart Area */}
          <div className="p-6">
            <div className="relative h-96 bg-white border border-gray-200 rounded-lg shadow-md">
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <div>Loading chart data...</div>
                    <div className="text-xs mt-1">Fetching {ticker} data...</div>
                  </div>
                </div>
              ) : (
                <svg className="w-full h-full" style={{ overflow: "visible" }}>
                  <defs>
                    <linearGradient
                      id="chartGradient"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop
                        offset="0%"
                        style={{
                          stopColor: priceChange >= 0 ? "#16a34a" : "#dc2626",
                          stopOpacity: 0.18,
                        }}
                      />
                      <stop
                        offset="100%"
                        style={{
                          stopColor: priceChange >= 0 ? "#16a34a" : "#dc2626",
                          stopOpacity: 0,
                        }}
                      />
                    </linearGradient>
                  </defs>
                  {/* Chart Grid */}
                  <g className="text-gray-400 text-xs">
                    {[...Array(6)].map((_, i) => {
                      const yPos = 40 + i * 50;
                      const price =
                        priceRange.max -
                        ((priceRange.max - priceRange.min) * i) / 5;
                      return (
                        <g key={i}>
                          <line
                            x1="60"
                            y1={yPos}
                            x2="720"
                            y2={yPos}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                          />
                          <text
                            x="50"
                            y={yPos + 5}
                            textAnchor="end"
                            fill="#9ca3af"
                            fontSize="11"
                            fontWeight="bold"
                          >
                            {price.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </text>
                        </g>
                      );
                    })}
                    {timelinePoints.map((point, i) => (
                      <line
                        key={`v-${i}`}
                        x1={point.x}
                        y1="40"
                        x2={point.x}
                        y2="290"
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                    ))}
                  </g>
                  {/* Chart Fill Area */}
                  {chartData.length > 0 && (
                    <path
                      d={`M 60 290 ${chartData
                        .map((point, i) => {
                          const x =
                            60 + (i * (660 / Math.max(1, chartData.length - 1)));
                          const y =
                            290 -
                            ((point.y - priceRange.min) /
                              (priceRange.max - priceRange.min)) *
                              250;
                          return `L ${x} ${y}`;
                        })
                        .join(" ")} L ${
                        60 +
                        ((chartData.length - 1) *
                          (660 / Math.max(1, chartData.length - 1)))
                      } 290 Z`}
                      fill="url(#chartGradient)"
                    />
                  )}
                  {/* Chart Line */}
                  {chartData.length > 0 && (
                    <path
                      d={`M ${60} ${
                        290 -
                        ((chartData[0].y - priceRange.min) /
                          (priceRange.max - priceRange.min)) *
                          250
                      } ${chartData
                        .slice(1)
                        .map((point, i) => {
                          const x =
                            60 +
                            ((i + 1) *
                              (660 / Math.max(1, chartData.length - 1)));
                          const y =
                            290 -
                            ((point.y - priceRange.min) /
                              (priceRange.max - priceRange.min)) *
                              250;
                          return `L ${x} ${y}`;
                        })
                        .join(" ")}`}
                      fill="none"
                      stroke={priceChange >= 0 ? "#16a34a" : "#dc2626"}
                      strokeWidth="3"
                      style={{
                        filter: "drop-shadow(0 2px 4px rgba(22,163,74,0.08))",
                      }}
                    />
                  )}
                  {/* Interactive Hover Areas */}
                  {chartData.map((point, i) => {
                    const x =
                      60 + (i * (660 / Math.max(1, chartData.length - 1)));
                    const y =
                      290 -
                      ((point.y - priceRange.min) /
                        (priceRange.max - priceRange.min)) *
                        250;
                    const isHovered = hoveredPoint?.index === i;
                    return (
                      <g key={i}>
                        <rect
                          x={x - 10}
                          y="40"
                          width="20"
                          height="250"
                          fill="transparent"
                          className="cursor-crosshair"
                          onMouseEnter={() =>
                            setHoveredPoint({
                              ...point,
                              x: x,
                              y: y,
                              index: i,
                              price: point.y,
                            })
                          }
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        {isHovered && (
                          <>
                            <circle
                              cx={x}
                              cy={y}
                              r="5"
                              fill={priceChange >= 0 ? "#3b82f6" : "#ef4444"}
                              stroke="white"
                              strokeWidth="2"
                              style={{
                                filter:
                                  "drop-shadow(0 2px 4px rgba(59,130,246,0.15))",
                              }}
                            />
                            <line
                              x1={x}
                              y1="40"
                              x2={x}
                              y2="290"
                              stroke={priceChange >= 0 ? "#3b82f6" : "#ef4444"}
                              strokeWidth="1"
                              strokeDasharray="3,3"
                            />
                          </>
                        )}
                      </g>
                    );
                  })}
                  {/* Timeline */}
                  {timelinePoints.map((point, i) => (
                    <g key={`timeline-${i}`}>
                      <circle
                        cx={point.x}
                        cy="310"
                        r="8"
                        fill="#f9fafb"
                        stroke="#d1d5db"
                        strokeWidth="2"
                      />
                      <circle cx={point.x} cy="310" r="3" fill="#3b82f6" />
                      <text
                        x={point.x}
                        y="330"
                        textAnchor="middle"
                        fill="#374151"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        {point.label}
                      </text>
                    </g>
                  ))}
                </svg>
              )}
              {/* Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute bg-white border border-blue-200 rounded-lg p-3 shadow-xl pointer-events-none z-20"
                  style={{
                    left: `${Math.max(
                      60,
                      Math.min(
                        hoveredPoint.x - 80,
                        60 + 660 - 160
                      )
                    )}px`,
                    top: `${hoveredPoint.y - 100}px`,
                    minWidth: "120px",
                  }}
                >
                  <div className="text-base font-bold text-blue-600">
                    {hoveredPoint.price?.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    USD
                  </div>
                  <div className="text-xs text-gray-600">{hoveredPoint.date}</div>
                  <div className="text-xs text-gray-500">{hoveredPoint.time}</div>
                  <div
                    className={`text-xs mt-1 ${
                      hoveredPoint.price >= (currentPrice?.y || 0)
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {currentPrice
                      ? ((hoveredPoint.price - currentPrice.y) / currentPrice.y) *
                          100 >=
                        0
                        ? "+"
                        : ""
                      : ""}
                    {currentPrice
                      ? (
                          ((hoveredPoint.price - currentPrice.y) /
                            currentPrice.y) *
                          100
                        ).toFixed(2)
                      : "0.00"}
                    %
                  </div>
                </div>
              )}
              {/* Chart Info Box */}
              <div className="absolute top-4 right-4 bg-white border border-blue-100 rounded p-3 shadow-md">
                <div className="text-base font-bold text-blue-600">
                  {currentPrice
                    ? currentPrice.y.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })
                    : "--"}{" "}
                  USD
                </div>
                <div className="text-xs text-gray-600">
                  {currentPrice ? currentPrice.date : "--"}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    priceChange >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {priceChangePercent >= 0 ? "+" : ""}
                  {priceChangePercent.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Daily Sentiment Bar Chart */}
          <div className="px-6 pb-6">
            <h3 className="text-lg font-semibold mb-4">
              Daily Average Sentiment (Past 7 Days)
            </h3>
            <div className="relative h-96 bg-white border border-gray-200 rounded-lg shadow-md p-6">
              {dailySentimentBars.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <div>Loading sentiment data...</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* (your existing bars SVG remains unchanged) */}
                  {/* ... keep everything inside here exactly as you had it ... */}
                </>
              )}
            </div>
          </div>

          {/* Overall Sentiment */}
          <div className="px-6 pb-6">
            <h3 className="text-lg font-semibold mb-4">Overall Sentiment</h3>
            <div className="flex items-center space-x-8">
              <div>
                <div className="text-sm text-gray-600">Average Sentiment Score</div>
                <div
                  className={`text-4xl font-bold ${
                    (sentiment.avg_score || 0) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {sentiment.avg_score ? sentiment.avg_score.toFixed(2) : "--"}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">News Articles</div>
                <div className="text-lg font-semibold">{news.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Related News */}
      <div className="w-1/3 p-6">
        <div className="bg-white border-l border-gray-200 rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-4">Related News</h3>
          <div className="max-h-screen overflow-y-auto">
            {relatedNews.length === 0 ? (
              <div className="text-gray-400">No news found for {ticker}</div>
            ) : (
              <RelatedNewsList items={relatedNews} />
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
); // end return
}; // end component

export default FinancialDashboard;