import React, { useState, useRef, useLayoutEffect } from 'react';
import {
  generateChartData,
  getPriceRange,
  generateTimelinePoints,
  calculatePriceChange,
  calculateChartPath,
  calculateFillPath,
  findEventPosition,
  formatTooltipDateTime,
  calculateTradingDayElapsed
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
 * @param {boolean} props.showSignificantEvents - Whether to show significant events with news icons (entity mode)
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
  showSignificantEvents = true,
  responsive = false,
  mode,
  timeframe = '1Y',
  prevClose = null,
  exchange = ''
}) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [clickedEvent, setClickedEvent] = useState(null);
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
  }
  const { currentPrice, priceChange, priceChangePercent } =
    preProcessedPriceChange !== undefined
      ? { currentPrice: chartData[chartData.length - 1], priceChange: preProcessedPriceChange, priceChangePercent: preProcessedPriceChange }
      : calculatePriceChange(chartData);

  // Chart dimensions
  const fullChartWidth = isResponsive ? dynamicChartWidth : CHART_CONFIG.width;
  const chartHeight = 250; // Consistent chart height for both modes
  const containerHeight = 384; // h-96 in pixels
  const paddingLeft = 60;
  const paddingRight = 60; // Equal padding on both sides for balanced layout
  const paddingTop = 40;

  // For 1D charts, calculate effective width based on trading day elapsed (Bloomberg style)
  const tradingDayElapsed = timeframe === '1D' ? calculateTradingDayElapsed(chartData, exchange) : 1;
  const chartWidth = timeframe === '1D' ? fullChartWidth * tradingDayElapsed : fullChartWidth;

  if (timeframe === '1D') {
    console.log('[PriceChart] 1D Width Calculation:');
    console.log('  - fullChartWidth:', fullChartWidth);
    console.log('  - tradingDayElapsed:', tradingDayElapsed);
    console.log('  - calculated chartWidth:', chartWidth);
    console.log('  - chartData length:', chartData.length);
    if (chartData.length > 0) {
      console.log('  - last data point time:', chartData[chartData.length - 1].time);
    }
  }

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
  // For 1D, use fullChartWidth so labels span entire trading day range
  const timelinePoints = generateTimelinePoints(
    chartData,
    timeframe === '1D' ? fullChartWidth : chartWidth,
    numXAxisPoints,
    paddingLeft,
    timeframe,
    exchange
  );

  // Event markers (different handling for entity vs sector)
  // Event markers computation removed - now using Bloomberg-style event icons for both entity and sector modes

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
      <div className="relative h-96 bg-white">
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
    <div ref={chartContainerRef} className="relative h-96 bg-white">
      <svg
        className="w-full h-full"
        viewBox={`0 0 ${paddingLeft + fullChartWidth + paddingRight} ${containerHeight}`}
        preserveAspectRatio="xMinYMin meet"
        style={{ overflow: 'visible' }}
      >
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
            // For 1D, extend lines to full width to show entire trading day range
            const lineEndX = timeframe === '1D' ? paddingLeft + fullChartWidth : paddingLeft + chartWidth;
            const labelX = timeframe === '1D' ? paddingLeft + fullChartWidth + 10 : paddingLeft + chartWidth + 10;
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={lineEndX}
                  y2={yPos}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                {/* Y-axis labels on the RIGHT side */}
                <text
                  x={labelX}
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
                x2={paddingLeft + fullChartWidth}
                y2={prevCloseY}
                stroke="#6b7280"
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.6"
              />
              {/* Label box overlaying the chart, ABOVE the line (Bloomberg style) */}
              {/* Smart positioning: if chart is narrow (< 200px), position at end of data; otherwise at left */}
              <g transform={`translate(${chartWidth < 200 ? Math.max(paddingLeft + chartWidth - 115, paddingLeft + 5) : paddingLeft + 5}, ${prevCloseY - 50})`}>
                <rect
                  x="0"
                  y="0"
                  width="110"
                  height="46"
                  fill="white"
                  fillOpacity="0.65"
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

        {/* End-of-chart price indicator - Bloomberg style */}
        {chartData.length > 0 && (() => {
          const lastPoint = chartData[chartData.length - 1];
          const lastX = paddingLeft + ((chartData.length - 1) * (chartWidth / Math.max(1, chartData.length - 1)));
          const lastY = (paddingTop + chartHeight) - ((lastPoint.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);

          return (
            <g>
              {/* Circle at end of line */}
              <circle
                cx={lastX}
                cy={lastY}
                r="5"
                fill={priceChange >= 0 ? '#16a34a' : '#dc2626'}
                stroke="white"
                strokeWidth="2"
              />

              {/* Vertical dotted line to top */}
              <line
                x1={lastX}
                y1={lastY}
                x2={lastX}
                y2={paddingTop - 10}
                stroke="#d1d5db"
                strokeWidth="1"
                strokeDasharray="3,3"
                opacity="0.6"
              />

              {/* Price and date box at top */}
              <g transform={`translate(${lastX}, ${paddingTop - 20})`}>
                {/* Background box */}
                <rect
                  x="-45"
                  y="-35"
                  width="90"
                  height="32"
                  fill="white"
                  stroke="#d1d5db"
                  strokeWidth="1"
                  rx="2"
                />

                {/* Price text */}
                <text
                  x="0"
                  y="-18"
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="bold"
                  fill="#111827"
                >
                  {lastPoint.y.toFixed(2)} {currency || 'USD'}
                </text>

                {/* Date text */}
                <text
                  x="0"
                  y="-6"
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {lastPoint.date ? new Date(lastPoint.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </text>
              </g>
            </g>
          );
        })()}

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

        {/* Entity mode: Significant Event Markers - Bloomberg Style */}
        {detectedMode === 'entity' && showSignificantEvents && (() => {
          // Calculate icon positions with spread logic for clustered events
          const iconPositions = significantEvents.map((event, i) => {
            const eventPos = findEventPosition(event, chartData, chartWidth, paddingLeft);
            if (!eventPos) return null;

            const { xPos, pricePoint } = eventPos;
            const priceYPos = (paddingTop + chartHeight) - ((pricePoint.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);

            return { event, i, xPos, pricePoint, priceYPos };
          }).filter(Boolean);

          // Adjust X positions to prevent overlap
          const minSpacing = 28; // Minimum spacing between icons
          const adjustedPositions = iconPositions.map((pos, idx) => {
            let adjustedX = pos.xPos;

            // Check for overlaps with previous icons
            for (let j = 0; j < idx; j++) {
              const prevPos = iconPositions[j];
              const distance = Math.abs(adjustedX - prevPos.xPos);

              if (distance < minSpacing) {
                // Shift to the right if too close
                adjustedX = prevPos.xPos + minSpacing;
              }
            }

            return { ...pos, adjustedX };
          });

          return adjustedPositions.map(({ event, i, xPos, adjustedX, pricePoint, priceYPos }) => {
            const iconYPos = paddingTop + chartHeight + 18;
            const lineColor = '#9ca3af'; // Gray color for all lines and icons

            return (
              <g key={`event-${i}`}>
                {/* Gray dotted line from price point to icon */}
                <line
                  x1={xPos}
                  y1={priceYPos}
                  x2={xPos}
                  y2={paddingTop + chartHeight}
                  stroke={lineColor}
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  opacity="0.7"
                />

                {/* Connector line if icon was shifted */}
                {adjustedX !== xPos && (
                  <line
                    x1={xPos}
                    y1={paddingTop + chartHeight}
                    x2={adjustedX}
                    y2={iconYPos}
                    stroke={lineColor}
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    opacity="0.5"
                  />
                )}

                {/* Icon */}
                <g
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setClickedEvent(clickedEvent === i ? null : i)}
                >
                  {/* Icon background circle */}
                  <circle
                    cx={adjustedX}
                    cy={iconYPos}
                    r="12"
                    fill="white"
                    stroke={lineColor}
                    strokeWidth="2"
                  />
                  {/* Document/News icon */}
                  <g transform={`translate(${adjustedX - 5.5}, ${iconYPos - 6.5})`}>
                    <rect x="2" y="1" width="7" height="10" fill="none" stroke="#374151" strokeWidth="1.1" rx="0.5" />
                    <line x1="3.5" y1="3.5" x2="7.5" y2="3.5" stroke="#374151" strokeWidth="0.8" />
                    <line x1="3.5" y1="5.5" x2="7.5" y2="5.5" stroke="#374151" strokeWidth="0.8" />
                    <line x1="3.5" y1="7.5" x2="6.5" y2="7.5" stroke="#374151" strokeWidth="0.8" />
                  </g>
                </g>
              </g>
            );
          });
        })()}

        {/* Sector mode: Bloomberg-style significant events */}
        {detectedMode === 'sector' && showEvents && (() => {
          // Use topEvents for sector mode (same structure as significantEvents)
          const eventsToShow = topEvents || [];

          // Calculate icon positions with spread logic for clustered events
          const iconPositions = eventsToShow.map((event, i) => {
            const eventPos = findEventPosition(event, chartData, chartWidth, paddingLeft);
            if (!eventPos) return null;

            const { xPos, pricePoint } = eventPos;
            const priceYPos = (paddingTop + chartHeight) - ((pricePoint.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);

            return { event, i, xPos, pricePoint, priceYPos };
          }).filter(Boolean);

          // Adjust X positions to prevent overlap (minimum 28px spacing)
          const minSpacing = 28;
          const adjustedPositions = iconPositions.map((pos, idx) => {
            let adjustedX = pos.xPos;

            for (let j = 0; j < idx; j++) {
              const prevPos = iconPositions[j];
              const distance = Math.abs(adjustedX - prevPos.xPos);

              if (distance < minSpacing) {
                // Shift to the right if too close
                adjustedX = prevPos.xPos + minSpacing;
              }
            }

            return { ...pos, adjustedX };
          });

          return adjustedPositions.map(({ event, i, xPos, adjustedX, pricePoint, priceYPos }) => {
            const iconYPos = paddingTop + chartHeight + 18;
            const lineColor = '#9ca3af'; // Gray color for all lines and icons

            return (
              <g key={`event-${i}`}>
                {/* Gray dotted line from price point to icon */}
                <line
                  x1={xPos}
                  y1={priceYPos}
                  x2={xPos}
                  y2={paddingTop + chartHeight}
                  stroke={lineColor}
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  opacity="0.7"
                />

                {/* Connector line if icon was shifted */}
                {adjustedX !== xPos && (
                  <line
                    x1={xPos}
                    y1={paddingTop + chartHeight}
                    x2={adjustedX}
                    y2={iconYPos}
                    stroke={lineColor}
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    opacity="0.5"
                  />
                )}

                {/* Icon */}
                <g
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setClickedEvent(clickedEvent === i ? null : i)}
                >
                  {/* Icon background circle */}
                  <circle
                    cx={adjustedX}
                    cy={iconYPos}
                    r="12"
                    fill="white"
                    stroke={lineColor}
                    strokeWidth="2"
                  />
                  {/* Document/News icon */}
                  <g transform={`translate(${adjustedX - 5.5}, ${iconYPos - 6.5})`}>
                    <rect x="2" y="1" width="7" height="10" fill="none" stroke="#374151" strokeWidth="1.1" rx="0.5" />
                    <line x1="3.5" y1="3.5" x2="7.5" y2="3.5" stroke="#374151" strokeWidth="0.8" />
                    <line x1="3.5" y1="5.5" x2="7.5" y2="5.5" stroke="#374151" strokeWidth="0.8" />
                    <line x1="3.5" y1="7.5" x2="6.5" y2="7.5" stroke="#374151" strokeWidth="0.8" />
                  </g>
                </g>
              </g>
            );
          });
        })()}
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

      {/* Entity mode: Event News Popup - Bloomberg Style (Above Icon) */}
      {detectedMode === 'entity' && clickedEvent !== null && significantEvents[clickedEvent] && (() => {
        const event = significantEvents[clickedEvent];
        const eventPos = findEventPosition(event, chartData, chartWidth, paddingLeft);
        if (!eventPos || !event.news || event.news.length === 0) return null;

        const { xPos } = eventPos;
        const iconYPos = paddingTop + chartHeight + 18;

        const popupWidth = 400;
        const popupHeight = Math.min(340, 120 + (event.news.length * 70));
        const popupLeft = Math.max(20, Math.min(xPos - popupWidth / 2, window.innerWidth - popupWidth - 40));
        // Position popup ABOVE the icon
        const popupTop = iconYPos - popupHeight - 15;

        return (
          <>
            {/* Backdrop to close popup when clicking outside */}
            <div
              className="fixed inset-0 z-20"
              onClick={() => setClickedEvent(null)}
            />

            {/* Popup - Above the icon */}
            <div
              className="absolute bg-white border border-gray-300 rounded-lg shadow-2xl z-30"
              style={{
                left: `${popupLeft}px`,
                top: `${popupTop}px`,
                width: `${popupWidth}px`,
                maxHeight: '340px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className={`text-base font-bold ${event.trend === 'Upward' ? 'text-green-600' : 'text-red-600'}`}>
                      {event.trend === 'Upward' ? '↑' : '↓'} {Math.abs(event.total_move_pct).toFixed(2)}% {event.trend}
                    </div>
                  </div>
                  <button
                    onClick={() => setClickedEvent(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    style={{ fontSize: '24px', lineHeight: '20px' }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* News Headlines List - Bloomberg Style */}
              <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
                {event.news && event.news.length > 0 ? (
                  event.news.map((newsItem, idx) => {
                    // Extract date from the news item (if available)
                    let newsDate = '';
                    if (newsItem.time_published) {
                      const date = new Date(newsItem.time_published);
                      newsDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    } else {
                      // Fall back to event date
                      newsDate = new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }

                    return (
                      <div
                        key={idx}
                        className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => {
                          if (newsItem.link) {
                            window.open(newsItem.link, '_blank');
                          }
                        }}
                      >
                        {/* Date header */}
                        <div className="px-4 pt-3 pb-1">
                          <div className="text-xs font-semibold text-gray-500">
                            {newsDate}
                          </div>
                        </div>

                        {/* News title */}
                        <div className="px-4 pb-3">
                          <div className="text-sm font-medium text-gray-900 leading-snug">
                            {newsItem.title || 'News article'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">
                    No news articles available
                  </div>
                )}
              </div>

              {/* Footer with article count */}
              {event.news && event.news.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                  <div className="text-xs text-gray-600 font-medium">
                    {event.news.length} related article{event.news.length > 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* Sector mode: Event News Popup - Bloomberg Style (Above Icon) */}
      {detectedMode === 'sector' && clickedEvent !== null && topEvents[clickedEvent] && (() => {
        const event = topEvents[clickedEvent];
        const eventPos = findEventPosition(event, chartData, chartWidth, paddingLeft);
        if (!eventPos || !event.news || event.news.length === 0) return null;

        const { xPos } = eventPos;
        const iconYPos = paddingTop + chartHeight + 18;

        const popupWidth = 400;
        const popupHeight = Math.min(340, 120 + (event.news.length * 70));
        const popupLeft = Math.max(20, Math.min(xPos - popupWidth / 2, window.innerWidth - popupWidth - 40));
        // Position popup ABOVE the icon
        const popupTop = iconYPos - popupHeight - 15;

        return (
          <>
            {/* Backdrop to close popup when clicking outside */}
            <div
              className="fixed inset-0 z-20"
              onClick={() => setClickedEvent(null)}
            />

            {/* Popup - Above the icon */}
            <div
              className="absolute bg-white border border-gray-300 rounded-lg shadow-2xl z-30"
              style={{
                left: `${popupLeft}px`,
                top: `${popupTop}px`,
                width: `${popupWidth}px`,
                maxHeight: '340px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className={`text-base font-bold ${event.trend === 'Upward' ? 'text-green-600' : 'text-red-600'}`}>
                      {event.trend === 'Upward' ? '↑' : '↓'} {Math.abs(event.total_move_pct).toFixed(2)}% {event.trend}
                    </div>
                  </div>
                  <button
                    onClick={() => setClickedEvent(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    style={{ fontSize: '24px', lineHeight: '20px' }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* News Headlines List - Bloomberg Style */}
              <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
                {event.news && event.news.length > 0 ? (
                  event.news.map((newsItem, idx) => {
                    // Extract date from the news item (if available)
                    let newsDate = '';
                    if (newsItem.time_published) {
                      const date = new Date(newsItem.time_published);
                      newsDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    } else if (newsItem.date) {
                      const date = new Date(newsItem.date);
                      newsDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    } else {
                      // Fall back to event date
                      newsDate = new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }

                    return (
                      <div
                        key={idx}
                        className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => {
                          if (newsItem.link) {
                            window.open(newsItem.link, '_blank');
                          }
                        }}
                      >
                        {/* Date header */}
                        <div className="px-4 pt-3 pb-1">
                          <div className="text-xs font-semibold text-gray-500">
                            {newsDate}
                          </div>
                        </div>

                        {/* News title */}
                        <div className="px-4 pb-3">
                          <div className="text-sm font-medium text-gray-900 leading-snug">
                            {newsItem.title || 'News article'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">
                    No news articles available
                  </div>
                )}
              </div>

              {/* Footer with article count */}
              {event.news && event.news.length > 0 && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                  <div className="text-xs text-gray-600 font-medium">
                    {event.news.length} related article{event.news.length > 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
};

export default PriceChart;
