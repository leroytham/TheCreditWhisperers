// frontend/src/hooks/index.js

/**
 * Centralized exports for all custom hooks
 */

// Stock hooks
export {
  useStockPrice,
  useStockHistorical,
  useStockSentiment,
  useStockEvents,
  useStockData,
  useWatchlist,
  usePrefetchStock,
} from './useStock';

// News hooks
export {
  useNews,
  useCategorizedNews,
  useDailySentiment,
  useFilteredNews,
  useNewsStats,
} from './useNews';

// Utility hooks
export { useDebounce } from './useDebounce';
export { useSearch } from './useSearch';
