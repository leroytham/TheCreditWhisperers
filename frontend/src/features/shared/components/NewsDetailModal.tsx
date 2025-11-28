// frontend/src/features/shared/components/NewsDetailModal.jsx

import React, { useEffect } from 'react';
import { X, ExternalLink, TrendingUp, BarChart3 } from 'lucide-react';

/**
 * Modal component to display full news article details
 * Supports both center modal and slide-over modes
 */
const NewsDetailModal = ({
  article,
  isOpen,
  onClose,
  mode = 'modal', // 'modal' or 'slideover'
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !article) return null;

  const formatPublishTime = (timeStr) => {
    if (!timeStr) return 'Unknown';
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

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex items-start justify-between p-4">
          <div className="flex-1 pr-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {article.title}
            </h2>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{article.source || 'Unknown Source'}</span>
              {article.category_within_source && article.category_within_source !== 'n/a' && (
                <>
                  <span>•</span>
                  <span>{article.category_within_source}</span>
                </>
              )}
              {article.source_domain && (
                <>
                  <span>•</span>
                  <span>{article.source_domain}</span>
                </>
              )}
              {article.time_published && (
                <>
                  <span>•</span>
                  <time>{formatPublishTime(article.time_published)}</time>
                </>
              )}
            </div>

            {article.authors && article.authors.length > 0 && (
              <div className="text-xs text-gray-600 mt-1">
                By: {article.authors.filter(a => !a.includes('http')).join(', ')}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Read Full Article Button - Prominent CTA */}
        {(article.url || article.link) && (
          <div className="px-4 pb-4">
            <a
              href={article.url || article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Read Full Article
            </a>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {/* Banner Image */}
        {(article.banner_image || article.image) && (
          <div className="mb-4 rounded-lg overflow-hidden bg-gray-200 shadow-sm">
            <img
              src={article.banner_image || article.image}
              alt={article.title || 'Article image'}
              className="w-full h-auto max-h-64 object-cover"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Quick Insights - Key metrics at a glance */}
        {(article.overall_sentiment_label || (article.topics && article.topics.length > 0) || (article.ticker_sentiment && article.ticker_sentiment.length > 0)) && (
          <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Insights</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {article.overall_sentiment_label && (
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Overall Sentiment</div>
                  <div className={`text-sm font-bold ${article.overall_sentiment_score >= 0.15 ? 'text-green-600' : article.overall_sentiment_score <= -0.15 ? 'text-red-600' : 'text-gray-600'}`}>
                    {article.overall_sentiment_label}
                  </div>
                </div>
              )}
              {article.topics && article.topics.length > 0 && (
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Main Topic</div>
                  <div className="text-sm font-bold text-gray-900">
                    {article.topics[0].topic}
                  </div>
                </div>
              )}
              {article.ticker_sentiment && article.ticker_sentiment.length > 0 && (
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Tickers Mentioned</div>
                  <div className="text-sm font-bold text-gray-900">
                    {article.ticker_sentiment.length} {article.ticker_sentiment.length === 1 ? 'ticker' : 'tickers'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Article Summary</h3>
          {article.summary ? (
            <p className="text-sm text-gray-700 leading-relaxed">{article.summary}</p>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No summary available. Click "Read Full Article" above to view the complete article.
            </p>
          )}
        </div>

        {/* Overall Sentiment */}
        {article.overall_sentiment_score !== undefined && article.overall_sentiment_score !== null && (
          <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Overall Sentiment Analysis
            </h3>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold border ${getSentimentColor(article.overall_sentiment_score)}`}>
                {article.overall_sentiment_label}
              </span>
              <span className="text-xl font-bold text-gray-900">
                {article.overall_sentiment_score.toFixed(3)}
              </span>
              <span className="text-xs text-gray-500 ml-auto">
                Score range: -1 (very negative) to +1 (very positive)
              </span>
            </div>
          </div>
        )}

        {/* Topics */}
        {article.topics && article.topics.length > 0 && (
          <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Topics & Relevance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {article.topics.map((topic, idx) => {
                const relevance = parseFloat(topic.relevance_score);
                const hasValidRelevance = !isNaN(relevance) && relevance !== null;

                return (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-800">{topic.topic}</span>
                    {hasValidRelevance ? (
                      <span className={`text-sm font-bold px-2.5 py-1 rounded-md border ${getRelevanceColor(relevance)}`}>
                        {(relevance * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">N/A</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ticker Sentiments */}
        {article.ticker_sentiment && article.ticker_sentiment.length > 0 && (
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Ticker-Specific Sentiment
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Ticker</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Relevance</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Label</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {article.ticker_sentiment.map((ts, idx) => {
                    const relevance = parseFloat(ts.relevance_score);
                    const sentiment = parseFloat(ts.ticker_sentiment_score);
                    const hasValidRelevance = !isNaN(relevance) && relevance !== null;
                    const hasValidSentiment = !isNaN(sentiment) && sentiment !== null;

                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-sm text-gray-900">{ts.ticker}</td>
                        <td className="px-4 py-3">
                          {hasValidRelevance ? (
                            <span className={`inline-block px-2.5 py-1 rounded-md text-sm font-bold border ${getRelevanceColor(relevance)}`}>
                              {(relevance * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-mono font-medium">
                          {hasValidSentiment ? sentiment.toFixed(3) : 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          {hasValidSentiment && ts.ticker_sentiment_label ? (
                            <span className={`inline-block px-2.5 py-1 rounded-md text-sm font-semibold border ${getSentimentColor(sentiment)}`}>
                              {ts.ticker_sentiment_label}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (mode === 'slideover') {
    return (
      <div
        className="fixed inset-0 z-50 overflow-hidden"
        aria-labelledby="slide-over-title"
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute inset-0 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            onClick={handleBackdropClick}
          ></div>

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-xl transform transition-transform">
              <div className="flex h-full flex-col bg-white shadow-xl">
                {modalContent}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Center modal
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleBackdropClick}
        ></div>

        {/* Modal panel */}
        <div className="relative z-10 w-full max-w-2xl max-h-[85vh] bg-white rounded-lg shadow-xl overflow-hidden">
          {modalContent}
        </div>
      </div>
    </div>
  );
};

export default NewsDetailModal;
