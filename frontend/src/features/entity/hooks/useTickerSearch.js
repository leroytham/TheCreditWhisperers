/**
 * useTickerSearch Hook
 *
 * Custom hook for ticker search with autocomplete
 */

import { useState, useEffect } from 'react';
import { SEARCH_DEBOUNCE_DELAY, MIN_SEARCH_LENGTH } from '../../shared/utils/constants';
import apiService from '../../../services/api';

export const useTickerSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

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
      } catch (err) {
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
