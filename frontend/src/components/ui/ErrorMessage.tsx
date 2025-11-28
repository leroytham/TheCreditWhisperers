// frontend/src/components/ui/ErrorMessage.js

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Error Message Component
 *
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @param {Function} onRetry - Optional retry callback
 */
const ErrorMessage = ({ title = 'Error', message, onRetry }) => {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">{title}</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{message || 'An unexpected error occurred. Please try again.'}</p>
            </div>
            {onRetry && (
              <div className="mt-4">
                <button
                  onClick={onRetry}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;
