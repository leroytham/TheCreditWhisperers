// frontend/src/features/shared/components/NewsEmpty.jsx

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Displays an error state for the news feed.
 * @param {object} props
 * @param {Error|null} props.error - The error object.
 * @param {function} props.onRetry - The function to call when the retry button is clicked.
 */
const NewsError = ({ error, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="w-12 h-12 flex items-center justify-center bg-red-100 rounded-full mb-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h4 className="text-lg font-medium text-red-800 mb-2">Could not load news</h4>
      <p className="text-sm text-red-700 max-w-sm mb-6">
        {error?.message || 'An unexpected error occurred. Please check your connection and try again.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </button>
      )}
    </div>
  );
};

export default NewsError;
