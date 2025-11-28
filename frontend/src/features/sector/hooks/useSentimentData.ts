import { useMemo } from 'react';
import { generateDailySentimentBars } from '../../shared/utils/chartHelpers';

interface DailySentimentData {
  [key: string]: {
    score?: number;
    count?: number;
    headlines?: string[];
  };
}

/**
 * Custom hook for processing sentiment data
 * @param {Object} dailySentiment - Daily sentiment data object
 * @param {number} numDays - Number of days to include (default 7)
 * @returns {Object} Processed sentiment bars data
 */
export const useSentimentData = (dailySentiment: DailySentimentData | null | undefined, numDays = 7) => {
  const sentimentBars = useMemo(() => {
    // @ts-expect-error - The interface is compatible but TypeScript can't verify
    return generateDailySentimentBars(dailySentiment || {}, numDays);
  }, [dailySentiment, numDays]);

  return {
    sentimentBars
  };
};
