# Portfolio API Optimization - Integration Instructions

This document provides step-by-step instructions to integrate the optimized portfolio holdings endpoint and supporting infrastructure into your existing application.

## Overview of Changes

The optimization addresses the following issues:
1. **Redundant API calls** - Same ticker fetched multiple times
2. **No request-level caching** - Duplicate work within single request
3. **Uncontrolled concurrency** - Too many parallel API calls
4. **No rate limiting** - Frontend can overwhelm backend
5. **No circuit breaking** - Failed APIs keep getting called

## Files Created

- `app/api/routes_optimized.py` - Optimized portfolio holdings endpoint
- `app/middleware/rate_limiter.py` - Rate limiting middleware
- `app/services/circuit_breaker.py` - Circuit breaker for external APIs
- `app/core/logging_config.py` - Enhanced logging with request tracking

## Integration Steps

### Step 1: Backup Current Implementation

```bash
# Create backup of current routes.py
cp app/api/routes.py app/api/routes_backup.py
```

### Step 2: Replace Portfolio Holdings Endpoint

Replace the existing `get_portfolio_holdings` function in `app/api/routes.py` with the optimized version:

```python
# In app/api/routes.py, replace the entire get_portfolio_holdings function with:

from app.api.routes_optimized import get_portfolio_holdings_optimized

# Comment out or remove the old function:
# @router.get("/portfolio/holdings/{username}/{account_name}")
# async def get_portfolio_holdings(username: str, account_name: str):
#     ... old implementation ...

# Use the optimized version
router.get("/portfolio/holdings/{username}/{account_name}")(get_portfolio_holdings_optimized)
```

### Step 3: Add Rate Limiting Middleware

In your main FastAPI application file (`main.py` or `app.py`):

```python
from fastapi import FastAPI
from app.middleware.rate_limiter import RateLimitMiddleware

app = FastAPI()

# Add rate limiting middleware
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=60,  # Adjust based on your needs
    burst_size=10
)
```

### Step 4: Integrate Circuit Breaker with News Service

Update `app/services/news_service.py` to use the circuit breaker:

```python
# At the top of news_service.py
from app.services.circuit_breaker import alpha_vantage_circuit_breaker

# Modify the get_ticker_news method in NewsService class:
async def get_ticker_news(self, ticker: str, **kwargs):
    """
    Fetch news with circuit breaker protection
    """
    async def _fetch():
        # Your existing news fetching logic
        async with aiohttp.ClientSession() as session:
            return await self._fetch_alpha_vantage_news(
                session, ticker, **kwargs
            )

    # Wrap with circuit breaker
    return await alpha_vantage_circuit_breaker.fetch_news_with_fallback(
        _fetch,
        ticker
    )
```

### Step 5: Setup Enhanced Logging

In your main application file:

```python
from app.core.logging_config import setup_logging, loggers
import logging

# Setup logging at startup
@app.on_event("startup")
async def startup_event():
    # Configure logging
    global loggers
    loggers = setup_logging(
        log_level="INFO",
        log_file="logs/app.log",  # Optional file logging
        enable_structured=True     # JSON structured logs
    )

    logger = loggers["app"]
    logger.info("Application starting up...")
```

### Step 6: Add Request Tracking Middleware

Create a middleware to add request IDs to all requests:

```python
# In app/middleware/request_tracking.py
from fastapi import Request
import uuid
import time

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id

    # Add to logging context
    import logging
    logger = logging.getLogger()
    for handler in logger.handlers:
        handler.addFilter(lambda record: setattr(record, 'request_id', request_id) or True)

    start_time = time.time()
    response = await call_next(request)
    duration = (time.time() - start_time) * 1000

    # Log request performance
    if hasattr(app.state, 'perf_logger'):
        await app.state.perf_logger.log_request(
            request_id=request_id,
            endpoint=request.url.path,
            duration_ms=duration,
            status_code=response.status_code
        )

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration:.0f}ms"

    return response
```

### Step 7: Add Monitoring Endpoints

Add endpoints to monitor system health and performance:

```python
# In app/api/routes.py

@router.get("/admin/circuit-breakers")
async def get_circuit_breaker_status():
    """Get status of all circuit breakers"""
    from app.services.circuit_breaker import alpha_vantage_circuit_breaker

    return {
        "alpha_vantage": alpha_vantage_circuit_breaker.get_status()
    }

@router.get("/admin/performance")
async def get_performance_stats():
    """Get performance statistics"""
    if hasattr(app.state, 'perf_logger'):
        return await app.state.perf_logger.get_stats()
    return {"message": "Performance logging not enabled"}

@router.get("/admin/api-calls")
async def get_api_call_stats():
    """Get external API call statistics"""
    if hasattr(app.state, 'api_call_logger'):
        return await app.state.api_call_logger.get_api_stats()
    return {"message": "API call logging not enabled"}
```

