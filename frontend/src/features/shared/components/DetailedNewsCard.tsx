// frontend/src/features/shared/components/DetailedNewsCard.jsx

import React, { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, TrendingUp, BarChart3 } from 'lucide-react';
import SentimentBadge from './SentimentBadge';
import { formatRelativeTime } from '../utils/dateFormatters';

/**
 * A detailed card component to display comprehensive news article information
 * including all data from Alpha Vantage API response
 */
const DetailedNewsCard = ({
  title,
  url,
  time_published,
  authors = [],
  summary,
  banner_image,
  source,
  category_within_source,
  source_domain,
  topics = [],
  overall_sentiment_score,
  overall_sentiment_label,
  ticker_sentiment = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatPublishTime = (timeStr) => {
    if (!timeStr) return 'Unknown';
    // Format: 20251026T073500 -> Oct 26, 2025 7:35 AM
    const year = timeStr.substring(0, 4);
    const month = timeStr.substring(4, 6);
    const day = timeStr.substring(6, 8);
    const hour = timeStr.substring(9, 11);
    const minute = timeStr.substring(11, 13);
    
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getSentimentColor = (score) => {
    if (score >= 0.35) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 0.15) return 'text-lime-600 bg-lime-50 border-lime-200';
    if (score > -0.15) return 'text-gray-600 bg-gray-50 border-gray-200';
    if (score > -0.35) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getRelevanceColor = (score) => {
    if (score >= 0.7) return 'text-purple-700 bg-purple-50 border-purple-200';
    if (score >= 0.4) return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    return 'text-blue-700 bg-blue-50 border-blue-200';
  };

  return (
    <article className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
      {/* Main Content */}
      <div className="p-5">
        <div className="flex gap-4">
          {/* Banner Image */}
          {banner_image && (
            <div className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
              <img
                src={banner_image}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2 flex items-start gap-2">
                {title}
                <ExternalLink className="flex-shrink-0 w-4 h-4 text-gray-400 group-hover:text-blue-500 mt-1" />
              </h3>
            </a>

            {/* Summary */}
            {summary && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{summary}</p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-3">
              <span className="font-medium text-gray-700">{source}</span>
              {category_within_source && category_within_source !== 'n/a' && (
                <>
                  <span>•</span>
                  <span>{category_within_source}</span>
                </>
              )}
              {source_domain && (
                <>
                  <span>•</span>
                  <span>{source_domain}</span>
                </>
              )}
              <span>•</span>
              <time>{formatPublishTime(time_published)}</time>
              {authors && authors.length > 0 && (
                <>
                  <span>•</span>
                  <span>{authors.filter(a => !a.includes('http')).join(', ')}</span>
                </>
              )}
            </div>

            {/* Overall Sentiment & Topics */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {overall_sentiment_score !== undefined && (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getSentimentColor(overall_sentiment_score)}`}>
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Overall: {overall_sentiment_label} ({overall_sentiment_score.toFixed(3)})
                </span>
              )}
              
              {topics && topics.length > 0 && topics.slice(0, 3).map((topic, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                  title={`Relevance: ${(parseFloat(topic.relevance_score) * 100).toFixed(1)}%`}
                >
                  {topic.topic}
                </span>
              ))}
            </div>

            {/* Ticker Sentiment Preview */}
            {ticker_sentiment && ticker_sentiment.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {ticker_sentiment.slice(0, 4).map((ts, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSentimentColor(ts.ticker_sentiment_score)}`}
                    title={`Relevance: ${(parseFloat(ts.relevance_score) * 100).toFixed(1)}%`}
                  >
                    {ts.ticker}: {ts.ticker_sentiment_label}
                  </span>
                ))}
                {ticker_sentiment.length > 4 && (
                  <span className="text-xs text-gray-500">
                    +{ticker_sentiment.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expand/Collapse Button */}
        {(ticker_sentiment.length > 0 || topics.length > 0) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 py-2 border-t border-gray-100"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show Less Details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show Full Details
              </>
            )}
          </button>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-5 bg-gray-50 space-y-4">
          {/* All Topics */}
          {topics && topics.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Topics & Relevance
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {topics.map((topic, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2 bg-white rounded border border-gray-200"
                  >
                    <span className="text-sm font-medium text-gray-700">{topic.topic}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${getRelevanceColor(parseFloat(topic.relevance_score))}`}>
                      {(parseFloat(topic.relevance_score) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Ticker Sentiments */}
          {ticker_sentiment && ticker_sentiment.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Ticker-Specific Sentiment
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Ticker</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Relevance</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Score</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Label</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ticker_sentiment.map((ts, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{ts.ticker}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRelevanceColor(parseFloat(ts.relevance_score))}`}>
                            {(parseFloat(ts.relevance_score) * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{parseFloat(ts.ticker_sentiment_score).toFixed(3)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getSentimentColor(parseFloat(ts.ticker_sentiment_score))}`}>
                            {ts.ticker_sentiment_label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export default DetailedNewsCard;
