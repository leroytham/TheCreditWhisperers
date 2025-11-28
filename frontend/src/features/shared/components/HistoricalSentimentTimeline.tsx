import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * HistoricalSentimentTimeline Component
 *
 * Displays historical sentiment trends with mini line chart and event markers
 * Allows users to explore sentiment changes over time
 *
 * @param {Object} props
 * @param {Array} props.data - Historical sentiment data points
 * @param {string} props.period - Display period ('1W', '1M', '3M', '6M', '1Y')
 * @param {boolean} props.highlightEvents - Show event markers on timeline
 * @param {Function} props.onEventClick - Callback when event is clicked
 * @param {Function} props.onDateRangeChange - Callback for date range changes
 * @param {string} props.className - Additional CSS classes
 */
const HistoricalSentimentTimeline = ({
  data = [],
  period = '1M',
  highlightEvents = true,
  onEventClick = () => {},
  onDateRangeChange = (_opt?: string) => {},
  className = ''
}: {
  data?: any[];
  period?: string;
  highlightEvents?: boolean;
  onEventClick?: (event: any) => void;
  onDateRangeChange?: (opt?: string) => void;
  className?: string;
}) => {
  const [displayPeriod, setDisplayPeriod] = useState(period);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const periodOptions = ['1W', '1M', '3M', '6M', '1Y'];

  // Mini chart dimensions
  const chartWidth = 400;
  const chartHeight = 120;
  const padding = { top: 20, right: 20, bottom: 20, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Find min/max sentiment for scaling
  const sentiments = data.map(d => d.sentiment || 0);
  const minSentiment = Math.min(...sentiments, -1);
  const maxSentiment = Math.max(...sentiments, 1);
  const sentimentRange = maxSentiment - minSentiment;

  // Generate SVG path for line chart
  const generatePath = () => {
    if (data.length === 0) return '';

    const points = data.map((d, i) => {
      const x = padding.left + (i / Math.max(1, data.length - 1)) * innerWidth;
      const y = padding.top + ((maxSentiment - (d.sentiment || 0)) / sentimentRange) * innerHeight;
      return `${x},${y}`;
    });

    return `M${points.join('L')}`;
  };

  // Calculate zero line position
  const zeroY = padding.top + ((maxSentiment - 0) / sentimentRange) * innerHeight;

  // Format date range
  const getDateRange = () => {
    if (data.length === 0) return 'No data available';
    const startDate = new Date(data[0].date || Date.now());
    const endDate = new Date(data[data.length - 1].date || Date.now());

    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  // Calculate statistics
  const getStats = () => {
    if (data.length === 0) return { avg: 0, min: 0, max: 0 };

    const scores = data.map(d => d.sentiment || 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    return { avg, min, max };
  };

  const stats = getStats();

  const getSentimentColor = (score) => {
    if (score > 0.3) return '#10B981';
    if (score > 0) return '#F59E0B';
    if (score < -0.3) return '#EF4444';
    if (score < 0) return '#F97316';
    return '#6B7280';
  };

  return (
    <div className={`border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Historical Sentiment</h3>
            <p className="text-xs text-gray-600 mt-1">{getDateRange()}</p>
          </div>

          {/* Period Selector */}
          <div className="flex items-center space-x-1">
            {periodOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  setDisplayPeriod(opt);
                  onDateRangeChange(opt);
                }}
                className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                  displayPeriod === opt
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {data.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No historical data available for this period</p>
          </div>
        ) : (
          <>
            {/* Mini Chart */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <svg width={chartWidth} height={chartHeight} className="w-full">
                <defs>
                  <linearGradient id="sentimentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Background grid */}
                <line
                  x1={padding.left}
                  y1={zeroY}
                  x2={chartWidth - padding.right}
                  y2={zeroY}
                  stroke="#D1D5DB"
                  strokeDasharray="4"
                  opacity="0.5"
                />

                {/* Y-axis labels */}
                <text x={padding.left - 10} y={padding.top + 5} fontSize="12" fill="#6B7280" textAnchor="end">
                  +1.0
                </text>
                <text x={padding.left - 10} y={zeroY + 5} fontSize="12" fill="#6B7280" textAnchor="end">
                  0
                </text>
                <text x={padding.left - 10} y={chartHeight - padding.bottom + 5} fontSize="12" fill="#6B7280" textAnchor="end">
                  -1.0
                </text>

                {/* Area chart fill */}
                <path
                  d={`${generatePath()} L${chartWidth - padding.right},${chartHeight - padding.bottom} L${padding.left},${chartHeight - padding.bottom} Z`}
                  fill="url(#sentimentGradient)"
                />

                {/* Line chart */}
                <path
                  d={generatePath()}
                  stroke="#10B981"
                  strokeWidth="2"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Data points */}
                {data.map((d, i) => {
                  const x = padding.left + (i / Math.max(1, data.length - 1)) * innerWidth;
                  const y = padding.top + ((maxSentiment - (d.sentiment || 0)) / sentimentRange) * innerHeight;
                  const isHovered = hoveredIndex === i;

                  return (
                    <g
                      key={i}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Invisible hit area */}
                      <circle cx={x} cy={y} r="6" fill="transparent" />

                      {/* Data point circle */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? '5' : '3'}
                        fill={getSentimentColor(d.sentiment || 0)}
                        opacity={isHovered ? 1 : 0.8}
                        className="transition-all"
                      />

                      {/* Event marker if applicable */}
                      {d.isEvent && highlightEvents && (
                        <circle
                          cx={x}
                          cy={y - 8}
                          r="4"
                          fill="none"
                          stroke="#EF4444"
                          strokeWidth="2"
                        />
                      )}

                      {/* Tooltip on hover */}
                      {isHovered && (
                        <g>
                          <rect
                            x={x - 40}
                            y={y - 45}
                            width="80"
                            height="40"
                            fill="white"
                            stroke="#6B7280"
                            strokeWidth="1"
                            rx="4"
                          />
                          <text
                            x={x}
                            y={y - 28}
                            fontSize="11"
                            fontWeight="600"
                            fill="#111827"
                            textAnchor="middle"
                          >
                            {(d.sentiment || 0).toFixed(2)}
                          </text>
                          <text
                            x={x}
                            y={y - 15}
                            fontSize="10"
                            fill="#6B7280"
                            textAnchor="middle"
                          >
                            {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Statistics Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Average</p>
                <p className="text-2xl font-bold text-green-900">{stats.avg.toFixed(2)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">High</p>
                <p className="text-2xl font-bold text-blue-900">{stats.max.toFixed(2)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Low</p>
                <p className="text-2xl font-bold text-red-900">{stats.min.toFixed(2)}</p>
              </div>
            </div>

            {/* Events Section */}
            {highlightEvents && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Notable Events</h4>
                <div className="space-y-2">
                  {data.filter(d => d.isEvent).length === 0 ? (
                    <p className="text-sm text-gray-600">No significant events recorded</p>
                  ) : (
                    data.filter(d => d.isEvent).map((event, idx) => (
                      <button
                        key={idx}
                        onClick={() => onEventClick(event)}
                        className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{event.headline}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            event.sentiment > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {event.sentiment > 0 ? '↑' : '↓'} {Math.abs(event.sentiment).toFixed(2)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HistoricalSentimentTimeline;
