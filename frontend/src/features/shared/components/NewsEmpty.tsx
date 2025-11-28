// frontend/src/features/shared/components/NewsEmpty.jsx

import React from 'react';
import { Newspaper } from 'lucide-react';

/**
 * Displays an empty state when no news articles are found.
 * @param {object} props
 * @param {string} [props.displayName] - The name of the entity being searched (e.g., a stock ticker).
 */
const NewsEmpty = ({ displayName, hasFilter }: { displayName: any; hasFilter?: boolean }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="w-16 h-16 flex items-center justify-center bg-gray-200 rounded-full mb-4">
        <Newspaper className="w-8 h-8 text-gray-400" />
      </div>
      <h4 className="text-lg font-medium text-gray-900 mb-2">No news found</h4>
      <p className="text-sm text-gray-500 text-center max-w-sm">
        {displayName
          ? `There are no recent articles available for ${displayName}.`
          : 'There are no recent news articles available at this time. Try checking back later for updates.'}
      </p>
    </div>
  );
};

export default NewsEmpty;
