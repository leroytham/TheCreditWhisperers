import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * NotificationModal Component
 *
 * Slide-out modal panel from the right showing full notification details
 */
const NotificationModal = ({ notification, onClose }) => {
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
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{notification.modalTitle}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Alert triggered: {notification.timestamp}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close notification details"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 text-sm overflow-y-auto flex-grow">
          {/* Main Content */}
          <div>
            <h3 className="text-xl font-bold text-gray-800">{notification.subject}</h3>
            <p className="text-gray-600 mt-2 whitespace-pre-wrap">{notification.body}</p>
          </div>

          {/* Signal Analysis */}
          {renderSignalAnalysis()}

          {/* Portfolio Impact */}
          {renderPortfolioImpact()}

          {/* Account Servicing */}
          {renderAccountServicing()}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-3">
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
    </>
  );
};

export default NotificationModal;
