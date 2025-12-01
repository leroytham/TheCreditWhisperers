/**
 * sentimentAnalysis.ts
 *
 * Utility functions for sentiment analysis calculations
 * Used by sentiment components for metrics and insights
 */

import { SENTIMENT_THRESHOLDS } from '../../../config/constants';

// Interfaces for sentiment analysis
export interface SentimentDataPoint {
  sentiment?: number;
  y?: number;
  [key: string]: unknown;
}

export interface MomentumResult {
  value: number;
  trend: 'up' | 'down' | 'stable';
}

export interface DistributionResult {
  bearish: number;
  somewhatBearish: number;
  neutral: number;
  somewhatBullish: number;
  bullish: number;
}

export interface VolatilityResult {
  score: number;
  level: 'Low' | 'Medium' | 'High';
}

export interface OverallSentimentResult {
  label: string;
  value: number;
  color: string;
  confidence: number;
}

export interface SentimentInsights {
  summary: string;
  keyPoints: string[];
  trend: string;
}

/**
 * Calculate momentum (percentage change) over a given period
 */
export const calculateMomentum = (data: SentimentDataPoint[], days: number = 7): MomentumResult => {
  if (!data || data.length === 0) {
    return { value: 0, trend: 'stable' };
  }

  // Get data for comparison (older vs recent)
  const step = Math.max(1, Math.floor(data.length / days));
  const recentData = data.slice(-step);
  const olderData = data.slice(0, step);

  if (recentData.length === 0 || olderData.length === 0) {
    return { value: 0, trend: 'stable' };
  }

  const recentAvg = recentData.reduce((sum, d) => sum + (d.sentiment || 0), 0) / recentData.length;
  const olderAvg = olderData.reduce((sum, d) => sum + (d.sentiment || 0), 0) / olderData.length;

  const change = ((recentAvg - olderAvg) / Math.abs(olderAvg || 1)) * 100;

  return {
    value: Math.round(change),
    trend: change > 2 ? 'up' : change < -2 ? 'down' : 'stable'
  };
};

/**
 * Calculate sentiment distribution (5 categories based on thresholds)
 */
export const calculateDistribution = (data: SentimentDataPoint[]): DistributionResult => {
  if (!data || data.length === 0) {
    return { 
      bearish: 20, 
      somewhatBearish: 20, 
      neutral: 20, 
      somewhatBullish: 20, 
      bullish: 20 
    };
  }

  // Classification thresholds (exact boundaries)
  // x < -0.35: Bearish
  // -0.35 <= x < -0.15: Somewhat-Bearish
  // -0.15 <= x < 0.15: Neutral
  // 0.15 <= x < 0.35: Somewhat-Bullish
  // x >= 0.35: Bullish

  const bearishCount = data.filter(d => (d.sentiment || 0) < SENTIMENT_THRESHOLDS.BEARISH).length;
  const somewhatBearishCount = data.filter(d => {
    const s = d.sentiment || 0;
    return s >= SENTIMENT_THRESHOLDS.BEARISH && s < SENTIMENT_THRESHOLDS.NEUTRAL_LOWER;
  }).length;
  const neutralCount = data.filter(d => {
    const s = d.sentiment || 0;
    return s >= SENTIMENT_THRESHOLDS.NEUTRAL_LOWER && s < SENTIMENT_THRESHOLDS.NEUTRAL_UPPER;
  }).length;
  const somewhatBullishCount = data.filter(d => {
    const s = d.sentiment || 0;
    return s >= SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH && s < SENTIMENT_THRESHOLDS.BULLISH;
  }).length;
  const bullishCount = data.filter(d => (d.sentiment || 0) >= SENTIMENT_THRESHOLDS.BULLISH).length;

  const total = data.length;

  return {
    bearish: Math.round((bearishCount / total) * 100),
    somewhatBearish: Math.round((somewhatBearishCount / total) * 100),
    neutral: Math.round((neutralCount / total) * 100),
    somewhatBullish: Math.round((somewhatBullishCount / total) * 100),
    bullish: Math.round((bullishCount / total) * 100)
  };
};

/**
 * Calculate volatility score (0-10) based on sentiment variation
 */
export const calculateVolatility = (data: SentimentDataPoint[]): VolatilityResult => {
  if (!data || data.length < 2) {
    return { score: 0, level: 'Low' };
  }

  // Calculate standard deviation of sentiment scores
  const sentiments = data.map(d => d.sentiment || 0);
  const mean = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
  const variance = sentiments.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sentiments.length;
  const stdDev = Math.sqrt(variance);

  // Convert standard deviation to 0-10 scale
  // stdDev of 0.3 = 3, stdDev of 0.6 = 10
  const score = Math.min(10, Math.round((stdDev / 0.6) * 10));

  return {
    score: Math.max(0, score),
    level: score <= 3 ? 'Low' : score <= 6 ? 'Medium' : 'High'
  };
};

/**
 * Calculate overall sentiment with confidence
 */
