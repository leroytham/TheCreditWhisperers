// frontend/src/hooks/useSearch.js

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../services/api';
import { QUERY_KEYS, DEBOUNCE_DELAYS } from '../config/constants';
import useAppStore from '../store/useAppStore';
import useDebounce from './useDebounce';

/**
 * Custom hook for ticker search with debouncing
 *
 * @returns {object} Search state and functions
 */
export const useSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, DEBOUNCE_DELAYS.SEARCH);
  const { addRecentSearch, recentSearches } = useAppStore();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [QUERY_KEYS.SEARCH_TICKER, debouncedQuery],
    queryFn: async () => {
      const response = await apiService.searchTicker(debouncedQuery);
      return response.data;
    },
    enabled: debouncedQuery.length >= 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const selectTicker = (ticker) => {
    addRecentSearch(ticker);
    setSearchQuery('');
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return {
    searchQuery,
    setSearchQuery,
    results: data?.quotes || [],
    isSearching: isLoading,
    isError,
    error,
    selectTicker,
    clearSearch,
    recentSearches,
    hasResults: (data?.quotes?.length || 0) > 0,
  };
};

export default useSearch;
