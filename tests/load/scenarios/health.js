/**
 * =============================================================================
 * Health Check Scenario
 * =============================================================================
 * Tests health endpoints (liveness, readiness, main health)
 */

import { check, sleep, group } from 'k6';
import { makeRequest } from '../lib/http-client.js';
import { healthFailRate, healthDuration } from '../lib/metrics.js';
import { endpoints, sleepDurations } from '../lib/data.js';

/**
 * Log response details for debugging (only on errors)
 */
function logOnError(res, name) {
  if (res.status !== 200) {
    const body = res.body ? res.body.substring(0, 200) : 'empty';
    console.log(`[${name}] Status: ${res.status}, Body: ${body}`);
  }
}

/**
 * Health Check Scenario
 * Tests liveness, readiness, and main health endpoints
 */
export function healthCheckScenario() {
  group('Health Endpoints', () => {
    // Liveness probe - is the app running?
    const liveRes = makeRequest(endpoints.health.live, 'liveness');
    healthDuration.add(liveRes.timings.duration);
    const liveOk = check(liveRes, {
      'liveness returns 200': (r) => r.status === 200,
      'liveness has status field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status !== undefined;
        } catch {
          return false;
        }
      },
    });
    healthFailRate.add(!liveOk);
    logOnError(liveRes, 'liveness');

    sleep(sleepDurations.health);

    // Readiness probe - are dependencies ready?
    const readyRes = makeRequest(endpoints.health.ready, 'readiness');
    healthDuration.add(readyRes.timings.duration);
    const readyOk = check(readyRes, {
      'readiness returns 200': (r) => r.status === 200,
    });
    healthFailRate.add(!readyOk);
    logOnError(readyRes, 'readiness');

    sleep(sleepDurations.health);

    // Main health endpoint
    const healthRes = makeRequest(endpoints.health.main, 'health');
    healthDuration.add(healthRes.timings.duration);
    const healthOk = check(healthRes, {
      'health returns 200': (r) => r.status === 200,
    });
    healthFailRate.add(!healthOk);
    logOnError(healthRes, 'health');
  });

  sleep(sleepDurations.standard);
}

/**
 * Quick Health Check (for spike tests - minimal sleep)
 */
export function quickHealthCheck() {
  const liveRes = makeRequest(endpoints.health.live, 'liveness');
  healthDuration.add(liveRes.timings.duration);
  const liveOk = check(liveRes, {
    'liveness returns 200': (r) => r.status === 200,
  });
  healthFailRate.add(!liveOk);

  sleep(sleepDurations.spike);
}
