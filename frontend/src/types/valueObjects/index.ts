/**
 * Value Objects Index
 *
 * Re-exports all value objects for convenient importing.
 */

export {
  type SentimentScore,
  type SentimentLabel,
  createSentimentScore,
  createSentimentScoreOrNeutral,
  classifySentiment,
  getSentimentColor,
  getSentimentColorClasses,
  formatSentimentScore,
} from './SentimentScore';

export {
  type Percentage,
  createPercentage,
  createPercentageFromDisplay,
  formatPercentage,
  formatPercentageWithSign,
} from './Percentage';
