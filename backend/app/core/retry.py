# =============================================================================
# TheCreditWhisperers - Retry Logic with Exponential Backoff
# =============================================================================
# Provides resilient API calls with automatic retry on transient failures.
# Implements exponential backoff to avoid overwhelming failing services.
#
# Usage:
#   from app.core.retry import with_retry, RetryableError
#
#   @with_retry(max_retries=3, base_delay=0.1)
#   async def fetch_data():
#       response = await client.get(url)
#       return response.json()

import asyncio
import logging
import random
from functools import wraps
from typing import Callable, Optional, Tuple, Type, TypeVar, Union
from datetime import datetime

import aiohttp

logger = logging.getLogger(__name__)

# Type variable for generic return type
T = TypeVar('T')


# =============================================================================
# Custom Exceptions
# =============================================================================

class RetryableError(Exception):
    """Exception that signals the operation should be retried."""
    pass


class MaxRetriesExceeded(Exception):
    """Raised when all retry attempts have been exhausted."""

    def __init__(self, message: str, last_exception: Optional[Exception] = None):
        super().__init__(message)
        self.last_exception = last_exception


# =============================================================================
# Default Retryable Exceptions
# =============================================================================

# Exceptions that should trigger a retry (transient failures)
DEFAULT_RETRYABLE_EXCEPTIONS: Tuple[Type[Exception], ...] = (
    aiohttp.ClientError,           # Network errors, timeouts
    aiohttp.ServerTimeoutError,    # Server timeout
    asyncio.TimeoutError,          # Async timeout
    ConnectionError,               # Connection refused, reset
    TimeoutError,                  # General timeout
    RetryableError,                # Explicitly marked as retryable
)

# HTTP status codes that should trigger a retry
RETRYABLE_STATUS_CODES = {
    408,  # Request Timeout
    429,  # Too Many Requests (rate limited)
    500,  # Internal Server Error
    502,  # Bad Gateway
    503,  # Service Unavailable
    504,  # Gateway Timeout
}


# =============================================================================
# Retry Decorator
# =============================================================================

def with_retry(
    max_retries: int = 3,
    base_delay: float = 0.1,
    max_delay: float = 10.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: Optional[Tuple[Type[Exception], ...]] = None,
    on_retry: Optional[Callable[[Exception, int, float], None]] = None,
):
    """
    Decorator that adds retry logic with exponential backoff to async functions.

    Args:
        max_retries: Maximum number of retry attempts (default: 3)
        base_delay: Initial delay in seconds (default: 0.1)
        max_delay: Maximum delay cap in seconds (default: 10.0)
        exponential_base: Base for exponential calculation (default: 2.0)
        jitter: Add random jitter to prevent thundering herd (default: True)
        retryable_exceptions: Tuple of exception types to retry on
        on_retry: Callback function called on each retry (exception, attempt, delay)

    Returns:
        Decorated function with retry logic

    Example:
        @with_retry(max_retries=3, base_delay=0.5)
        async def fetch_stock_price(symbol: str):
            async with aiohttp.ClientSession() as session:
                async with session.get(f"https://api.example.com/price/{symbol}") as resp:
                    if resp.status in RETRYABLE_STATUS_CODES:
                        raise RetryableError(f"Server returned {resp.status}")
                    return await resp.json()
    """
    if retryable_exceptions is None:
        retryable_exceptions = DEFAULT_RETRYABLE_EXCEPTIONS

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            last_exception: Optional[Exception] = None

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)

                except retryable_exceptions as e:
                    last_exception = e

                    # If this was the last attempt, raise
                    if attempt >= max_retries:
                        logger.error(
                            f"[Retry] {func.__name__} failed after {max_retries + 1} attempts. "
                            f"Last error: {type(e).__name__}: {e}"
                        )
                        raise MaxRetriesExceeded(
                            f"Function {func.__name__} failed after {max_retries + 1} attempts",
                            last_exception=e
                        ) from e

                    # Calculate delay with exponential backoff
                    delay = min(base_delay * (exponential_base ** attempt), max_delay)

                    # Add jitter (0-50% of delay) to prevent thundering herd
                    if jitter:
                        delay = delay * (1 + random.random() * 0.5)

                    logger.warning(
                        f"[Retry] {func.__name__} attempt {attempt + 1}/{max_retries + 1} failed: "
                        f"{type(e).__name__}: {e}. Retrying in {delay:.2f}s..."
                    )

                    # Call on_retry callback if provided
                    if on_retry:
                        on_retry(e, attempt + 1, delay)

                    # Wait before retrying
                    await asyncio.sleep(delay)

                except Exception as e:
                    # Non-retryable exception - fail immediately
                    logger.error(
                        f"[Retry] {func.__name__} failed with non-retryable error: "
                        f"{type(e).__name__}: {e}"
                    )
                    raise

            # Should never reach here, but just in case
            raise MaxRetriesExceeded(
                f"Function {func.__name__} failed after {max_retries + 1} attempts",
                last_exception=last_exception
            )

        return wrapper
    return decorator


