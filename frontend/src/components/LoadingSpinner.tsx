import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  message?: string;
  fullScreen?: boolean;
  overlay?: boolean;
  className?: string;
}

/**
 * LoadingSpinner Component
 *
 * Reusable loading spinner to replace scattered loading states
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  message = '',
  fullScreen = false,
  overlay = false,
  className = '',
}) => {
  // Size configurations
  const sizeClasses: Record<SpinnerSize, string> = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
    xl: 'w-16 h-16 border-4',
  };

  const textSizeClasses: Record<SpinnerSize, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  };

  const spinnerClass = sizeClasses[size];
  const textClass = textSizeClasses[size];

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

type InlineSpinnerSize = 'xs' | 'sm' | 'md';

interface InlineSpinnerProps {
  size?: InlineSpinnerSize;
  className?: string;
}

/**
 * Inline loading spinner for buttons and small spaces
 */
export const InlineSpinner: React.FC<InlineSpinnerProps> = ({ size = 'sm', className = '' }) => {
  const sizeClasses: Record<InlineSpinnerSize, string> = {
    xs: 'w-3 h-3 border',
    sm: 'w-4 h-4 border-2',
    md: 'w-5 h-5 border-2',
  };

  const spinnerClass = sizeClasses[size];

  return (
    <div
      className={`${spinnerClass} border-gray-200 border-t-current rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading..."
    />
  );
};

export default LoadingSpinner;
