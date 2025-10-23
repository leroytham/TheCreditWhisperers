# app/core/cache.py

import json
import hashlib
import redis
from functools import wraps
from typing import Any, Callable, Optional
import asyncio
import pickle
from datetime import timedelta

from .config import settings


class RedisCache:
    """
    Redis cache wrapper with support for both sync and async operations.
    Provides connection pooling, serialization, and error handling.
    """

    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self._async_client: Optional[redis.asyncio.Redis] = None

    @property
    def client(self) -> redis.Redis:
        """Get or create synchronous Redis client."""
        if self._client is None:
            try:
                if settings.REDIS_URL:
                    self._client = redis.from_url(
                        settings.REDIS_URL,
                        decode_responses=False,  # We'll handle serialization
                        socket_connect_timeout=5,
                        socket_timeout=5
                    )
                else:
                    self._client = redis.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        db=settings.REDIS_DB,
                        password=settings.REDIS_PASSWORD,
                        decode_responses=False,
                        socket_connect_timeout=5,
                        socket_timeout=5
                    )
                # Test connection
                self._client.ping()
                print("[OK] Redis connection established successfully")
            except redis.ConnectionError as e:
                print(f"[WARNING] Redis connection failed: {e}. Caching will be disabled.")
                self._client = None
        return self._client

    @property
    def async_client(self) -> Optional[redis.asyncio.Redis]:
        """Get or create asynchronous Redis client."""
        if self._async_client is None:
            try:
                if settings.REDIS_URL:
                    self._async_client = redis.asyncio.from_url(
                        settings.REDIS_URL,
                        decode_responses=False,
                        socket_connect_timeout=5,
                        socket_timeout=5
                    )
                else:
                    self._async_client = redis.asyncio.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        db=settings.REDIS_DB,
                        password=settings.REDIS_PASSWORD,
                        decode_responses=False,
                        socket_connect_timeout=5,
                        socket_timeout=5
                    )
            except Exception as e:
                print(f"[WARNING] Async Redis connection failed: {e}")
                self._async_client = None
        return self._async_client

    def is_available(self) -> bool:
        """Check if Redis is available."""
        try:
            return self.client is not None and self.client.ping()
        except:
            return False

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache with deserialization."""
        if not self.is_available():
            return None

        try:
            value = self.client.get(key)
            if value is None:
                return None
            return pickle.loads(value)
        except Exception as e:
            print(f"Cache get error for key {key}: {e}")
            return None

    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with serialization."""
        if not self.is_available():
            return False

        try:
            serialized = pickle.dumps(value)
            self.client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            print(f"Cache set error for key {key}: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self.is_available():
            return False

        try:
            self.client.delete(key)
            return True
        except Exception as e:
            print(f"Cache delete error for key {key}: {e}")
            return False

    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern."""
        if not self.is_available():
            return 0

        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            print(f"Cache delete pattern error for pattern {pattern}: {e}")
            return 0

    async def aget(self, key: str) -> Optional[Any]:
        """Async get value from cache."""
        if self.async_client is None:
            return None

        try:
            value = await self.async_client.get(key)
            if value is None:
                return None
            return pickle.loads(value)
        except Exception as e:
            print(f"Async cache get error for key {key}: {e}")
            return None

    async def aset(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Async set value in cache."""
        if self.async_client is None:
            return False

        try:
            serialized = pickle.dumps(value)
            await self.async_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            print(f"Async cache set error for key {key}: {e}")
            return False

    async def adelete(self, key: str) -> bool:
        """Async delete key from cache."""
        if self.async_client is None:
            return False

        try:
            await self.async_client.delete(key)
            return True
        except Exception as e:
            print(f"Async cache delete error for key {key}: {e}")
            return False

    def close(self):
        """Close Redis connections."""
        if self._client:
            self._client.close()
        if self._async_client:
            asyncio.run(self._async_client.close())


# Create singleton instance
redis_cache = RedisCache()
redis_client = redis_cache  # Alias for backward compatibility


def generate_cache_key(func_name: str, *args, **kwargs) -> str:
    """
    Generate a unique cache key based on function name and arguments.
    Uses hashing for long argument lists.
    """
    # Convert args and kwargs to a stable string representation
    args_str = ":".join(str(arg) for arg in args)
    kwargs_str = ":".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
    full_key = f"{func_name}:{args_str}:{kwargs_str}"

    # If key is too long, hash it
    if len(full_key) > 200:
        hash_suffix = hashlib.md5(full_key.encode()).hexdigest()[:16]
        return f"{func_name}:{hash_suffix}"

    return full_key


def cache_result(ttl: int = 300, key_prefix: Optional[str] = None):
    """
    Decorator for caching synchronous function results in Redis.

    Args:
        ttl: Time to live in seconds (default 5 minutes)
        key_prefix: Optional prefix for cache key (uses function name if not provided)

    Usage:
        @cache_result(ttl=600)
        def get_stock_data(ticker: str):
            return expensive_operation(ticker)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            prefix = key_prefix or func.__name__
            cache_key = generate_cache_key(prefix, *args, **kwargs)

            # Try to get from cache
            cached = redis_cache.get(cache_key)
            if cached is not None:
                print(f"[CACHE HIT] {cache_key}")
                return cached

            # Execute function
            print(f"[CACHE MISS] {cache_key}")
            result = func(*args, **kwargs)

            # Store in cache
            redis_cache.set(cache_key, result, ttl)

            return result
        return wrapper
    return decorator


def async_cache_result(ttl: int = 300, key_prefix: Optional[str] = None):
    """
    Decorator for caching asynchronous function results in Redis.

    Args:
        ttl: Time to live in seconds (default 5 minutes)
        key_prefix: Optional prefix for cache key (uses function name if not provided)

    Usage:
        @async_cache_result(ttl=600)
        async def get_stock_data(ticker: str):
            return await expensive_operation(ticker)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            prefix = key_prefix or func.__name__
            cache_key = generate_cache_key(prefix, *args, **kwargs)

            # Try to get from cache
            cached = await redis_cache.aget(cache_key)
            if cached is not None:
                print(f"[CACHE HIT] {cache_key}")
                return cached

            # Execute function
            print(f"[CACHE MISS] {cache_key}")
            result = await func(*args, **kwargs)

            # Store in cache
            await redis_cache.aset(cache_key, result, ttl)

            return result
        return wrapper
    return decorator


def invalidate_cache(pattern: str):
    """
    Invalidate all cache keys matching a pattern.

    Args:
        pattern: Redis key pattern (e.g., "get_stock_data:AAPL:*")

    Usage:
        invalidate_cache("get_stock_data:AAPL:*")
    """
    deleted = redis_cache.delete_pattern(pattern)
    if deleted > 0:
        print(f"[CACHE] Invalidated {deleted} cache entries matching pattern: {pattern}")
    return deleted


def cache_with_tags(ttl: int = 300, tags: list[str] = None):
    """
    Advanced caching decorator with tag-based invalidation.

    Args:
        ttl: Time to live in seconds
        tags: List of tags for grouped invalidation

    Usage:
        @cache_with_tags(ttl=600, tags=["stock_data", "AAPL"])
        def get_stock_data(ticker: str):
            return expensive_operation(ticker)

        # Later, invalidate all cached data with tag "AAPL"
        invalidate_by_tag("AAPL")
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = generate_cache_key(func.__name__, *args, **kwargs)

            # Try to get from cache
            cached = redis_cache.get(cache_key)
            if cached is not None:
                return cached

            # Execute function
            result = func(*args, **kwargs)

            # Store in cache
            redis_cache.set(cache_key, result, ttl)

            # Store tags for invalidation
            if tags and redis_cache.is_available():
                for tag in tags:
                    tag_key = f"tag:{tag}"
                    try:
                        redis_cache.client.sadd(tag_key, cache_key)
                        redis_cache.client.expire(tag_key, ttl)
                    except:
                        pass

            return result
        return wrapper
    return decorator


def invalidate_by_tag(tag: str):
    """Invalidate all cache entries with a specific tag."""
    if not redis_cache.is_available():
        return 0

    try:
        tag_key = f"tag:{tag}"
        cache_keys = redis_cache.client.smembers(tag_key)

        if cache_keys:
            # Delete all cached entries
            deleted = redis_cache.client.delete(*cache_keys)
            # Delete the tag set itself
            redis_cache.client.delete(tag_key)
            print(f"[CACHE] Invalidated {deleted} cache entries with tag: {tag}")
            return deleted
        return 0
    except Exception as e:
        print(f"Error invalidating tag {tag}: {e}")
        return 0
