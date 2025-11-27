# Market Data Service

Microservice for stock prices, company information, and market data.

## Overview

The Market Data Service provides real-time and historical stock data by aggregating multiple data sources (Alpha Vantage, Yahoo Finance) with caching and circuit breaker protection.

## Port

**8002**

## API Endpoints

### Health Checks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/live` | GET | Kubernetes liveness probe |
| `/health/ready` | GET | Kubernetes readiness probe |
| `/health/startup` | GET | Kubernetes startup probe |

### Market Data

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/market/quote/{ticker}` | GET | Get current quote for ticker |
| `/api/market/history/{ticker}` | GET | Get historical price data |
| `/api/market/history-range/{ticker}` | GET | Get price data for date range |
| `/api/market/company/{ticker}` | GET | Get company information |
| `/api/market/company/{ticker}/overview` | GET | Get comprehensive company overview |
| `/api/market/sector/{etf}/constituents` | GET | Get ETF constituents |
| `/api/market/batch/quotes` | GET | Get quotes for multiple tickers |

### Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/market/status/circuit-breakers` | GET | Circuit breaker status |

## Query Parameters

### `/api/market/history/{ticker}`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `1y` | Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max) |
| `interval` | string | `1d` | Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo) |
| `timeframe` | string | - | Filter (1D, 1M, 3M, 6M, 1Y, YTD) |

### `/api/market/batch/quotes`

| Parameter | Type | Description |
|-----------|------|-------------|
| `tickers` | string | Comma-separated list of tickers (max 50) |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Service host | `0.0.0.0` |
| `PORT` | Service port | `8002` |
| `DEBUG` | Enable debug mode | `false` |
| `ENVIRONMENT` | Environment name | `development` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage API key | Required |
| `PRICE_CACHE_TTL` | Price cache TTL (seconds) | `300` |
| `COMPANY_CACHE_TTL` | Company info cache TTL | `3600` |

## Data Sources

| Source | Data Type | Rate Limit |
|--------|-----------|------------|
| Alpha Vantage | Company overview, fundamentals | 5 calls/min (free tier) |
| Yahoo Finance | Quotes, historical data, company info | No strict limit |

## Running

```bash
cd services/market-data-service

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

## Docker

```bash
# Build
docker build -t market-data-service .

# Run
docker run -p 8002:8002 \
  -e REDIS_HOST=redis \
  -e ALPHA_VANTAGE_API_KEY=your_key \
  market-data-service
```

## Example Requests

```bash
# Get quote
curl http://localhost:8002/api/market/quote/AAPL

# Get historical data
curl "http://localhost:8002/api/market/history/AAPL?period=1y&interval=1d"

# Get company info
curl http://localhost:8002/api/market/company/AAPL

# Batch quotes
curl "http://localhost:8002/api/market/batch/quotes?tickers=AAPL,MSFT,GOOGL"
```

## Circuit Breakers

| Circuit | Failure Threshold | Recovery Time |
|---------|------------------|---------------|
| Alpha Vantage | 5 failures | 60 seconds |
| Yahoo Finance | 5 failures | 60 seconds |

## Related Documentation

- [Services Overview](../README.md)
- [Backend API](../../backend/README.md)
