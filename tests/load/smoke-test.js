/**
 * =============================================================================
 * TheCreditWhisperers - k6 Smoke Test
 * =============================================================================
 * Quick validation of API endpoints before production deployment.
 *
 * This smoke test runs against the staging environment to verify:
 * - Health endpoints respond correctly
 * - Market data endpoints work
 * - Sentiment endpoints work
 *
 * Usage:
 *   LOCAL:   k6 run tests/load/smoke-test.js
 *   CI:      k6 run tests/load/smoke-test.js --env BASE_URL=https://staging.example.com
 *
 * Pass/Fail Criteria:
 *   - Overall failure rate < 5%
 *   - p95 response time < 3 seconds
 *   - Health endpoints: p95 < 500ms
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

// Custom metrics for detailed analysis
const healthFailRate = new Rate('health_failures');
const marketFailRate = new Rate('market_failures');
const sentimentFailRate = new Rate('sentiment_failures');
const healthDuration = new Trend('health_duration', true);
const marketDuration = new Trend('market_duration', true);
const sentimentDuration = new Trend('sentiment_duration', true);

// =============================================================================
// TEST OPTIONS
// =============================================================================

export const options = {
  // Test scenarios - run different load profiles concurrently
  scenarios: {
    // Health check scenario - lightweight, constant load
    health_checks: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'healthCheckScenario',
      tags: { scenario: 'health' },
    },

    // Market data scenario - moderate load, tests external API integration
    market_data: {
      executor: 'constant-vus',
      vus: 3,
      duration: '30s',
      startTime: '10s', // Start after health checks warm up
      exec: 'marketDataScenario',
      tags: { scenario: 'market' },
    },

    // Sentiment scenario - light load, tests sentiment analysis
    sentiment_analysis: {
      executor: 'constant-vus',
      vus: 2,
      duration: '20s',
      startTime: '15s', // Start after other scenarios
      exec: 'sentimentScenario',
      tags: { scenario: 'sentiment' },
    },
  },

  // Pass/fail thresholds
  thresholds: {
    // Global thresholds
    http_req_failed: ['rate<0.05'],           // < 5% failure rate overall
    http_req_duration: ['p(95)<3000'],         // 95% of requests < 3s

    // Health endpoint thresholds (should be fast)
    'health_duration': ['p(95)<500'],          // Health checks < 500ms
    'health_failures': ['rate<0.01'],          // < 1% failure rate

    // Market data thresholds (external API dependency)
    'market_duration': ['p(95)<5000'],         // Market data < 5s (external APIs)
    'market_failures': ['rate<0.10'],          // < 10% failure rate (rate limiting)

    // Sentiment thresholds
    'sentiment_duration': ['p(95)<5000'],      // Sentiment < 5s
    'sentiment_failures': ['rate<0.10'],       // < 10% failure rate
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Make an HTTP GET request with standard headers
 */
function makeRequest(endpoint, name) {
  const url = `${BASE_URL}${endpoint}`;
  const params = {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'k6-load-test/1.0',
    },
    tags: { name: name },
    timeout: '30s',
  };

  return http.get(url, params);
}

/**
 * Log response details for debugging (only on errors)
 */
function logOnError(res, name) {
  if (res.status !== 200) {
    console.log(`[${name}] Status: ${res.status}, Body: ${res.body.substring(0, 200)}`);
  }
}

// =============================================================================
// TEST SCENARIOS
// =============================================================================

/**
 * Health Check Scenario
 * Tests liveness, readiness, and main health endpoints
 */
export function healthCheckScenario() {
  group('Health Endpoints', () => {
    // Liveness probe - is the app running?
    const liveRes = makeRequest('/health/live', 'liveness');
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

    sleep(0.5);

    // Readiness probe - are dependencies ready?
    const readyRes = makeRequest('/health/ready', 'readiness');
    healthDuration.add(readyRes.timings.duration);
    const readyOk = check(readyRes, {
      'readiness returns 200': (r) => r.status === 200,
    });
    healthFailRate.add(!readyOk);
    logOnError(readyRes, 'readiness');

    sleep(0.5);

    // Main health endpoint
    const healthRes = makeRequest('/health', 'health');
    healthDuration.add(healthRes.timings.duration);
    const healthOk = check(healthRes, {
      'health returns 200': (r) => r.status === 200,
    });
    healthFailRate.add(!healthOk);
    logOnError(healthRes, 'health');
  });

  sleep(1);
}

/**
 * Market Data Scenario
 * Tests stock quote and market data endpoints
 */
export function marketDataScenario() {
  group('Market Data', () => {
    // Test stock quote endpoint
    const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
    const randomTicker = tickers[Math.floor(Math.random() * tickers.length)];

    const quoteRes = makeRequest(`/api/market/quote/${randomTicker}`, 'market_quote');
    marketDuration.add(quoteRes.timings.duration);
    const quoteOk = check(quoteRes, {
      'market quote returns 200 or 429': (r) => r.status === 200 || r.status === 429,
      'market quote has data': (r) => {
        if (r.status === 429) return true; // Rate limited is acceptable
        try {
          const body = JSON.parse(r.body);
          return body !== null;
        } catch {
          return false;
        }
      },
    });
    marketFailRate.add(!quoteOk);
    logOnError(quoteRes, 'market_quote');
  });

  // Longer sleep to respect rate limits (60 req/min)
  sleep(2);
}

/**
 * Sentiment Analysis Scenario
 * Tests sentiment endpoints
 */
export function sentimentScenario() {
  group('Sentiment Analysis', () => {
    const tickers = ['AAPL', 'TSLA', 'NVDA'];
    const randomTicker = tickers[Math.floor(Math.random() * tickers.length)];

    // Test sentiment endpoint
    const sentimentRes = makeRequest(`/api/sentiment/ticker/${randomTicker}`, 'ticker_sentiment');
    sentimentDuration.add(sentimentRes.timings.duration);
    const sentimentOk = check(sentimentRes, {
      'sentiment returns 200 or 429': (r) => r.status === 200 || r.status === 429,
    });
    sentimentFailRate.add(!sentimentOk);
    logOnError(sentimentRes, 'ticker_sentiment');
  });

  // Longer sleep to respect rate limits
  sleep(3);
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Setup function - runs once before test starts
 */
export function setup() {
  console.log(`Starting smoke test against: ${BASE_URL}`);

  // Verify base URL is reachable
  const res = http.get(`${BASE_URL}/health/live`, {
    timeout: '10s',
  });

  if (res.status !== 200) {
    throw new Error(`Base URL not reachable: ${BASE_URL} (status: ${res.status})`);
  }

  console.log('Base URL is reachable, starting tests...');
  return { baseUrl: BASE_URL };
}

/**
 * Teardown function - runs once after test completes
 */
export function teardown(data) {
  console.log(`Smoke test completed against: ${data.baseUrl}`);
}

// =============================================================================
// DEFAULT FUNCTION (for simple k6 run)
// =============================================================================

export default function () {
  healthCheckScenario();
  marketDataScenario();
  sentimentScenario();
}
