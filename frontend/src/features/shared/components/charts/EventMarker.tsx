import React from 'react';

interface EventMarkerProps {
  xPos: number;
  iconY: number;
  dataY: number;
  originalXPos: number;
  baseIconY: number;
  priceChangePercent: number;
  chartHeight: number;
  paddingTop: number;
  isHovered?: boolean;
  onClick: () => void;
  onNavigate: () => void;
}

export const EventMarker: React.FC<EventMarkerProps> = ({
  xPos,
  iconY,
  dataY,
  originalXPos,
  baseIconY,
  priceChangePercent,
  chartHeight,
  paddingTop,
  onClick,
  onNavigate
}) => {
  return (
    <g className="cursor-pointer group" onClick={onClick}>
      {/* Dot at data point on chart line */}
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

      {/* Background glow circle */}
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
        {/* Main document body */}
        <path
          d={`M ${xPos - 5} ${iconY - 6} L ${xPos - 5} ${iconY + 6} L ${xPos + 5} ${iconY + 6} L ${xPos + 5} ${iconY - 3} L ${xPos + 2} ${iconY - 6} Z`}
          fill="white"
          stroke="#374151"
          strokeWidth="1"
        />
        {/* Folded corner */}
        <path
          d={`M ${xPos + 2} ${iconY - 6} L ${xPos + 2} ${iconY - 3} L ${xPos + 5} ${iconY - 3} Z`}
          fill="#9ca3af"
          stroke="#6b7280"
          strokeWidth="0.5"
        />
        {/* Horizontal lines */}
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
        onClick={onNavigate}
      />
    </g>
  );
};

export default EventMarker;
