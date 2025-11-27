/**
 * =============================================================================
 * TheCreditWhisperers - k6 Soak Test
 * =============================================================================
 * Tests system stability over an extended period.
 *
 * Purpose:
 *   - Detect memory leaks
 *   - Identify connection pool exhaustion
 *   - Find resource degradation over time
 *   - Verify consistent performance
 *
 * Pattern:
 *   - Constant moderate load (7 VUs total)
 *   - Extended duration (30 minutes default, configurable)
 *   - Multiple concurrent scenarios
 *
 * Usage:
 *   k6 run tests/load/soak-test.js
 *   k6 run tests/load/soak-test.js --env BASE_URL=https://staging.example.com
 *   k6 run tests/load/soak-test.js --env SOAK_DURATION=2h
 *
 * Default Duration: 30 minutes (configurable via SOAK_DURATION env var)
 */

import { soakThresholds } from './config/thresholds.js';
import { verifyBaseUrlReachable, getBaseUrl } from './lib/http-client.js';
import { healthCheckScenario } from './scenarios/health.js';
import { marketDataScenario } from './scenarios/market.js';
import { sentimentScenario } from './scenarios/sentiment.js';

// Import metrics to register them
import './lib/metrics.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Configurable soak duration (default 30 minutes)
const SOAK_DURATION = __ENV.SOAK_DURATION || '30m';

// =============================================================================
// TEST OPTIONS
// =============================================================================

export const options = {
  scenarios: {
    // Health monitoring - constant throughout soak
    health_soak: {
      executor: 'constant-vus',
      vus: 3,
      duration: SOAK_DURATION,
      exec: 'healthSoakScenario',
      tags: { scenario: 'health', test_type: 'soak' },
    },

    // Market data load - starts after 1 minute warmup
    market_soak: {
      executor: 'constant-vus',
      vus: 2,
      duration: SOAK_DURATION,
      startTime: '1m',
      exec: 'marketSoakScenario',
      tags: { scenario: 'market', test_type: 'soak' },
    },

    // Sentiment load - starts after 1 minute warmup
    sentiment_soak: {
      executor: 'constant-vus',
      vus: 2,
      duration: SOAK_DURATION,
      startTime: '1m',
      exec: 'sentimentSoakScenario',
      tags: { scenario: 'sentiment', test_type: 'soak' },
    },
  },

  thresholds: {
    ...soakThresholds,

    // Additional soak-specific thresholds
    'http_req_duration{scenario:health}': ['p(99)<1000'],
    'iteration_duration': ['avg<10000', 'max<30000'],
  },
};

// =============================================================================
// SOAK SCENARIOS
// =============================================================================

/**
 * Health soak scenario - monitor health endpoints continuously
 */
export function healthSoakScenario() {
  healthCheckScenario();
}

/**
 * Market data soak scenario - continuous market data requests
 */
export function marketSoakScenario() {
  marketDataScenario();
}

/**
 * Sentiment soak scenario - continuous sentiment requests
 */
export function sentimentSoakScenario() {
  sentimentScenario();
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export function setup() {
  console.log('='.repeat(60));
  console.log('Starting SOAK TEST');
  console.log('='.repeat(60));
  console.log('');
  console.log('Configuration:');
  console.log(`  - Duration: ${SOAK_DURATION}`);
  console.log('  - Health VUs: 3 (constant)');
  console.log('  - Market VUs: 2 (starts at 1m)');
  console.log('  - Sentiment VUs: 2 (starts at 1m)');
  console.log('  - Total VUs: 7');
  console.log('');
  console.log('Monitoring for:');
  console.log('  - Memory leaks (response time degradation)');
  console.log('  - Connection pool exhaustion');
  console.log('  - Resource degradation over time');
  console.log('');

  return verifyBaseUrlReachable();
}

export function teardown(data) {
  console.log('');
  console.log('='.repeat(60));
  console.log(`Soak test completed against: ${data.baseUrl}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('Key metrics to review:');
  console.log('  - http_req_failed: Should be < 2%');
  console.log('  - iteration_duration avg: Should be < 10s');
  console.log('  - Response time trend: Should NOT increase over time');
  console.log('');
  console.log('Compare early vs late performance:');
  console.log('  - If late-test latency is significantly higher, investigate memory leaks');
}

// =============================================================================
// DEFAULT FUNCTION
// =============================================================================

export default function () {
  healthSoakScenario();
  marketSoakScenario();
  sentimentSoakScenario();
}
