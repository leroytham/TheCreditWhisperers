/**
 * Sentiment Data Transformation Utilities
 *
 * Functions for transforming sentiment data for charts and displays.
 */

import { parseExchangeDate } from './dateFormatters';
import type { DailySentimentPoint } from '../../../types';

export interface SentimentHeadline {
  title?: string;
  link?: string;
  provider?: string;
  sentiment_score?: number;
}

export interface DailySentimentBar {
  date: string;
  label: string;
  score: number;
  count: number;
  headlines: SentimentHeadline[];
  index: number;
}

/**
 * Generate daily sentiment bar chart data
 */
export const generateDailySentimentBars = (
  dailySentiment: Record<string, DailySentimentPoint>,
  daysToShow: number = 7,
  exchange: string = 'NASDAQ'
): DailySentimentBar[] => {
  if (!dailySentiment || Object.keys(dailySentiment).length === 0) {
    return [];
  }

  // Sort by date and get last N days
  const sortedDates = Object.keys(dailySentiment).sort();
  const lastDays = sortedDates.slice(-daysToShow);

  return lastDays.map((date, index) => {
    const dayData = dailySentiment[date];
    const score = dayData.score || 0;
    const count = dayData.count || 0;
    // Convert string headlines to SentimentHeadline objects if needed
    const rawHeadlines = dayData.headlines || [];
    const headlines: SentimentHeadline[] = rawHeadlines.map((h: string | SentimentHeadline) =>
      typeof h === 'string' ? { title: h } : h
    );
    const dateObj = parseExchangeDate(date, exchange) || new Date(date);
    const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      date: date,
      label: label,
      score: score,
      count: count,
      headlines: headlines,
      index: index
    };
  });
};
