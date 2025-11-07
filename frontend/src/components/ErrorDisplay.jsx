import React from 'react';

/**
 * ErrorDisplay Component
 *
 * Reusable error display component to replace scattered error states
 *
 * @param {Object} props
 * @param {string} props.message - Error message to display
 * @param {string} props.title - Optional error title (default: "Error")
 * @param {Function} props.onRetry - Optional retry callback
 * @param {string} props.retryText - Text for retry button (default: "Try Again")
 * @param {boolean} props.fullScreen - If true, renders centered full screen
 * @param {string} props.variant - Style variant: 'error', 'warning', 'info' (default: 'error')
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showIcon - Show error icon (default: true)
 */
const ErrorDisplay = ({
  message = 'Something went wrong',
  title = '',
  onRetry,
  retryText = 'Try Again',
  fullScreen = false,
  variant = 'error',
  className = '',
  showIcon = true,
}) => {
  // Variant configurations
  const variantConfig = {
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconBgColor: 'bg-red-100',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      messageColor: 'text-red-700',
      buttonColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconBgColor: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-900',
      messageColor: 'text-yellow-700',
      buttonColor: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconBgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      messageColor: 'text-blue-700',
      buttonColor: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  };

  const config = variantConfig[variant] || variantConfig.error;

  const errorContent = (
    <div
      className={`${config.bgColor} ${config.borderColor} border rounded-lg p-6 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-4">
        {showIcon && (
          <div className={`flex-shrink-0 ${config.iconBgColor} rounded-full p-2`}>
            <svg
              className={`w-6 h-6 ${config.iconColor}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {variant === 'error' && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              )}
              {variant === 'warning' && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              )}
              {variant === 'info' && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              )}
            </svg>
          </div>
        )}

        <div className="flex-1">
          {title && (
            <h3 className={`text-lg font-semibold ${config.titleColor} mb-2`}>
              {title}
            </h3>
          )}

          <p className={`text-sm ${config.messageColor}`}>
            {message}
          </p>

          {onRetry && (
            <button
              onClick={onRetry}
              className={`mt-4 px-4 py-2 rounded-md text-sm font-medium text-white ${config.buttonColor} focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors`}
            >
              {retryText}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full">
          {errorContent}
        </div>
      </div>
    );
  }

  return errorContent;
};

/**
 * Inline error display for compact spaces
 */
export const InlineError = ({ message, onRetry, className = '', details = null }) => {
  const enhancedMessage = React.useMemo(() => {
    // Add helpful context to common error messages
    if (message.toLowerCase().includes('failed to load')) {
      return `${message}. Please check your internet connection.`;
    }
    if (message.toLowerCase().includes('timeout')) {
      return `${message}. The server is taking longer than expected to respond.`;
    }
    if (message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('401')) {
      return `${message}. Your session may have expired.`;
    }
    if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('404')) {
      return `${message}. The requested data may have been moved or deleted.`;
    }
    return message;
  }, [message]);

  return (
    <div
      className={`flex items-center gap-2 text-sm text-red-600 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="flex-1">
        <span>{enhancedMessage}</span>
        {details && (
          <p className="text-xs text-red-500 mt-1">{details}</p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-2 text-red-700 hover:text-red-800 underline font-medium flex-shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
};

/**
 * Empty state display (for when there's no data but no error)
 */
export const EmptyState = ({
  title = 'No data available',
  message = '',
  icon,
  action,
  actionText,
  className = '',
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      {icon || (
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      )}

      <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>

      {message && (
        <p className="mt-1 text-sm text-gray-500">{message}</p>
      )}

      {action && actionText && (
        <div className="mt-6">
          <button
            onClick={action}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {actionText}
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorDisplay;
