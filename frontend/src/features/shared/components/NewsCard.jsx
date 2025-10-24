// frontend/src/features/shared/components/NewsCard.jsx

import React from 'react';
import { ExternalLink } from 'lucide-react';
import SentimentBadge from './SentimentBadge.jsx';
import { formatRelativeTime } from '../utils/dateFormatters.js';
import { getRelevanceDetails } from '../utils/sentimentHelpers.js';

/**
 * A card component to display a single news article with modern UX/UI.
 * Now includes exponential decay weighting visualization.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.link
 * @param {string} props.provider
 * @param {string} props.publish_date
 * @param {number} props.sentiment_score
 * @param {string} props.sentiment_label
 * @param {string|null} props.image
 * @param {string} [props.summary] - The article summary.
 * @param {string[]} [props.tickers] - An array of related tickers.
 * @param {number} [props.relevance_score] - Relevance score (0 < x <= 1) if available.
 * @param {number} [props.recency_weight] - Recency weight from exponential decay (0 to 1).
 * @param {number} [props.combined_weight] - Combined weight (recency × relevance).
 * @param {number} [props.age_hours] - Age of the article in hours.
 */
const NewsCard = ({
  title,
  link,
  provider,
  publish_date,
  sentiment_score,
  sentiment_label,
  image,
  summary,
  tickers,
  relevance_score,
  recency_weight,
  combined_weight,
  age_hours,
}) => {
  // Get relevance display details if score is available
  const relevanceDetails = getRelevanceDetails(relevance_score);

  // Format age hours for display
  const formatAgeHours = (hours) => {
    if (hours === undefined || hours === null) return null;
    if (hours < 1) return `${Math.round(hours * 60)}m ago`;
    if (hours < 24) return `${Math.round(hours)}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  };

  const ageDisplay = formatAgeHours(age_hours);
  // Use a ref for the fallback div to control its display
  const fallbackRef = React.useRef(null);

  const handleCardClick = (e) => {
    // Prevent default if the click is on an interactive element inside the card
    if (e.target.closest('a')) {
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleImageError = (e) => {
    e.currentTarget.style.display = 'none';
    if (fallbackRef.current) {
      fallbackRef.current.style.display = 'flex';
    }
  };

  const TickerTag = ({ symbol }) => (
    <span className="inline-block bg-gray-100 text-gray-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full">{symbol}</span>
  );

  return (
    <article
      onClick={handleCardClick}
      className="relative flex gap-4 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ease-in-out hover:scale-[1.02] border border-transparent hover:border-blue-200 cursor-pointer group"
      role="link"
      tabIndex="0"
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick(e)}
      aria-label={`Read article: ${title}`}
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        {image ? (
          <img
            src={image}
            alt="" // Alt text is decorative as the title is the main content
            className="w-full h-full object-cover"
            loading="lazy"
            onError={handleImageError}
          />
        ) : null}
        <div
          ref={fallbackRef}
          className="w-full h-full items-center justify-center text-2xl font-bold text-gray-400"
          style={{ display: image ? 'none' : 'flex' }}
        >
          {provider?.[0]?.toUpperCase() || 'N'}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1 pr-8">
        <div>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="focus:outline-none"
              onClick={(e) => e.stopPropagation()} // Prevent card's onClick from firing twice
            >
              <h3 className="text-base font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                {title}
              </h3>
            </a>
            {summary && <p className="text-sm text-gray-500 mb-2 line-clamp-2">{summary}</p>}
            {tickers && tickers.length > 0 && (
              <div className="news-tickers mb-2">
                {tickers.map((t) => (
                  <TickerTag key={t} symbol={t} />
                ))}
              </div>
            )}
        </div>
        {/* Metadata and Sentiment */}
        <div>
            <div className="flex items-center gap-x-3 flex-wrap text-xs">
                <span className="text-gray-600 font-medium">{provider}</span>
                <span className="text-gray-400" aria-hidden="true">•</span>
                <time dateTime={publish_date} className="text-gray-500">
                    {formatRelativeTime(publish_date)}
                </time>
                {ageDisplay && (
                    <>
                        <span className="text-gray-400" aria-hidden="true">•</span>
                        <span className="text-gray-500">{ageDisplay}</span>
                    </>
                )}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
                {(sentiment_score !== null && sentiment_score !== undefined) && (
                    <SentimentBadge score={sentiment_score} label={sentiment_label} />
                )}
                {relevanceDetails && (
                    <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${relevanceDetails.colorClasses}`}
                        title={`${relevanceDetails.label}: ${relevanceDetails.value}`}
                    >
                        Relevance: {relevanceDetails.displayValue}
                    </span>
                )}
                {(recency_weight !== undefined && recency_weight !== null) && (
                    <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700"
                        title={`Recency Weight: ${(recency_weight * 100).toFixed(1)}%`}
                    >
                        Freshness: {(recency_weight * 100).toFixed(0)}%
                    </span>
                )}
                {(combined_weight !== undefined && combined_weight !== null && combined_weight > 0) && (
                    <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-purple-200 bg-purple-50 text-purple-700"
                        title={`Combined Weight (Recency × Relevance): ${(combined_weight * 100).toFixed(1)}%`}
                    >
                        Weight: {(combined_weight * 100).toFixed(0)}%
                    </span>
                )}
            </div>
        </div>
      </div>
      
      {/* External Link Icon */}
      <div className="absolute top-4 right-4 self-start pt-1">
        <ExternalLink className="flex-shrink-0 w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
      </div>
    </article>
  );
};

export default NewsCard;