import { useMemo } from 'react';
import { generateDailySentimentBars } from '../../shared/utils/chartHelpers';

/**
 * Custom hook for processing sentiment data
 * @param {Object} dailySentiment - Daily sentiment data object
 * @param {number} numDays - Number of days to include (default 7)
 * @returns {Object} Processed sentiment bars data
 */
export const useSentimentData = (dailySentiment, numDays = 7) => {
  const sentimentBars = useMemo(() => {
    return generateDailySentimentBars(dailySentiment, numDays);
  }, [dailySentiment, numDays]);

  return {
    sentimentBars
  };
};
