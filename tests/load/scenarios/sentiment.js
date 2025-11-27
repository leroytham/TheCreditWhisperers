/**
 * =============================================================================
 * Sentiment Analysis Scenario
 * =============================================================================
 * Tests sentiment analysis endpoints
 */

import { check, sleep, group } from 'k6';
import { makeRequest } from '../lib/http-client.js';
import { sentimentFailRate, sentimentDuration } from '../lib/metrics.js';
import { endpoints, sentimentTickers, getRandomTicker, sleepDurations } from '../lib/data.js';

/**
 * Log response details for debugging (only on errors)
 */
function logOnError(res, name) {
  if (res.status !== 200 && res.status !== 429) {
    const body = res.body ? res.body.substring(0, 200) : 'empty';
    console.log(`[${name}] Status: ${res.status}, Body: ${body}`);
  }
}

/**
 * Sentiment Analysis Scenario
 * Tests sentiment endpoints
 * @param {number} sleepTime - Optional custom sleep duration
 */
export function sentimentScenario(sleepTime = sleepDurations.sentiment) {
  group('Sentiment Analysis', () => {
    const randomTicker = getRandomTicker(sentimentTickers);

    const sentimentRes = makeRequest(endpoints.sentiment.ticker(randomTicker), 'ticker_sentiment');
    sentimentDuration.add(sentimentRes.timings.duration);
    const sentimentOk = check(sentimentRes, {
      'sentiment returns 200 or 429': (r) => r.status === 200 || r.status === 429,
    });
    sentimentFailRate.add(!sentimentOk);
    logOnError(sentimentRes, 'ticker_sentiment');
  });

  // Longer sleep to respect rate limits
  sleep(sleepTime);
}

/**
 * Quick Sentiment Check (for spike tests - minimal sleep)
 */
export function quickSentimentCheck() {
  const randomTicker = getRandomTicker(sentimentTickers);
  const sentimentRes = makeRequest(endpoints.sentiment.ticker(randomTicker), 'ticker_sentiment');
  sentimentDuration.add(sentimentRes.timings.duration);
  const sentimentOk = check(sentimentRes, {
    'sentiment returns 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
  sentimentFailRate.add(!sentimentOk);

  sleep(sleepDurations.spike);
}
