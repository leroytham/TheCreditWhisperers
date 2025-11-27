# Monitoring Stack

This directory contains configuration for the Prometheus and Grafana monitoring stack.

## Overview

The monitoring stack provides:

- Metrics collection with Prometheus
- Visualization with Grafana dashboards
- Alerting rules for critical conditions
- Pre-built dashboards for system and business metrics

## Components

```
monitoring/
├── prometheus.yml                    # Prometheus configuration
└── grafana/
    ├── provisioning/
    │   ├── datasources/
    │   │   └── prometheus.yml        # Prometheus datasource
    │   └── dashboards/
    │       └── dashboards.yml        # Dashboard provisioning
    └── dashboards/
        ├── system-overview.json      # System metrics dashboard
        ├── circuit-breakers.json     # Circuit breaker status
        ├── external-apis.json        # External API metrics
        └── business-metrics.json     # Business KPIs
```

## Running

### With Docker Compose

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access services
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001
```

### Access Grafana

- URL: http://localhost:3001
- Default username: `admin`
- Default password: `admin` (change on first login)

## Prometheus Configuration

### Scrape Targets

The `prometheus.yml` configures scraping:

| Target | Endpoint | Interval |
|--------|----------|----------|
| Backend | `backend:8000/metrics` | 15s |
| Frontend | `frontend:3000/metrics` | 30s |
| Market Data Service | `market-data:8002/metrics` | 15s |
| Sentiment Service | `sentiment:8003/metrics` | 15s |
| Notification Service | `notification:8001/metrics` | 15s |
| Portfolio Service | `portfolio:8004/metrics` | 15s |

### Sample Configuration

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  - job_name: 'services'
    static_configs:
      - targets:
          - 'market-data:8002'
          - 'sentiment:8003'
          - 'notification:8001'
          - 'portfolio:8004'
```

## Grafana Dashboards

### System Overview

Monitors overall system health:

| Panel | Description |
|-------|-------------|
| Request Rate | Requests per second by service |
| Error Rate | HTTP 4xx/5xx rate |
| Response Time | p50, p95, p99 latencies |
| CPU Usage | CPU utilization by service |
| Memory Usage | Memory consumption |
| Active Connections | WebSocket connections |

### Circuit Breakers

Monitors circuit breaker status:

| Panel | Description |
|-------|-------------|
| Circuit State | Open/Closed/Half-Open status |
| Failure Count | Recent failures by circuit |
| Success Rate | Success percentage |
| Recovery Time | Time in open state |

### External APIs

Monitors external API integrations:

| Panel | Description |
|-------|-------------|
| API Latency | Response time by API |
| Rate Limit Status | Remaining calls |
| Error Rate | Failures by provider |
| Cache Hit Rate | Cache effectiveness |

### Business Metrics

Monitors business KPIs:

| Panel | Description |
|-------|-------------|
| Active Users | WebSocket connections |
| Portfolio Queries | Portfolio analysis requests |
| Sentiment Requests | Sentiment analysis volume |
| News Articles | Articles processed |

## Metrics

### Backend Metrics

The backend exposes metrics at `/metrics`:

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | Request latency |
| `http_requests_in_progress` | Gauge | Current in-flight requests |
| `circuit_breaker_state` | Gauge | Circuit breaker status |
| `cache_hits_total` | Counter | Cache hit count |
| `cache_misses_total` | Counter | Cache miss count |

### Custom Metrics

Services expose custom business metrics:

| Metric | Description |
|--------|-------------|
| `sentiment_analysis_total` | Sentiment analyses performed |
| `news_articles_processed` | News articles fetched |
| `websocket_connections` | Active WebSocket connections |
| `price_alerts_triggered` | Price alerts fired |

## Alerting

### Alert Rules

Defined in `k8s/prometheus-rules.yaml`:

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | Error rate > 5% for 5m | critical |
| HighLatency | p95 > 3s for 5m | warning |
| ServiceDown | Instance down for 1m | critical |
| CircuitBreakerOpen | Circuit open for 5m | warning |
| HighMemoryUsage | Memory > 90% for 5m | warning |

### Alert Configuration

```yaml
groups:
  - name: creditwhisperers
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
          / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
```

## Adding Dashboards

### Import Dashboard

1. Open Grafana
2. Go to Dashboards > Import
3. Upload JSON file or paste JSON
4. Select Prometheus datasource
5. Click Import

### Create Dashboard

1. Go to Dashboards > New Dashboard
2. Add panels with PromQL queries
3. Save dashboard
4. Export JSON for version control

### Example Panel Query

```promql
# Request rate by service
sum(rate(http_requests_total[5m])) by (service)

# 95th percentile latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
```

## Retention

### Prometheus

Default retention: 15 days

Configure in `prometheus.yml`:

```yaml
storage:
  tsdb:
    retention.time: 30d
    retention.size: 10GB
```

### Grafana

Dashboards are provisioned from files and persisted in volume.

## Kubernetes Integration

For Kubernetes deployment, use Prometheus Operator:

```bash
# Install Prometheus Operator
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --create-namespace

# Apply ServiceMonitor
kubectl apply -f k8s/prometheus-rules.yaml
```

## Troubleshooting

### Prometheus not scraping

```bash
# Check targets
curl http://localhost:9090/targets

# Check service discovery
curl http://localhost:9090/service-discovery
```

### Grafana not loading dashboards

```bash
# Check provisioning logs
docker logs grafana

# Verify dashboard files
ls -la monitoring/grafana/dashboards/
```

### Missing metrics

```bash
# Check metrics endpoint
curl http://localhost:8000/metrics

# Verify Prometheus config
promtool check config monitoring/prometheus.yml
```

## Related Documentation

- [Root README](../README.md)
- [Kubernetes Deployment](../k8s/README.md)
- [Terraform Infrastructure](../terraform/README.md)
