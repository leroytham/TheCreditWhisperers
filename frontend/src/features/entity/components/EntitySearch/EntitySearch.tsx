import React from 'react';
import { Search } from 'lucide-react';
import { useTickerSearch } from '../../hooks/useTickerSearch';
import type { SearchResult } from '../../../../types';

interface EntitySearchProps {
  onTickerSelect: (symbol: string) => void;
}

/**
 * EntitySearch Component
 *
 * Search input with autocomplete for ticker symbols
 */
const EntitySearch: React.FC<EntitySearchProps> = ({ onTickerSelect }) => {
  const { searchTerm, setSearchTerm, suggestions, loading, clearSearch } = useTickerSearch();

  const handleTickerSelect = (symbol: string): void => {
    onTickerSelect(symbol.toUpperCase().trim());
    clearSearch();
  };

  return (
    <div className="flex-1 max-w-md mx-8">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by entity"
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Suggestions Dropdown */}
        {searchTerm.length > 1 && suggestions.length > 0 && (
          <div className="absolute left-0 top-full w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 z-30 max-h-96 overflow-y-auto">
            {loading && (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            )}

            {!loading &&
              Array.from(
                new Map(
                  suggestions
                    .filter((q: SearchResult) => q.quoteType === 'EQUITY')
                    .map((q: SearchResult): [string, SearchResult] => [q.symbol, q])
                ).values()
              ).map((q: SearchResult, idx: number) => (
                <div
                  key={q.symbol + '-' + idx}
                  onClick={() => handleTickerSelect(q.symbol)}
                  className="px-4 py-3 cursor-pointer hover:bg-gray-100"
                >
                  <p className="font-bold text-sm">{q.symbol}</p>
                  <p className="text-xs text-gray-600 truncate">
                    {q.shortname || q.longname}
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EntitySearch;
