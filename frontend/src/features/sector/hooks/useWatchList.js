// src/hooks/useWatchlist.js

import { useState, useEffect } from 'react';

const WATCHLIST_KEY = 'stock_watchlist';

export const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState([]);

  // Load watchlist from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    if (stored) {
      try {
        setWatchlist(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading watchlist:', e);
      }
    }
  }, []);

  // Save to localStorage whenever watchlist changes
  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const addToWatchlist = (ticker, companyName) => {
    if (!isInWatchlist(ticker)) {
      setWatchlist(prev => [...prev, { ticker, companyName, addedAt: new Date().toISOString() }]);
      return true;
    }
    return false;
  };

  const removeFromWatchlist = (ticker) => {
    setWatchlist(prev => prev.filter(item => item.ticker !== ticker));
  };

  const isInWatchlist = (ticker) => {
    return watchlist.some(item => item.ticker === ticker);
  };

  return {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist
  };
};