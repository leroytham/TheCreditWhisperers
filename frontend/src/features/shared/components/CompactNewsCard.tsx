// frontend/src/features/shared/components/CompactNewsCard.jsx

import React from 'react';
import { ExternalLink, TrendingUp } from 'lucide-react';

/**
 * Compact news card for multi-column grid layouts
 * Clicking opens the full detail modal
 */
const CompactNewsCard = ({
  article,
  onClick,
}) => {
  const formatPublishTime = (timeStr) => {
    if (!timeStr) return 'Unknown';

    // Check if it's an ISO date format (e.g., "2025-11-13T11:53:58+00:00" or "2025-11-13")
    if (timeStr.includes('-')) {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }

    // Handle the old format (yyyymmddThhmmss)
    const year = timeStr.substring(0, 4);
    const month = timeStr.substring(4, 6);
    const day = timeStr.substring(6, 8);
    const hour = timeStr.substring(9, 11) || '00';
    const minute = timeStr.substring(11, 13) || '00';

    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    return 'Unknown';
  };

  const getSentimentColor = (score) => {
    if (score >= 0.35) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 0.15) return 'text-lime-600 bg-lime-50 border-lime-200';
    if (score > -0.15) return 'text-gray-600 bg-gray-50 border-gray-200';
    if (score > -0.35) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const handleCardClick = () => {
    onClick(article);
  };

  const handleLinkClick = (e) => {
    e.stopPropagation();
  };

  return (
    <article
      onClick={handleCardClick}
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group overflow-hidden flex flex-col h-full"
    >
      {/* Banner Image */}
      {article.banner_image && (
        <div className="w-full h-40 bg-gray-100 overflow-hidden">
          <img
            src={article.banner_image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; ((e.target as HTMLElement).parentElement as HTMLElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 line-clamp-3 mb-2 group-hover:text-blue-600 transition-colors">
          {article.title}
        </h3>

        {/* Summary */}
        {article.summary && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{article.summary}</p>
        )}

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Metadata */}
        <div className="mt-auto space-y-2">
          {/* Source and Date */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-medium truncate">{article.source}</span>
            <time className="flex-shrink-0 ml-2">{formatPublishTime(article.time_published)}</time>
          </div>

          {/* Sentiment */}
          {article.overall_sentiment_score !== undefined && (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getSentimentColor(article.overall_sentiment_score)}`}>
                <TrendingUp className="w-3 h-3 mr-1" />
                {article.overall_sentiment_label}
              </span>
              {article.topics && article.topics.length > 0 && (
                <span className="text-xs text-gray-500">
                  +{article.topics.length} topics
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* External link indicator */}
      <div className="absolute top-3 right-3">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="p-1.5 bg-white/90 rounded-full shadow-sm hover:bg-white transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-gray-500 hover:text-blue-600" />
        </a>
      </div>
    </article>
  );
};

export default CompactNewsCard;