## Environment Variables

Add these to your `.env` file:

```env
# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_BURST_SIZE=10

# Circuit Breaker
CIRCUIT_BREAKER_FAILURE_THRESHOLD=3
CIRCUIT_BREAKER_RECOVERY_TIMEOUT=120
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=2

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/app.log
ENABLE_STRUCTURED_LOGGING=true

# Performance
MAX_CONCURRENT_API_CALLS=5
REQUEST_CACHE_TTL_SECONDS=5
```

## Testing the Optimizations

### 1. Test Request Deduplication

```bash
# Make multiple concurrent requests - should see cache hits in logs
curl -X GET "http://localhost:8000/api/portfolio/holdings/testuser/account1" &
curl -X GET "http://localhost:8000/api/portfolio/holdings/testuser/account1" &
curl -X GET "http://localhost:8000/api/portfolio/holdings/testuser/account1" &
```

### 2. Test Rate Limiting

```python
# Python script to test rate limiting
import asyncio
import aiohttp

async def test_rate_limit():
    async with aiohttp.ClientSession() as session:
        tasks = []
        for i in range(100):
            task = session.get("http://localhost:8000/api/portfolio/holdings/test/account")
            tasks.append(task)

        responses = await asyncio.gather(*tasks, return_exceptions=True)

        rate_limited = sum(1 for r in responses if hasattr(r, 'status') and r.status == 429)
        print(f"Rate limited requests: {rate_limited}/100")

asyncio.run(test_rate_limit())
```

### 3. Test Circuit Breaker

```bash
# Simulate API failures by blocking AlphaVantage domain
# The circuit should open after 3 failures and use cached data

# Check circuit breaker status
curl http://localhost:8000/api/admin/circuit-breakers
```

## Monitoring and Observability

### Log Aggregation

The structured JSON logs can be easily parsed by log aggregation tools:

```bash
# View structured logs
tail -f logs/app.log | jq '.'

# Filter for specific request
tail -f logs/app.log | jq 'select(.request_id=="abc123")'

# View only errors
tail -f logs/app.log | jq 'select(.level=="ERROR")'
```

### Performance Metrics

Monitor key performance indicators:

```bash
# Get performance statistics
curl http://localhost:8000/api/admin/performance

# Get API call statistics
curl http://localhost:8000/api/admin/api-calls
```

## Rollback Plan

If issues occur, rollback to the original implementation:

```bash
# Restore original routes.py
cp app/api/routes_backup.py app/api/routes.py

# Remove middleware from main.py
# Comment out: app.add_middleware(RateLimitMiddleware, ...)

# Restart application
```

## Performance Improvements Expected

After implementing these optimizations, you should see:

1. **50-70% reduction in AlphaVantage API calls** due to deduplication
2. **30-40% faster response times** from request-level caching
3. **Improved stability** during high load from rate limiting
4. **Better resilience** when external APIs fail due to circuit breaker
5. **Enhanced observability** from structured logging and metrics

## Troubleshooting

### Issue: Still seeing duplicate API calls

**Solution**: Check that the frontend isn't making multiple requests. Add debouncing:

```javascript
// Frontend debouncing example
let debounceTimer;
function fetchPortfolioData() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        // Make API call
        fetch('/api/portfolio/holdings/...')
    }, 300); // 300ms debounce
}
```

### Issue: Circuit breaker stays open

**Solution**: Check the recovery timeout and adjust if needed:

```python
# Increase recovery timeout if API is slow to recover
circuit_breaker = CircuitBreaker(
    recovery_timeout=300  # 5 minutes instead of 2
)
```

### Issue: Rate limiting too aggressive

**Solution**: Adjust the rate limit parameters:

```python
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=120,  # Increase limit
    burst_size=20             # Allow more burst traffic
)
```

## Additional Optimizations (Future)

Consider these additional improvements:

1. **Background Job Processing**: Move news fetching to background jobs using Celery or similar
2. **Database Query Optimization**: Add indexes on frequently queried fields
3. **Response Compression**: Enable gzip compression for API responses
4. **CDN Integration**: Cache static responses at CDN level
5. **WebSocket Updates**: Replace polling with WebSocket for real-time updates

## Support

For issues or questions about the optimization:
1. Check the logs for detailed error messages
2. Review the monitoring endpoints for system status
3. Use the rollback plan if immediate recovery is needed