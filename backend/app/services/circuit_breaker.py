# app/services/circuit_breaker.py
"""
Circuit breaker pattern implementation for external API calls
Prevents cascading failures and provides fallback mechanisms

Instrumented with Prometheus metrics for observability.
"""

import asyncio
import time
from enum import Enum
from typing import Optional, Callable, Any, Dict
from datetime import datetime, timedelta
import logging
from functools import wraps

from app.core.circuit_breaker_metrics import get_metrics_recorder

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Circuit tripped, rejecting calls
    HALF_OPEN = "half_open" # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker implementation with configurable thresholds
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception,
        success_threshold: int = 2
    ):
        """
        Initialize circuit breaker

        Args:
            name: Circuit breaker identifier
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before attempting recovery
            expected_exception: Exception type to catch
            success_threshold: Successes needed in half-open state to close circuit
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.success_threshold = success_threshold

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[float] = None
        self.last_state_change: float = time.time()
        self._lock = asyncio.Lock()

        # Initialize Prometheus metrics recorder
        self._metrics = get_metrics_recorder(name)

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function through circuit breaker

        Args:
            func: Async function to execute
            *args, **kwargs: Function arguments

        Returns:
            Function result or raises exception
        """
        start_time = time.time()

        async with self._lock:
            # Check circuit state
            if self.state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self._transition_to_half_open()
                else:
                    # Record rejection metric
                    self._metrics.record_rejection()
                    self._metrics.record_call_duration(time.time() - start_time, "rejected")
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker '{self.name}' is OPEN. "
                        f"Retry after {self._time_until_retry()} seconds."
                    )

        # Try to execute the function
        try:
            result = await func(*args, **kwargs)
            await self._on_success()
            # Record successful call duration
            self._metrics.record_call_duration(time.time() - start_time, "success")
            return result
        except self.expected_exception as e:
            await self._on_failure()
            # Record failed call duration
            self._metrics.record_call_duration(time.time() - start_time, "failure")
            raise e

    async def _on_success(self):
        """Handle successful call"""
        async with self._lock:
            # Record success metric
            self._metrics.record_success()

            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                logger.info(f"[CIRCUIT-{self.name}] Success in HALF_OPEN state ({self.success_count}/{self.success_threshold})")

                if self.success_count >= self.success_threshold:
                    self._transition_to_closed()
            elif self.state == CircuitState.CLOSED:
                # Reset failure count on success
                self.failure_count = 0

    async def _on_failure(self):
        """Handle failed call"""
        async with self._lock:
            self.last_failure_time = time.time()

            # Record failure metric
            self._metrics.record_failure()

            if self.state == CircuitState.CLOSED:
                self.failure_count += 1
                logger.warning(f"[CIRCUIT-{self.name}] Failure {self.failure_count}/{self.failure_threshold}")

                if self.failure_count >= self.failure_threshold:
                    self._transition_to_open()

            elif self.state == CircuitState.HALF_OPEN:
                logger.warning(f"[CIRCUIT-{self.name}] Failure in HALF_OPEN state, reopening circuit")
                self._transition_to_open()

    def _transition_to_open(self):
        """Transition to OPEN state"""
        previous_state = self.state.value
        self.state = CircuitState.OPEN
        self.last_state_change = time.time()
        self.failure_count = 0
        self.success_count = 0

        # Record state transition metric
        self._metrics.record_state_change(previous_state, "open")
        logger.error(f"[CIRCUIT-{self.name}] Circuit OPENED due to failures")

    def _transition_to_closed(self):
        """Transition to CLOSED state"""
        previous_state = self.state.value
        self.state = CircuitState.CLOSED
        self.last_state_change = time.time()
        self.failure_count = 0
        self.success_count = 0

        # Record state transition metric (also records recovery time)
        self._metrics.record_state_change(previous_state, "closed")
        logger.info(f"[CIRCUIT-{self.name}] Circuit CLOSED, service recovered")

    def _transition_to_half_open(self):
        """Transition to HALF_OPEN state"""
        previous_state = self.state.value
        self.state = CircuitState.HALF_OPEN
        self.last_state_change = time.time()
        self.success_count = 0

        # Record state transition metric
        self._metrics.record_state_change(previous_state, "half_open")
        logger.info(f"[CIRCUIT-{self.name}] Circuit HALF_OPEN, testing recovery")

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return False
        return time.time() - self.last_failure_time >= self.recovery_timeout

    def _time_until_retry(self) -> int:
        """Calculate seconds until retry is allowed"""
        if self.last_failure_time is None:
            return 0
        elapsed = time.time() - self.last_failure_time
        return max(0, int(self.recovery_timeout - elapsed))

    def get_status(self) -> Dict:
        """Get circuit breaker status"""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure": datetime.fromtimestamp(self.last_failure_time).isoformat() if self.last_failure_time else None,
            "last_state_change": datetime.fromtimestamp(self.last_state_change).isoformat()
        }


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open"""
    pass


class AlphaVantageCircuitBreaker:
    """
    Specialized circuit breaker for AlphaVantage API with fallback mechanisms
    """

    def __init__(self):
        self.circuit_breaker = CircuitBreaker(
            name="AlphaVantage",
            failure_threshold=3,      # Open after 3 failures
            recovery_timeout=120,      # Wait 2 minutes before retry
            success_threshold=2        # Need 2 successes to fully recover
        )
        self.fallback_cache: Dict[str, Any] = {}
        self.cache_ttl = 3600  # 1 hour cache TTL for fallback data

    async def fetch_news_with_fallback(
        self,
        fetch_func: Callable,
        ticker: str,
        *args,
        **kwargs
    ) -> Dict:
        """
        Fetch news with circuit breaker and fallback

        Args:
            fetch_func: Async function to fetch news
            ticker: Stock ticker
            *args, **kwargs: Additional arguments for fetch function

        Returns:
            News data or fallback response
        """
        cache_key = f"news:{ticker}"

        try:
            # Try to fetch through circuit breaker
            result = await self.circuit_breaker.call(fetch_func, ticker, *args, **kwargs)

            # Cache successful result for fallback
            if result:
                self.fallback_cache[cache_key] = {
                    "data": result,
                    "timestamp": time.time(),
                    "from_cache": False
                }

            return result

        except CircuitBreakerOpenError as e:
            logger.warning(f"[ALPHA-VANTAGE-CB] Circuit open: {e}")
            # Return cached data if available
            return self._get_fallback_data(cache_key, ticker)

        except Exception as e:
            logger.error(f"[ALPHA-VANTAGE-CB] API call failed: {e}")
            # Return cached data if available
            return self._get_fallback_data(cache_key, ticker)

    def _get_fallback_data(self, cache_key: str, ticker: str) -> Dict:
        """Get fallback data from cache or return empty structure"""
        if cache_key in self.fallback_cache:
            cached = self.fallback_cache[cache_key]
            if time.time() - cached["timestamp"] < self.cache_ttl:
                logger.info(f"[ALPHA-VANTAGE-CB] Returning cached data for {ticker}")
                data = cached["data"].copy()
                data["from_cache"] = True
                data["cache_age_seconds"] = int(time.time() - cached["timestamp"])
                return data

        # Return empty structure if no cache available
        logger.info(f"[ALPHA-VANTAGE-CB] No cached data for {ticker}, returning empty response")
        return {
            "ticker": ticker,
            "news": [],
            "avg_score": 0,
            "sentiment_momentum": None,
            "from_cache": False,
            "error": "Service temporarily unavailable"
        }

    def get_status(self) -> Dict:
        """Get circuit breaker status with cache info"""
        status = self.circuit_breaker.get_status()
        status["cache_entries"] = len(self.fallback_cache)
        status["cache_ttl_seconds"] = self.cache_ttl
        return status


# Global singleton instances
alpha_vantage_circuit_breaker = AlphaVantageCircuitBreaker()


def with_circuit_breaker(circuit_breaker: CircuitBreaker):
    """
    Decorator to apply circuit breaker to async functions
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await circuit_breaker.call(func, *args, **kwargs)
        return wrapper
    return decorator


# Example usage in news_service.py modification:
async def fetch_alpha_vantage_news_with_circuit_breaker(
    self,
    session: aiohttp.ClientSession,
    ticker: str,
    **kwargs
) -> list[dict]:
    """
    Wrapper for AlphaVantage news fetching with circuit breaker
    """
    from app.services.circuit_breaker import alpha_vantage_circuit_breaker

    async def _fetch():
        return await self._fetch_alpha_vantage_news(session, ticker, **kwargs)

    return await alpha_vantage_circuit_breaker.fetch_news_with_fallback(
        _fetch,
        ticker
    )