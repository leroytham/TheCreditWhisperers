/**
 * useTickerSearch Hook
 *
 * Custom hook for ticker search with autocomplete
 */

import { useState, useEffect } from 'react';
import { SEARCH_DEBOUNCE_DELAY, MIN_SEARCH_LENGTH } from '../../shared/utils/constants';
import apiService from '../../../services/api';
import type { SearchResult } from '../../../types';

interface UseTickerSearchReturn {
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  suggestions: SearchResult[];
  loading: boolean;
  clearSearch: () => void;
}

export const useTickerSearch = (): UseTickerSearchReturn => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    console.log('[useTickerSearch] Search term changed:', searchTerm);

    if (searchTerm.trim().length < MIN_SEARCH_LENGTH) {
      console.log('[useTickerSearch] Search term too short, clearing suggestions');
      setSuggestions([]);
      return;
    }

    setLoading(true);

    // Debounced API call
    const timeoutId = setTimeout(async () => {
      try {
        console.log('[useTickerSearch] Fetching:', searchTerm);

        const response = await apiService.searchTicker(searchTerm);
        const data = response.data;

        console.log('[useTickerSearch] Response:', data);
        setSuggestions(data.quotes || []);
      } catch (err: unknown) {
        console.error('[useTickerSearch] Error searching ticker:', err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_DELAY);

    return () => {
      clearTimeout(timeoutId);
      setLoading(false);
    };
  }, [searchTerm]);

  const clearSearch = () => {
    setSearchTerm('');
    setSuggestions([]);
  };

  return {
    searchTerm,
    setSearchTerm,
    suggestions,
    loading,
    clearSearch
  };
};