# =============================================================================
# Retry Context Manager (Alternative Pattern)
# =============================================================================

class RetryContext:
    """
    Context manager for retry logic, useful when decorator pattern doesn't fit.

    Example:
        async with RetryContext(max_retries=3) as retry:
            while retry.should_continue():
                try:
                    result = await fetch_data()
                    break
                except aiohttp.ClientError as e:
                    await retry.handle_error(e)
    """

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 0.1,
        max_delay: float = 10.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
        self.attempt = 0
        self.last_exception: Optional[Exception] = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    def should_continue(self) -> bool:
        """Check if more retry attempts are available."""
        return self.attempt <= self.max_retries

    async def handle_error(self, error: Exception) -> None:
        """Handle an error and wait before next retry."""
        self.last_exception = error
        self.attempt += 1

        if self.attempt > self.max_retries:
            raise MaxRetriesExceeded(
                f"Max retries ({self.max_retries}) exceeded",
                last_exception=error
            ) from error

        # Calculate delay
        delay = min(
            self.base_delay * (self.exponential_base ** (self.attempt - 1)),
            self.max_delay
        )

        if self.jitter:
            delay = delay * (1 + random.random() * 0.5)

        logger.warning(
            f"[Retry] Attempt {self.attempt}/{self.max_retries + 1} failed: "
            f"{type(error).__name__}: {error}. Retrying in {delay:.2f}s..."
        )

        await asyncio.sleep(delay)


# =============================================================================
# Utility Functions
# =============================================================================

def is_retryable_status(status_code: int) -> bool:
    """Check if an HTTP status code should trigger a retry."""
    return status_code in RETRYABLE_STATUS_CODES


def calculate_backoff_delay(
    attempt: int,
    base_delay: float = 0.1,
    max_delay: float = 10.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
) -> float:
    """
    Calculate the delay for a given retry attempt.

    Args:
        attempt: Current attempt number (0-indexed)
        base_delay: Initial delay in seconds
        max_delay: Maximum delay cap
        exponential_base: Base for exponential calculation
        jitter: Add random jitter

    Returns:
        Delay in seconds
    """
    delay = min(base_delay * (exponential_base ** attempt), max_delay)

    if jitter:
        delay = delay * (1 + random.random() * 0.5)

    return delay


# =============================================================================
# Pre-configured Decorators for Common Use Cases
# =============================================================================

# For external API calls (Yahoo Finance, Finnhub, etc.)
api_retry = with_retry(
    max_retries=3,
    base_delay=0.5,
    max_delay=30.0,
    jitter=True,
)

# For database operations
db_retry = with_retry(
    max_retries=2,
    base_delay=0.1,
    max_delay=5.0,
    jitter=True,
)

# For cache operations (fail fast)
cache_retry = with_retry(
    max_retries=1,
    base_delay=0.05,
    max_delay=1.0,
    jitter=False,
)
