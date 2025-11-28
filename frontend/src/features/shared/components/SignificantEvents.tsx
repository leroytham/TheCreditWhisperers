import React, { useState, useEffect } from 'react';
import { MAX_EVENTS_DISPLAY } from '../utils/constants';
import { TrendingUp, TrendingDown, CalendarDays, Newspaper, ChevronDown } from 'lucide-react';
import SentimentBadge from './SentimentBadge';
import NewsDetailModal from './NewsDetailModal';

/**
 * Shared SignificantEvents Component
 *
 * Displays significant price movement events with related news
 * Used by both Entity and Sector features
 *
 * @param {Object} props
 * @param {Array} props.events - Array of significant events
 * @param {boolean} props.loading - Loading state from hook
 * @param {string} props.error - Error message from hook
 * @param {string} props.ticker - Ticker symbol for display context
 * @param {string} props.sectorName - Sector name for display context
 * @param {string} props.className - Additional CSS classes for wrapper
 * @param {number} props.maxEvents - Maximum number of events to display (default from constants)
 * @param {string} props.selectedEventDate - Date of event to auto-expand (format: YYYY-MM-DD)
 */
interface NewsArticle {
  title?: string;
  sentiment_score?: number;
  relevance_score?: number;
  url?: string;
  link?: string;
  source?: string;
  time_published?: string;
  banner_image?: string;
  image?: string;
  summary?: string;
  overall_sentiment_score?: number;
  overall_sentiment_label?: string;
}

interface SignificantEvent {
  start_date: string;
  end_date?: string;
  trend: 'Upward' | 'Downward';
  total_move_pct: number;
  news?: NewsArticle[];
}

interface SignificantEventsProps {
  events?: SignificantEvent[];
  loading?: boolean;
  error?: string | null;
  ticker?: string;
  sectorName?: string;
  className?: string;
  maxEvents?: number;
  selectedEventDate?: string;
}

const SignificantEvents: React.FC<SignificantEventsProps> = ({
  events,
  loading,
  error,
  ticker,
  sectorName = '',
  className = 'bg-white border border-gray-200 rounded-lg shadow p-6 flex flex-col h-full',
  maxEvents = MAX_EVENTS_DISPLAY,
  selectedEventDate
}) => {
  const displayName = sectorName || ticker;
  const [expandedEvent, setExpandedEvent] = useState<number | null>(0); // Default first event to be open
  const [visibleNewsCount, setVisibleNewsCount] = useState<Record<number, number>>({});
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Auto-expand event when selectedEventDate changes
  useEffect(() => {
    if (selectedEventDate && events) {
      const eventIndex = events.findIndex(event => event.start_date === selectedEventDate);
      if (eventIndex !== -1) {
        setExpandedEvent(eventIndex);
      }
    }
  }, [selectedEventDate, events]);

  const handleArticleClick = (article: NewsArticle, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedArticle(article);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
  };

  const handleToggleNews = (eventIndex: number, totalNews: number) => {
    const currentCount = visibleNewsCount[eventIndex] || 2;
    setVisibleNewsCount({
      ...visibleNewsCount,
      [eventIndex]: currentCount === 2 ? totalNews : 2,
    });
  };

  // Show loading skeleton while fetching
  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Significant Events</h3>
          {displayName && <span className="text-sm text-gray-500">{displayName}</span>}
        </div>
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show error state if fetch failed
  if (error && !loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Significant Events</h3>
          {displayName && <span className="text-sm text-gray-500">{displayName}</span>}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Failed to Load Events</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // Show empty state only after loading completes
  if (!loading && (!events || events.length === 0)) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Significant Events</h3>
          {displayName && <span className="text-sm text-gray-500">{displayName}</span>}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No significant events found</h3>
            <p className="mt-1 text-sm text-gray-500">
                There have been no major price movements{displayName ? ` for ${displayName}` : ''} recently.
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900">Significant Events</h3>
        {displayName && <span className="text-sm text-gray-600">{displayName}</span>}
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-2 -mr-2" role="list" aria-label="Significant market events">
        {events && events.slice(0, maxEvents).map((event: SignificantEvent, idx: number) => {
          const isExpanded = expandedEvent === idx;
          const newsCount = visibleNewsCount[idx] || 2;

          return (
            <div key={idx} className="border border-gray-200 rounded-lg">
              <button
                onClick={() => setExpandedEvent(isExpanded ? null : idx)}
                className="w-full flex items-start justify-between p-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white border">
                        {event.trend === 'Upward' ? (
                            <TrendingUp className="h-5 w-5 text-green-500" />
                        ) : (
                            <TrendingDown className="h-5 w-5 text-red-500" />
                        )}
                    </div>
                    <div className="ml-3">
                        <h4 className="text-base font-semibold text-gray-800">
                            {event.trend} Move
                        </h4>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                            <CalendarDays className="h-4 w-4 mr-1.5" />
                            {event.start_date} {event.end_date && event.end_date !== event.start_date && `- ${event.end_date}`}
                        </div>
                    </div>
                </div>
                <div className="flex items-center">
                    <span className={`text-lg font-bold mr-3 ${event.trend === 'Upward' ? 'text-green-600' : 'text-red-600'}`}>
                        {event.total_move_pct.toFixed(2)}%
                    </span>
                    <ChevronDown className={`h-5 w-5 text-gray-500 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && event.news && event.news.length > 0 && (
                <div className="p-3 border-t border-gray-200">
                    <h5 className="flex items-center text-xs font-semibold text-gray-700 mb-2">
                        <Newspaper className="h-4 w-4 mr-1.5" />
                        Related News
                    </h5>
                    <ul className="space-y-2">
                        {event.news.slice(0, newsCount).map((n: NewsArticle, i: number) => (
                            <li key={i} className="group">
                                <button
                                  onClick={(e) => handleArticleClick(n, e)}
                                  className="block w-full text-left p-2 rounded-md bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 line-clamp-2">
                                        {n.title}
                                    </p>
                                    {(n.sentiment_score !== null && n.sentiment_score !== undefined) || (n.relevance_score !== undefined && n.relevance_score !== null && n.relevance_score > 0) ? (
                                        <div className="mt-2 flex items-center gap-2">
                                            {n.sentiment_score !== null && n.sentiment_score !== undefined && (
                                                <SentimentBadge score={n.sentiment_score} />
                                            )}
                                            {n.relevance_score !== undefined && n.relevance_score !== null && n.relevance_score > 0 && (
                                                <span className="font-semibold px-2 py-0.5 rounded whitespace-nowrap bg-blue-100 text-blue-800 text-xs">
                                                    Relevance: {n.relevance_score.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    ) : null}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {event.news && event.news.length > 2 && (
                        <button
                            onClick={() => handleToggleNews(idx, event.news?.length || 0)}
                            className="text-sm font-medium text-blue-600 hover:underline mt-2"
                        >
                            {newsCount === 2 ? `View ${event.news.length - 2} More` : 'Show Less'}
                        </button>
                    )}
                </div>
              )}
            </div>
          );
        })}
      </div>

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

export default SignificantEvents;