// frontend/src/components/ui/LoadingSpinner.js

import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading Spinner Component
 *
 * @param {string} size - Size of spinner: 'sm', 'md', 'lg'
 * @param {string} text - Optional loading text
 * @param {boolean} fullScreen - Whether to display fullscreen
 */
const LoadingSpinner = ({ size = 'md', text, fullScreen = false }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
      {text && <p className="text-sm text-gray-600">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
