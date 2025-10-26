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
      <div className="flex items-start justify-between p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex-1 pr-4">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
          >
            <h2 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors flex items-start gap-2">
              {article.title}
              <ExternalLink className="flex-shrink-0 w-4 h-4 text-gray-400 group-hover:text-blue-500 mt-1" />
            </h2>
          </a>
          
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1.5">
            <span className="font-medium text-gray-700">{article.source}</span>
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
            <span>•</span>
            <time>{formatPublishTime(article.time_published)}</time>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {/* Banner Image */}
        {article.banner_image && (
          <div className="mb-4 rounded-lg overflow-hidden bg-gray-200">
            <img
              src={article.banner_image}
              alt=""
              className="w-full h-auto max-h-64 object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}

        {/* Summary */}
        {article.summary && (
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Summary</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{article.summary}</p>
          </div>
        )}

        {/* Overall Sentiment */}
        {article.overall_sentiment_score !== undefined && article.overall_sentiment_score !== null && (
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" />
              Overall Sentiment
            </h3>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border ${getSentimentColor(article.overall_sentiment_score)}`}>
                {article.overall_sentiment_label}
              </span>
              <span className="text-lg font-bold text-gray-900">
                {article.overall_sentiment_score.toFixed(3)}
              </span>
            </div>
          </div>
        )}

        {/* Topics */}
        {article.topics && article.topics.length > 0 && (
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Topics & Relevance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {article.topics.map((topic, idx) => {
                const relevance = parseFloat(topic.relevance_score);
                const hasValidRelevance = !isNaN(relevance) && relevance !== null;
                
                return (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-200"
                  >
                    <span className="text-xs font-medium text-gray-700">{topic.topic}</span>
                    {hasValidRelevance ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getRelevanceColor(relevance)}`}>
                        {(relevance * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ticker Sentiments */}
        {article.ticker_sentiment && article.ticker_sentiment.length > 0 && (
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" />
              Ticker-Specific Sentiment
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Ticker</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Relevance</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Score</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Label</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {article.ticker_sentiment.map((ts, idx) => {
                    const relevance = parseFloat(ts.relevance_score);
                    const sentiment = parseFloat(ts.ticker_sentiment_score);
                    const hasValidRelevance = !isNaN(relevance) && relevance !== null;
                    const hasValidSentiment = !isNaN(sentiment) && sentiment !== null;
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{ts.ticker}</td>
                        <td className="px-3 py-2">
                          {hasValidRelevance ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRelevanceColor(relevance)}`}>
                              {(relevance * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">N/A</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700 font-mono">
                          {hasValidSentiment ? sentiment.toFixed(3) : 'N/A'}
                        </td>
                        <td className="px-3 py-2">
                          {hasValidSentiment && ts.ticker_sentiment_label ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getSentimentColor(sentiment)}`}>
                              {ts.ticker_sentiment_label}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">N/A</span>
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
