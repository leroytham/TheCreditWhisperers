import React, { useState, useRef, useLayoutEffect } from 'react';
import {
  generateChartData,
  getPriceRange,
  generateTimelinePoints,
  calculatePriceChange,
  calculateChartPath,
  calculateFillPath,
  findEventPosition,
  computeEventMarkers,
  formatTooltipDateTime
} from '../utils/chartHelpers';
import {
  formatPrice,
  getChartLineColor
} from '../utils/formatters';
import { CHART_CONFIG, SECTOR_CHART_CONFIG } from '../utils/constants';

/**
 * Shared PriceChart Component
 *
 * Interactive price chart with timeline and event markers
 * Supports both static (entity) and responsive (sector) layouts
 *
 * @param {Object} props
 * @param {Array} props.priceData - Raw price data (entity mode)
 * @param {Array} props.chartData - Pre-processed chart data (sector mode)
 * @param {Object} props.priceRange - Pre-calculated price range (sector mode)
 * @param {number} props.priceChange - Pre-calculated price change (sector mode)
 * @param {string} props.ticker - Ticker symbol
 * @param {string} props.companyName - Company/sector name
 * @param {string} props.currency - Currency code
 * @param {Array} props.significantEvents - Events for entity mode
 * @param {Array} props.topEvents - Events for sector mode
 * @param {boolean} props.showEvents - Whether to show event markers (sector mode)
 * @param {boolean} props.responsive - Enable responsive width calculation (default: false)
 * @param {string} props.mode - 'entity' or 'sector' (auto-detected if not specified)
 * @param {string} props.timeframe - Current timeframe (1D, 5D, 1M, 6M, YTD, 1Y, 5Y)
 * @param {number} props.prevClose - Previous close price (for 1D view)
 */
