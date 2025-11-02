# Testing Guide - The Credit Whisperers

## Test Suite Overview

This document provides comprehensive information about the test suite for The Credit Whisperers platform.

## Test Coverage Summary

### ✅ **Completed Tests** (5/7 components)

| Component | Location | Tests | Status |
|-----------|----------|-------|--------|
| **Backend: Sentiment Service** | `backend/tests/services/test_sentiment_service.py` | 12 tests | ✅ **100% passing** |
| **Frontend: API Service** | `frontend/src/services/api.test.js` | 20+ tests | ✅ **Complete** |
| **Frontend: Zustand Store** | `frontend/src/store/useAppStore.test.js` | 41 tests | ✅ **100% passing** |
| **Frontend: Test Infrastructure** | `frontend/src/setupTests.js` | N/A | ✅ **Configured** |
| **Documentation** | `README.md`, `TESTING.md` | N/A | ✅ **Complete** |

### ⏳ **Pending Tests** (2/7 components)

| Component | Priority | Estimated Time |
|-----------|----------|----------------|
| Backend: News Service | HIGH | 4-6 hours |
| Backend: API Routes | MEDIUM | 4-6 hours |

---

## Backend Tests

### 1. Sentiment Service Tests ✅

**Location**: `backend/tests/services/test_sentiment_service.py`
**Status**: **12/12 tests passing**

#### Test Coverage

**Exponential Decay Tests:**
- ✅ 7-hour half-life (fast score) decay verification
- ✅ 24-hour half-life (slow score) decay verification
- ✅ Exponential weight formula: `e^(-k × age_hours)`

**Momentum Calculation Tests:**
- ✅ MACD-style momentum (fast - slow) calculation
- ✅ Momentum classification labels (Strong/Weak Positive/Negative)
- ✅ Direction & strength indicators (improving/deteriorating/stable)

**Hybrid Sentiment Analysis:**
- ✅ Alpha Vantage score used as primary source
- ✅ FinBERT fallback for non-Alpha Vantage sources
- ✅ Score normalization within [-1.0, 1.0] bounds

**Data Quality:**
- ✅ Good, low_confidence, insufficient_recent_data indicators
- ✅ Empty data handling
- ✅ Very old article handling

#### Running Tests

```bash
cd backend

# Run all sentiment service tests
python -m pytest tests/services/test_sentiment_service.py -v

# Run specific test
python -m pytest tests/services/test_sentiment_service.py::TestSentimentService::test_exponential_decay_7h_half_life -v

# Run with coverage
python -m pytest tests/services/test_sentiment_service.py --cov=app/services/sentiment_service --cov-report=html
```

#### Sample Output

```
tests/services/test_sentiment_service.py::TestSentimentService::test_analyze_sentiment_positive PASSED
tests/services/test_sentiment_service.py::TestSentimentService::test_analyze_sentiment_empty_text PASSED
tests/services/test_sentiment_service.py::TestSentimentService::test_exponential_decay_7h_half_life PASSED
tests/services/test_sentiment_service.py::TestSentimentService::test_exponential_decay_24h_half_life PASSED
tests/services/test_sentiment_service.py::TestSentimentService::test_sentiment_momentum_calculation PASSED
tests/services/test_sentiment_service.py::TestSentimentService::test_hybrid_sentiment_uses_alpha_vantage_when_available PASSED
tests/services/test_sentiment_service.py::TestSentimentService::test_hybrid_sentiment_uses_finbert_for_fallback PASSED
tests/services/test_sentiment_service.py::TestSentimentService::test_momentum_classification_labels PASSED
tests/services/test_sentiment_service.py::TestSentimentService::test_data_quality_indicators PASSED
tests/services/test_sentiment_service.py::TestSentimentService::test_score_normalization_bounds PASSED

========================= 12 passed in 0.32s =========================
```

---

## Frontend Tests

### 1. API Service Tests ✅

**Location**: `frontend/src/services/api.test.js`
**Status**: **Complete (20+ test cases)**

#### Test Coverage

**Request Interceptor:**
- ✅ Auth token injection from localStorage
- ✅ Missing token handling
- ✅ Request metadata (startTime) tracking

**Response Interceptor:**
- ✅ Success response handling
- ✅ Success notifications for mutations

**Error Handling & Retry Logic:**
- ✅ Network error detection & notification
- ✅ Retry on 429 (rate limit) with exponential backoff
- ✅ Retry on 503 (service unavailable)
- ✅ Respect MAX_RETRIES limit (3 attempts)
- ✅ Exponential backoff verification (1s, 2s, 4s)

