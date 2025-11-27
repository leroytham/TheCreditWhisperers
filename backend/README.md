# Backend API

FastAPI-based backend service providing REST APIs, WebSocket connections, and business logic for TheCreditWhisperers platform.

## Overview

The backend serves as the main API layer, handling:
- Portfolio management and analytics
- Stock price and market data aggregation
- Sentiment analysis and news processing
- Real-time notifications via WebSocket
- User preferences and alerts

## Prerequisites

- Python 3.12+
- MongoDB 7.0+
- Redis 7.x
- API keys for external services (Alpha Vantage, Finnhub, NewsAPI, MarketAux)

## Directory Structure

```
backend/
├── app/
│   ├── api/                    # API route handlers
│   │   ├── routes.py           # Main API routes
│   │   ├── portfolio_routes.py # Portfolio endpoints
│   │   ├── notification_routes.py # Notification endpoints
│   │   ├── health_routes.py    # Health check endpoints
│   │   ├── metrics_routes.py   # Prometheus metrics
│   │   └── websocket.py        # WebSocket handlers
│   ├── core/                   # Core utilities
│   │   ├── config.py           # Configuration management
│   │   ├── cache.py            # Redis caching
│   │   ├── circuit_breakers.py # Circuit breaker pattern
│   │   ├── http_client.py      # HTTP client utilities
│   │   ├── pubsub.py           # Redis Pub/Sub
│   │   ├── retry.py            # Retry logic
│   │   └── telemetry.py        # OpenTelemetry setup
│   ├── middleware/             # FastAPI middleware
│   │   ├── rate_limiter.py     # Rate limiting
│   │   ├── performance_monitor.py # Performance tracking
│   │   └── prometheus_middleware.py # Metrics collection
│   ├── models/                 # Database models
│   │   ├── portfolio.py        # Portfolio model
│   │   ├── transaction.py      # Transaction model
│   │   ├── notification.py     # Notification model
│   │   ├── sentiment.py        # Sentiment data model
│   │   └── market_data.py      # Market data model
│   ├── schemas/                # Pydantic schemas
│   │   ├── portfolio.py        # Portfolio schemas
│   │   └── notification.py     # Notification schemas
│   ├── services/               # Business logic
│   │   ├── stock_data_service.py       # Stock price data
│   │   ├── sentiment_service.py        # Sentiment analysis
│   │   ├── news_service.py             # News aggregation
│   │   ├── notification_service.py     # Notification delivery
│   │   ├── portfolio_sentiment_service.py # Portfolio sentiment
│   │   ├── portfolio_timeseries_service.py # Time series data
│   │   ├── price_alert_service.py      # Price alerts
│   │   ├── sector_sentiment_service.py # Sector analysis
│   │   ├── earnings_service.py         # Earnings data
│   │   ├── cache_manager.py            # Cache management
│   │   └── circuit_breaker.py          # Resilience patterns
│   ├── config/                 # Configuration files
│   │   ├── scoring.py          # Sentiment scoring config
│   │   └── yfinance_sector_mapping.py # Sector mappings
│   ├── database.py             # Database connections
│   └── main.py                 # Application entry point
├── tests/                      # Test files
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Container image
└── README.md
```

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download NLP models (first run)
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | Database name | `creditwhisperers` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage API key | Required |
| `FINNHUB_API_TOKEN` | Finnhub API token | Required |
| `NEWS_API_KEY` | NewsAPI key | Required |
| `MARKETAUX_API_KEY` | MarketAux API key | Required |
| `SENTRY_DSN` | Sentry error tracking | - |
| `DEBUG` | Enable debug mode | `false` |
| `ENVIRONMENT` | Environment (dev/staging/prod) | `dev` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |

### Cache TTL Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `PRICE_CACHE_TTL` | Stock price cache duration | `300` (5 min) |
| `NEWS_CACHE_TTL` | News cache duration | `600` (10 min) |
| `SENTIMENT_CACHE_TTL` | Sentiment cache duration | `900` (15 min) |

## Running the Server

### Development

```bash
# Run with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or use the development script
python -m uvicorn app.main:app --reload
```

