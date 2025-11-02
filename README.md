# The Credit Whisperers

A sophisticated financial sentiment analysis platform that aggregates news, analyzes sentiment using hybrid AI models, and provides real-time market insights with momentum tracking.

## Features

- **Hybrid Sentiment Analysis**: Combines Alpha Vantage pre-calculated scores with FinBERT ML model fallback
- **MACD-Style Momentum Tracking**: Fast (7h) and Slow (24h) exponential decay scores for trend detection
- **Multi-Source News Aggregation**: Fallback chain across Alpha Vantage → Finnhub → NewsAPI → MarketAux
- **Portfolio Management**: Track watchlists, set price alerts, and manage multi-account portfolios
- **Real-Time Notifications**: WebSocket-based alerts with intelligent categorization
- **Sector Analysis**: Aggregate sentiment across industry sectors with constituent breakdown

## Architecture

### Backend (FastAPI + Python)
- **Framework**: FastAPI 0.119.0
- **Database**: MongoDB (portfolio data)
- **Cache**: Redis (API response caching)
- **External APIs**: Alpha Vantage, yfinance, Finnhub, NewsAPI, MarketAux
- **ML Model**: FinBERT (ProsusAI) for sentiment analysis fallback

### Frontend (React 19)
- **Framework**: React 19.1.1
- **State Management**: Zustand (client state) + TanStack Query (server state)
- **HTTP Client**: Axios with retry logic & exponential backoff
- **Charts**: Recharts + Chart.js
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB
- Redis
- API Keys: Alpha Vantage, Finnhub, NewsAPI, MarketAux

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set REACT_APP_API_URL=http://localhost:8000

# Run the development server
npm start
```

## Testing

### Backend Tests

**Test Coverage:**
- ✅ Sentiment Service (12 tests) - Decay, momentum, hybrid fallback
- ⏳ News Service (expandable) - Multi-source fallback, rate limits
- ⏳ API Routes (expandable) - Endpoint integration tests

**Run Tests:**
```bash
cd backend

# Run all tests
pytest -v

# Run specific test file
pytest tests/services/test_sentiment_service.py -v

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test
pytest tests/services/test_sentiment_service.py::TestSentimentService::test_exponential_decay_7h_half_life -v
```

**Sentiment Service Tests:**
- ✅ Exponential decay (7h & 24h half-lives)
- ✅ MACD-style momentum calculation
- ✅ Hybrid sentiment (Alpha Vantage primary, FinBERT fallback)
- ✅ Score normalization within [-1.0, 1.0]
- ✅ Data quality indicators (good, low_confidence, insufficient_recent_data)

### Frontend Tests

**Test Coverage:**
- ✅ API Service (20+ tests) - Auth, retries, error handling
- ✅ Zustand Store (40+ tests) - Watchlist, alerts, notifications, persistence
- ⏳ Hooks (expandable) - useRollingSentiment, usePriceAlerts

**Run Tests:**
```bash
cd frontend

# Run all tests
npm test

# Run specific test file
npm test -- api.test.js

# Run with coverage
npm test -- --coverage --watchAll=false

