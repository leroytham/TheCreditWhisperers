import React, { useState, useEffect } from 'react';
import { Search, Bell, User, Menu } from 'lucide-react';
// Standardize number of x-axis points
const NUM_X_AXIS_POINTS = 6;
const TIMEFRAMES = ['5D', '1M', '3M', '6M', 'YTD', '1Y'];
// COMMENTED OUT timeframes: '1D', '5Y'

const FinancialDashboard = () => {
  // Backend integration state
  const [ticker, setTicker] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1Y');
  const [priceData, setPriceData] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [news, setNews] = useState([]);
  const [sentiment, setSentiment] = useState({});

  // UI state
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Backend API calls
  useEffect(() => {
    fetch(`/api/price?ticker=${ticker}&timeframe=${timeframe}`)
      .then(res => res.json())
      .then(data => {
        setPriceData(data.prices || []);
        setCompanyName(data.company_name || '');
        setCurrency(data.currency || 'USD');
      })
      .catch(err => console.error('Error fetching price data:', err));

    fetch(`/api/news?ticker=${ticker}`)
      .then(res => res.json())
      .then(data => {
        setNews(data.news || []);
        setSentiment({ avg_score: data.avg_score });
      })
      .catch(err => console.error('Error fetching news:', err));
  }, [ticker, timeframe]);

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

  // Generate timeline points from data based on timeframe - UPDATED
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
        // Always use 'Aug 16' style for all timeframes
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        label = `Point ${i + 1}`;
      }
      return { label, x: xPosition };
    });
  };

  const timelinePoints = generateTimelinePoints();

  // Current price info - calculate based on timeframe (start to end of selected period)
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const startPrice = chartData.length > 0 ? chartData[0] : null;
  const priceChange = currentPrice && startPrice ? (currentPrice.y - startPrice.y) : 0;
  const priceChangePercent = startPrice ? ((priceChange / startPrice.y) * 100) : 0;

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

      <div className="flex">
        {/* Main Content */}
        <div className="flex-1 p-6">
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
              </div>

              <div className="flex items-end space-x-4 mb-4">
                <span className="text-4xl font-bold">
                  {currentPrice ? currentPrice.y.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '--'}
                </span>
                <span className={`flex items-center text-xl ${
                  priceChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)} 
                  <span className="ml-1">{priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
                </span>
              </div>
              <p className="text-gray-600 text-sm">
                As of {currentPrice ? new Date(currentPrice.date).toLocaleString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                  timeZoneName: 'short'
                }) : 'Loading...'}
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
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart Area */}
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
                  <svg className="w-full h-full" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: priceChange >= 0 ? '#3b82f6' : '#ef4444', stopOpacity: 0.25 }} />
                        <stop offset="100%" style={{ stopColor: priceChange >= 0 ? '#3b82f6' : '#ef4444', stopOpacity: 0 }} />
                      </linearGradient>
                    </defs>
                    {/* Chart Grid - horizontal lines and price labels */}
                    <g className="text-gray-400 text-xs">
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
                              stroke="#e5e7eb"
                              strokeWidth="1"
                            />
                            <text x="50" y={yPos + 5} textAnchor="end" fill="#9ca3af" fontSize="11" fontWeight="bold">
                              {price.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </text>
                          </g>
                        );
                      })}
                      {/* Vertical grid lines for timeline points */}
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
                    {/* Chart Fill Area - modern gradient */}
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
                    {/* Chart Line - bold, modern color */}
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
                        stroke={priceChange >= 0 ? '#3b82f6' : '#ef4444'}
                        strokeWidth="3"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(59,130,246,0.08))' }}
                      />
                    )}
                    {/* Interactive Hover Areas and Points */}
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
                            onMouseEnter={() => setHoveredPoint({ ...point, x: x, y: y, index: i, price: point.y })}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                          {/* Visible point circle */}
                          {isHovered && (
                            <circle
                              cx={x}
                              cy={y}
                              r="5"
                              fill={priceChange >= 0 ? '#3b82f6' : '#ef4444'}
                              stroke="white"
                              strokeWidth="2"
                              style={{ filter: 'drop-shadow(0 2px 4px rgba(59,130,246,0.15))' }}
                            />
                          )}
                          {/* Vertical line on hover */}
                          {isHovered && (
                            <line
                              x1={x}
                              y1="40"
                              x2={x}
                              y2="290"
                              stroke={priceChange >= 0 ? '#3b82f6' : '#ef4444'}
                              strokeWidth="1"
                              strokeDasharray="3,3"
                            />
                          )}
                        </g>
                      );
                    })}
                    {/* Timeline Circles and Labels (Bloomberg style) */}
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
                        <circle
                          cx={point.x}
                          cy="310"
                          r="3"
                          fill="#3b82f6"
                        />
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
                {/* Tooltip - Bloomberg style */}
                {hoveredPoint && (
                  <div
                    className="absolute bg-white border border-blue-200 rounded-lg p-3 shadow-xl pointer-events-none z-20"
                    style={{
                      /* Tooltip width is 160px, chart left edge is at 60px, chart width is 660px */
                      left: `${Math.max(
                        60, // chart left edge
                        Math.min(
                          hoveredPoint.x - 80, // center tooltip above point
                          60 + 660 - 160 // chart right edge minus tooltip width
                        )
                      )}px`,
                      top: `${hoveredPoint.y - 100}px`,
                      minWidth: '120px'
                    }}
                  >
                    <div className="text-base font-bold text-blue-600">{hoveredPoint.price?.toLocaleString(undefined, {maximumFractionDigits: 2})} USD</div>
                    <div className="text-xs text-gray-600">{hoveredPoint.date}</div>
                    <div className="text-xs text-gray-500">{hoveredPoint.time}</div>
                    <div className={`text-xs mt-1 ${
                      hoveredPoint.price >= (currentPrice?.y || 0) ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {currentPrice ? (
                        ((hoveredPoint.price - currentPrice.y) / currentPrice.y * 100) >= 0 ? '+' : ''
                      ) : ''}
                      {currentPrice ? ((hoveredPoint.price - currentPrice.y) / currentPrice.y * 100).toFixed(2) : '0.00'}%
                    </div>
                  </div>
                )}
                {/* Chart Info Box - Bloomberg style */}
                <div className="absolute top-4 right-4 bg-white border border-blue-100 rounded p-3 shadow-md">
                  <div className="text-base font-bold text-blue-600">
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
                  <div className="text-sm text-gray-600">News Articles</div>
                  <div className="text-lg font-semibold">{news.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Related News (Always visible) */}
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
                    {article.sentiment_score !== undefined && article.sentiment_score !== null && (
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap border ${
                        article.sentiment_score > 0 ? 'text-green-600 border-green-600 bg-green-50' : 
                        article.sentiment_score < 0 ? 'text-red-600 border-red-600 bg-red-50' :
                        'text-gray-600 border-gray-600 bg-gray-50'
                      }`}>
                        Sentiment Score: {article.sentiment_score.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    {article.publish_date} | {article.provider}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;