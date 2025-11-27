# =============================================================================
# Circuit Breaker Pattern Implementation
# =============================================================================
# Prevents cascading failures for external API calls

import asyncio
import time
from enum import Enum
from typing import Optional, Callable, Any, Dict
from datetime import datetime
import logging
from functools import wraps

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Circuit tripped, rejecting calls
    HALF_OPEN = "half_open" # Testing if service recovered


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open"""
    pass


class CircuitBreaker:
    """
    Circuit breaker implementation with configurable thresholds.
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception,
        success_threshold: int = 2
    ):
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

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function through circuit breaker."""
        async with self._lock:
            if self.state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self._transition_to_half_open()
                else:
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker '{self.name}' is OPEN. "
                        f"Retry after {self._time_until_retry()} seconds."
                    )

        try:
            result = await func(*args, **kwargs)
            await self._on_success()
            return result
        except self.expected_exception as e:
            await self._on_failure()
            raise e

    async def _on_success(self):
        """Handle successful call."""
        async with self._lock:
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                logger.info(f"[CIRCUIT-{self.name}] Success in HALF_OPEN ({self.success_count}/{self.success_threshold})")
                if self.success_count >= self.success_threshold:
                    self._transition_to_closed()
            elif self.state == CircuitState.CLOSED:
                self.failure_count = 0

    async def _on_failure(self):
        """Handle failed call."""
        async with self._lock:
            self.last_failure_time = time.time()

            if self.state == CircuitState.CLOSED:
                self.failure_count += 1
                logger.warning(f"[CIRCUIT-{self.name}] Failure {self.failure_count}/{self.failure_threshold}")
                if self.failure_count >= self.failure_threshold:
                    self._transition_to_open()
            elif self.state == CircuitState.HALF_OPEN:
                logger.warning(f"[CIRCUIT-{self.name}] Failure in HALF_OPEN, reopening")
                self._transition_to_open()

    def _transition_to_open(self):
        self.state = CircuitState.OPEN
        self.last_state_change = time.time()
        self.failure_count = 0
        self.success_count = 0
        logger.error(f"[CIRCUIT-{self.name}] Circuit OPENED")

    def _transition_to_closed(self):
        self.state = CircuitState.CLOSED
        self.last_state_change = time.time()
        self.failure_count = 0
        self.success_count = 0
        logger.info(f"[CIRCUIT-{self.name}] Circuit CLOSED")

    def _transition_to_half_open(self):
        self.state = CircuitState.HALF_OPEN
        self.last_state_change = time.time()
        self.success_count = 0
        logger.info(f"[CIRCUIT-{self.name}] Circuit HALF_OPEN")

    def _should_attempt_reset(self) -> bool:
        if self.last_failure_time is None:
            return False
        return time.time() - self.last_failure_time >= self.recovery_timeout

    def _time_until_retry(self) -> int:
        if self.last_failure_time is None:
            return 0
        elapsed = time.time() - self.last_failure_time
        return max(0, int(self.recovery_timeout - elapsed))

    def get_status(self) -> Dict:
        """Get circuit breaker status."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "last_failure": datetime.fromtimestamp(self.last_failure_time).isoformat() if self.last_failure_time else None,
            "last_state_change": datetime.fromtimestamp(self.last_state_change).isoformat()
        }


# Pre-configured circuit breakers for external APIs
_circuit_breakers: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str) -> CircuitBreaker:
    """Get or create a circuit breaker by name."""
    if name not in _circuit_breakers:
        configs = {
            "alpha_vantage": {"failure_threshold": 3, "recovery_timeout": 120, "success_threshold": 2},
            "yahoo_finance": {"failure_threshold": 5, "recovery_timeout": 30, "success_threshold": 2},
        }
        config = configs.get(name, {"failure_threshold": 5, "recovery_timeout": 60, "success_threshold": 2})
        _circuit_breakers[name] = CircuitBreaker(name=name, **config)
    return _circuit_breakers[name]


def get_all_circuit_breakers() -> Dict[str, Dict]:
    """Get status of all circuit breakers."""
    return {name: cb.get_status() for name, cb in _circuit_breakers.items()}
