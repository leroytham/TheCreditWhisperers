import React, { useState, useEffect } from 'react';
import { Search, Bell, User, Menu, TrendingUp, TrendingDown } from 'lucide-react';

const TIMEFRAMES = ['1D', '1M', '3M', '6M', 'YTD', '1Y', '5Y'];

const FinancialDashboard = () => {
  // Backend integration state
  const [ticker, setTicker] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1D');
  const [priceData, setPriceData] = useState([]);
  const [news, setNews] = useState([]);
  const [sentiment, setSentiment] = useState({});
  const [largeMoves, setLargeMoves] = useState([]);
  const [dailySentiment, setDailySentiment] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [relatedNews, setRelatedNews] = useState([]);
  
  // UI state
  const [showNews, setShowNews] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Recently viewed state
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    // Load from localStorage on component mount
    const saved = localStorage.getItem('recentlyViewed');
    return saved ? JSON.parse(saved) : [];
  });

  // Mock top securities for ticker (you can replace with API call)
  const topSecurities = [
    { name: 'S&P 500', symbol: 'SPX', price: '6,584.29', change: '0.05%', changeType: 'positive' },
    { name: 'Nasdaq', symbol: 'NDX', price: '22,141.10', change: '0.44%', changeType: 'positive' },
    { name: 'BSOO', symbol: 'BSOO', price: '2,386.16', change: '0.04%', changeType: 'positive' },
    { name: 'US 10 Yr', symbol: 'US10Y', price: '4.06', change: '0.35%', changeType: 'negative' }
  ];

  // Backend API calls
  useEffect(() => {
    fetch(`/api/price?ticker=${ticker}&timeframe=${timeframe}`)
      .then(res => res.json())
      .then(data => setPriceData(data.prices || []))
      .catch(err => console.error('Error fetching price data:', err));
    
    fetch(`/api/news?ticker=${ticker}`)
      .then(res => res.json())
      .then(data => {
        setNews(data.news || []);
        setSentiment({ avg_score: data.avg_score });
      })
      .catch(err => console.error('Error fetching news:', err));
    
    fetch(`/api/large_moves?ticker=${ticker}&timeframe=${timeframe}`)
      .then(res => res.json())
      .then(data => setLargeMoves(data.moves || []))
      .catch(err => console.error('Error fetching large moves:', err));
    
    fetch(`/api/daily_sentiment?ticker=${ticker}`)
      .then(res => res.json())
      .then(data => setDailySentiment(data.daily || {}))
      .catch(err => console.error('Error fetching daily sentiment:', err));
  }, [ticker, timeframe]);

  useEffect(() => {
    if (selectedDate) {
      fetch(`/api/news_around_date?ticker=${ticker}&date=${selectedDate}`)
        .then(res => res.json())
        .then(data => setRelatedNews(data.news || []))
        .catch(err => console.error('Error fetching related news:', err));
    }
  }, [selectedDate, ticker]);

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
    
    // Use 6 points for better spacing, but extend chart to full width
    const numPoints = 6;
    const step = Math.max(1, Math.floor((chartData.length - 1) / (numPoints - 1)));
    const chartWidth = 660; // Extended width from x=60 to x=720
    
    // Get evenly distributed points including first and last
    const selectedIndices = [];
    for (let i = 0; i < numPoints - 1; i++) {
      selectedIndices.push(i * step);
    }
    selectedIndices.push(chartData.length - 1); // Always include last point
    
    const selectedPoints = selectedIndices.map(index => chartData[index]).filter(Boolean);
    
    return selectedPoints.map((point, i, arr) => {
      const xPosition = 60 + (i * (chartWidth / Math.max(1, arr.length - 1)));
      
      // Format label based on actual data structure
      let label = '';
      
      if (point.date) {
        const date = new Date(point.date);
        
        // For YTD and longer timeframes, show month abbreviations for better readability
        if (timeframe === 'YTD' || timeframe === '1Y' || timeframe === '5Y') {
          label = date.toLocaleDateString('en-US', { month: 'short' });
        } else if (timeframe === '1D' && point.time) {
          label = point.time;
        } else if (timeframe === '1D') {
          label = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        } else {
          // For 1M, 3M, 6M use M/D format
          label = `${date.getMonth() + 1}/${date.getDate()}`;
        }
      } else {
        label = `Point ${i + 1}`;
      }
      
      return {
        label,
        x: xPosition
      };
    });
  };

  const timelinePoints = generateTimelinePoints();

  // Current price info from latest data point
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const previousPrice = chartData.length > 1 ? chartData[chartData.length - 2] : null;
  const priceChange = currentPrice && previousPrice ? (currentPrice.y - previousPrice.y) : 0;
  const priceChangePercent = previousPrice ? ((priceChange / previousPrice.y) * 100) : 0;

  // Add ticker to recently viewed when it changes
  useEffect(() => {
    if (ticker && currentPrice) {
      const newItem = {
        symbol: ticker,
        price: `${currentPrice.y.toFixed(2)} USD`,
        change: `${priceChangePercent.toFixed(2)}%`,
        changeType: priceChange >= 0 ? 'positive' : 'negative',
        timestamp: Date.now()
      };

      setRecentlyViewed(prev => {
        // Remove if already exists and add to beginning
        const filtered = prev.filter(item => item.symbol !== ticker);
        const updated = [newItem, ...filtered].slice(0, 6); // Keep only 6 most recent
        
        // Save to localStorage
        localStorage.setItem('recentlyViewed', JSON.stringify(updated));
        return updated;
      });
    }
  }, [ticker, currentPrice, priceChange, priceChangePercent]);

  const handleTickerSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setTicker(searchTerm.toUpperCase().trim());
      setSearchTerm('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Menu className="w-6 h-6 text-gray-600" />
            <nav className="flex space-x-8">
              <button className="text-gray-600 hover:text-gray-900">PORTFOLIO</button>
              <button className="text-gray-900 font-semibold border-b-2 border-blue-500 pb-2">ENTITY</button>
            </nav>
          </div>
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTickerSubmit(e)}
                placeholder="Search sector, country, entity, and more"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Bell className="w-6 h-6 text-gray-600" />
            <User className="w-6 h-6 text-gray-600" />
          </div>
        </div>
      </header>

      {/* Top Securities Ticker */}
      <div className="bg-black text-white px-4 py-2">
        <div className="flex space-x-6 overflow-x-auto">
          {topSecurities.map((security, index) => (
            <div key={index} className="flex items-center space-x-2 whitespace-nowrap">
              <span className="text-sm font-semibold">{security.name}</span>
              <span className="text-sm">USD</span>
              <span className="text-lg font-bold">{security.price}</span>
              <span className={`text-sm flex items-center ${
                security.changeType === 'positive' ? 'text-green-400' : 'text-red-400'
              }`}>
                {security.changeType === 'positive' ? '▲' : '▼'} {security.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* Left Sidebar - Recently Viewed */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTickerSubmit(e)}
                placeholder="Search for any entity"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-4">Recently Viewed</h3>
          <div className="space-y-3">
            {recentlyViewed.length === 0 ? (
              <div className="text-gray-400 text-sm">No recent searches</div>
            ) : (
              recentlyViewed.map((item, index) => (
                <div key={`${item.symbol}-${item.timestamp}`} className="border-b border-gray-100 pb-2 cursor-pointer hover:bg-gray-50 p-2 rounded" 
                     onClick={() => setTicker(item.symbol)}>
                  <div className="text-sm font-medium text-gray-900">{item.symbol}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.price}</span>
                    <span className={`text-xs flex items-center ${
                      item.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {item.changeType === 'positive' ? '▲' : '▼'} {item.change}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow-sm">
            {/* Chart Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold">{ticker} INDEX</h1>
                  <p className="text-gray-600">{ticker}:IND</p>
                  <p className="text-gray-600">(USD)</p>
                </div>
              </div>

              <div className="flex items-end space-x-4 mb-4">
                <span className="text-4xl font-bold">
                  {currentPrice ? currentPrice.y.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '--'}
                </span>
                <span className={`flex items-center ${
                  priceChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)} 
                  <span className="ml-1">{priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
                </span>
              </div>
              <p className="text-gray-600 text-sm">As of {currentPrice ? currentPrice.date : 'Loading...'}</p>
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
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <span className="text-gray-600 text-sm">News</span>
                    <button
                      onClick={() => setShowNews(!showNews)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showNews ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showNews ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="p-6">
              <div className="relative h-96 border border-gray-200 rounded">
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      <div>Loading chart data...</div>
                      <div className="text-xs mt-1">Fetching {ticker} data...</div>
                    </div>
                  </div>
                ) : (
                  <svg className="w-full h-full" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: priceChange >= 0 ? '#10b981' : '#ef4444', stopOpacity: 0.3 }} />
                        <stop offset="100%" style={{ stopColor: priceChange >= 0 ? '#10b981' : '#ef4444', stopOpacity: 0 }} />
                      </linearGradient>
                    </defs>
                    
                    {/* Chart Grid */}
                    <g className="text-gray-400 text-xs">
                      {/* Horizontal grid lines */}
                      {[...Array(6)].map((_, i) => {
                        const yPos = 40 + (i * 50);
                        const price = priceRange.max - ((priceRange.max - priceRange.min) * i / 5);
                        return (
                          <g key={i}>
                            <line
                              x1="60"
                              y1={yPos}
                              x2="720"
                              y2={yPos}
                              stroke="#f3f4f6"
                              strokeWidth="1"
                            />
                            <text x="55" y={yPos + 5} textAnchor="end" fill="#9ca3af" fontSize="10">
                              {price.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </text>
                          </g>
                        );
                      })}
                      {/* Vertical grid lines */}
                      {timelinePoints.map((point, i) => (
                        <line
                          key={`v-${i}`}
                          x1={point.x}
                          y1="40"
                          x2={point.x}
                          y2="290"
                          stroke="#f3f4f6"
                          strokeWidth="1"
                        />
                      ))}
                    </g>
                    
                    {/* Chart Fill Area */}
                    {chartData.length > 0 && (
                      <path
                        d={`M 60 290 ${chartData
                          .map((point, i) => {
                            const x = 60 + (i * (660 / Math.max(1, chartData.length - 1)));
                            const y = 290 - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * 250);
                            return `L ${x} ${y}`;
                          })
                          .join(' ')} L ${60 + ((chartData.length - 1) * (660 / Math.max(1, chartData.length - 1)))} 290 Z`}
                        fill="url(#chartGradient)"
                      />
                    )}
                    
                    {/* Chart Line */}
                    {chartData.length > 0 && (
                      <path
                        d={`M ${60} ${290 - ((chartData[0].y - priceRange.min) / (priceRange.max - priceRange.min) * 250)} ${chartData
                          .slice(1)
                          .map((point, i) => {
                            const x = 60 + ((i + 1) * (660 / Math.max(1, chartData.length - 1)));
                            const y = 290 - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * 250);
                            return `L ${x} ${y}`;
                          })
                          .join(' ')}`}
                        fill="none"
                        stroke={priceChange >= 0 ? '#10b981' : '#ef4444'}
                        strokeWidth="2"
                      />
                    )}
                    
                    {/* Interactive Hover Areas */}
                    {chartData.map((point, i) => {
                      const x = 60 + (i * (660 / Math.max(1, chartData.length - 1)));
                      const y = 290 - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * 250);
                      const isHovered = hoveredPoint?.index === i;
                      
                      return (
                        <g key={i}>
                          {/* Large invisible hover area */}
                          <rect
                            x={x - 10}
                            y="40"
                            width="20"
                            height="250"
                            fill="transparent"
                            className="cursor-crosshair"
                            onMouseEnter={() => setHoveredPoint({ ...point, x: x, y: y, index: i })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          
                          {/* Visible point circle */}
                          {isHovered && (
                            <circle
                              cx={x}
                              cy={y}
                              r="4"
                              fill={priceChange >= 0 ? '#10b981' : '#ef4444'}
                              stroke="white"
                              strokeWidth="2"
                            />
                          )}
                          
                          {/* Vertical line on hover */}
                          {isHovered && (
                            <line
                              x1={x}
                              y1="40"
                              x2={x}
                              y2="290"
                              stroke={priceChange >= 0 ? '#10b981' : '#ef4444'}
                              strokeWidth="1"
                              strokeDasharray="3,3"
                            />
                          )}
                        </g>
                      );
                    })}
                    
                    {/* Bottom Timeline Circles and Labels */}
                    {timelinePoints.map((point, i) => (
                      <g key={`timeline-${i}`}>
                        {/* Timeline circle */}
                        <circle
                          cx={point.x}
                          cy="310"
                          r="8"
                          fill="white"
                          stroke="#d1d5db"
                          strokeWidth="2"
                        />
                        {/* Inner circle */}
                        <circle
                          cx={point.x}
                          cy="310"
                          r="3"
                          fill="#6b7280"
                        />
                        {/* Timeline label */}
                        <text
                          x={point.x}
                          y="330"
                          textAnchor="middle"
                          fill="#6b7280"
                          fontSize="10"
                        >
                          {point.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
                
                {/* Fixed Position Tooltip */}
                {hoveredPoint && (
                  <div
                    className="absolute bg-white border border-gray-300 rounded-lg p-3 shadow-lg pointer-events-none z-20"
                    style={{
                      left: `${Math.min(Math.max(hoveredPoint.x - 60, 10), 400)}px`,
                      top: `${hoveredPoint.y - 100}px`
                    }}
                  >
                    <div className="text-sm font-semibold">{hoveredPoint.y.toLocaleString(undefined, {maximumFractionDigits: 2})} USD</div>
                    <div className="text-xs text-gray-600">{hoveredPoint.date}</div>
                    <div className="text-xs text-gray-500">{hoveredPoint.time}</div>
                    <div className={`text-xs mt-1 ${
                      hoveredPoint.y >= (currentPrice?.y || 0) ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {currentPrice ? (
                        ((hoveredPoint.y - currentPrice.y) / currentPrice.y * 100) >= 0 ? '+' : ''
                      ) : ''}
                      {currentPrice ? ((hoveredPoint.y - currentPrice.y) / currentPrice.y * 100).toFixed(2) : '0.00'}%
                    </div>
                  </div>
                )}
                
                {/* Chart Info Box */}
                <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded p-3 shadow-sm">
                  <div className="text-sm font-medium">
                    {currentPrice ? currentPrice.y.toLocaleString(undefined, {maximumFractionDigits: 2}) : '--'} USD
                  </div>
                  <div className="text-xs text-gray-600">{currentPrice ? currentPrice.date : '--'}</div>
                  <div className={`text-xs mt-1 ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Sentiment */}
            <div className="px-6 pb-6">
              <h3 className="text-lg font-semibold mb-4">Overall Sentiment</h3>
              <div className="flex items-center space-x-8">
                <div>
                  <div className="text-sm text-gray-600">Average Sentiment Score (5M)</div>
                  <div className={`text-4xl font-bold ${
                    (sentiment.avg_score || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {sentiment.avg_score ? sentiment.avg_score.toFixed(2) : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Large Moves Detected</div>
                  <div className="text-lg font-semibold">{largeMoves.length}</div>
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
        {showNews && (
          <div className="w-80 bg-white border-l border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-4">Related News</h3>
            <div className="space-y-4 max-h-screen overflow-y-auto">
              {news.length === 0 ? (
                <div className="text-gray-400">No news found for {ticker}</div>
              ) : (
                news.map((article, index) => (
                  <div key={index} className="border-b border-gray-100 pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 leading-5 flex-1">
                        <a 
                          href={article.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-blue-600"
                        >
                          {article.title}
                        </a>
                      </h4>
                      {article.sentiment_label && (
                        <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                          article.sentiment_label === 'positive' ? 'bg-green-100 text-green-800' : 
                          article.sentiment_label === 'negative' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {article.sentiment_label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      {article.publish_date} | {article.provider}
                      {article.sentiment_score && (
                        <span className="ml-2">Score: {article.sentiment_score}</span>
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>


          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialDashboard;