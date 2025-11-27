# Load Testing

This directory contains k6 load tests for TheCreditWhisperers application.

## Overview

Load tests validate that the application can handle expected traffic patterns and help catch performance regressions before production deployment.

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

### smoke-test.js

Quick validation test that runs before production deployment.

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

## Running Tests

### Local Development

```bash
# Run against local backend
k6 run tests/load/smoke-test.js

# Run against staging
k6 run tests/load/smoke-test.js --env BASE_URL=https://credit-staging.azurewebsites.net

# Run with summary output
k6 run tests/load/smoke-test.js --out json=results.json
```

### With Docker Compose

```bash
# Start the application
docker-compose up -d

# Run smoke tests
k6 run tests/load/smoke-test.js --env BASE_URL=http://localhost:8000
```

### CI/CD (GitHub Actions)

Smoke tests run automatically in the deployment pipeline between health-check and production swap.

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
