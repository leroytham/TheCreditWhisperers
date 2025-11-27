/**
 * =============================================================================
 * k6 Threshold Configurations
 * =============================================================================
 * Centralized threshold definitions for all k6 load tests.
 * Import the appropriate threshold set based on test type.
 */

// =============================================================================
// BASE THRESHOLDS (Common to all test types)
// =============================================================================

export const baseThresholds = {
  http_req_failed: ['rate<0.05'],           // < 5% failure rate
  http_req_duration: ['p(95)<3000'],         // 95% of requests < 3s
};

// =============================================================================
// ENDPOINT-SPECIFIC THRESHOLDS
// =============================================================================

export const healthThresholds = {
  'health_duration': ['p(95)<500'],          // Health checks < 500ms
  'health_failures': ['rate<0.01'],          // < 1% failure rate
};

export const marketThresholds = {
  'market_duration': ['p(95)<5000'],         // Market data < 5s (external APIs)
  'market_failures': ['rate<0.10'],          // < 10% failure rate (rate limiting)
};

export const sentimentThresholds = {
  'sentiment_duration': ['p(95)<5000'],      // Sentiment < 5s
  'sentiment_failures': ['rate<0.10'],       // < 10% failure rate
};

// =============================================================================
// TEST-TYPE SPECIFIC THRESHOLD SETS
// =============================================================================

/**
 * Smoke Test Thresholds
 * Quick validation - strictest thresholds
 */
export const smokeThresholds = {
  ...baseThresholds,
  ...healthThresholds,
  ...marketThresholds,
  ...sentimentThresholds,
};

/**
 * Spike Test Thresholds
 * Relaxed thresholds to account for sudden traffic bursts
 */
export const spikeThresholds = {
  // Relaxed global thresholds during spikes
  http_req_failed: ['rate<0.15'],            // Allow up to 15% failure during spikes
  http_req_duration: ['p(95)<5000'],          // 5s p95 (relaxed for spikes)

  // Health must stay responsive even during spikes
  'health_duration': ['p(99)<1000'],          // Health < 1s at p99
  'health_failures': ['rate<0.05'],           // < 5% health failures

  // Relaxed for market/sentiment during spikes
  'market_duration': ['p(95)<8000'],
  'market_failures': ['rate<0.20'],
  'sentiment_duration': ['p(95)<8000'],
  'sentiment_failures': ['rate<0.20'],
};

/**
 * Soak Test Thresholds
 * Strict thresholds - performance must NOT degrade over time
 */
export const soakThresholds = {
  // Stricter than baseline for stability testing
  http_req_failed: ['rate<0.02'],            // < 2% failure for soak
  http_req_duration: ['p(95)<3000', 'p(99)<5000'],

  // Track iteration duration to detect degradation
  iteration_duration: ['avg<10000'],          // Average iteration < 10s

  ...healthThresholds,
  ...marketThresholds,
  ...sentimentThresholds,
};

/**
 * Load/Ramp Test Thresholds
 * Standard thresholds for gradual load increase
 */
export const loadThresholds = {
  ...baseThresholds,

  // Additional percentile thresholds for load testing
  http_req_duration: ['p(90)<2000', 'p(95)<3000', 'p(99)<5000'],

  // Throughput threshold
  http_reqs: ['rate>50'],                    // Maintain minimum throughput

  ...healthThresholds,
  ...marketThresholds,
  ...sentimentThresholds,
};
