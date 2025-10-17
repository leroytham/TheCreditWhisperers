// frontend/src/features/shared/components/NewsSkeleton.jsx

import React from 'react';

/**
 * Displays a skeleton loading state for the news feed.
 * @param {object} props
 * @param {number} [props.count=5] - The number of skeleton cards to display.
 */
const NewsSkeleton = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 bg-white rounded-lg shadow-sm animate-pulse">
          {/* Skeleton Thumbnail */}
          <div className="flex-shrink-0 w-20 h-20 bg-gray-200 rounded-md" />
          
          {/* Skeleton Content */}
          <div className="flex-1 space-y-3 py-1">
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="flex items-center gap-4 pt-2">
              <div className="h-3 bg-gray-200 rounded w-1/4" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NewsSkeleton;
