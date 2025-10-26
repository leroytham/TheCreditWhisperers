import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
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
import { SECTOR_CHART_CONFIG } from '../utils/constants';

/**
 * Shared PriceChart Component
 *
 * Interactive price chart with timeline and event markers
 * Fully responsive - automatically fills container width while maintaining aspect ratio
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
 * @param {string} props.mode - 'entity' or 'sector' (auto-detected if not specified)
 * @param {string} props.timeframe - Current timeframe (1D, 5D, 1M, 6M, YTD, 1Y, 5Y)
 * @param {number} props.prevClose - Previous close price (for 1D view)
 * @param {string} props.exchange - Exchange code (for market hours calculation)
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
  mode,
  timeframe = '1Y',
  prevClose = null,
  exchange = ''
}) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const chartContainerRef = useRef(null);
  const [dynamicChartWidth, setDynamicChartWidth] = useState(SECTOR_CHART_CONFIG.DEFAULT_WIDTH);

  // Auto-detect mode if not specified
  const detectedMode = mode || (priceData ? 'entity' : 'sector');

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (hoveredEvent) {
        setHoveredEvent(null);
      }
    };

    if (hoveredEvent) {
      // Add slight delay to prevent immediate closure from the opening click
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [hoveredEvent]);

  // Close tooltip when pressing Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && hoveredEvent) {
        setHoveredEvent(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [hoveredEvent]);

  // Responsive width calculation for both entity and sector
  useLayoutEffect(() => {
    const measure = () => {
      const el = chartContainerRef.current;
      if (!el) return;
      // Use container width minus padding for labels
      const containerWidth = el.clientWidth;
      const availableWidth = containerWidth - 90; // Space for y-axis labels
      // Cap at max width for very large screens, min width for small screens
      const w = Math.min(1200, Math.max(300, availableWidth));
      setDynamicChartWidth(w);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

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
  const fullChartWidth = dynamicChartWidth;
  const chartHeight = 250; // Consistent chart height for both modes
  const containerHeight = 384; // h-96 in pixels
  const paddingLeft = 40;
  const paddingRight = 50;
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

  const numXAxisPoints = getNumXAxisPoints(chartWidth);

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
    <div ref={chartContainerRef} className="relative h-96" style={{ backgroundColor: 'white' }}>
      <svg
        className="w-full h-full"
        viewBox={`0 0 ${paddingLeft + fullChartWidth + paddingRight} ${containerHeight}`}
        preserveAspectRatio="xMinYMin meet"
        style={{ overflow: 'visible' }}
      >
        {/* Gradient Definition and Filters */}
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              style={{
                stopColor: priceChange >= 0 ? '#00a850' : '#dc2626',
                stopOpacity: 0.12
              }}
            />
            <stop
              offset="100%"
              style={{
                stopColor: priceChange >= 0 ? '#00a850' : '#dc2626',
                stopOpacity: 0
              }}
            />
          </linearGradient>

          {/* Blur effect for document icon circle - Bloomberg style */}
          <filter id="iconCircleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
        </defs>

        {/* Grid lines and labels */}
        <g className="text-gray-400 text-xs">
          {[...Array(5)].map((_, i) => {
            const yPos = paddingTop + (i * ((chartHeight - 40) / 4));
            const price = priceRange.max - ((priceRange.max - priceRange.min) * i / 4);
            const labelX = timeframe === '1D' ? paddingLeft + fullChartWidth + 10 : paddingLeft + chartWidth + 10;
            // End grid lines at the last timeline point
            const gridLineEndX = timelinePoints.length > 0
              ? timelinePoints[timelinePoints.length - 1].x
              : paddingLeft + chartWidth;
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={gridLineEndX}
                  y2={yPos}
                  stroke="#ececea"
                  strokeWidth="1"
                />
                {/* Y-axis labels on the RIGHT side */}
                <text
                  x={labelX}
                  y={yPos + 5}
                  textAnchor="start"
                  fill="#4b5563"
                  fontSize="11"
                  fontWeight="600"
                >
                  {price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </text>
              </g>
            );
          })}
        </g>

        {/* Previous Close Line (for 1D view) - just the dashed line */}
        {timeframe === '1D' && prevClose && (() => {
          const prevCloseY = paddingTop + chartHeight - ((prevClose - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
          // End at the last timeline point, same as grid lines
          const lineEndX = timelinePoints.length > 0
            ? timelinePoints[timelinePoints.length - 1].x
            : paddingLeft + fullChartWidth;
          return (
            <line
              x1={paddingLeft}
              y1={prevCloseY}
              x2={lineEndX}
              y2={prevCloseY}
              stroke="#6b7280"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.6"
            />
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
            stroke={priceChange >= 0 ? '#00a850' : '#dc2626'}
            strokeWidth="1.5"
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
            stroke={priceChange >= 0 ? '#00a850' : '#dc2626'}
            strokeWidth="1.5"
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
                  {/* Vertical dashed line - Bloomberg style */}
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + chartHeight}
                    stroke="#9ca3af"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                    opacity="0.7"
                  />
                </>
              )}
            </g>
          );
        })}

        {/* X-axis baseline - Bloomberg style continuous line extended beyond last label */}
        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={timeframe === '1D' && timelinePoints.length > 0
            ? timelinePoints[timelinePoints.length - 1].x + 60
            : (timeframe === '1D' ? paddingLeft + fullChartWidth : paddingLeft + chartWidth) + 60}
          y2={paddingTop + chartHeight}
          stroke="#6b7280"
          strokeWidth="2"
        />

        {/* Timeline - Bloomberg style tick marks */}
        {timelinePoints.map((point, i) => (
          <g key={`timeline-${i}`}>
            {/* Tick mark extending down from baseline */}
            <line
              x1={point.x}
              y1={paddingTop + chartHeight}
              x2={point.x}
              y2={paddingTop + chartHeight + 8}
              stroke="#6b7280"
              strokeWidth="2.5"
            />
            <text
              x={point.x}
              y={paddingTop + chartHeight + 24}
              textAnchor="middle"
              fill="#4b5563"
              fontSize={chartWidth < 500 ? "10" : "11"}
              fontWeight="600"
            >
              {point.label}
            </text>
          </g>
        ))}

        {/* Entity mode: Significant Event Markers - Bloomberg style */}
        {detectedMode === 'entity' && (() => {
          // Calculate positions and detect collisions
          const eventPositions = [];
          significantEvents.forEach((event, i) => {
            const eventPos = findEventPosition(event, chartData, chartWidth, paddingLeft);
            if (eventPos) {
              // Find the data point Y position for this event
              const dataPoint = chartData.find(d => d.date === event.start_date);
              const dataY = dataPoint
                ? (paddingTop + chartHeight) - ((dataPoint.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight)
                : paddingTop;

              eventPositions.push({ event, ...eventPos, dataY, index: i });
            }
          });

          // Sort by xPos for collision detection
          eventPositions.sort((a, b) => a.xPos - b.xPos);

          // All icons at same vertical level - no stacking
          const baseIconY = paddingTop + chartHeight - 15;
          const OVERLAP_THRESHOLD = 25; // Icons within 25px are considered overlapping
          const SPREAD_SPACING = 18; // Horizontal spacing between overlapping icons

          // Apply horizontal spreading for overlapping icons
          eventPositions.forEach((pos, i) => {
            pos.iconY = baseIconY;
            // Store original xPos BEFORE spreading for dotted line positioning
            pos.originalXPos = pos.xPos;

            // Find all previous icons that overlap with this one
            const overlappingGroup = [];
            for (let j = 0; j < i; j++) {
              if (Math.abs(pos.xPos - eventPositions[j].xPos) < OVERLAP_THRESHOLD) {
                overlappingGroup.push(eventPositions[j]);
              }
            }

            // If overlapping, spread icons horizontally
            if (overlappingGroup.length > 0) {
              const groupSize = overlappingGroup.length + 1;
              const totalWidth = (groupSize - 1) * SPREAD_SPACING;
              const startX = pos.xPos - (totalWidth / 2);

              // Adjust positions of all icons in the overlapping group
              overlappingGroup.forEach((overlapped, idx) => {
                overlapped.xPos = startX + (idx * SPREAD_SPACING);
              });

              // Position current icon at the end of the group
              pos.xPos = startX + (overlappingGroup.length * SPREAD_SPACING);
            }
          });

          return eventPositions.map(({ event, xPos, iconY, dataY, originalXPos, index }) => {
            const handleClick = () => {
              const url = event.link || event.url;
              if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
              }
            };

            return (
              <g
                key={`event-${index}`}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  // Toggle tooltip: if clicking same icon, close it; otherwise open new one
                  if (hoveredEvent && hoveredEvent.start_date === event.start_date) {
                    setHoveredEvent(null);
                  } else {
                    setHoveredEvent({ ...event, xPos, iconY, chartWidth: chartWidth, paddingLeft });
                  }
                }}
              >
                {/* Dot at data point on chart line - matches chart color */}
                <circle
                  cx={originalXPos}
                  cy={dataY}
                  r="6"
                  fill={priceChangePercent >= 0 ? '#00a850' : '#ef4444'}
                  stroke="white"
                  strokeWidth="2"
                />
                {/* Vertical dotted line - starts below the dot */}
                <line
                  x1={originalXPos}
                  y1={dataY + 8}
                  x2={originalXPos}
                  y2={paddingTop + chartHeight}
                  stroke="#6b7280"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  opacity="1"
                />
                {/* Connector line if icon is offset */}
                {iconY !== baseIconY && (
                  <line
                    x1={xPos}
                    y1={paddingTop + chartHeight}
                    x2={xPos}
                    y2={iconY + 14}
                    stroke="#9ca3af"
                    strokeWidth="1"
                    strokeDasharray="2,3"
                    opacity="0.6"
                  />
                )}
                {/* Background blurred glow circle - larger for visible halo */}
                <circle
                  cx={xPos}
                  cy={iconY}
                  r="18"
                  fill="white"
                  fillOpacity="0.5"
                  stroke="#9ca3af"
                  strokeWidth="2"
                  filter="url(#iconCircleGlow)"
                />

                {/* Foreground crisp circle - thin BLACK border, NO blur */}
                <circle
                  cx={xPos}
                  cy={iconY}
                  r="15"
                  fill="white"
                  fillOpacity="0.9"
                  stroke="black"
                  strokeWidth="0.5"
                  className="group-hover:fill-opacity-95 transition-all"
                />
                {/* Document icon - Bloomberg style with WHITE fill */}
                <g>
                  {/* Main document body - WHITE */}
                  <path
                    d={`M ${xPos - 5} ${iconY - 6} L ${xPos - 5} ${iconY + 6} L ${xPos + 5} ${iconY + 6} L ${xPos + 5} ${iconY - 3} L ${xPos + 2} ${iconY - 6} Z`}
                    fill="white"
                    stroke="#374151"
                    strokeWidth="1"
                  />
                  {/* Folded corner flap - medium gray for shadow */}
                  <path
                    d={`M ${xPos + 2} ${iconY - 6} L ${xPos + 2} ${iconY - 3} L ${xPos + 5} ${iconY - 3} Z`}
                    fill="#9ca3af"
                    stroke="#6b7280"
                    strokeWidth="0.5"
                  />
                  {/* Horizontal lines inside document - BLACK for visibility */}
                  <line x1={xPos - 3} y1={iconY - 1} x2={xPos + 3} y2={iconY - 1} stroke="#374151" strokeWidth="0.8" />
                  <line x1={xPos - 3} y1={iconY + 1} x2={xPos + 3} y2={iconY + 1} stroke="#374151" strokeWidth="0.8" />
                  <line x1={xPos - 3} y1={iconY + 3} x2={xPos + 1} y2={iconY + 3} stroke="#374151" strokeWidth="0.8" />
                </g>

                {/* Transparent clickable area - ensures reliable clicking */}
                <rect
                  x={xPos - 17}
                  y={iconY - 17}
                  width="34"
                  height="34"
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={handleClick}
                />
              </g>
            );
          });
        })()}

        {/* Sector mode: Event markers - Bloomberg style (same structure as entity mode) */}
        {detectedMode === 'sector' && showEvents && topEvents && topEvents.length > 0 && (() => {
          // Calculate positions and detect collisions (same logic as entity mode)
          const eventPositions = [];
          topEvents.forEach((event, i) => {
            const eventPos = findEventPosition(event, chartData, chartWidth, paddingLeft);
            if (eventPos) {
              const dataPoint = chartData.find(d => d.date === event.start_date);
              const dataY = dataPoint
                ? (paddingTop + chartHeight) - ((dataPoint.y - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight)
                : paddingTop;

              eventPositions.push({ event, ...eventPos, dataY, index: i });
            }
          });

          eventPositions.sort((a, b) => a.xPos - b.xPos);

          const baseIconY = paddingTop + chartHeight - 15;
          const OVERLAP_THRESHOLD = 25;
          const SPREAD_SPACING = 18;

          eventPositions.forEach((pos, i) => {
            pos.iconY = baseIconY;
            pos.originalXPos = pos.xPos;

            const overlappingGroup = [];
            for (let j = 0; j < i; j++) {
              if (Math.abs(pos.xPos - eventPositions[j].xPos) < OVERLAP_THRESHOLD) {
                overlappingGroup.push(eventPositions[j]);
              }
            }

            if (overlappingGroup.length > 0) {
              const groupSize = overlappingGroup.length + 1;
              const totalWidth = (groupSize - 1) * SPREAD_SPACING;
              const startX = pos.xPos - (totalWidth / 2);

              overlappingGroup.forEach((overlapped, idx) => {
                overlapped.xPos = startX + (idx * SPREAD_SPACING);
              });

              pos.xPos = startX + (overlappingGroup.length * SPREAD_SPACING);
            }
          });

          return eventPositions.map(({ event, xPos, iconY, dataY, originalXPos, index }) => {
            const handleClick = () => {
              const url = event.link || event.url;
              if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
              }
            };

            return (
              <g
                key={`event-${index}`}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hoveredEvent && hoveredEvent.start_date === event.start_date) {
                    setHoveredEvent(null);
                  } else {
                    setHoveredEvent({ ...event, xPos, iconY, chartWidth: chartWidth, paddingLeft });
                  }
                }}
              >
                {/* Dot at data point */}
                <circle
                  cx={originalXPos}
                  cy={dataY}
                  r="6"
                  fill={priceChangePercent >= 0 ? '#00a850' : '#ef4444'}
                  stroke="white"
                  strokeWidth="2"
                />
                {/* Vertical dotted line */}
                <line
                  x1={originalXPos}
                  y1={dataY + 8}
                  x2={originalXPos}
                  y2={paddingTop + chartHeight}
                  stroke="#6b7280"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  opacity="1"
                />
                {/* Background blurred circle */}
                <circle
                  cx={xPos}
                  cy={iconY}
                  r="18"
                  fill="white"
                  fillOpacity="0.5"
                  stroke="#9ca3af"
                  strokeWidth="2"
                  filter="url(#iconCircleGlow)"
                />
                {/* Foreground circle */}
                <circle
                  cx={xPos}
                  cy={iconY}
                  r="15"
                  fill="white"
                  fillOpacity="0.9"
                  stroke="black"
                  strokeWidth="0.5"
                  className="group-hover:fill-opacity-95 transition-all"
                />
                {/* Document icon */}
                <g>
                  <path
                    d={`M ${xPos - 5} ${iconY - 6} L ${xPos - 5} ${iconY + 6} L ${xPos + 5} ${iconY + 6} L ${xPos + 5} ${iconY - 3} L ${xPos + 2} ${iconY - 6} Z`}
                    fill="white"
                    stroke="#374151"
                    strokeWidth="1"
                  />
                  <path
                    d={`M ${xPos + 2} ${iconY - 6} L ${xPos + 2} ${iconY - 3} L ${xPos + 5} ${iconY - 3} Z`}
                    fill="#9ca3af"
                    stroke="#6b7280"
                    strokeWidth="0.5"
                  />
                  <line x1={xPos - 3} y1={iconY - 1} x2={xPos + 3} y2={iconY - 1} stroke="#374151" strokeWidth="0.8" />
                  <line x1={xPos - 3} y1={iconY + 1} x2={xPos + 3} y2={iconY + 1} stroke="#374151" strokeWidth="0.8" />
                  <line x1={xPos - 3} y1={iconY + 3} x2={xPos + 1} y2={iconY + 3} stroke="#374151" strokeWidth="0.8" />
                </g>
                {/* Clickable area */}
                <rect
                  x={xPos - 17}
                  y={iconY - 17}
                  width="34"
                  height="34"
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={handleClick}
                />
              </g>
            );
          });
        })()}

        {/* PREV CLOSE Label Box - rendered LAST to appear on top (1D view only) */}
        {timeframe === '1D' && prevClose && (() => {
          const prevCloseY = paddingTop + chartHeight - ((prevClose - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
          return (
            <g transform={`translate(${paddingLeft + 10}, ${prevCloseY - 50})`}>
              <defs>
                <filter id="prevCloseBlur">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
                </filter>
              </defs>
              <rect
                x="0"
                y="0"
                width="110"
                height="46"
                fill="white"
                fillOpacity="0.65"
                stroke="#d1d5db"
                strokeWidth="1.5"
                rx="3"
                filter="url(#prevCloseBlur)"
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
                fontWeight="600"
                fill="#6b7280"
              >
                {prevClose.toFixed(2)} {currency || 'USD'}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Entity mode: Price hover tooltip - Bloomberg style */}
      {detectedMode === 'entity' && hoveredPoint && !hoveredEvent && (
        <div
          className="absolute bg-white border border-gray-300 rounded pointer-events-none"
          style={{
            left: `${Math.max(paddingLeft + 10, Math.min(hoveredPoint.x - 60, paddingLeft + chartWidth - 120))}px`,
            top: `${paddingTop + 10}px`,
            padding: '6px 10px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 20
          }}
        >
          <div className="text-sm font-bold text-gray-900">
            {formatPrice(hoveredPoint.price)} {currency}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {formatTooltipDateTime(hoveredPoint.date, timeframe, hoveredPoint.time)}
          </div>
        </div>
      )}

      {/* Entity mode: Event click tooltip - Bloomberg style with article list */}
      {detectedMode === 'entity' && hoveredEvent && (
        <div
          className="absolute bg-white border border-gray-300 rounded shadow-lg"
          style={{
            left: `${Math.min(hoveredEvent.xPos - 110, (hoveredEvent.chartWidth || chartWidth) - 220)}px`,
            top: `${hoveredEvent.iconY - 260}px`,
            width: '220px',
            maxHeight: '240px',
            overflowY: 'scroll',
            padding: '10px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
            zIndex: 100,
            pointerEvents: 'auto'
          }}
          onClick={(e) => {
            // Prevent clicks inside tooltip from closing it
            e.stopPropagation();
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setHoveredEvent(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Bloomberg format: Date on top, then price movement */}
          <div className="text-xs text-gray-500 mb-1">
            {hoveredEvent.start_date}
          </div>
          <div
            className="text-sm font-semibold mb-2"
            style={{
              color: hoveredEvent.trend === 'Downward' ? '#dc2626' : '#00a850'
            }}
          >
            {hoveredEvent.trend === 'Downward' ? '↓' : '↑'} {Math.abs(hoveredEvent.total_move_pct).toFixed(2)}% {hoveredEvent.trend}
          </div>

          {/* Divider line */}
          <div className="border-t border-gray-300 mb-3"></div>

          {/* Article List - Bloomberg style with article dates */}
          {hoveredEvent.news && hoveredEvent.news.length > 0 ? (
            <div>
              {hoveredEvent.news.map((article, i) => (
                <div key={i}>
                  {/* Article publish date */}
                  {(article.publish_date || article.date) && (
                    <div className="text-xs text-gray-500 mb-0.5">
                      {new Date(article.publish_date || article.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  {/* Article title link */}
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-blue-600 hover:underline hover:text-blue-800 leading-snug"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {article.title || 'View Article'}
                  </a>
                  {/* Divider line (not for last article) */}
                  {i < hoveredEvent.news.length - 1 && (
                    <div className="border-t border-gray-200 my-3"></div>
                  )}
                </div>
              ))}
              <div className="text-xs text-gray-500 mt-1">
                {hoveredEvent.news.length} related article{hoveredEvent.news.length !== 1 ? 's' : ''}
              </div>
            </div>
          ) : hoveredEvent.link || hoveredEvent.url ? (
            <a
              href={hoveredEvent.link || hoveredEvent.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View Article
            </a>
          ) : null}
        </div>
      )}

      {/* Sector mode: Hover tooltip - Bloomberg style */}
      {detectedMode === 'sector' && hoveredPoint && (
        <div
          className="absolute bg-white border border-gray-300 rounded pointer-events-none"
          style={{
            left: `${Math.max(paddingLeft + 10, Math.min(hoveredPoint.x - 60, paddingLeft + chartWidth - 120))}px`,
            top: `${paddingTop + 10}px`,
            padding: '6px 10px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 50
          }}
        >
          <div className="text-sm font-bold text-gray-900">
            {Number(hoveredPoint.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency || 'USD'}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {formatTooltipDateTime(hoveredPoint.date, timeframe, hoveredPoint.time)}
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceChart;
