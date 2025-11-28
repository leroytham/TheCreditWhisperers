import React from 'react';

/**
 * LoadingSpinner Component
 *
 * Reusable loading spinner to replace scattered loading states
 *
 * @param {Object} props
 * @param {string} props.size - Size variant: 'sm', 'md', 'lg', 'xl' (default: 'md')
 * @param {string} props.message - Optional loading message
 * @param {boolean} props.fullScreen - If true, renders centered full screen overlay
 * @param {boolean} props.overlay - If true, renders as overlay over parent
 * @param {string} props.className - Additional CSS classes
 */
const LoadingSpinner = ({
  size = 'md',
  message = '',
  fullScreen = false,
  overlay = false,
  className = '',
}) => {
  // Size configurations
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
    xl: 'w-16 h-16 border-4',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  };

  const spinnerClass = sizeClasses[size] || sizeClasses.md;
  const textClass = textSizeClasses[size] || textSizeClasses.md;

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3" aria-live="polite" aria-busy="true">
      <div
        className={`${spinnerClass} border-gray-200 border-t-blue-600 rounded-full animate-spin ${className}`}
        role="status"
        aria-label={message || 'Loading...'}
      />
      {message && (
        <p className={`${textClass} text-gray-600 font-medium`}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50/90 backdrop-blur-sm z-50">
        {spinner}
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg z-10">
        {spinner}
      </div>
    );
  }

  return spinner;
};

/**
 * Inline loading spinner for buttons and small spaces
 */
export const InlineSpinner = ({ size = 'sm', className = '' }) => {
  const sizeClasses = {
    xs: 'w-3 h-3 border',
    sm: 'w-4 h-4 border-2',
    md: 'w-5 h-5 border-2',
  };

  const spinnerClass = sizeClasses[size] || sizeClasses.sm;

  return (
    <div
      className={`${spinnerClass} border-gray-200 border-t-current rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading..."
    />
  );
};

export default LoadingSpinner;
