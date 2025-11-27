/**
 * =============================================================================
 * TheCreditWhisperers - k6 Spike Test
 * =============================================================================
 * Tests system behavior under sudden traffic spikes.
 *
 * Pattern:
 *   - Baseline load (5 VUs)
 *   - Sudden spike to 50 VUs
 *   - Recovery period
 *   - Second larger spike to 80 VUs
 *   - Ramp down to zero
 *
 * This simulates scenarios like:
 *   - Breaking financial news causing user rush
 *   - Flash sale or viral content
 *   - Marketing campaign spike
 *
 * Usage:
 *   k6 run tests/load/spike-test.js
 *   k6 run tests/load/spike-test.js --env BASE_URL=https://staging.example.com
 *
 * Duration: ~4 minutes
 */

import { sleep } from 'k6';
import { spikeThresholds } from './config/thresholds.js';
import { verifyBaseUrlReachable, getBaseUrl } from './lib/http-client.js';
import { healthCheckScenario, quickHealthCheck } from './scenarios/health.js';
import { marketDataScenario, quickMarketCheck } from './scenarios/market.js';
import { sentimentScenario, quickSentimentCheck } from './scenarios/sentiment.js';

// Import metrics to register them
import './lib/metrics.js';

// =============================================================================
// TEST OPTIONS
// =============================================================================

export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        // Phase 1: Baseline
        { duration: '30s', target: 5 },     // Normal load

        // Phase 2: First spike
        { duration: '10s', target: 50 },    // Spike UP (instant)
        { duration: '30s', target: 50 },    // Sustained spike

        // Phase 3: Recovery
        { duration: '10s', target: 5 },     // Drop DOWN (instant)
        { duration: '30s', target: 5 },     // Recovery period

        // Phase 4: Second spike (larger)
        { duration: '10s', target: 80 },    // Larger spike UP
        { duration: '30s', target: 80 },    // Sustained at peak

        // Phase 5: Ramp down
        { duration: '30s', target: 0 },     // Gradual cooldown
      ],
      exec: 'spikeScenario',
      tags: { test_type: 'spike' },
    },
  },

  thresholds: spikeThresholds,
};

// =============================================================================
// SPIKE SCENARIO
// =============================================================================

/**
 * Main spike test scenario
 * Rotates through different endpoints to distribute load
 */
export function spikeScenario() {
  // Rotate through different endpoints based on iteration
  const iteration = __ITER % 10;

  // Distribution: 40% health, 35% market, 25% sentiment
  if (iteration < 4) {
    // Health checks (fastest, can handle more load)
    quickHealthCheck();
  } else if (iteration < 7) {
    // Market data (external API dependent)
    quickMarketCheck();
  } else {
    // Sentiment (compute intensive)
    quickSentimentCheck();
  }

  // Minimal sleep during spike to maximize pressure
  sleep(0.2);
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export function setup() {
  console.log('='.repeat(60));
  console.log('Starting SPIKE TEST');
  console.log('='.repeat(60));
  console.log('');
  console.log('Test Pattern:');
  console.log('  - Baseline: 5 VUs (30s)');
  console.log('  - Spike #1: 50 VUs (40s)');
  console.log('  - Recovery: 5 VUs (40s)');
  console.log('  - Spike #2: 80 VUs (40s)');
  console.log('  - Cooldown: 0 VUs (30s)');
  console.log('');
  console.log('Total Duration: ~4 minutes');
  console.log('');

  return verifyBaseUrlReachable();
}

export function teardown(data) {
  console.log('');
  console.log('='.repeat(60));
  console.log(`Spike test completed against: ${data.baseUrl}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('Key metrics to review:');
  console.log('  - http_req_failed: Should be < 15% during spikes');
  console.log('  - health_duration p99: Should be < 1s');
  console.log('  - Recovery time: Check if latency normalizes after spikes');
}

// =============================================================================
// DEFAULT FUNCTION
// =============================================================================

export default function () {
  spikeScenario();
}
