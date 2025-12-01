/**
 * Smoke tests for sentiment analysis utilities.
 *
 * These tests verify that the refactored sentiment classification logic
 * using SENTIMENT_THRESHOLDS constants produces correct results.
 */

import { SENTIMENT_THRESHOLDS } from '../../../../config/constants';
import {
  formatSentimentLabel,
  getSentimentColorByScore,
  calculateDistribution,
  calculateOverallSentiment,
} from '../sentimentAnalysis';

describe('Sentiment Classification with Centralized Thresholds', () => {
  describe('formatSentimentLabel', () => {
    test('score >= 0.35 should be Bullish', () => {
      expect(formatSentimentLabel(0.35)).toBe('Bullish');
      expect(formatSentimentLabel(0.5)).toBe('Bullish');
      expect(formatSentimentLabel(1.0)).toBe('Bullish');
    });

    test('score >= 0.15 and < 0.35 should be Somewhat Bullish', () => {
      expect(formatSentimentLabel(0.15)).toBe('Somewhat Bullish');
      expect(formatSentimentLabel(0.25)).toBe('Somewhat Bullish');
      expect(formatSentimentLabel(0.34)).toBe('Somewhat Bullish');
    });

    test('score > -0.15 and < 0.15 should be Neutral', () => {
      expect(formatSentimentLabel(0)).toBe('Neutral');
      expect(formatSentimentLabel(0.14)).toBe('Neutral');
      expect(formatSentimentLabel(-0.14)).toBe('Neutral');
    });

    test('score >= -0.35 and <= -0.15 should be Somewhat Bearish', () => {
      expect(formatSentimentLabel(-0.15)).toBe('Somewhat Bearish');
      expect(formatSentimentLabel(-0.25)).toBe('Somewhat Bearish');
      expect(formatSentimentLabel(-0.34)).toBe('Somewhat Bearish');
    });

    test('score < -0.35 should be Bearish', () => {
      expect(formatSentimentLabel(-0.35)).toBe('Bearish');
      expect(formatSentimentLabel(-0.5)).toBe('Bearish');
      expect(formatSentimentLabel(-1.0)).toBe('Bearish');
    });
  });

  describe('getSentimentColorByScore', () => {
    test('bullish scores should return green', () => {
      expect(getSentimentColorByScore(0.35)).toBe('green');
      expect(getSentimentColorByScore(0.5)).toBe('green');
    });

    test('somewhat bullish scores should return yellow', () => {
      expect(getSentimentColorByScore(0.15)).toBe('yellow');
      expect(getSentimentColorByScore(0.25)).toBe('yellow');
    });

    test('neutral scores should return gray', () => {
      expect(getSentimentColorByScore(0)).toBe('gray');
      expect(getSentimentColorByScore(0.1)).toBe('gray');
      expect(getSentimentColorByScore(-0.1)).toBe('gray');
    });

    test('somewhat bearish scores should return yellow', () => {
      expect(getSentimentColorByScore(-0.15)).toBe('yellow');
      expect(getSentimentColorByScore(-0.25)).toBe('yellow');
    });

    test('bearish scores should return red', () => {
      expect(getSentimentColorByScore(-0.35)).toBe('red');
      expect(getSentimentColorByScore(-0.5)).toBe('red');
    });
  });

  describe('calculateDistribution', () => {
    test('should correctly distribute data across sentiment categories', () => {
      const data = [
        { sentiment: 0.5 },   // Bullish
        { sentiment: 0.4 },   // Bullish
        { sentiment: 0.2 },   // Somewhat Bullish
        { sentiment: 0.0 },   // Neutral
        { sentiment: -0.2 },  // Somewhat Bearish
        { sentiment: -0.4 },  // Bearish
      ];

      const distribution = calculateDistribution(data);

      // 2/6 = 33.33% Bullish, 1/6 = 16.67% each for others
      expect(distribution.bullish).toBe(33);  // Rounded
      expect(distribution.somewhatBullish).toBe(17);
      expect(distribution.neutral).toBe(17);
      expect(distribution.somewhatBearish).toBe(17);
      expect(distribution.bearish).toBe(17);
    });

    test('should return equal distribution for empty data', () => {
      const distribution = calculateDistribution([]);

      expect(distribution.bullish).toBe(20);
      expect(distribution.somewhatBullish).toBe(20);
      expect(distribution.neutral).toBe(20);
      expect(distribution.somewhatBearish).toBe(20);
      expect(distribution.bearish).toBe(20);
    });
  });

  describe('calculateOverallSentiment', () => {
    test('should classify average as Bullish when >= 0.35', () => {
      const data = [{ sentiment: 0.5 }, { sentiment: 0.4 }, { sentiment: 0.3 }];
      const result = calculateOverallSentiment(data);

      expect(result.label).toBe('Bullish');
      expect(result.color).toBe('green');
    });

    test('should classify average as Neutral when between -0.15 and 0.15', () => {
      const data = [{ sentiment: 0.1 }, { sentiment: -0.1 }, { sentiment: 0.0 }];
      const result = calculateOverallSentiment(data);

      expect(result.label).toBe('Neutral');
      expect(result.color).toBe('gray');
    });

    test('should classify average as Bearish when < -0.35', () => {
      const data = [{ sentiment: -0.5 }, { sentiment: -0.4 }, { sentiment: -0.3 }];
      const result = calculateOverallSentiment(data);

      expect(result.label).toBe('Bearish');
      expect(result.color).toBe('red');
    });
  });

  describe('Threshold boundary conditions', () => {
    // These tests verify exact boundary behavior
    // Classification rules:
    // - Bullish: score >= 0.35
    // - Somewhat-Bullish: 0.15 <= score < 0.35
    // - Neutral: -0.15 < score < 0.15 (exclusive on both ends)
    // - Somewhat-Bearish: -0.35 < score <= -0.15
    // - Bearish: score <= -0.35
    test('exact threshold values should classify correctly', () => {
      // Use the actual threshold constants to verify consistency
      expect(formatSentimentLabel(SENTIMENT_THRESHOLDS.BULLISH)).toBe('Bullish');        // 0.35 → Bullish
      expect(formatSentimentLabel(SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH)).toBe('Somewhat Bullish'); // 0.15 → Somewhat Bullish
      expect(formatSentimentLabel(SENTIMENT_THRESHOLDS.NEUTRAL_LOWER)).toBe('Somewhat Bearish');    // -0.15 → Somewhat Bearish (boundary inclusive)
      expect(formatSentimentLabel(SENTIMENT_THRESHOLDS.BEARISH)).toBe('Bearish');        // -0.35 → Bearish
    });

    test('values just below thresholds should classify to lower category', () => {
      expect(formatSentimentLabel(SENTIMENT_THRESHOLDS.BULLISH - 0.01)).toBe('Somewhat Bullish');
      expect(formatSentimentLabel(SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH - 0.01)).toBe('Neutral');
      expect(formatSentimentLabel(SENTIMENT_THRESHOLDS.NEUTRAL_LOWER - 0.01)).toBe('Somewhat Bearish');
      expect(formatSentimentLabel(SENTIMENT_THRESHOLDS.BEARISH - 0.01)).toBe('Bearish');
    });
  });
});