# Run in watch mode
npm test -- --watch
```

**API Service Tests:**
- ✅ Request interceptor (auth token injection)
- ✅ Response interceptor (success notifications)
- ✅ Retry logic with exponential backoff (429, 503 errors)
- ✅ Error handling (401, 404, 500, network errors)
- ✅ HTTP status code handling with priority levels

**Zustand Store Tests:**
- ✅ Watchlist management (add, remove, duplicate prevention)
- ✅ Price alerts CRUD (create, update, toggle, delete)
- ✅ Notifications (add, mark read, archive, clear)
- ✅ Helper methods (notifySuccess, notifyError, notifyWarning, notifyInfo)
- ✅ Recent searches (add, limit, clear)
- ✅ localStorage persistence (partialize pattern)
- ✅ User authentication state
- ✅ UI preferences and filters

### Test Files

**Backend:**
```
backend/
├── tests/
│   ├── services/
│   │   ├── test_sentiment_service.py ✅ (12 tests)
│   │   ├── test_news_service.py ⏳ (expandable)
│   │   ├── test_stock_data_service.py
│   │   └── test_market_analysis_service.py
│   ├── api/
│   │   └── test_routes.py ⏳ (expandable)
│   ├── models/
│   │   └── test_*.py
│   └── core/
│       └── test_cache.py
```

**Frontend:**
```
frontend/src/
├── services/
│   └── api.test.js ✅ (20+ tests)
├── store/
│   └── useAppStore.test.js ✅ (40+ tests)
├── hooks/
│   ├── useRollingSentiment.test.js ⏳ (planned)
│   └── usePriceAlerts.test.js ⏳ (planned)
└── setupTests.js ✅ (configured with jest-dom, localStorage mock)
```

## Key Algorithms

### Exponential Decay Weighting

Sentiment scores use time-based decay with configurable half-lives:

```
RecencyWeight = e^(-k × age_hours)
CombinedWeight = relevance_score × RecencyWeight
AggregatedScore = Σ(sentiment × CombinedWeight) / Σ(CombinedWeight)

where k = ln(2) / half_life_hours
```

**Default Half-Lives:**
- **Fast Score**: 7 hours (captures breaking news, intraday sentiment)
- **Slow Score**: 24 hours (stable baseline, daily trend)

**Examples:**
- Article published now: weight = 1.0 (100%)
- Article 7 hours old (fast): weight ≈ 0.5 (50%)
- Article 24 hours old (slow): weight ≈ 0.5 (50%)
- Article 7 days old: weight ≈ 0.04 (4%)

### Sentiment Momentum

MACD-style momentum calculation:

```
Momentum = Fast Score - Slow Score

Classification:
- Strong Positive: momentum > +0.20 (improving rapidly)
- Positive: +0.10 < momentum ≤ +0.20 (improving)
- Neutral: -0.10 ≤ momentum ≤ +0.10 (stable)
- Negative: -0.20 ≤ momentum < -0.10 (deteriorating)
- Strong Negative: momentum < -0.20 (deteriorating rapidly)
```

**Interpretation:**
- Positive momentum: Recent news is more positive than baseline (bullish)
- Negative momentum: Recent news is more negative than baseline (bearish)
- Neutral momentum: Sentiment is stable

## API Endpoints

### Stock Endpoints
- `GET /price?ticker={ticker}&timeframe={timeframe}` - Historical price data
- `GET /stocks/{ticker}/sentiment` - Rolling sentiment with momentum
- `GET /stocks/{ticker}/historical-data?timeframe={timeframe}` - OHLCV data
- `GET /stocks/{ticker}/significant-events?timeframe={timeframe}` - Detected events

### News Endpoints
- `GET /news?ticker={ticker}&timeframe={timeframe}` - Ticker-specific news
- `GET /news/{ticker}/categorized` - Categorized news with sentiment
- `GET /daily-sentiment?ticker={ticker}` - Daily sentiment aggregates

### Sector Endpoints
- `GET /sector/{sector}/news?timeframe={timeframe}` - Sector news aggregation
- `GET /sectors/{sector}/top-constituents` - Top sector constituents

### Portfolio Endpoints
- `POST /portfolio/save` - Save portfolio data
- `GET /portfolio/{user_id}` - Retrieve portfolio
- `PUT /portfolio/{portfolio_id}` - Update portfolio
- `DELETE /portfolio/{portfolio_id}` - Delete portfolio

### Utility Endpoints
- `GET /search-ticker?query={query}` - Search for tickers
- `GET /earnings-calendar?ticker={ticker}` - Upcoming earnings
- `GET /company-overview?ticker={ticker}` - Company fundamentals

## Configuration

### Backend Environment Variables

```bash
# API Keys
ALPHA_VANTAGE_API_KEY=your_key_here
FINNHUB_API_KEY=your_key_here
NEWS_API_KEY=your_key_here
MARKETAUX_API_KEY=your_key_here

