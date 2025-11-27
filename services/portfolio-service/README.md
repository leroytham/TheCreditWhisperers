# Portfolio Service

Microservice for portfolio aggregation, sentiment analysis, and time series analytics.

## Overview

The Portfolio Service aggregates data from Market Data Service and Sentiment Service to provide portfolio-level analytics including weighted sentiment scores and historical value time series.

## Port

**8004**

## Dependencies

This service depends on other microservices:

| Service | Purpose |
|---------|---------|
| Market Data Service (8002) | Stock quotes and historical prices |
| Sentiment Service (8003) | Sentiment scores and news |

## API Endpoints

### Health Checks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/live` | GET | Kubernetes liveness probe |
| `/health/ready` | GET | Kubernetes readiness probe (checks downstream services) |
| `/health/startup` | GET | Kubernetes startup probe |

### Portfolio Sentiment

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio/sentiment` | POST | Get aggregated portfolio sentiment |
| `/api/portfolio/sentiment/quick` | POST | Quick portfolio sentiment summary |

### Portfolio Time Series

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio/timeseries` | POST | Get portfolio value history |
| `/api/portfolio/benchmark` | GET | Get benchmark index data |

### Holdings Data

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio/holdings/{ticker}/quote` | GET | Get quote for holding |
| `/api/portfolio/holdings/quotes` | POST | Batch quotes for holdings |
| `/api/portfolio/holdings/{ticker}/sentiment` | GET | Get sentiment for holding |
| `/api/portfolio/holdings/{ticker}/news` | GET | Get news for holding |

### Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio/status/services` | GET | Downstream service status |

## Request Bodies

### Portfolio Sentiment Request

```json
{
  "holdings": [
    {
      "ticker": "AAPL",
      "quantity": 100,
      "cost_basis": 150.00
    },
    {
      "ticker": "MSFT",
      "quantity": 50,
      "cost_basis": 300.00
    }
  ],
  "timeframe": "1M"
}
```

### Portfolio Time Series Request

```json
{
  "holdings": [
    {
      "ticker": "AAPL",
      "quantity": 100
    }
  ],
  "timeframe": "1Y"
}
```

## Response Fields

### Portfolio Sentiment

| Field | Description |
|-------|-------------|
| `slow_score` | Weighted portfolio sentiment |
| `sentiment_momentum` | Portfolio momentum |
| `momentum_label` | Direction label |
| `valid_holdings` | Holdings with sentiment data |
| `coverage` | Percentage of portfolio covered |
| `data_quality` | Quality indicator |
| `holdings_sentiment` | Per-holding breakdown |

### Portfolio Time Series

| Field | Description |
|-------|-------------|
| `timeframe` | Requested timeframe |
| `data_points` | Array of {date, value} |
| `start_value` | Initial portfolio value |
| `end_value` | Current portfolio value |
| `change_percent` | Total return percentage |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Service host | `0.0.0.0` |
| `PORT` | Service port | `8004` |
| `DEBUG` | Enable debug mode | `false` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `MARKET_DATA_SERVICE_URL` | Market Data Service URL | `http://localhost:8002` |
| `SENTIMENT_SERVICE_URL` | Sentiment Service URL | `http://localhost:8003` |
| `PORTFOLIO_CACHE_TTL` | Portfolio cache TTL | `300` |

## Running

```bash
cd services/portfolio-service

# Install dependencies
pip install -r requirements.txt

# Ensure downstream services are running
# Market Data Service on port 8002
# Sentiment Service on port 8003

# Run server
uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload
```

## Example Requests

```bash
# Portfolio sentiment
curl -X POST "http://localhost:8004/api/portfolio/sentiment" \
  -H "Content-Type: application/json" \
  -d '{
    "holdings": [
      {"ticker": "AAPL", "quantity": 100, "cost_basis": 150},
      {"ticker": "MSFT", "quantity": 50, "cost_basis": 300}
    ],
    "timeframe": "1M"
  }'

# Portfolio time series
curl -X POST "http://localhost:8004/api/portfolio/timeseries" \
  -H "Content-Type: application/json" \
  -d '{
    "holdings": [
      {"ticker": "AAPL", "quantity": 100},
      {"ticker": "MSFT", "quantity": 50}
    ],
    "timeframe": "1Y"
  }'

# Benchmark comparison
curl "http://localhost:8004/api/portfolio/benchmark?timeframe=1Y&ticker=^GSPC"

# Service status
curl "http://localhost:8004/api/portfolio/status/services"
```

## Related Documentation

- [Services Overview](../README.md)
- [Market Data Service](../market-data-service/README.md)
- [Sentiment Service](../sentiment-service/README.md)
