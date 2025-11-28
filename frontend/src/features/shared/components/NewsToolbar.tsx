// frontend/src/features/shared/components/NewsToolbar.tsx

import React from 'react';
import { Search, List, LayoutGrid, ChevronsUpDown } from 'lucide-react';

interface NewsToolbarProps {
  onFilterChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onLayoutChange: (value: 'list' | 'grid') => void;
  sortOption: string;
  layoutOption: 'list' | 'grid';
  resultCount: number;
}

/**
 * A toolbar for filtering, sorting, and changing the layout of the news feed.
 */
const NewsToolbar: React.FC<NewsToolbarProps> = ({
  onFilterChange,
  onSortChange,
  onLayoutChange,
  sortOption,
  layoutOption,
  resultCount,
}) => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Search Input */}
      <div className="relative w-full md:w-auto md:flex-1 md:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder={`Search ${resultCount} articles...`}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-gray-50 hover:bg-gray-100"
        />
      </div>

      <div className="flex items-center gap-4">
        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
            <label htmlFor="sort-options" className="text-sm font-medium text-gray-700 whitespace-nowrap">Sort by:</label>
            <div className="relative">
                <select
                    id="sort-options"
                    value={sortOption}
                    onChange={(e) => onSortChange(e.target.value)}
                    className="appearance-none w-full md:w-auto bg-white border border-gray-300 rounded-md py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-gray-50"
                    aria-label="Sort articles"
                >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="sentiment-desc">Most Positive</option>
                    <option value="sentiment-asc">Most Negative</option>
                </select>
                <ChevronsUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
        </div>

        {/* Layout Toggle */}
        <div className="flex items-center gap-1 rounded-md bg-gray-100 p-1 border border-gray-200">
          <button
            onClick={() => onLayoutChange('list')}
            className={`p-1.5 rounded ${layoutOption === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
            aria-label="List view"
          >
            <List className={`w-5 h-5 ${layoutOption === 'list' ? 'text-blue-600' : 'text-gray-500'}`} />
          </button>
          <button
            onClick={() => onLayoutChange('grid')}
            className={`p-1.5 rounded ${layoutOption === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
            aria-label="Grid view"
          >
            <LayoutGrid className={`w-5 h-5 ${layoutOption === 'grid' ? 'text-blue-600' : 'text-gray-500'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewsToolbar;