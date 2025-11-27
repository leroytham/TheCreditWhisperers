/**
 * =============================================================================
 * TheCreditWhisperers - k6 Load Test (Ramp Test)
 * =============================================================================
 * Tests system performance under gradually increasing load.
 *
 * Purpose:
 *   - Find system breaking points
 *   - Validate SLA compliance under expected load
 *   - Identify performance bottlenecks
 *   - Test HPA auto-scaling behavior
 *
 * Pattern:
 *   - Gradual ramp-up: 0 -> 25% -> 50% -> 75% -> 100% of max load
 *   - Sustained peak period
 *   - Gradual ramp-down
 *
 * Usage:
 *   k6 run tests/load/load-test.js
 *   k6 run tests/load/load-test.js --env BASE_URL=https://staging.example.com
 *   k6 run tests/load/load-test.js --env MAX_VUS=100
 *
 * Duration: ~13 minutes
 */

import { sleep } from 'k6';
import { loadThresholds } from './config/thresholds.js';
import { verifyBaseUrlReachable, getBaseUrl } from './lib/http-client.js';
import { healthCheckScenario } from './scenarios/health.js';
import { marketDataScenario } from './scenarios/market.js';
import { sentimentScenario } from './scenarios/sentiment.js';

// Import metrics to register them
import './lib/metrics.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Configurable max VUs (default 30)
const MAX_VUS = parseInt(__ENV.MAX_VUS) || 30;

// =============================================================================
// TEST OPTIONS
// =============================================================================

export const options = {
  scenarios: {
    // Health checks - constant baseline throughout test
    health_baseline: {
      executor: 'constant-vus',
      vus: 5,
      duration: '13m',
      exec: 'healthLoadScenario',
      tags: { scenario: 'health', test_type: 'load' },
    },

    // Main load test with ramping
    load_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Ramp-up phase (8 minutes)
        { duration: '2m', target: Math.floor(MAX_VUS * 0.25) },  // 25% load
        { duration: '2m', target: Math.floor(MAX_VUS * 0.50) },  // 50% load
        { duration: '2m', target: Math.floor(MAX_VUS * 0.75) },  // 75% load
        { duration: '2m', target: MAX_VUS },                      // 100% load

        // Sustained peak load (3 minutes)
        { duration: '3m', target: MAX_VUS },

        // Ramp-down phase (2 minutes)
        { duration: '2m', target: 0 },
      ],
      exec: 'mainLoadScenario',
      tags: { test_type: 'load' },
    },
  },

  thresholds: loadThresholds,
};

// =============================================================================
// LOAD SCENARIOS
// =============================================================================

/**
 * Health baseline scenario - constant monitoring
 */
export function healthLoadScenario() {
  healthCheckScenario();
}

/**
 * Main load scenario - mixed workload
 * Distribution: 40% health, 35% market, 25% sentiment
 */
export function mainLoadScenario() {
  const rand = Math.random();

  if (rand < 0.40) {
    // Health checks (40%)
    healthCheckScenario();
  } else if (rand < 0.75) {
    // Market data (35%)
    marketDataScenario();
  } else {
    // Sentiment analysis (25%)
    sentimentScenario();
  }
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export function setup() {
  console.log('='.repeat(60));
  console.log('Starting LOAD TEST (Ramp Test)');
  console.log('='.repeat(60));
  console.log('');
  console.log('Configuration:');
  console.log(`  - Max VUs: ${MAX_VUS}`);
  console.log(`  - Health baseline: 5 VUs (constant)`);
  console.log('');
  console.log('Ramp Pattern:');
  console.log(`  - 0-2m:   0 -> ${Math.floor(MAX_VUS * 0.25)} VUs (25%)`);
  console.log(`  - 2-4m:   -> ${Math.floor(MAX_VUS * 0.50)} VUs (50%)`);
  console.log(`  - 4-6m:   -> ${Math.floor(MAX_VUS * 0.75)} VUs (75%)`);
  console.log(`  - 6-8m:   -> ${MAX_VUS} VUs (100%)`);
  console.log(`  - 8-11m:  ${MAX_VUS} VUs (sustained peak)`);
  console.log('  - 11-13m: -> 0 VUs (ramp down)');
  console.log('');
  console.log('Total Duration: ~13 minutes');
  console.log('');
  console.log('Workload Distribution:');
  console.log('  - 40% Health checks');
  console.log('  - 35% Market data');
  console.log('  - 25% Sentiment analysis');
  console.log('');

  return verifyBaseUrlReachable();
}

export function teardown(data) {
  console.log('');
  console.log('='.repeat(60));
  console.log(`Load test completed against: ${data.baseUrl}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('Key metrics to review:');
  console.log('  - http_req_duration p90/p95/p99: Check at each load level');
  console.log('  - http_req_failed: Should be < 5%');
  console.log('  - http_reqs rate: Should maintain > 50 req/s');
  console.log('');
  console.log('Scaling Analysis:');
  console.log('  - At what VU count did latency start to increase?');
  console.log('  - Did HPA trigger pod scaling?');
  console.log('  - What was the throughput ceiling?');
}

// =============================================================================
// DEFAULT FUNCTION
// =============================================================================

export default function () {
  mainLoadScenario();
}
