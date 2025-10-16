/**
 * useTickerSearch Hook
 *
 * Custom hook for ticker search with autocomplete
 */

import { useState, useEffect } from 'react';
import { SEARCH_DEBOUNCE_DELAY, MIN_SEARCH_LENGTH } from '../../shared/utils/constants';

export const useTickerSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchTerm.trim().length < MIN_SEARCH_LENGTH) {
      setSuggestions([]);
      return;
    }

    setLoading(true);

    // Debounced API call
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search-ticker?q=${searchTerm}`);
        const data = await response.json();

        setSuggestions(data.quotes || []);
      } catch (err) {
        console.error('Error searching ticker:', err);
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
