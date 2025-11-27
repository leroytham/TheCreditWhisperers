# =============================================================================
# Redis Cache Utilities
# =============================================================================

import redis
import json
import pickle
import hashlib
from functools import wraps
from typing import Optional, Any, Callable
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Redis client singleton
_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> Optional[redis.Redis]:
    """Get or create Redis client."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                settings.get_redis_url(),
                decode_responses=False
            )
            _redis_client.ping()
            logger.info("Connected to Redis cache")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            _redis_client = None
    return _redis_client


def _generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate a unique cache key from function arguments."""
    key_parts = [prefix]
    for arg in args:
        if hasattr(arg, '__dict__'):
            key_parts.append(str(arg.__class__.__name__))
        else:
            key_parts.append(str(arg))
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}={v}")

    key_string = ":".join(key_parts)
    if len(key_string) > 200:
        key_hash = hashlib.md5(key_string.encode()).hexdigest()
        return f"{prefix}:{key_hash}"
    return key_string


def cache_result(ttl: int, key_prefix: str):
    """
    Decorator to cache function results in Redis.
    For synchronous functions.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            redis_client = get_redis_client()
            if redis_client is None:
                return func(*args, **kwargs)

            # Skip 'self' in cache key for methods
            cache_args = args[1:] if args and hasattr(args[0], '__class__') else args
            cache_key = _generate_cache_key(key_prefix, *cache_args, **kwargs)

            try:
                cached = redis_client.get(cache_key)
                if cached:
                    return pickle.loads(cached)
            except Exception as e:
                logger.warning(f"Cache read error: {e}")

            result = func(*args, **kwargs)

            if result is not None:
                try:
                    redis_client.setex(cache_key, ttl, pickle.dumps(result))
                except Exception as e:
                    logger.warning(f"Cache write error: {e}")

            return result
        return wrapper
    return decorator


def async_cache_result(ttl: int, key_prefix: str):
    """
    Decorator to cache async function results in Redis.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            redis_client = get_redis_client()
            if redis_client is None:
                return await func(*args, **kwargs)

            cache_args = args[1:] if args and hasattr(args[0], '__class__') else args
            cache_key = _generate_cache_key(key_prefix, *cache_args, **kwargs)

            try:
                cached = redis_client.get(cache_key)
                if cached:
                    return pickle.loads(cached)
            except Exception as e:
                logger.warning(f"Cache read error: {e}")

            result = await func(*args, **kwargs)

            if result is not None:
                try:
                    redis_client.setex(cache_key, ttl, pickle.dumps(result))
                except Exception as e:
                    logger.warning(f"Cache write error: {e}")

            return result
        return wrapper
    return decorator
