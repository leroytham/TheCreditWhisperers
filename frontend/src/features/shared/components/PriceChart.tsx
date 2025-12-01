import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import {
  generateChartData,
  getPriceRange,
  generateTimelinePoints,
  calculatePriceChange,
  calculateChartPath,
  calculateFillPath,
  formatTooltipDateTime,
  calculateTradingDayElapsed
} from '../utils/chartHelpers';
import type { ChartDataPoint, PriceRange } from '../utils/chartHelpers';
import { SECTOR_CHART_CONFIG } from '../utils/constants';
import NewsDetailModal from './NewsDetailModal';
import { EventMarkersGroup } from './charts/EventMarkersGroup';
import type { DisplayEvent, HoveredEventState } from './charts/EventMarkersGroup';
import { EventClickTooltip } from './charts/EventClickTooltip';
import { PriceHoverTooltip } from './charts/PriceHoverTooltip';
import type { PriceDataPoint, NewsArticle } from '../../../types';

// Hovered point state (local, used for chart hover)
import type { HoveredPointState } from './charts/PriceHoverTooltip';

interface PriceChartProps {
  priceData?: PriceDataPoint[];
  chartData?: ChartDataPoint[];
  priceRange?: PriceRange;
  priceChange?: number;
  ticker: string;
  companyName?: string;
  currency?: string;
  significantEvents?: DisplayEvent[];
  topEvents?: DisplayEvent[];
  showEvents?: boolean;
  showSignificantEvents?: boolean;
  mode?: 'entity' | 'sector';
  timeframe?: string;
  prevClose?: number | null;
  exchange?: string;
  onEventClick?: (event: DisplayEvent) => void;
  // Portfolio-specific props (passed but not yet implemented)
  benchmarkData?: PriceDataPoint[];
  showBenchmark?: boolean;
  displayMode?: string;
}

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
  exchange = '',
  onEventClick
}: PriceChartProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPointState | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<HoveredEventState | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [dynamicChartWidth, setDynamicChartWidth] = useState<number>(SECTOR_CHART_CONFIG.DEFAULT_WIDTH);

  // Auto-detect mode if not specified
  const detectedMode: 'entity' | 'sector' = mode || (priceData ? 'entity' : 'sector');

  const handleArticleClick = (article: NewsArticle, e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedArticle(article);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
  };

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (): void => {
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
    const handleEscape = (e: KeyboardEvent): void => {
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

    // Use ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    // Initial measure with small delay to ensure layout is complete
    const timeoutId = setTimeout(measure, 0);

    // Fallback: also measure after a longer delay to catch any late layout changes
    const fallbackTimeoutId = setTimeout(measure, 100);

    // Window resize as additional fallback
    window.addEventListener('resize', measure);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeoutId);
      clearTimeout(fallbackTimeoutId);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Calculate chart data based on mode
  const chartData = preProcessedChartData || generateChartData(priceData || []);
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
  const getNumXAxisPoints = (width: number): number => {
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
    const prev = (idx > 0 && chartData[idx - 1]) ? (chartData[idx - 1].y ?? hoveredPoint.price) : hoveredPoint.price;
    const change = hoveredPoint.price - prev;
    const changePct = prev !== 0 ? (change / prev) * 100 : 0;
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
          {[...Array(5)].map((_: undefined, i: number) => {
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
              .map((point: ChartDataPoint, i: number) => {
                const x = paddingLeft + (i * (chartWidth / Math.max(1, chartData.length - 1)));
                const y = (paddingTop + chartHeight) - (((point.y ?? 0) - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
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
            d={`M ${paddingLeft} ${(paddingTop + chartHeight) - (((chartData[0].y ?? 0) - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight)} ${chartData
              .slice(1)
              .map((point: ChartDataPoint, i: number) => {
                const x = paddingLeft + ((i + 1) * (chartWidth / Math.max(1, chartData.length - 1)));
                const y = (paddingTop + chartHeight) - (((point.y ?? 0) - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
                return `L ${x} ${y}`;
              })
              .join(' ')}`}
            fill="none"
            stroke={priceChange >= 0 ? '#00a850' : '#dc2626'}
            strokeWidth="1.5"
          />
        )}

        {/* Interactive hover areas and points */}
        {chartData.map((point: ChartDataPoint, i: number) => {
          const x = paddingLeft + (i * (chartWidth / Math.max(1, chartData.length - 1)));
          const y = (paddingTop + chartHeight) - (((point.y ?? 0) - priceRange.min) / (priceRange.max - priceRange.min) * chartHeight);
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
                  setHoveredPoint({ ...point, x, y, xIndex: i, index: i, price: point.y ?? 0 })
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
        {timelinePoints.map((point: { x: number; label: string; dataIndex?: number }, i: number) => (
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
        {detectedMode === 'entity' && (
          <EventMarkersGroup
            events={significantEvents}
            chartData={chartData}
            chartWidth={chartWidth}
            chartHeight={chartHeight}
            paddingLeft={paddingLeft}
            paddingTop={paddingTop}
            priceRange={priceRange}
            priceChangePercent={priceChangePercent ?? 0}
            hoveredEvent={hoveredEvent}
            setHoveredEvent={setHoveredEvent}
            onEventClick={onEventClick}
            mode="entity"
          />
        )}

        {/* Sector mode: Event markers - Bloomberg style */}
        {detectedMode === 'sector' && showEvents && topEvents && topEvents.length > 0 && (
          <EventMarkersGroup
            events={topEvents}
            chartData={chartData}
            chartWidth={chartWidth}
            chartHeight={chartHeight}
            paddingLeft={paddingLeft}
            paddingTop={paddingTop}
            priceRange={priceRange}
            priceChangePercent={priceChangePercent ?? 0}
            hoveredEvent={hoveredEvent}
            setHoveredEvent={setHoveredEvent}
            mode="sector"
          />
        )}

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
        <PriceHoverTooltip
          hoveredPoint={hoveredPoint}
          paddingLeft={paddingLeft}
          paddingTop={paddingTop}
          chartWidth={chartWidth}
          timeframe={timeframe}
          currency={currency}
          mode="entity"
        />
      )}

      {/* Event click tooltip - Bloomberg style with article list (works for both entity and sector modes) */}
      {hoveredEvent && (
        <EventClickTooltip
          hoveredEvent={hoveredEvent}
          chartWidth={chartWidth}
          onClose={() => setHoveredEvent(null)}
          onArticleClick={handleArticleClick}
        />
      )}

      {/* Sector mode: Hover tooltip - Bloomberg style */}
      {detectedMode === 'sector' && hoveredPoint && !hoveredEvent && (
        <PriceHoverTooltip
          hoveredPoint={hoveredPoint}
          paddingLeft={paddingLeft}
          paddingTop={paddingTop}
          chartWidth={chartWidth}
          timeframe={timeframe}
          currency={currency}
          mode="sector"
        />
      )}

      {/* News Detail Modal */}
      <NewsDetailModal
        article={selectedArticle}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        mode="modal"
      />
    </div>
  );
};

export default PriceChart;
