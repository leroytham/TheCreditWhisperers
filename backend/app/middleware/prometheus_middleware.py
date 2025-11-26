"""
Prometheus Metrics Middleware

Provides request metrics for monitoring and alerting:
- Request count by endpoint and status
- Request latency histograms
- Active request gauges
- Custom business metrics

Usage:
    from app.middleware.prometheus_middleware import PrometheusMiddleware, metrics
    app.add_middleware(PrometheusMiddleware)

Metrics Endpoint:
    GET /metrics - Prometheus scrape endpoint
"""

import time
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Info,
    generate_latest,
    CONTENT_TYPE_LATEST,
    REGISTRY,
)
import logging

logger = logging.getLogger(__name__)

# =============================================================================
# Metric Definitions
# =============================================================================

# Request counter - tracks total requests by method, endpoint, and status
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
)

# Request latency histogram - tracks request duration
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=(0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0),
)

# Active requests gauge - tracks in-flight requests
ACTIVE_REQUESTS = Gauge(
    "http_requests_active",
    "Number of active HTTP requests",
    ["method", "endpoint"],
)

# Request size histogram
REQUEST_SIZE = Histogram(
    "http_request_size_bytes",
    "HTTP request size in bytes",
    ["method", "endpoint"],
    buckets=(100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000),
)

# Response size histogram
RESPONSE_SIZE = Histogram(
    "http_response_size_bytes",
    "HTTP response size in bytes",
    ["method", "endpoint"],
    buckets=(100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000),
)

# Application info metric
APP_INFO = Info(
    "creditwhisperers_app",
    "Application information",
)

# =============================================================================
# Business Metrics
# =============================================================================

# Stock price fetch counter
STOCK_PRICE_FETCHES = Counter(
    "stock_price_fetches_total",
    "Total stock price API fetches",
    ["symbol", "source", "status"],
)

# Sentiment analysis counter
SENTIMENT_ANALYSIS_COUNT = Counter(
    "sentiment_analysis_total",
    "Total sentiment analyses performed",
    ["symbol", "result"],
)

# Cache hit/miss counter
CACHE_OPERATIONS = Counter(
    "cache_operations_total",
    "Cache operations",
    ["operation", "cache_type", "status"],
)

# WebSocket connections gauge
WEBSOCKET_CONNECTIONS = Gauge(
    "websocket_connections_active",
    "Number of active WebSocket connections",
)

# Portfolio operations counter
PORTFOLIO_OPERATIONS = Counter(
    "portfolio_operations_total",
    "Portfolio operations",
    ["operation", "status"],
)

# External API call latency
EXTERNAL_API_LATENCY = Histogram(
    "external_api_request_duration_seconds",
    "External API request latency",
    ["api_name", "endpoint"],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)

# External API errors
EXTERNAL_API_ERRORS = Counter(
    "external_api_errors_total",
    "External API errors",
    ["api_name", "error_type"],
)


# =============================================================================
# Middleware Class
# =============================================================================

