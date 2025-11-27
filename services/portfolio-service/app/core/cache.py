# =============================================================================
# Redis Cache Utilities
# =============================================================================

import redis.asyncio as aioredis
import json
import hashlib
from functools import wraps
from typing import Optional, Any
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisCache:
    """Async Redis cache manager."""

    def __init__(self):
        self.async_client: Optional[aioredis.Redis] = None

    async def connect(self):
        """Connect to Redis."""
        try:
            self.async_client = await aioredis.from_url(
                settings.get_redis_url(),
                encoding="utf-8",
                decode_responses=True
            )
            await self.async_client.ping()
            logger.info(f"Connected to Redis at {settings.REDIS_HOST}:{settings.REDIS_PORT}")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}. Caching disabled.")
            self.async_client = None

    async def close(self):
        """Close Redis connection."""
        if self.async_client:
            await self.async_client.close()
            logger.info("Redis connection closed")

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.async_client:
            return None
        try:
            value = await self.async_client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.debug(f"Cache get error for {key}: {e}")
        return None

    async def set(self, key: str, value: Any, ttl: int = 300):
        """Set value in cache with TTL."""
        if not self.async_client:
            return
        try:
            await self.async_client.setex(key, ttl, json.dumps(value, default=str))
        except Exception as e:
            logger.debug(f"Cache set error for {key}: {e}")

    async def delete(self, key: str):
        """Delete key from cache."""
        if not self.async_client:
            return
        try:
            await self.async_client.delete(key)
        except Exception as e:
            logger.debug(f"Cache delete error for {key}: {e}")


redis_cache = RedisCache()


def generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate a consistent cache key from arguments."""
    key_parts = [prefix] + [str(arg) for arg in args]
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}={v}")
    key_str = ":".join(key_parts)
    return hashlib.md5(key_str.encode()).hexdigest()


def async_cache_result(ttl: int, key_prefix: str):
    """Decorator for caching async function results."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = f"{key_prefix}:{generate_cache_key('', *args[1:], **kwargs)}"

            # Try cache first
            cached = await redis_cache.get(cache_key)
            if cached is not None:
                return cached

            # Call function
            result = await func(*args, **kwargs)

            # Cache result
            if result is not None:
                await redis_cache.set(cache_key, result, ttl)

            return result
        return wrapper
    return decorator