export const calculateOverallSentiment = (data: SentimentDataPoint[]): OverallSentimentResult => {
  if (!data || data.length === 0) {
    return {
      label: 'Neutral',
      value: 0,
      color: 'gray',
      confidence: 0
    };
  }

  const scores = data.map(d => d.sentiment || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Calculate confidence as inverse of volatility
  const variance = scores.reduce((sum, val) => sum + Math.pow(val - avgScore, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const confidence = Math.max(0, Math.min(1, 1 - stdDev));

  // Classify sentiment
  let label, color;
  if (avgScore >= SENTIMENT_THRESHOLDS.BULLISH) {
    label = 'Bullish';
    color = 'green';
  } else if (avgScore >= SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH) {
    label = 'Somewhat Bullish';
    color = 'yellow';
  } else if (avgScore >= SENTIMENT_THRESHOLDS.NEUTRAL_LOWER) {
    label = 'Neutral';
    color = 'gray';
  } else if (avgScore >= SENTIMENT_THRESHOLDS.BEARISH) {
    label = 'Somewhat Bearish';
    color = 'yellow';
  } else {
    label = 'Bearish';
    color = 'red';
  }

  return {
    label,
    value: avgScore,
    color,
    confidence
  };
};

/**
 * Generate AI-like insights from sentiment data
 */
export const generateSentimentInsights = (
  overall: OverallSentimentResult,
  momentum: MomentumResult,
  distribution: DistributionResult,
  volatility: VolatilityResult
): SentimentInsights => {
  const insights: SentimentInsights = {
    summary: '',
    keyPoints: [],
    trend: overall.label
  };

  // Generate summary based on overall + momentum
  if (overall.label.includes('Bullish')) {
    insights.summary = momentum.trend === 'up'
      ? `Strong ${overall.label.toLowerCase()} sentiment with improving momentum.`
      : `${overall.label} sentiment but showing signs of weakening.`;
  } else if (overall.label.includes('Bearish')) {
    insights.summary = momentum.trend === 'down'
      ? `Growing ${overall.label.toLowerCase()} sentiment with accelerating decline.`
      : `${overall.label} sentiment but showing signs of stabilization.`;
  } else {
    insights.summary = momentum.trend === 'up'
      ? 'Neutral sentiment with slight bullish momentum.'
      : momentum.trend === 'down'
      ? 'Neutral sentiment with slight bearish momentum.'
      : 'Mixed sentiment with no clear direction.';
  }

  // Generate key points
  const points: string[] = [];

  // Point 1: Distribution insight
  if (distribution.bullish > 50) {
    points.push(`${distribution.bullish}% of articles show bullish sentiment`);
  } else if (distribution.bearish > 50) {
    points.push(`${distribution.bearish}% of articles show bearish sentiment`);
  } else {
    points.push(`Sentiment is evenly distributed across bullish, neutral, and bearish views`);
  }

  // Point 2: Momentum insight
  const momentumText = momentum.trend === 'up'
    ? `Positive momentum with ${momentum.value}% improvement over the period`
    : momentum.trend === 'down'
    ? `Negative momentum with ${Math.abs(momentum.value)}% decline over the period`
    : 'Sentiment remains stable with minimal momentum';
  points.push(momentumText);

  // Point 3: Volatility insight
  const volatilityText = volatility.level === 'High'
    ? 'High volatility indicates rapidly changing sentiment - exercise caution'
    : volatility.level === 'Medium'
    ? 'Moderate sentiment fluctuations - normal market dynamics'
    : 'Stable sentiment with consistent market views';
  points.push(volatilityText);

  // Point 4: Confidence/Reliability
  if (overall.confidence > 0.8) {
    points.push('High confidence in sentiment analysis based on diverse data sources');
  } else if (overall.confidence > 0.6) {
    points.push('Moderate confidence - sentiment trend is clear but with some uncertainty');
  } else {
    points.push('Low confidence - limited data or highly divided sentiment');
  }

  insights.keyPoints = points;
  return insights;
};

/**
 * Format sentiment score for display
 */
export const formatSentimentLabel = (score: number): string => {
  if (score >= SENTIMENT_THRESHOLDS.BULLISH) return 'Bullish';
  if (score >= SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH) return 'Somewhat Bullish';
  if (score >= SENTIMENT_THRESHOLDS.NEUTRAL_LOWER) return 'Neutral';
  if (score >= SENTIMENT_THRESHOLDS.BEARISH) return 'Somewhat Bearish';
  return 'Bearish';
};

/**
 * Get sentiment color for a given score
 */
export const getSentimentColorByScore = (score: number): string => {
  if (score >= SENTIMENT_THRESHOLDS.BULLISH) return 'green';
  if (score >= SENTIMENT_THRESHOLDS.SOMEWHAT_BULLISH) return 'yellow';
  if (score >= SENTIMENT_THRESHOLDS.NEUTRAL_LOWER) return 'gray';
  if (score >= SENTIMENT_THRESHOLDS.BEARISH) return 'yellow';
  return 'red';
};

/**
 * Calculate trend line for chart (linear regression)
 */
export const calculateTrendLine = (data: SentimentDataPoint[]): number[] => {
  if (!data || data.length < 2) return [];

  const values = data.map((d, i) => ({
    x: i,
    y: d.sentiment !== undefined ? d.sentiment : (d.y || 0)
  }));

  // Linear regression
  const n = values.length;
  const sumX = values.reduce((sum, v) => sum + v.x, 0);
  const sumY = values.reduce((sum, v) => sum + v.y, 0);
  const sumXY = values.reduce((sum, v) => sum + v.x * v.y, 0);
  const sumX2 = values.reduce((sum, v) => sum + v.x * v.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return values.map(v => slope * v.x + intercept);
};
