import React, { useState } from 'react';
import { Search, Bell, User, Menu } from 'lucide-react';

const FinancialDashboard = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [showNews, setShowNews] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const topSecurities = [
    { name: 'S&P 500', symbol: 'SPX', price: '6,584.29', change: '0.05%', changeType: 'positive' },
    { name: 'Nasdaq', symbol: 'NDX', price: '22,141.10', change: '0.44%', changeType: 'positive' },
    { name: 'BSOO', symbol: 'BSOO', price: '2,386.16', change: '0.04%', changeType: 'positive' },
    { name: 'US 10 Yr', symbol: 'US10Y', price: '4.06', change: '0.35%', changeType: 'negative' }
  ];

  const recentlyViewed = [
    { symbol: 'GBP-USD X-RATE', price: '1.3556 USD', change: '0.13%', changeType: 'positive' },
    { symbol: 'EUR-USD X-RATE', price: '1.1734 USD', change: '0.04%', changeType: 'positive' },
    { symbol: "Generic 1st 'GC' Future", price: '2,668.40 USD/t oz.', change: '0.35%', changeType: 'positive' },
    { symbol: 'FTSE 100 Index', price: '8,283.29 GBP', change: '0.15%', changeType: 'positive' },
    { symbol: "Generic 1st 'CL' Future", price: '62.69 USD/bbl.', change: '0.51%', changeType: 'positive' },
    { symbol: 'US TREASURY N/B', price: '101.50 USD', change: '0.35%', changeType: 'negative' }
  ];

  const newsItems = [
    { title: "Stock-Market Rally Is Built on Narrative That's Loaded With Risk", time: '22 hours ago', tag: 'HOT' },
    { title: 'The $14 Trillion US Stock Rally Is Seeking a Fed Cut Playbook', time: '3 hours ago', tag: 'HOT' },
    { title: 'Wall Street Rides a $1 Trillion Money Wave as Fed Test Looms', time: 'Sep 12, 2025', tag: '+8.0%' },
    { title: 'Stock Buyer Fatigue Kicks In as Bond Yields Rise: Markets Wrap', time: 'updated Sep 13, 2025', tag: '-3%' },
    { title: 'Gold Rises Toward Record as ETFs Expand in Run-Up to Fed Meeting', time: 'Sep 13, 2025', tag: null },
    { title: 'Wall Street Expects Rally in Riskiest Stocks to Last 12 Months', time: 'Sep 10, 2025', tag: '+12.6%' },
    { title: 'US Stocks Advance as CPI Report Buoys Trader Bets on Rate Cuts', time: 'updated Sep 12, 2025', tag: '+8.7%' }
  ];

  // Generate stable chart data (not random to avoid shifting)
  const chartData = Array.from({ length: 50 }, (_, i) => ({
    x: i,
    y: 6400 + Math.sin(i * 0.3) * 30 + (i * 3.5) + (Math.sin(i * 0.1) * 15),
    date: `Sep ${12 + Math.floor(i / 8)}`,
    time: `${9 + Math.floor(i / 6)}:${String((i * 10) % 60).padStart(2, '0')}`
  }));

  const timelinePoints = [
    { label: '9/9', x: 80 },
    { label: '9/10', x: 180 },
    { label: '9/11', x: 280 },
    { label: '9/12', x: 380 },
    { label: '9/13', x: 480 },
    { label: '9/16', x: 580 }
  ];

  const timeframes = ['1D', '1M', '6M', 'YTD', '1Y', '5Y'];

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
                placeholder="Search for any entity"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-4">Recently Viewed</h3>
          <div className="space-y-3">
            {recentlyViewed.map((item, index) => (
              <div key={index} className="border-b border-gray-100 pb-2">
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
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow-sm">
            {/* Chart Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold">S&P 500 INDEX</h1>
                  <p className="text-gray-600">SPX:IND</p>
                  <p className="text-gray-600">(USD)</p>
                </div>
              </div>

              <div className="flex items-end space-x-4 mb-4">
                <span className="text-4xl font-bold">6,584.29</span>
                <span className="text-green-600 flex items-center">
                  ▲ 3.18 <span className="ml-1">+0.05%</span>
                </span>
              </div>
              <p className="text-gray-600 text-sm">As of 12:00 AM EDT Sep 12, 2025</p>
            </div>

            {/* Chart Controls */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex space-x-1">
                  {timeframes.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setSelectedTimeframe(tf)}
                      className={`px-3 py-1 rounded text-sm ${
                        selectedTimeframe === tf
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
                <svg className="w-full h-full" style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 0.3 }} />
                      <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 0 }} />
                    </linearGradient>
                  </defs>
                  {/* Chart Grid */}
                  <g className="text-gray-400 text-xs">
                    {/* Horizontal grid lines */}
                    {[...Array(6)].map((_, i) => (
                      <g key={i}>
                        <line
                          x1="60"
                          y1={40 + (i * 50)}
                          x2="620"
                          y2={40 + (i * 50)}
                          stroke="#f3f4f6"
                          strokeWidth="1"
                        />
                        <text x="55" y={45 + (i * 50)} textAnchor="end" fill="#9ca3af" fontSize="10">
                          {(6650 - (i * 50)).toLocaleString()}
                        </text>
                      </g>
                    ))}
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
                  <path
                    d={`M 60 ${290 - ((chartData[0].y - 6400) / 300 * 250)} ${chartData
                      .map((point, i) => `L ${60 + (i * 11)} ${290 - ((point.y - 6400) / 300 * 250)}`)
                      .join(' ')} L ${60 + ((chartData.length - 1) * 11)} 290 L 60 290 Z`}
                    fill="url(#chartGradient)"
                  />
                  {/* Chart Line */}
                  <path
                    d={`M 60 ${290 - ((chartData[0].y - 6400) / 300 * 250)} ${chartData
                      .map((point, i) => `L ${60 + (i * 11)} ${290 - ((point.y - 6400) / 300 * 250)}`)
                      .join(' ')}`}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  {/* Interactive Hover Areas - Fixed positioning */}
                  {chartData.map((point, i) => {
                    const x = 60 + (i * 11);
                    const y = 290 - ((point.y - 6400) / 300 * 250);
                    const isHovered = hoveredPoint?.index === i;
                    return (
                      <g key={i}>
                        {/* Large invisible hover area - stays fixed */}
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
                            fill="#10b981"
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
                            stroke="#10b981"
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
                    <div className="text-xs text-green-600 mt-1">
                      {((hoveredPoint.y - 6400) / 6400 * 100) >= 0 ? '+' : ''}{((hoveredPoint.y - 6400) / 6400 * 100).toFixed(2)}%
                    </div>
                  </div>
                )}
                {/* Chart Info Box */}
                <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded p-3 shadow-sm">
                  <div className="text-sm font-medium">6,584.29 USD</div>
                  <div className="text-xs text-gray-600">Sep 12</div>
                  <div className="text-xs text-green-600 mt-1">7.00%</div>
                </div>
              </div>
            </div>
            {/* Overall Sentiment */}
            <div className="px-6 pb-6">
              <h3 className="text-lg font-semibold mb-4">Overall Sentiment</h3>
              <div className="flex items-center space-x-8">
                <div>
                  <div className="text-sm text-gray-600">Average Sentiment Score (5M)</div>
                  <div className="text-4xl font-bold text-green-600">0.21</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Country Average (5M)</div>
                  <div className="text-lg font-semibold">0.30</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Sector Average (5M)</div>
                  <div className="text-lg font-semibold">N/A</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Right Sidebar - Related News */}
        <div className="w-80 bg-white border-l border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-4">Related News</h3>
          <div className="space-y-4">
            {newsItems.map((news, index) => (
              <div key={index} className="border-b border-gray-100 pb-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900 leading-5 flex-1">
                    {news.title}
                  </h4>
                  {news.tag && (
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                      news.tag === 'HOT' ? 'bg-red-500 text-white' : 
                      news.tag.startsWith('+') ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {news.tag}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">{news.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;
