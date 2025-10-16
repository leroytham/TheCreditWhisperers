import React from 'react';

/**
 * Shared RelatedNews Component
 *
 * Displays news articles with sentiment scores
 * Used by both Entity and Sector features
 *
 * @param {Object} props
 * @param {Array} props.news - Array of news articles
 * @param {string} props.ticker - Ticker symbol for display context
 * @param {string} props.companyName - Company/sector name for display context
 * @param {string} props.error - Error message to display (optional)
 * @param {string} props.className - Additional CSS classes for wrapper
 */
const RelatedNews = ({
  news,
  ticker,
  companyName,
  error,
  className = 'bg-white border-l border-gray-200 rounded-lg shadow-sm p-4'
}) => {
  const displayName = companyName || ticker;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Related News</h3>
        {displayName && <div className="text-sm text-gray-500">{displayName}</div>}
      </div>

      {error && <div className="text-sm text-red-500 mb-2">{error}</div>}

      <div className="space-y-4 max-h-screen overflow-y-auto">
        {!news || news.length === 0 ? (
          <div className="text-gray-400">
            No news found{displayName ? ` for ${displayName}` : ''}
          </div>
        ) : (
          news.map((article, index) => (
            <div key={index} className="border-b border-gray-100 pb-4">
              {/* Article Title and Sentiment */}
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900 leading-5 flex-1">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600"
                  >
                    {article.title}
                  </a>
                </h4>

                {/* Sentiment Badge */}
                {article.sentiment_score !== undefined &&
                  article.sentiment_score !== null && (
                    <span
                      className={`ml-2 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap border ${
                        article.sentiment_score > 0
                          ? 'text-green-600 border-green-600 bg-green-50'
                          : article.sentiment_score < 0
                          ? 'text-red-600 border-red-600 bg-red-50'
                          : 'text-gray-600 border-gray-600 bg-gray-50'
                      }`}
                    >
                      {article.sentiment_score > 0 ? '+' : ''}
                      {Number(article.sentiment_score).toFixed(2)}
                    </span>
                  )}
              </div>

              {/* Article Metadata */}
              <p className="text-xs text-gray-600">
                {article.publish_date} | {article.provider}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RelatedNews;