# Database
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=credit_whisperers

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Sentiment Configuration
SENTIMENT_HALF_LIFE_FAST_HOURS=7      # Fast score (intraday)
SENTIMENT_HALF_LIFE_SLOW_HOURS=24     # Slow score (daily trend)
MOMENTUM_THRESHOLD_WEAK=0.10          # ±0.10 for weak momentum
MOMENTUM_THRESHOLD_STRONG=0.20        # ±0.20 for strong momentum

# CORS
ALLOWED_ORIGINS=["http://localhost:3000"]
```

### Frontend Environment Variables

```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENABLE_DEVTOOLS=true
```

## Performance Optimization

### Caching Strategy
- **Redis**: API responses cached for 5-60 minutes depending on data type
- **React Query**: Client-side caching with stale-while-revalidate
- **Background Prefetching**: Significant events pre-cached for common timeframes

### Rate Limit Handling
- **Exponential Backoff**: Automatic retry with 1s, 2s, 4s delays
- **Fallback Chain**: Multi-source news aggregation prevents API saturation
- **Request Deduplication**: React Query prevents duplicate requests

## Testing Best Practices

### Backend Testing
1. **Mock External APIs**: Use `unittest.mock` to avoid real API calls
2. **Test Edge Cases**: Empty data, very old articles, rate limits
3. **Verify Calculations**: Mathematical formulas (decay, momentum) with known values
4. **Data Quality**: Test quality indicators for various scenarios

### Frontend Testing
1. **Mock HTTP Requests**: Use `axios-mock-adapter` or MSW
2. **Test State Persistence**: Verify localStorage integration
3. **Test Error Scenarios**: Network errors, 401/404/500 responses
4. **Test User Interactions**: Hooks and store mutations

## Contributing

### Adding Tests

**Backend:**
```python
# tests/services/test_new_service.py
import unittest
from unittest.mock import patch
from app.services.new_service import NewService

class TestNewService(unittest.TestCase):
    def setUp(self):
        self.service = NewService()

    def test_feature(self):
        result = self.service.feature()
        self.assertEqual(result, expected)
```

**Frontend:**
```javascript
// src/services/newService.test.js
import { renderHook, act } from '@testing-library/react';
import useNewHook from './useNewHook';

describe('useNewHook', () => {
  test('does something', () => {
    const { result } = renderHook(() => useNewHook());
    expect(result.current.value).toBe(expected);
  });
});
```

## Deployment

### Backend Deployment
```bash
# Build Docker image
docker build -t credit-whisperers-backend .

# Run with docker-compose
docker-compose up -d
```

### Frontend Deployment
```bash
# Build production bundle
npm run build

# Serve static files
npx serve -s build
```

## License

MIT License

## Contact

For questions or support, please open an issue on GitHub.

---

## Quick Reference

### Test Commands
```bash
# Backend
cd backend && pytest -v
cd backend && pytest --cov=app --cov-report=html

# Frontend
cd frontend && npm test
cd frontend && npm test -- --coverage --watchAll=false
```

### Development Commands
```bash
# Backend
cd backend && uvicorn app.main:app --reload

# Frontend
cd frontend && npm start
```

### Sentiment Score Ranges
- **Bullish**: ≥ +0.35
- **Somewhat-Bullish**: +0.15 to +0.35
- **Neutral**: -0.15 to +0.15
- **Somewhat-Bearish**: -0.35 to -0.15
- **Bearish**: ≤ -0.35

### Momentum Ranges
- **Strong Positive**: > +0.20
- **Positive**: +0.10 to +0.20
- **Neutral**: -0.10 to +0.10
- **Negative**: -0.20 to -0.10
- **Strong Negative**: < -0.20
