/**
 * =============================================================================
 * k6 Custom Metrics
 * =============================================================================
 * Centralized custom metric definitions for all k6 load tests.
 * Import this module to register all custom metrics.
 */

import { Rate, Trend, Counter } from 'k6/metrics';

// =============================================================================
// FAILURE RATE METRICS
// =============================================================================

/** Health endpoint failure rate */
export const healthFailRate = new Rate('health_failures');

/** Market data endpoint failure rate */
export const marketFailRate = new Rate('market_failures');

/** Sentiment endpoint failure rate */
export const sentimentFailRate = new Rate('sentiment_failures');

// =============================================================================
// DURATION TREND METRICS
// =============================================================================

/** Health endpoint response time trends */
export const healthDuration = new Trend('health_duration', true);

/** Market data endpoint response time trends */
export const marketDuration = new Trend('market_duration', true);

/** Sentiment endpoint response time trends */
export const sentimentDuration = new Trend('sentiment_duration', true);

// =============================================================================
// REQUEST COUNTERS
// =============================================================================

/** Total requests made */
export const totalRequests = new Counter('total_requests');

/** Successful requests (2xx responses) */
export const successfulRequests = new Counter('successful_requests');

/** Failed requests (non-2xx responses, excluding 429) */
export const failedRequests = new Counter('failed_requests');

/** Rate limited requests (429 responses) */
export const rateLimitedRequests = new Counter('rate_limited_requests');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Record metrics for a response
 * @param {object} res - k6 response object
 * @param {string} type - Metric type ('health', 'market', 'sentiment')
 */
export function recordMetrics(res, type) {
  totalRequests.add(1);

  if (res.status >= 200 && res.status < 300) {
    successfulRequests.add(1);
  } else if (res.status === 429) {
    rateLimitedRequests.add(1);
  } else {
    failedRequests.add(1);
  }

  // Record type-specific metrics
  switch (type) {
    case 'health':
      healthDuration.add(res.timings.duration);
      healthFailRate.add(res.status !== 200);
      break;
    case 'market':
      marketDuration.add(res.timings.duration);
      marketFailRate.add(res.status !== 200 && res.status !== 429);
      break;
    case 'sentiment':
      sentimentDuration.add(res.timings.duration);
      sentimentFailRate.add(res.status !== 200 && res.status !== 429);
      break;
  }
}
