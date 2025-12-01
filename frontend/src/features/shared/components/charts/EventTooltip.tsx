import React from 'react';
import type { NewsArticle } from '../../../../types';

interface DisplayEvent {
  start_date: string;
  trend: string;
  total_move_pct?: number;
  link?: string;
  url?: string;
  news?: NewsArticle[];
  xPos: number;
  iconY: number;
  chartWidth: number;
  paddingLeft: number;
}

interface EventTooltipProps {
  event: DisplayEvent | null;
  chartWidth: number;
  onClose: () => void;
  onArticleClick: (article: NewsArticle, e: React.MouseEvent) => void;
}

export const EventTooltip: React.FC<EventTooltipProps> = ({
  event,
  chartWidth,
  onClose,
  onArticleClick
}) => {
  if (!event) return null;

  return (
    <div
      className="absolute bg-white border border-gray-300 rounded shadow-lg"
      style={{
        left: `${Math.min(event.xPos - 110, chartWidth - 220)}px`,
        top: `${event.iconY - 260}px`,
        width: '220px',
        maxHeight: '240px',
        overflowY: 'scroll',
        padding: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
        zIndex: 100,
        pointerEvents: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Date header */}
      <div className="text-xs text-gray-500 mb-1">
        {event.start_date}
      </div>

      {/* Price movement indicator */}
      <div
        className="text-sm font-semibold mb-2"
        style={{
          color: event.trend === 'Downward' ? '#dc2626' : '#00a850'
        }}
      >
        {event.trend === 'Downward' ? '↓' : '↑'} {Math.abs(event.total_move_pct ?? 0).toFixed(2)}% {event.trend}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-300 mb-3"></div>

      {/* Article List */}
      {event.news && event.news.length > 0 ? (
        <div>
          {event.news.map((article: NewsArticle, i: number) => (
            <div key={i}>
              {article.publish_date && (
                <div className="text-xs text-gray-500 mb-0.5">
                  {new Date(article.publish_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
              <button
                onClick={(e) => onArticleClick(article, e)}
                className="block w-full text-left text-xs text-blue-600 hover:underline hover:text-blue-800 leading-snug cursor-pointer"
              >
                {article.title || 'View Article'}
              </button>
              {event.news && i < event.news.length - 1 && (
                <div className="border-t border-gray-200 my-3"></div>
              )}
            </div>
          ))}
          <div className="text-xs text-gray-500 mt-1">
            {event.news?.length ?? 0} related article{(event.news?.length ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>
      ) : event.link || event.url ? (
        <a
          href={event.link || event.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View Article
        </a>
      ) : null}
    </div>
  );
};

export default EventTooltip;
