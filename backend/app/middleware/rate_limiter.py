# app/middleware/rate_limiter.py
"""
Rate limiting middleware to prevent API abuse and control request flow
"""

import time
import asyncio
from typing import Dict, Optional, Tuple
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict, deque
from datetime import datetime, timedelta
import logging
import hashlib
import json

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token bucket rate limiter with sliding window tracking
    """

    def __init__(self, requests_per_minute: int = 60, burst_size: int = 10):
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.refill_rate = requests_per_minute / 60.0  # tokens per second
        self.buckets: Dict[str, Tuple[float, float]] = {}  # client_id -> (tokens, last_refill_time)
        self.request_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self._lock = asyncio.Lock()

    def _get_client_id(self, request: Request) -> str:
        """Generate unique client identifier from request"""
        # Try to get username from path parameters
        if "username" in request.path_params:
            return f"user:{request.path_params['username']}"

        # Fallback to IP address
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"

    async def check_rate_limit(self, client_id: str, endpoint: str) -> Tuple[bool, Optional[int]]:
        """
        Check if request is allowed under rate limit
        Returns: (allowed: bool, retry_after_seconds: Optional[int])
        """
        async with self._lock:
            current_time = time.time()

            # Get or create bucket for client
            if client_id not in self.buckets:
                self.buckets[client_id] = (float(self.burst_size), current_time)

            tokens, last_refill = self.buckets[client_id]

            # Refill tokens based on time elapsed
            time_elapsed = current_time - last_refill
            tokens_to_add = time_elapsed * self.refill_rate
            tokens = min(self.burst_size, tokens + tokens_to_add)

            # Check if we have tokens available
            if tokens >= 1.0:
                # Consume a token
                tokens -= 1.0
                self.buckets[client_id] = (tokens, current_time)

                # Track request in history
                self.request_history[client_id].append({
                    "timestamp": current_time,
                    "endpoint": endpoint
                })

                return True, None
            else:
                # Calculate retry after
                tokens_needed = 1.0 - tokens
                retry_after = int(tokens_needed / self.refill_rate) + 1
                return False, retry_after

    def get_client_stats(self, client_id: str) -> Dict:
        """Get rate limit statistics for a client"""
        if client_id not in self.buckets:
            return {
                "tokens_available": self.burst_size,
                "max_tokens": self.burst_size,
                "requests_per_minute": self.requests_per_minute,
                "recent_requests": 0
            }

        tokens, last_refill = self.buckets[client_id]
        current_time = time.time()

        # Calculate current tokens
        time_elapsed = current_time - last_refill
        tokens_to_add = time_elapsed * self.refill_rate
        current_tokens = min(self.burst_size, tokens + tokens_to_add)

        # Count recent requests (last minute)
        one_minute_ago = current_time - 60
        recent_requests = sum(
            1 for req in self.request_history[client_id]
            if req["timestamp"] > one_minute_ago
        )

        return {
            "tokens_available": round(current_tokens, 2),
            "max_tokens": self.burst_size,
            "requests_per_minute": self.requests_per_minute,
            "recent_requests": recent_requests
        }


class PortfolioEndpointRateLimiter:
    """
    Specialized rate limiter for portfolio endpoints with request deduplication
    """

    def __init__(self, cache_ttl_seconds: int = 5):
        self.cache_ttl_seconds = cache_ttl_seconds
        self.request_cache: Dict[str, Tuple[float, any]] = {}  # hash -> (timestamp, response)
        self._lock = asyncio.Lock()

    def _get_request_hash(self, request: Request) -> str:
        """Generate hash for request to detect duplicates"""
        # Create hash from method, path, and query params
        request_data = {
            "method": request.method,
            "path": request.url.path,
            "query": str(request.url.query) if request.url.query else "",
            "username": request.path_params.get("username", ""),
            "account": request.path_params.get("account_name", "")
        }
        request_str = json.dumps(request_data, sort_keys=True)
        return hashlib.md5(request_str.encode()).hexdigest()

    async def check_duplicate(self, request: Request) -> Optional[any]:
        """
        Check if this is a duplicate request within cache TTL
        Returns cached response if duplicate, None otherwise
        """
        request_hash = self._get_request_hash(request)
        current_time = time.time()

        async with self._lock:
            # Clean expired cache entries
            expired_hashes = [
                h for h, (t, _) in self.request_cache.items()
                if current_time - t > self.cache_ttl_seconds
            ]
            for h in expired_hashes:
                del self.request_cache[h]

            # Check if request exists in cache
            if request_hash in self.request_cache:
                timestamp, response = self.request_cache[request_hash]
                if current_time - timestamp <= self.cache_ttl_seconds:
                    logger.info(f"[DUPLICATE-REQUEST] Returning cached response for {request.url.path}")
                    return response

            return None

    async def cache_response(self, request: Request, response: any):
        """Cache response for deduplication"""
        request_hash = self._get_request_hash(request)
        current_time = time.time()

        async with self._lock:
            self.request_cache[request_hash] = (current_time, response)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for rate limiting
    """

    def __init__(self, app, requests_per_minute: int = 60, burst_size: int = 10):
        super().__init__(app)
        self.rate_limiter = RateLimiter(requests_per_minute, burst_size)
        self.portfolio_limiter = PortfolioEndpointRateLimiter(cache_ttl_seconds=5)

        # Endpoints that need special handling
        self.portfolio_endpoints = [
            "/api/portfolio/holdings",
            "/api/portfolio/performance",
            "/api/portfolio/account"
        ]

    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting"""
        try:
            # Skip rate limiting for health checks and static files
            if request.url.path in ["/health", "/docs", "/openapi.json"]:
                return await call_next(request)

            # Get client identifier
            client_id = self.rate_limiter._get_client_id(request)

            # Check for duplicate portfolio requests
            if any(request.url.path.startswith(ep) for ep in self.portfolio_endpoints):
                cached_response = await self.portfolio_limiter.check_duplicate(request)
                if cached_response:
                    logger.info(f"[RATE-LIMIT] Serving cached response for {client_id} -> {request.url.path}")
                    # Return cached response directly
                    from fastapi.responses import JSONResponse
                    return JSONResponse(content=cached_response, headers={
                        "X-Cache-Hit": "true",
                        "X-Rate-Limit-Cached": "true"
                    })

            # Check rate limit
            allowed, retry_after = await self.rate_limiter.check_rate_limit(
                client_id,
                request.url.path
            )

            if not allowed:
                # Get client stats for error message
                stats = self.rate_limiter.get_client_stats(client_id)
                logger.warning(f"[RATE-LIMIT] Request blocked for {client_id} -> {request.url.path}")

                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "Rate limit exceeded",
                        "retry_after_seconds": retry_after,
                        "stats": stats
                    },
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(self.rate_limiter.requests_per_minute),
                        "X-RateLimit-Remaining": "0"
                    }
                )

            # Add rate limit headers to response
            stats = self.rate_limiter.get_client_stats(client_id)
            response = await call_next(request)

            # Add rate limit headers
            response.headers["X-RateLimit-Limit"] = str(self.rate_limiter.requests_per_minute)
            response.headers["X-RateLimit-Remaining"] = str(int(stats["tokens_available"]))
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 60)

            # Cache portfolio responses for deduplication
            if any(request.url.path.startswith(ep) for ep in self.portfolio_endpoints):
                # Note: In production, you'd extract the response body here
                # This is simplified for demonstration
                pass

            return response

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[RATE-LIMIT-ERROR] Middleware error: {e}", exc_info=True)
            # Don't block request on middleware errors
            return await call_next(request)


def create_rate_limiter(app, config: Optional[Dict] = None):
    """
    Factory function to create and configure rate limiter
    """
    config = config or {}
    requests_per_minute = config.get("requests_per_minute", 60)
    burst_size = config.get("burst_size", 10)

    return RateLimitMiddleware(app, requests_per_minute, burst_size)