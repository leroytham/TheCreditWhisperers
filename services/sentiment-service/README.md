# Sentiment Service

Microservice for financial news aggregation and sentiment analysis with momentum tracking.

## Overview

The Sentiment Service aggregates news from multiple sources (Finnhub, NewsAPI, MarketAux, Reuters RSS) and performs sentiment analysis using machine learning models. It calculates sentiment momentum using MACD-style indicators with exponential decay.

## Port

**8003**

## API Endpoints

### Health Checks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/live` | GET | Kubernetes liveness probe |
| `/health/ready` | GET | Kubernetes readiness probe |
| `/health/startup` | GET | Kubernetes startup probe |

### News

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sentiment/news/{ticker}` | GET | Get news articles for ticker |
| `/api/sentiment/news/{ticker}/around-date` | GET | Get news around a specific date |

### Sentiment Analysis

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sentiment/analyze/{ticker}` | GET | Full sentiment analysis with momentum |
| `/api/sentiment/quick/{ticker}` | GET | Quick sentiment score |
| `/api/sentiment/batch/analyze` | POST | Batch analysis for multiple tickers |

### Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sentiment/status/circuit-breakers` | GET | Circuit breaker status |
| `/api/sentiment/status/cache` | GET | Redis cache status |

## Query Parameters

### `/api/sentiment/news/{ticker}`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `count` | int | `100` | Max articles (1-1000) |
| `timeframe` | string | `1M` | Time range (1D, 1W, 1M, 3M, 6M, YTD, 1Y) |

### `/api/sentiment/analyze/{ticker}`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `timeframe` | string | `1M` | Time range for analysis |
| `include_articles` | bool | `false` | Include articles in response |

## Response Fields

### Full Sentiment Analysis

| Field | Description |
|-------|-------------|
| `fast_score` | Short-term sentiment (24h half-life) |
| `slow_score` | Long-term sentiment (168h half-life) |
| `sentiment_momentum` | MACD-style momentum (fast - slow) |
| `momentum_direction` | "bullish", "bearish", or "neutral" |
| `sentiment_volatility` | Sentiment variation |
| `sentiment_breadth_score` | Ratio of bullish vs bearish articles |
| `sentiment_z_score` | Deviation from historical average |
| `source_concentration_hhi` | HHI index for source diversity |
| `dominant_topic` | Most common topic in news |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Service host | `0.0.0.0` |
| `PORT` | Service port | `8003` |
| `DEBUG` | Enable debug mode | `false` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `FINNHUB_API_TOKEN` | Finnhub API token | Required |
| `NEWS_API_KEY` | NewsAPI key | Required |
| `MARKETAUX_API_KEY` | MarketAux API key | Required |
| `NEWS_CACHE_TTL` | News cache TTL (seconds) | `600` |
| `SENTIMENT_CACHE_TTL` | Sentiment cache TTL | `900` |

## News Sources

| Source | Type | Rate Limit |
|--------|------|------------|
| Finnhub | API | 60 calls/min |
| NewsAPI | API | 100 calls/day (free) |
| MarketAux | API | 100 calls/day (free) |
| Reuters | RSS | Unlimited |

## ML Models

| Model | Purpose |
|-------|---------|
| `all-MiniLM-L6-v2` | Text embedding |
| FinBERT | Financial sentiment classification |

## Running

```bash
cd services/sentiment-service

# Install dependencies
pip install -r requirements.txt

# Download ML models (first run)
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Run server
uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload
```

## Example Requests

```bash
# Get news
curl "http://localhost:8003/api/sentiment/news/AAPL?timeframe=1M"

# Full sentiment analysis
curl "http://localhost:8003/api/sentiment/analyze/AAPL?timeframe=1M"

# Quick sentiment
curl "http://localhost:8003/api/sentiment/quick/AAPL"

# Batch analysis
curl -X POST "http://localhost:8003/api/sentiment/batch/analyze?timeframe=1W" \
  -H "Content-Type: application/json" \
  -d '["AAPL", "MSFT", "GOOGL"]'
```

## Related Documentation

- [Services Overview](../README.md)
- [Backend API](../../backend/README.md)