const PriceChart = ({
  priceData,
  chartData: preProcessedChartData,
  priceRange: preProcessedPriceRange,
  priceChange: preProcessedPriceChange,
  ticker,
  companyName,
  currency,
  significantEvents = [],
  topEvents = [],
  showEvents = true,
  responsive = false,
  mode,
  timeframe = '1Y',
  prevClose = null,
  exchange = ''
}) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const chartContainerRef = useRef(null);
  const [dynamicChartWidth, setDynamicChartWidth] = useState(SECTOR_CHART_CONFIG.DEFAULT_WIDTH);

  // Auto-detect mode if not specified
  const detectedMode = mode || (priceData ? 'entity' : 'sector');
  const isResponsive = responsive || detectedMode === 'sector';

  // Responsive width calculation (sector mode)
  useLayoutEffect(() => {
    if (!isResponsive) return;

    const measure = () => {
      const el = chartContainerRef.current;
      if (!el) return;
      const w = Math.max(SECTOR_CHART_CONFIG.MIN_WIDTH, el.clientWidth - 120);
      setDynamicChartWidth(Math.min(SECTOR_CHART_CONFIG.MAX_WIDTH, w));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isResponsive]);

  // Calculate chart data based on mode
  const chartData = preProcessedChartData || generateChartData(priceData);
  let priceRange = preProcessedPriceRange || getPriceRange(chartData);

  // For 1D timeframe, expand price range to include prevClose if needed
  if (timeframe === '1D' && prevClose && priceRange) {
    const adjustedMin = Math.min(priceRange.min, prevClose);
    const adjustedMax = Math.max(priceRange.max, prevClose);
    // Add some padding to ensure prevClose is visible
    const padding = (adjustedMax - adjustedMin) * 0.1;
    priceRange = {
      min: adjustedMin - padding,
      max: adjustedMax + padding
    };
    console.log('[PriceChart] Adjusted price range for 1D to include prevClose:', priceRange);
  }
  const { currentPrice, priceChange, priceChangePercent } =
    preProcessedPriceChange !== undefined
      ? { currentPrice: chartData[chartData.length - 1], priceChange: preProcessedPriceChange, priceChangePercent: preProcessedPriceChange }
      : calculatePriceChange(chartData);

  // Debug logging for 1D
  if (timeframe === '1D') {
    console.log('[PriceChart] 1D Debug:');
    console.log('  - timeframe:', timeframe);
    console.log('  - prevClose:', prevClose);
    console.log('  - chartData length:', chartData.length);
    console.log('  - priceRange:', priceRange);
  }

  // Chart dimensions
  const chartWidth = isResponsive ? dynamicChartWidth : CHART_CONFIG.width;
  const chartHeight = isResponsive ? SECTOR_CHART_CONFIG.HEIGHT : 250;
  const paddingLeft = 60;
  const paddingRight = 60;
  const paddingTop = 40;

  // Responsive number of x-axis points based on chart width
  const getNumXAxisPoints = (width) => {
    if (width < 400) return 4;
    if (width < 600) return 5;
    if (width < 800) return 6;
    return 8;
  };

  const numXAxisPoints = isResponsive
    ? getNumXAxisPoints(chartWidth)
    : getNumXAxisPoints(CHART_CONFIG.width);

  // Generate timeline points with responsive count and timeframe-aware formatting
  const timelinePoints = generateTimelinePoints(
    chartData,
    chartWidth,
    numXAxisPoints,
    paddingLeft,
    timeframe,
    exchange
  );

  // Event markers (different handling for entity vs sector)
  const eventMarkers = detectedMode === 'sector' && showEvents
    ? computeEventMarkers(topEvents, chartData, chartWidth, chartHeight, priceRange, paddingLeft, paddingTop)
    : [];

  // Calculate paths for entity mode
  const linePath = detectedMode === 'entity'
    ? calculateChartPath(chartData, priceRange, chartWidth, chartHeight, paddingLeft, paddingTop)
    : null;
  const fillPath = detectedMode === 'entity'
    ? calculateFillPath(chartData, priceRange, chartWidth, chartHeight, paddingLeft, paddingTop)
    : null;

  // Empty state
  if (!chartData || chartData.length === 0) {
    return (
      <div className="relative h-96 bg-white border border-gray-200 rounded-lg shadow-md">
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <div>Loading chart data...</div>
            {ticker && <div className="text-xs mt-1">Fetching {ticker} data...</div>}
          </div>
        </div>
      </div>
    );
  }

  // Compute tooltip data for sector mode
  const tooltip = detectedMode === 'sector' && hoveredPoint ? (() => {
    const tooltipWidth = 220;
    const containerLeft = paddingLeft;
    const minLeft = containerLeft;
    const maxLeft = containerLeft + chartWidth - tooltipWidth;
    const rawLeft = hoveredPoint.x - tooltipWidth / 2;
    const left = Math.max(minLeft, Math.min(rawLeft, maxLeft));
    const rawTop = hoveredPoint.y - 100;
    const top = Math.max(8, rawTop);
    const idx = hoveredPoint.xIndex;
    const prev = (idx > 0 && chartData[idx - 1]) ? chartData[idx - 1].y : hoveredPoint.price;
    const change = hoveredPoint.price - prev;
    const changePct = prev ? (change / prev) * 100 : 0;
    const dateStr = hoveredPoint.date ? formatTooltipDateTime(hoveredPoint.date, timeframe, hoveredPoint.time) : '';
    return { left, top, change, changePct, dateStr };
  })() : null;

  return (
    <div ref={chartContainerRef} className="relative h-96 bg-white border border-gray-200 rounded-lg shadow-md">
      <svg className="w-full h-full" style={{ overflow: 'visible' }}>
        {/* Gradient Definition */}
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              style={{
                stopColor: priceChange >= 0 ? '#16a34a' : '#dc2626',
                stopOpacity: 0.18
              }}
            />
            <stop
              offset="100%"
              style={{
                stopColor: priceChange >= 0 ? '#16a34a' : '#dc2626',
                stopOpacity: 0
              }}
            />
          </linearGradient>
        </defs>

        {/* Grid lines and labels */}
        <g className="text-gray-400 text-xs">
          {[...Array(6)].map((_, i) => {
            const yPos = paddingTop + (i * (chartHeight / 5));
            const price = priceRange.max - ((priceRange.max - priceRange.min) * i / 5);
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={paddingLeft + chartWidth}
                  y2={yPos}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                {/* Y-axis labels on the RIGHT side */}
                <text
                  x={paddingLeft + chartWidth + 10}
                  y={yPos + 5}
                  textAnchor="start"
                  fill="#9ca3af"
                  fontSize="11"
                  fontWeight="bold"
                >
                  {price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </text>
              </g>
            );
          })}
          {timelinePoints.map((point, i) => (
            <line
              key={`v-${i}`}
              x1={point.x}
              y1={paddingTop}
              x2={point.x}
              y2={paddingTop + chartHeight}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* Previous Close Line (for 1D view) with label */}
        {timeframe === '1D' && prevClose && (() => {
          const prevCloseY = paddingTop + chartHeight - ((prevClose - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
          return (
            <g>
              <line
                x1={paddingLeft}
                y1={prevCloseY}
                x2={paddingLeft + chartWidth}
                y2={prevCloseY}
                stroke="#6b7280"
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.6"
              />
              {/* Label box overlaying the chart at left edge, ABOVE the line (Bloomberg style) */}
              <g transform={`translate(${paddingLeft + 5}, ${prevCloseY - 50})`}>
                <rect
                  x="0"
                  y="0"
                  width="110"
                  height="46"
                  fill="white"
                  fillOpacity="0.75"
                  stroke="#d1d5db"
                  strokeWidth="1"
                  rx="3"
                />
                <text
                  x="8"
                  y="16"
                  textAnchor="start"
                  fontSize="10"
                  fontWeight="600"
                  fill="#6b7280"
                  letterSpacing="0.3"
                >
                  PREV. CLOSE
                </text>
                <text
                  x="8"
                  y="34"
                  textAnchor="start"
                  fontSize="14"
                  fontWeight="bold"
                  fill="#1f2937"
                >
                  {prevClose.toFixed(2)} {currency || 'USD'}
                </text>
              </g>
            </g>
          );
        })()}

        {/* Area fill - Entity mode uses helper, Sector mode inline */}
        {detectedMode === 'entity' && fillPath && (
          <path d={fillPath} fill="url(#chartGradient)" />
        )}
        {detectedMode === 'sector' && chartData.length > 0 && (
          <path
            d={`M ${paddingLeft} ${paddingTop + chartHeight} ${chartData
              .map((point, i) => {
                const x = paddingLeft + (i * (chartWidth / Math.max(1, chartData.length - 1)));
                const y = (paddingTop + chartHeight) - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
                return `L ${x} ${y}`;
              })
              .join(' ')} L ${paddingLeft + ((chartData.length - 1) * (chartWidth / Math.max(1, chartData.length - 1)))} ${paddingTop + chartHeight} Z`}
            fill="url(#chartGradient)"
          />
        )}

        {/* Line - Entity mode uses helper, Sector mode inline */}
        {detectedMode === 'entity' && linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={getChartLineColor(priceChange)}
            strokeWidth="3"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(22,163,74,0.08))' }}
          />
        )}
        {detectedMode === 'sector' && chartData.length > 0 && (
          <path
            d={`M ${paddingLeft} ${(paddingTop + chartHeight) - ((chartData[0].y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight)} ${chartData
              .slice(1)
              .map((point, i) => {
                const x = paddingLeft + ((i + 1) * (chartWidth / Math.max(1, chartData.length - 1)));
                const y = (paddingTop + chartHeight) - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
                return `L ${x} ${y}`;
              })
              .join(' ')}`}
            fill="none"
            stroke={priceChange >= 0 ? '#16a34a' : '#dc2626'}
            strokeWidth="3"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(22,163,74,0.08))' }}
          />
        )}

        {/* Interactive hover areas and points */}
        {chartData.map((point, i) => {
          const x = paddingLeft + (i * (chartWidth / Math.max(1, chartData.length - 1)));
          const y = (paddingTop + chartHeight) - ((point.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
          const isHovered = hoveredPoint?.xIndex === i || hoveredPoint?.index === i;

          return (
            <g key={i}>
              <rect
                x={x - 10}
                y={paddingTop}
                width="20"
                height={chartHeight}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() =>
                  setHoveredPoint({ ...point, x, y, xIndex: i, index: i, price: point.y })
                }
                onMouseLeave={() => setHoveredPoint(null)}
              />
              {isHovered && (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill={priceChange >= 0 ? '#3b82f6' : '#ef4444'}
                    stroke="white"
                    strokeWidth="2"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(59,130,246,0.15))' }}
                  />
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + chartHeight}
                    stroke={priceChange >= 0 ? '#3b82f6' : '#ef4444'}
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
            {/* Tick mark instead of circle */}
            <line
              x1={point.x}
              y1={paddingTop + chartHeight}
              x2={point.x}
              y2={paddingTop + chartHeight + 8}
              stroke="#6b7280"
              strokeWidth="2"
            />
            <text
              x={point.x}
              y={paddingTop + chartHeight + 24}
              textAnchor="middle"
              fill="#374151"
              fontSize={chartWidth < 500 ? "10" : "11"}
              fontWeight="bold"
            >
              {point.label}
            </text>
          </g>
        ))}

        {/* Entity mode: Significant Event Markers */}
        {detectedMode === 'entity' && significantEvents.map((event, i) => {
          const eventPos = findEventPosition(event, chartData, chartWidth, paddingLeft);
          if (!eventPos) return null;

          const { xPos, isUpward } = eventPos;

          return (
            <g key={`event-${i}`} className="cursor-pointer">
              <path
                d={
                  isUpward
                    ? `M ${xPos} ${paddingTop - 5} L ${xPos - 6} ${paddingTop - 15} L ${xPos + 6} ${paddingTop - 15} Z`
                    : `M ${xPos} ${paddingTop - 5} L ${xPos - 6} ${paddingTop + 5} L ${xPos + 6} ${paddingTop + 5} Z`
                }
                fill={isUpward ? '#10b981' : '#ef4444'}
                stroke="white"
                strokeWidth="1.5"
              />
              <line
                x1={xPos}
                y1={isUpward ? paddingTop - 15 : paddingTop + 5}
                x2={xPos}
                y2={paddingTop + chartHeight}
                stroke={isUpward ? '#10b981' : '#ef4444'}
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.4"
              />
            </g>
          );
        })}

        {/* Sector mode: Event markers */}
        {detectedMode === 'sector' && showEvents && eventMarkers.map((marker, i) => (
          <g key={`event-${i}`} className="cursor-pointer group">
            <line
              x1={marker.x}
              y1={paddingTop}
              x2={marker.x}
              y2={paddingTop + chartHeight}
              stroke={marker.trend === "UP" ? "#16a34a" : "#dc2626"}
              strokeWidth="1.5"
              strokeDasharray="4,2"
              opacity="0.6"
            />
            <circle
              cx={marker.x}
              cy={marker.y}
              r="5"
              fill={marker.trend === "UP" ? "#16a34a" : "#dc2626"}
              stroke="white"
              strokeWidth="2"
            />
            <g className="opacity-0 group-hover:opacity-100 transition-opacity">
              <rect
                x={marker.x - 70}
                y={marker.y - 60}
                width="140"
                height="48"
                rx="6"
                fill="white"
                stroke="#d1d5db"
                strokeWidth="1"
                filter="drop-shadow(0 1px 2px rgba(0,0,0,0.1))"
              />
              <text
                x={marker.x}
                y={marker.y - 42}
                textAnchor="middle"
                fill="#111827"
                fontSize="11"
                fontWeight="bold"
              >
                {marker.trend} Move ({marker.pct.toFixed(2)}%)
              </text>
              <text
                x={marker.x}
                y={marker.y - 28}
                textAnchor="middle"
                fill="#6b7280"
                fontSize="10"
              >
                {marker.date}
              </text>
            </g>
          </g>
        ))}
      </svg>

      {/* Entity mode: Hover tooltip */}
      {detectedMode === 'entity' && hoveredPoint && (
        <div
          className="absolute bg-white border border-blue-200 rounded-lg p-3 shadow-xl pointer-events-none z-20"
          style={{
            left: `${Math.max(paddingLeft, Math.min(hoveredPoint.x - 80, paddingLeft + chartWidth - 160))}px`,
            top: `${hoveredPoint.y - 100}px`,
            minWidth: '120px'
          }}
        >
          <div className="text-base font-bold text-blue-600">
            {formatPrice(hoveredPoint.price)} {currency}
          </div>
          <div className="text-xs text-gray-600">
            {formatTooltipDateTime(hoveredPoint.date, timeframe, hoveredPoint.time)}
          </div>
          {currentPrice && currentPrice.y && !isNaN(currentPrice.y) && (
            <div
              className={`text-xs mt-1 ${
                hoveredPoint.price >= currentPrice.y ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {(((hoveredPoint.price - currentPrice.y) / currentPrice.y) * 100 >= 0 ? '+' : '')}
              {(((hoveredPoint.price - currentPrice.y) / currentPrice.y) * 100).toFixed(2)}%
            </div>
          )}
        </div>
      )}

      {/* Sector mode: Hover tooltip */}
      {detectedMode === 'sector' && tooltip && (
        <div style={{ position: 'absolute', left: `${tooltip.left}px`, top: `${tooltip.top}px`, width: `220px`, zIndex: 50 }}>
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-xs text-gray-700">{companyName || ticker}</div>
              {!isNaN(tooltip.change) && (
                <div className={`text-xs font-bold ${tooltip.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tooltip.change >= 0 ? '▲' : '▼'} {tooltip.change.toFixed(2)}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mb-1">{tooltip.dateStr}</div>
            <div className="flex items-baseline justify-between">
              <div className="text-lg font-bold">
                {Number(hoveredPoint.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {!isNaN(tooltip.changePct) && (
                <div className={`text-xs ${tooltip.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tooltip.changePct >= 0 ? '+' : ''}{tooltip.changePct.toFixed(2)}%
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceChart;
