import React, { useEffect } from 'react';
import { X, Archive, Trash2 } from 'lucide-react';

/**
 * NotificationModal Component
 *
 * Slide-out modal panel from the right showing full notification details
 */
const NotificationModal = ({ notification, onClose, onArchive, onDelete }) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const renderSignalAnalysis = () => {
    if (!notification.signalAnalysis) return null;

    const { triggerRule, sentimentScore, volumeChange } = notification.signalAnalysis;

    const getSentimentColor = (score) => {
      if (score > 0) return 'text-green-600';
      if (score < 0) return 'text-red-600';
      return 'text-gray-600';
    };

    const getVolumeColor = (change) => {
      const value = parseInt(change);
      return value > 0 ? 'text-green-600' : 'text-gray-600';
    };

    return (
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Signal Analysis</h4>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-gray-500">Trigger Rule</p>
            <p className="font-medium text-gray-700">{triggerRule}</p>
          </div>
          {sentimentScore !== undefined && (
            <div>
              <p className="text-gray-500">Sentiment Score</p>
              <p className={`font-bold text-lg ${getSentimentColor(sentimentScore)}`}>
                {sentimentScore.toFixed(2)}
              </p>
            </div>
          )}
          {volumeChange && (
            <div>
              <p className="text-gray-500">News Volume vs. Avg</p>
              <p className={`font-bold text-lg ${getVolumeColor(volumeChange)}`}>
                {volumeChange}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPortfolioImpact = () => {
    if (!notification.portfolioImpact) return null;

    const { ticker, price, change } = notification.portfolioImpact;

    const getChangeColor = (changeStr) => {
      if (changeStr.startsWith('-')) return 'text-red-600';
      if (changeStr.startsWith('+')) return 'text-green-600';
      return 'text-gray-600';
    };

    return (
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">Portfolio Impact</h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs">Holding</p>
            <p className="font-bold text-gray-800 text-lg">{ticker}</p>
          </div>
          <div>
            <p className="text-right font-medium text-gray-800">{price}</p>
            <p className={`text-right font-bold ${getChangeColor(change)}`}>{change}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderAccountServicing = () => {
    if (!notification.accountServicing) return null;

    const { rejectedDoc, rejectionReason, instructions } = notification.accountServicing;

    return (
      <>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <h4 className="text-sm font-semibold text-yellow-800 mb-3">Action Required</h4>
          <p className="font-medium text-gray-700">Documents Rejected</p>
          <p className="text-gray-600 mt-1">{rejectedDoc}</p>
          <p className="text-red-600 text-xs mt-1">{rejectionReason}</p>
        </div>
        {instructions && instructions.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-800">Instructions</h4>
            {instructions.map((instruction, idx) => (
              <p key={idx} className="text-gray-600 mt-1">
                {instruction}
              </p>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-30"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-40 flex flex-col animate-slide-in-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-200">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900">
                {notification.modalTitle || notification.title || notification.category}
              </h2>

              {/* Portfolio Badge */}
              {notification.is_global ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM8 11a1 1 0 112 0v2a1 1 0 11-2 0v-2zm1-5a1 1 0 011 1v1a1 1 0 11-2 0V7a1 1 0 011-1z" />
                  </svg>
                  Global
                </span>
              ) : notification.portfolio_name ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  {notification.portfolio_name}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Alert triggered: {notification.timestamp}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Close notification details"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 text-sm overflow-y-auto flex-grow">
          {/* Main Content */}
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              {notification.subject || notification.title}
            </h3>
            <p className="text-gray-600 mt-2 whitespace-pre-wrap">
              {notification.body || notification.message}
            </p>
          </div>

          {/* Affected Tickers */}
          {notification.affected_tickers && notification.affected_tickers.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Affected Tickers</h4>
              <div className="flex flex-wrap gap-2">
                {notification.affected_tickers.map((ticker) => (
                  <span
                    key={ticker}
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-mono font-semibold bg-white text-gray-800 border border-blue-300 hover:bg-blue-100 cursor-pointer transition-colors"
                    title={`View ${ticker} details`}
                  >
                    {ticker}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Signal Analysis */}
          {renderSignalAnalysis()}

          {/* Portfolio Impact */}
          {renderPortfolioImpact()}

          {/* Account Servicing */}
          {renderAccountServicing()}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          {/* Left side - Archive/Delete actions */}
          <div className="flex items-center space-x-2">
            {/* Archive Button - Show for active notifications */}
            {onArchive && !notification.isArchived && !notification.is_archived && (
              <button
                onClick={() => {
                  onArchive(notification.id);
                  onClose();
                }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Archive notification"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </button>
            )}
            {/* Delete Button - Show for archived notifications */}
            {onDelete && (notification.isArchived || notification.is_archived) && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this notification? This action cannot be undone.')) {
                    onDelete(notification.id);
                    onClose();
                  }
                }}
                className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                title="Delete notification"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
            )}
          </div>

          {/* Right side - Other actions */}
          <div className="flex items-center space-x-3">
            {notification.portfolioImpact && (
              <>
                <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none">
                  View News Feed
                </button>
                <button className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none">
                  Create Order
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none"
            >
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationModal;
