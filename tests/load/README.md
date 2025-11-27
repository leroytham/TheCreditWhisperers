# Load Testing

This directory contains k6 load tests for TheCreditWhisperers application.

## Overview

Load tests validate that the application can handle expected traffic patterns and help catch performance regressions before production deployment.

## Directory Structure

```
tests/load/
├── config/
│   └── thresholds.js        # Centralized threshold definitions
├── lib/
│   ├── http-client.js       # HTTP request helpers
│   ├── metrics.js           # Custom k6 metrics
│   └── data.js              # Test data (tickers, endpoints)
├── scenarios/
│   ├── health.js            # Health check scenario
│   ├── market.js            # Market data scenario
│   └── sentiment.js         # Sentiment scenario
├── smoke-test.js            # Quick validation (gates deployment)
├── spike-test.js            # Traffic spike resilience
├── soak-test.js             # Long-running stability
├── load-test.js             # Gradual ramp (HPA testing)
└── README.md
```

## Prerequisites

Install k6 locally for development:

```bash
# macOS
brew install k6

# Windows
choco install k6

# Docker (no installation required)
docker run --rm -i grafana/k6 run - <tests/load/smoke-test.js
```

## Available Tests

### 1. smoke-test.js

Quick validation test that runs before production deployment. **Gates the deployment pipeline.**

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| Health Checks | 5 | 30s | Verify health endpoints respond |
| Market Data | 3 | 30s | Test stock quote endpoint |
| Sentiment | 2 | 20s | Test sentiment analysis |

**Total Duration:** ~45 seconds

**Pass/Fail Thresholds:**
- Overall failure rate < 5%
- p95 response time < 3 seconds
- Health endpoints: p95 < 500ms

---

### 2. spike-test.js

Tests system resilience to sudden traffic bursts (e.g., breaking news).

| Phase | VUs | Duration | Purpose |
|-------|-----|----------|---------|
| Baseline | 5 | 30s | Normal load |
| Spike #1 | 50 | 40s | First traffic spike |
| Recovery | 5 | 40s | Recovery period |
| Spike #2 | 80 | 40s | Larger spike |
| Cooldown | 0 | 30s | Ramp down |

**Total Duration:** ~4 minutes

**Pass/Fail Thresholds (relaxed for spikes):**
- Overall failure rate < 15%
- p95 response time < 5 seconds
- Health endpoints: p99 < 1 second

---

### 3. soak-test.js

Tests system stability over extended periods to detect memory leaks and resource exhaustion.

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| Health | 3 | 30m | Continuous health monitoring |
| Market | 2 | 30m | Steady market data load |
| Sentiment | 2 | 30m | Steady sentiment load |

**Total Duration:** 30 minutes (configurable via `SOAK_DURATION`)

**Pass/Fail Thresholds (strict for stability):**
- Overall failure rate < 2%
- p95 response time < 3 seconds
- Average iteration < 10 seconds

---

### 4. load-test.js (Ramp Test)

Tests system performance under gradually increasing load. Useful for testing HPA auto-scaling.

| Phase | VUs | Duration | Purpose |
|-------|-----|----------|---------|
| Ramp 25% | 8 | 2m | Light load |
| Ramp 50% | 15 | 2m | Medium load |
| Ramp 75% | 23 | 2m | Heavy load |
| Ramp 100% | 30 | 2m | Full load |
| Sustained | 30 | 3m | Peak load |
| Ramp down | 0 | 2m | Cooldown |

**Total Duration:** ~13 minutes

**Pass/Fail Thresholds:**
- Overall failure rate < 5%
- p90 < 2s, p95 < 3s, p99 < 5s
- Throughput > 50 req/s

## Running Tests

### Local Development

```bash
# Run smoke test against local backend
k6 run tests/load/smoke-test.js

# Run against staging
k6 run tests/load/smoke-test.js --env BASE_URL=https://credit-staging.azurewebsites.net

# Run spike test
k6 run tests/load/spike-test.js --env BASE_URL=https://credit-staging.azurewebsites.net

# Run soak test (30 minutes)
k6 run tests/load/soak-test.js --env BASE_URL=https://credit-staging.azurewebsites.net

# Run soak test with custom duration
k6 run tests/load/soak-test.js --env BASE_URL=https://credit-staging.azurewebsites.net --env SOAK_DURATION=1h

# Run load/ramp test
k6 run tests/load/load-test.js --env BASE_URL=https://credit-staging.azurewebsites.net

# Run load test with custom max VUs
k6 run tests/load/load-test.js --env BASE_URL=https://credit-staging.azurewebsites.net --env MAX_VUS=100

# Save results to JSON
k6 run tests/load/smoke-test.js --out json=results.json
```

### With Docker Compose

```bash
# Start the application
docker-compose up -d

# Run smoke tests
k6 run tests/load/smoke-test.js --env BASE_URL=http://localhost:8000

# Run spike test against local
k6 run tests/load/spike-test.js --env BASE_URL=http://localhost:8000
```

### CI/CD Integration

#### Deployment Pipeline (dev-final_credit.yml)

Smoke tests run automatically in the deployment pipeline:
- **Trigger:** On every deployment to staging
- **Gate:** Must pass before production swap
- **Location:** Between health-check and swap-to-production jobs

#### Scheduled Tests (load-tests-scheduled.yml)

Extended tests run on a schedule:

| Test | Schedule | Purpose |
|------|----------|---------|
| Soak Test | Nightly at 2 AM UTC | Detect memory leaks |
| Spike Test | Weekly (Saturday 3 AM UTC) | Test traffic surge resilience |
| Load Test | Weekly (Wednesday 3 AM UTC) | Validate scaling behavior |

**Manual Trigger:** Go to Actions > Scheduled Load Tests > Run workflow

## Understanding Results

### Successful Run

```
     checks.........................: 100.00% ✓ 250      ✗ 0
     data_received..................: 45 kB   1.5 kB/s
     data_sent......................: 12 kB   400 B/s
     http_req_duration..............: avg=120ms p(95)=450ms
     ✓ http_req_failed...............: 0.00%
```

### Failed Run

If thresholds are not met, k6 exits with code 99:

```
     ✗ http_req_duration.............: avg=3500ms p(95)=8000ms
        ✗ p(95)<3000

ERRO[0045] thresholds on metrics 'http_req_duration' have been breached
```

## Adding New Tests

1. Create a new `.js` file in this directory
2. Define scenarios and thresholds using the k6 API
3. Update the GitHub Actions workflow if needed

Example template:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  scenarios: {
    my_scenario: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/endpoint`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

## Rate Limiting Considerations

The application has rate limiting (60 requests/minute per client). Tests are designed to stay within these limits:

- Use `sleep()` between requests
- Distribute load across multiple VUs
- Accept 429 responses as valid in thresholds

## Prometheus Integration (Future)

To export metrics to Prometheus:

```bash
k6 run --out experimental-prometheus-rw tests/load/smoke-test.js
```

Configure `K6_PROMETHEUS_RW_SERVER_URL` environment variable.