**HTTP Status Code Handling:**
- ✅ 401: Clear token & redirect to login
- ✅ 404: Not Found error
- ✅ 500: Server Error (critical priority)
- ✅ 4xx: High priority errors
- ✅ 5xx: Critical priority errors

**API Method Tests:**
- ✅ `getStockPrice` with ticker & timeframe params
- ✅ `getStockSentiment` endpoint verification
- ✅ Empty/no data response handling

#### Running Tests

```bash
cd frontend

# Run API service tests
npm test -- api.test.js --watchAll=false

# Run with coverage
npm test -- api.test.js --coverage --watchAll=false
```

#### Dependencies

- `axios-mock-adapter` - HTTP mocking
- `jest` - Test runner
- `@testing-library/react` - React testing utilities

---

### 2. Zustand Store Tests ✅

**Location**: `frontend/src/store/useAppStore.test.js`
**Status**: **41/41 tests passing**

#### Test Coverage

**Watchlist Management (6 tests):**
- ✅ Add ticker to watchlist
- ✅ Prevent duplicate watchlist entries
- ✅ Remove ticker from watchlist
- ✅ Check if ticker is in watchlist
- ✅ Success notification when adding
- ✅ Info notification when removing

**Price Alerts (5 tests):**
- ✅ Add price alert with defaults
- ✅ Update price alert
- ✅ Toggle price alert active state
- ✅ Remove price alert
- ✅ Get active alerts for ticker

**Notifications (6 tests):**
- ✅ Add notification with timestamp and defaults
- ✅ Mark notification as read
- ✅ Mark all notifications as read
- ✅ Archive notification
- ✅ Get unread count excluding archived
- ✅ Clear all notifications
- ✅ Remove specific notification

**Helper Notification Methods (4 tests):**
- ✅ notifySuccess creates success notification
- ✅ notifyError creates error notification (no auto-dismiss)
- ✅ notifyWarning creates warning notification
- ✅ notifyInfo creates info notification

**Recent Searches (4 tests):**
- ✅ Add recent search to beginning of list
- ✅ Prevent duplicates and move to front
- ✅ Limit recent searches to maxRecentSearches
- ✅ Clear recent searches

**Persistence (4 tests):**
- ✅ Watchlist state maintained in store
- ✅ Price alerts state maintained in store
- ✅ Notifications state maintained in store
- ✅ Store configuration includes partialize

**User State (2 tests):**
- ✅ Set user and authentication state
- ✅ Logout user

**UI State (3 tests):**
- ✅ Toggle theme
- ✅ Toggle sidebar
- ✅ Set sidebar open state

**Preferences (1 test):**
- ✅ Update preferences

**Filters (2 tests):**
- ✅ Update filters
- ✅ Reset filters to defaults

**Cache Management (2 tests):**
- ✅ Set last refresh timestamp
- ✅ Determine if data should refresh

#### Running Tests

```bash
cd frontend

# Run store tests
npm test -- useAppStore.test.js --watchAll=false

# Run with verbose output
npm test -- useAppStore.test.js --watchAll=false --verbose

# Run with coverage
npm test -- useAppStore.test.js --coverage --watchAll=false
```

#### Sample Output

```
PASS src/store/useAppStore.test.js
  useAppStore - Zustand Store
    Watchlist Management
      ✓ adds ticker to watchlist (18 ms)
      ✓ prevents duplicate watchlist entries (5 ms)
      ✓ removes ticker from watchlist (5 ms)
      ✓ checks if ticker is in watchlist (3 ms)
      ✓ shows success notification when adding to watchlist (8 ms)
      ✓ shows info notification when removing from watchlist (3 ms)
    Price Alerts
      ✓ adds price alert with defaults (4 ms)
      ✓ updates price alert (2 ms)
      ✓ toggles price alert active state (3 ms)
      ✓ removes price alert (2 ms)
      ✓ gets active alerts for ticker (2 ms)
    [... 30 more tests ...]

Test Suites: 1 passed, 1 total
Tests:       41 passed, 41 total
Snapshots:   0 total
Time:        2.242 s
```

---

### 3. Test Infrastructure ✅

**Location**: `frontend/src/setupTests.js`

**Configured Features:**
- ✅ `@testing-library/jest-dom` - Custom matchers
- ✅ `jest-localstorage-mock` - LocalStorage mocking

**Installed Dependencies:**
- ✅ `msw` - Mock Service Worker for API mocking
- ✅ `jest-localstorage-mock` - LocalStorage testing
- ✅ `axios-mock-adapter` - Axios HTTP mocking

---

## Test Commands Quick Reference

### Backend

