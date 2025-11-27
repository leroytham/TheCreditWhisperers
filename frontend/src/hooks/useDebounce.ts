import { useState, useEffect } from 'react';

/**
 * Custom hook for debouncing values
 *
 * @template T - The type of value being debounced
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds (default: 500)
 * @returns Debounced value
 *
 * @example
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 *
 * @example
 * // With explicit type
 * const debouncedCount = useDebounce<number>(count, 500);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