### Production

```bash
# Run with Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## API Endpoints

### Health & Metrics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/health/ready` | GET | Readiness probe |
| `/health/live` | GET | Liveness probe |
| `/metrics` | GET | Prometheus metrics |

> All services use the same health check endpoints. See [services/README.md](../services/README.md#health-checks) for details.

### Stock Data

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/price` | GET | Get stock price data |
| `/api/quote` | GET | Get stock quote |
| `/api/company` | GET | Get company information |
| `/api/search` | GET | Search for tickers |

### Sentiment & News

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sentiment` | GET | Get sentiment for ticker |
| `/api/news` | GET | Get news for ticker |
| `/api/daily-sentiment` | GET | Get daily sentiment breakdown |
| `/api/significant-events` | GET | Get significant events |

### Portfolio

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio` | GET | Get portfolio |
| `/api/portfolio` | POST | Create/update portfolio |
| `/api/portfolio/sentiment` | GET | Get portfolio sentiment |
| `/api/portfolio/timeseries` | GET | Get portfolio time series |

### Notifications

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | Get notifications |
| `/api/notifications/{id}` | DELETE | Delete notification |
| `/api/alerts` | GET | Get price alerts |
| `/api/alerts` | POST | Create price alert |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/ws/notifications/{client_id}` | Real-time notification stream |

## Services

### Stock Data Service

Fetches stock prices from Alpha Vantage and Yahoo Finance with caching and circuit breaker protection.

### Sentiment Service

Analyzes text sentiment using Sentence Transformers (all-MiniLM-L6-v2) and HuggingFace models.

### News Service

Aggregates news from multiple sources (Finnhub, NewsAPI, MarketAux, Reuters RSS) with deduplication.

### Notification Service

Manages WebSocket connections and delivers real-time notifications via Redis Pub/Sub.

### Price Alert Service

Monitors stock prices and triggers alerts when thresholds are crossed.

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_api.py

# Run async tests
pytest -v --asyncio-mode=auto
```

## Database Models

### Portfolio

```python
{
    "user_id": str,
    "holdings": [
        {
            "ticker": str,
            "quantity": float,
            "cost_basis": float,
            "added_date": datetime
        }
    ],
    "created_at": datetime,
    "updated_at": datetime
}
```

### Notification

```python
{
    "user_id": str,
    "type": str,  # "price_alert", "news", "system"
    "title": str,
    "message": str,
    "priority": str,  # "low", "medium", "high", "critical"
    "category": str,
    "is_read": bool,
    "created_at": datetime
}
```

## Middleware

### Rate Limiter

Limits requests to 60 per minute per client IP. Returns 429 when exceeded.

### Performance Monitor

Tracks request duration and logs slow requests (>1s).

### Prometheus Middleware

Collects HTTP request metrics for monitoring.

## Circuit Breakers

External API calls are protected by circuit breakers:

| Circuit | Failure Threshold | Recovery Time |
|---------|------------------|---------------|
| Alpha Vantage | 5 failures | 60 seconds |
| Finnhub | 5 failures | 60 seconds |
| NewsAPI | 5 failures | 60 seconds |
| MarketAux | 5 failures | 60 seconds |

## Troubleshooting

### MongoDB connection failed

```bash
# Verify MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Check connection string
echo $MONGO_URI
```

### Redis connection failed

```bash
# Verify Redis is running
redis-cli ping

# Check connection
redis-cli -h $REDIS_HOST -p $REDIS_PORT
```

### API rate limits exceeded

External APIs have rate limits. The application handles this with:
- Circuit breakers (automatic backoff)
- Response caching (reduces API calls)
- Request queuing (batches requests)

### Slow sentiment analysis

First request loads ML models (~500MB). Subsequent requests use cached models:

```bash
# Pre-load models
python -c "from app.services.sentiment_service import SentimentService; SentimentService()"
```

## API Documentation

Interactive API documentation is available at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

## Related Documentation

- [Root README](../README.md)
- [Services Overview](../services/README.md)
- [Monitoring](../monitoring/README.md)