```bash
cd backend

# Run all tests
pytest -v

# Run specific test file
pytest tests/services/test_sentiment_service.py -v

# Run with coverage
pytest --cov=app --cov-report=html --cov-report=term

# Run specific test
pytest tests/services/test_sentiment_service.py::TestSentimentService::test_exponential_decay_7h_half_life -v

# Run tests matching pattern
pytest -k "momentum" -v
```

### Frontend

```bash
cd frontend

# Run all tests
npm test

# Run specific test file
npm test -- api.test.js --watchAll=false

# Run all tests without watch mode
npm test -- --watchAll=false

# Run with coverage
npm test -- --coverage --watchAll=false

# Run in watch mode
npm test -- --watch

# Run with verbose output
npm test -- --verbose --watchAll=false
```

---

## Test Best Practices

### Backend Testing

1. **Mock External APIs**: Always mock Alpha Vantage, Finnhub, NewsAPI, etc.
   ```python
   @patch('app.services.sentiment_service.datetime')
   def test_feature(self, mock_datetime):
       mock_datetime.utcnow.return_value = fixed_date
   ```

2. **Test Edge Cases**: Empty data, very old articles, rate limits
   ```python
   def test_empty_data(self):
       result = self.service.analyze_sentiment_with_weights([])
       self.assertEqual(result["data_quality"], "no_data")
   ```

3. **Verify Calculations**: Test mathematical formulas with known values
   ```python
   # Verify exponential decay: e^(-0.099 × 24) ≈ 0.09
   weights = [a["recency_weight"] for a in articles_meta]
   self.assertAlmostEqual(weights[1], 0.09, delta=0.01)
   ```

### Frontend Testing

1. **Mock HTTP Requests**: Use `axios-mock-adapter`
   ```javascript
   mock.onGet('/test').reply(200, { success: true });
   ```

2. **Test State Persistence**: Verify localStorage integration
   ```javascript
   expect(localStorage.setItem).toHaveBeenCalled();
   ```

3. **Test User Interactions**: Use `act()` for state updates
   ```javascript
   act(() => {
     result.current.addToWatchlist('AAPL');
   });
   ```

---

## Code Coverage Goals

### Backend
- **Target**: 80% overall coverage
- **Critical paths**: 95%+ (sentiment, news, earnings)
- **Models**: 100% (simple, high ROI)
- **API routes**: 85%

### Frontend
- **Target**: 70% overall coverage
- **Utils/Helpers**: 90%+
- **Services**: 95% (API service, etc.)
- **Store**: 85%
- **Hooks**: 80%
- **Components**: 60% (UI heavy)

---

## Continuous Integration

### Recommended GitHub Actions Workflow

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-cov
      - name: Run tests with coverage
        run: |
          cd backend
          pytest --cov=app --cov-report=xml --cov-report=html
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      - name: Run tests with coverage
        run: |
          cd frontend
          npm test -- --coverage --watchAll=false
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

---

## Next Steps

### Immediate (Week 2)
1. ⏳ **News Service Tests** - Multi-source fallback, rate limits, timeframes
2. ⏳ **API Routes Tests** - 5-6 critical endpoint integration tests

### Future Enhancements
3. **Hooks Tests** - `useRollingSentiment`, `usePriceAlerts`
4. **Component Tests** - PriceChart, SentimentChart, NewsCard
5. **Integration Tests** - End-to-end user flows
6. **Performance Tests** - Load testing, memory profiling

---

## Troubleshooting

### Common Issues

**Backend: ModuleNotFoundError**
```bash
# Install missing dependencies
cd backend
pip install -r requirements.txt
```

**Frontend: Tests timeout**
```bash
# Increase Jest timeout
jest.setTimeout(10000);
```

**Frontend: localStorage not working**
```javascript
// Ensure setupTests.js is configured
import 'jest-localstorage-mock';
```

**Backend: Tests fail with Redis error**
```bash
# Mock Redis in tests or start Redis locally
docker run -d -p 6379:6379 redis:latest
```

---

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Pytest Documentation](https://docs.pytest.org/)
- [Zustand Testing Guide](https://github.com/pmndrs/zustand#testing)
- [Axios Mock Adapter](https://github.com/ctimmerm/axios-mock-adapter)

---

## Contributing to Tests

When adding new features, please include corresponding tests:

1. **Write tests first** (TDD approach recommended)
2. **Aim for 80%+ coverage** on new code
3. **Test edge cases** and error scenarios
4. **Keep tests isolated** (no shared state)
5. **Use descriptive test names** (what, when, expected)

---

**Last Updated**: 2025-01-02
**Test Suite Version**: 1.0
**Status**: Production-ready for core features
