# app/services/cache_manager.py
"""
Multi-level caching system with request scoping for optimal performance.
L1: Request cache (prevents duplicate work within same request)
L2: Redis cache (shared across requests)
L3: Fallback cache (for circuit breaker scenarios)
"""

import asyncio
import hashlib
import json
import logging
import pickle
import time
from typing import Any, Dict, Optional, Callable, Set
from datetime import datetime, timedelta
from functools import wraps
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class RequestCache:
    """
    L1 Cache: Request-scoped cache that lives for the duration of a single request.
    Prevents duplicate API calls within the same request.
    """

    def __init__(self, request_id: str):
        self.request_id = request_id
        self.cache: Dict[str, Any] = {}
        self.hit_count = 0
        self.miss_count = 0
        self.created_at = time.time()

    def get_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from prefix and arguments."""
        key_parts = [prefix]
        key_parts.extend(str(arg) for arg in args)
        key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
        return ":".join(key_parts)

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if key in self.cache:
            self.hit_count += 1
            logger.debug(f"[L1-CACHE-HIT] {self.request_id}: {key}")
            return self.cache[key]
        self.miss_count += 1
        return None

    def set(self, key: str, value: Any) -> None:
        """Set value in cache."""
        self.cache[key] = value
        logger.debug(f"[L1-CACHE-SET] {self.request_id}: {key}")

    def get_stats(self) -> Dict:
        """Get cache statistics."""
        duration = time.time() - self.created_at
        total_requests = self.hit_count + self.miss_count
        hit_rate = (self.hit_count / total_requests * 100) if total_requests > 0 else 0

        return {
            "request_id": self.request_id,
            "duration_seconds": round(duration, 2),
            "hit_count": self.hit_count,
            "miss_count": self.miss_count,
            "hit_rate": round(hit_rate, 2),
            "cache_size": len(self.cache)
        }


class RedisCache:
    """
    L2 Cache: Redis-based cache shared across requests.
    Provides persistent caching with TTL support.
    """

    def __init__(self, redis_client: Optional[aioredis.Redis] = None):
        self.redis_client = redis_client
        self.enabled = redis_client is not None

    async def get(self, key: str) -> Optional[Any]:
        """Get value from Redis cache."""
        if not self.enabled:
            return None

        try:
            data = await self.redis_client.get(key)
            if data:
                logger.debug(f"[L2-CACHE-HIT] {key}")
                return pickle.loads(data)
        except Exception as e:
            logger.error(f"[L2-CACHE-ERROR] Get failed for {key}: {e}")
        return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        """Set value in Redis cache with TTL."""
        if not self.enabled:
            return

        try:
            data = pickle.dumps(value)
            await self.redis_client.setex(key, ttl, data)
            logger.debug(f"[L2-CACHE-SET] {key} (TTL: {ttl}s)")
        except Exception as e:
            logger.error(f"[L2-CACHE-ERROR] Set failed for {key}: {e}")

    async def delete(self, pattern: str) -> int:
        """Delete keys matching pattern."""
        if not self.enabled:
            return 0

        try:
            keys = await self.redis_client.keys(pattern)
            if keys:
                return await self.redis_client.delete(*keys)
        except Exception as e:
            logger.error(f"[L2-CACHE-ERROR] Delete failed for {pattern}: {e}")
        return 0

    async def clear_user_cache(self, username: str) -> int:
        """Clear all cache entries for a specific user."""
        patterns = [
            f"portfolio:holdings:{username}:*",
            f"portfolio:performance:{username}:*",
            f"portfolio:account:{username}:*"
        ]

        total_deleted = 0
        for pattern in patterns:
            total_deleted += await self.delete(pattern)

        logger.info(f"[L2-CACHE] Cleared {total_deleted} entries for user {username}")
        return total_deleted


class FallbackCache:
    """
    L3 Cache: In-memory fallback cache for circuit breaker scenarios.
    Stores last known good data when external services fail.
    """

    def __init__(self, max_age_seconds: int = 3600):
        self.cache: Dict[str, Tuple[Any, float]] = {}
        self.max_age = max_age_seconds

    def get(self, key: str) -> Optional[Any]:
        """Get value from fallback cache if not expired."""
        if key in self.cache:
            value, timestamp = self.cache[key]
            age = time.time() - timestamp

            if age <= self.max_age:
                logger.info(f"[L3-CACHE-HIT] {key} (age: {age:.0f}s)")
                return value
            else:
                # Remove expired entry
                del self.cache[key]
        return None

    def set(self, key: str, value: Any) -> None:
        """Store value in fallback cache."""
        self.cache[key] = (value, time.time())
        logger.debug(f"[L3-CACHE-SET] {key}")

    def clear_old_entries(self) -> int:
        """Remove expired entries."""
        current_time = time.time()
        expired_keys = [
            key for key, (_, timestamp) in self.cache.items()
            if current_time - timestamp > self.max_age
        ]

        for key in expired_keys:
            del self.cache[key]

        return len(expired_keys)


class CacheManager:
    """
    Unified cache manager that coordinates all cache levels.
    """

    def __init__(self, redis_client: Optional[aioredis.Redis] = None):
        self.l2_cache = RedisCache(redis_client)
        self.l3_cache = FallbackCache()
        self.request_caches: Dict[str, RequestCache] = {}
        self._lock = asyncio.Lock()

    def get_request_cache(self, request_id: str) -> RequestCache:
        """Get or create request cache for given request ID."""
        if request_id not in self.request_caches:
            self.request_caches[request_id] = RequestCache(request_id)
        return self.request_caches[request_id]

    def cleanup_request_cache(self, request_id: str) -> Optional[Dict]:
        """Clean up request cache and return stats."""
        if request_id in self.request_caches:
            stats = self.request_caches[request_id].get_stats()
            del self.request_caches[request_id]
            return stats
        return None

    async def get_with_fallback(
        self,
        key: str,
        fetch_func: Callable,
        ttl: int = 300,
        request_id: Optional[str] = None,
        use_fallback: bool = True
    ) -> Any:
        """
        Get data with multi-level cache fallback.

        Args:
            key: Cache key
            fetch_func: Async function to fetch data if not cached
            ttl: TTL for L2 cache in seconds
            request_id: Request ID for L1 cache
            use_fallback: Whether to use L3 fallback cache

        Returns:
            Cached or fetched data
        """
        # L1: Check request cache
        if request_id:
            request_cache = self.get_request_cache(request_id)
            value = request_cache.get(key)
            if value is not None:
                return value

        # L2: Check Redis cache
        value = await self.l2_cache.get(key)
        if value is not None:
            # Store in L1 for this request
            if request_id:
                request_cache.set(key, value)
            return value

        # Try to fetch fresh data
        try:
            value = await fetch_func()

            # Store in all cache levels
            if value is not None:
                # L1: Request cache
                if request_id:
                    request_cache.set(key, value)

                # L2: Redis cache
                await self.l2_cache.set(key, value, ttl)

                # L3: Fallback cache (for circuit breaker)
                if use_fallback:
                    self.l3_cache.set(key, value)

            return value

        except Exception as e:
            logger.error(f"[CACHE-MANAGER] Fetch failed for {key}: {e}")

            # L3: Try fallback cache on error
            if use_fallback:
                fallback_value = self.l3_cache.get(key)
                if fallback_value is not None:
                    logger.info(f"[CACHE-MANAGER] Using fallback for {key}")
                    return fallback_value

            raise

    async def invalidate_portfolio_cache(self, username: str, account_name: Optional[str] = None):
        """Invalidate portfolio-related cache for a user."""
        patterns = []

        if account_name:
            patterns.extend([
                f"portfolio:holdings:{username}:{account_name}:*",
                f"portfolio:performance:{username}:{account_name}:*",
                f"portfolio:account:{username}:{account_name}:*"
            ])
        else:
            patterns.append(f"portfolio:*:{username}:*")

        total_deleted = 0
        for pattern in patterns:
            total_deleted += await self.l2_cache.delete(pattern)

        logger.info(f"[CACHE-MANAGER] Invalidated {total_deleted} entries for {username}")
        return total_deleted

    def get_stats(self) -> Dict:
        """Get cache statistics across all levels."""
        stats = {
            "l1_request_caches": len(self.request_caches),
            "l1_stats": [
                cache.get_stats() for cache in self.request_caches.values()
            ],
            "l2_enabled": self.l2_cache.enabled,
            "l3_cache_size": len(self.l3_cache.cache)
        }

        # Clean up old entries
        expired_count = self.l3_cache.clear_old_entries()
        if expired_count > 0:
            stats["l3_expired_cleared"] = expired_count

        return stats


def with_smart_cache(
    ttl: int = 300,
    key_prefix: str = "",
    use_fallback: bool = True
):
    """
    Decorator for functions to use smart multi-level caching.

    Args:
        ttl: TTL for L2 cache in seconds
        key_prefix: Prefix for cache keys
        use_fallback: Whether to use L3 fallback cache
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{key_prefix}:{func.__name__}"

            # Add arguments to key
            if args:
                arg_str = ":".join(str(arg) for arg in args)
                cache_key = f"{cache_key}:{arg_str}"

            if kwargs:
                kwarg_str = ":".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
                cache_key = f"{cache_key}:{kwarg_str}"

            # Get request ID from context if available
            request_id = kwargs.pop("_request_id", None)

            # Use cache manager to get data
            cache_manager = kwargs.pop("_cache_manager", None)
            if cache_manager:
                return await cache_manager.get_with_fallback(
                    key=cache_key,
                    fetch_func=lambda: func(*args, **kwargs),
                    ttl=ttl,
                    request_id=request_id,
                    use_fallback=use_fallback
                )
            else:
                # No cache manager, call function directly
                return await func(*args, **kwargs)

        return wrapper
    return decorator


# Global cache manager instance
_global_cache_manager = None

def get_cache_manager() -> CacheManager:
    """Get global cache manager instance."""
    global _global_cache_manager
    if _global_cache_manager is None:
        # Initialize without Redis by default
        # Will be updated when app starts
        _global_cache_manager = CacheManager()
    return _global_cache_manager

def set_cache_manager(cache_manager: CacheManager):
    """Set global cache manager instance."""
    global _global_cache_manager
    _global_cache_manager = cache_manager