class PrometheusMiddleware(BaseHTTPMiddleware):
    """
    Middleware to collect Prometheus metrics for HTTP requests.

    Metrics collected:
    - Request count by method, endpoint, status
    - Request duration histograms
    - Active request count
    - Request/response sizes
    """

    # Endpoints to exclude from detailed metrics (high cardinality)
    EXCLUDE_PATHS = {"/metrics", "/health", "/health/live", "/health/ready", "/health/startup"}

    def __init__(self, app, app_name: str = "creditwhisperers"):
        super().__init__(app)
        # Set application info
        APP_INFO.info({
            "app_name": app_name,
            "version": "1.0.0",
        })
        logger.info("Prometheus metrics middleware initialized")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip metrics for excluded paths
        path = request.url.path
        if path in self.EXCLUDE_PATHS:
            return await call_next(request)

        # Normalize path to reduce cardinality
        # e.g., /api/stock/AAPL -> /api/stock/{symbol}
        endpoint = self._normalize_path(path)
        method = request.method

        # Track request size
        content_length = request.headers.get("content-length")
        if content_length:
            REQUEST_SIZE.labels(method=method, endpoint=endpoint).observe(int(content_length))

        # Track active requests
        ACTIVE_REQUESTS.labels(method=method, endpoint=endpoint).inc()

        # Measure request duration
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            raise
        finally:
            # Calculate duration
            duration = time.perf_counter() - start_time

            # Record metrics
            REQUEST_COUNT.labels(
                method=method,
                endpoint=endpoint,
                status_code=str(status_code),
            ).inc()

            REQUEST_LATENCY.labels(
                method=method,
                endpoint=endpoint,
            ).observe(duration)

            ACTIVE_REQUESTS.labels(method=method, endpoint=endpoint).dec()

        # Track response size
        response_size = response.headers.get("content-length")
        if response_size:
            RESPONSE_SIZE.labels(method=method, endpoint=endpoint).observe(int(response_size))

        return response

    def _normalize_path(self, path: str) -> str:
        """
        Normalize path to reduce metric cardinality.

        Replaces dynamic segments with placeholders:
        - Stock symbols: /api/stock/AAPL -> /api/stock/{symbol}
        - User IDs: /api/users/123 -> /api/users/{id}
        - Client IDs: /ws/notifications/abc123 -> /ws/notifications/{client_id}
        """
        parts = path.strip("/").split("/")
        normalized = []

        for i, part in enumerate(parts):
            # Check if this looks like a dynamic segment
            if self._is_dynamic_segment(part, i, parts):
                # Determine placeholder name based on context
                if i > 0:
                    prev = parts[i - 1].lower()
                    if prev in ("stock", "stocks", "entity", "company"):
                        normalized.append("{symbol}")
                    elif prev in ("user", "users"):
                        normalized.append("{user_id}")
                    elif prev in ("notification", "notifications"):
                        normalized.append("{client_id}")
                    elif prev in ("portfolio", "portfolios"):
                        normalized.append("{portfolio_id}")
                    else:
                        normalized.append("{id}")
                else:
                    normalized.append("{id}")
            else:
                normalized.append(part)

        return "/" + "/".join(normalized)

    def _is_dynamic_segment(self, part: str, index: int, parts: list) -> bool:
        """
        Determine if a path segment is dynamic (should be normalized).
        """
        # Stock symbols are typically 1-5 uppercase letters
        if part.isupper() and 1 <= len(part) <= 5:
            return True

        # Numeric IDs
        if part.isdigit():
            return True

        # UUIDs or other long alphanumeric strings
        if len(part) > 20 and part.isalnum():
            return True

        # MongoDB ObjectIds (24 hex chars)
        if len(part) == 24:
            try:
                int(part, 16)
                return True
            except ValueError:
                pass

        return False


# =============================================================================
# Metrics Endpoint Helper
# =============================================================================

def get_metrics() -> bytes:
    """
    Generate Prometheus metrics output.

    Returns:
        bytes: Prometheus text format metrics
    """
    return generate_latest(REGISTRY)


def get_metrics_content_type() -> str:
    """
    Get the content type for Prometheus metrics.

    Returns:
        str: Content type string
    """
    return CONTENT_TYPE_LATEST


# =============================================================================
# Business Metric Helpers
# =============================================================================

def record_stock_fetch(symbol: str, source: str, success: bool):
    """Record a stock price fetch operation."""
    STOCK_PRICE_FETCHES.labels(
        symbol=symbol,
        source=source,
        status="success" if success else "failure",
    ).inc()


def record_sentiment_analysis(symbol: str, result: str):
    """Record a sentiment analysis operation."""
    SENTIMENT_ANALYSIS_COUNT.labels(
        symbol=symbol,
        result=result,
    ).inc()


def record_cache_operation(operation: str, cache_type: str, hit: bool):
    """Record a cache operation."""
    CACHE_OPERATIONS.labels(
        operation=operation,
        cache_type=cache_type,
        status="hit" if hit else "miss",
    ).inc()


def record_external_api_call(api_name: str, endpoint: str, duration: float):
    """Record an external API call duration."""
    EXTERNAL_API_LATENCY.labels(
        api_name=api_name,
        endpoint=endpoint,
    ).observe(duration)


def record_external_api_error(api_name: str, error_type: str):
    """Record an external API error."""
    EXTERNAL_API_ERRORS.labels(
        api_name=api_name,
        error_type=error_type,
    ).inc()


def increment_websocket_connections():
    """Increment active WebSocket connections."""
    WEBSOCKET_CONNECTIONS.inc()


def decrement_websocket_connections():
    """Decrement active WebSocket connections."""
    WEBSOCKET_CONNECTIONS.dec()


def record_portfolio_operation(operation: str, success: bool):
    """Record a portfolio operation."""
    PORTFOLIO_OPERATIONS.labels(
        operation=operation,
        status="success" if success else "failure",
    ).inc()
