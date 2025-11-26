# app/core/circuit_breaker_metrics.py
"""
Prometheus metrics for circuit breaker monitoring.

Exposes circuit breaker state and transitions as Prometheus metrics
for alerting and visualization.

Metrics:
- circuit_breaker_state: Current state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)
- circuit_breaker_state_changes_total: Total state transitions
- circuit_breaker_failures_total: Total failures recorded
- circuit_breaker_successes_total: Total successes recorded
- circuit_breaker_recovery_seconds: Time to recover from OPEN to CLOSED
"""

import logging
import time
from typing import Optional

from prometheus_client import Counter, Gauge, Histogram

logger = logging.getLogger(__name__)

# =============================================================================
# Circuit Breaker State Gauge
# =============================================================================
# State values: 0 = CLOSED, 1 = OPEN, 2 = HALF_OPEN
CIRCUIT_BREAKER_STATE = Gauge(
    "circuit_breaker_state",
    "Current circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)",
    ["api_name"]
)

# =============================================================================
# State Transition Counter
# =============================================================================
CIRCUIT_BREAKER_STATE_CHANGES = Counter(
    "circuit_breaker_state_changes_total",
    "Total number of circuit breaker state transitions",
    ["api_name", "from_state", "to_state"]
)

# =============================================================================
# Failure Counter
# =============================================================================
CIRCUIT_BREAKER_FAILURES = Counter(
    "circuit_breaker_failures_total",
    "Total number of failures recorded by circuit breaker",
    ["api_name"]
)

# =============================================================================
# Success Counter
# =============================================================================
CIRCUIT_BREAKER_SUCCESSES = Counter(
    "circuit_breaker_successes_total",
    "Total number of successes recorded by circuit breaker",
    ["api_name"]
)

# =============================================================================
# Recovery Time Histogram
# =============================================================================
CIRCUIT_BREAKER_RECOVERY_TIME = Histogram(
    "circuit_breaker_recovery_seconds",
    "Time taken to recover from OPEN to CLOSED state",
    ["api_name"],
    buckets=(10, 30, 60, 120, 300, 600, 900, 1800)
)

# =============================================================================
# Call Duration Histogram
# =============================================================================
CIRCUIT_BREAKER_CALL_DURATION = Histogram(
    "circuit_breaker_call_duration_seconds",
    "Duration of calls through circuit breaker",
    ["api_name", "result"],  # result: success, failure, rejected
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0)
)

# =============================================================================
# Rejection Counter (calls rejected due to open circuit)
# =============================================================================
CIRCUIT_BREAKER_REJECTIONS = Counter(
    "circuit_breaker_rejections_total",
    "Total number of calls rejected due to open circuit",
    ["api_name"]
)


class CircuitBreakerMetricsRecorder:
    """
    Helper class to record circuit breaker metrics.

    Usage:
        recorder = CircuitBreakerMetricsRecorder("alpha_vantage")
        recorder.set_state("CLOSED")
        recorder.record_failure()
        recorder.record_state_change("CLOSED", "OPEN")
    """

    # State name to numeric value mapping
    STATE_VALUES = {
        "CLOSED": 0,
        "closed": 0,
        "OPEN": 1,
        "open": 1,
        "HALF_OPEN": 2,
        "half_open": 2,
    }

    def __init__(self, api_name: str):
        """
        Initialize metrics recorder for a specific API.

        Args:
            api_name: Name of the API (e.g., "alpha_vantage", "finnhub")
        """
        self.api_name = api_name
        self._open_time: Optional[float] = None

        # Initialize state to CLOSED
        self.set_state("CLOSED")

    def set_state(self, state: str) -> None:
        """
        Set the current circuit breaker state.

        Args:
            state: State name (CLOSED, OPEN, HALF_OPEN)
        """
        state_value = self.STATE_VALUES.get(state.upper(), 0)
        CIRCUIT_BREAKER_STATE.labels(api_name=self.api_name).set(state_value)
        logger.debug(f"[CB-METRICS] {self.api_name} state set to {state} ({state_value})")

    def record_state_change(self, from_state: str, to_state: str) -> None:
        """
        Record a state transition.

        Args:
            from_state: Previous state
            to_state: New state
        """
        CIRCUIT_BREAKER_STATE_CHANGES.labels(
            api_name=self.api_name,
            from_state=from_state.lower(),
            to_state=to_state.lower()
        ).inc()

        # Update current state
        self.set_state(to_state)

        # Track recovery time
        if to_state.upper() == "OPEN":
            self._open_time = time.time()
        elif to_state.upper() == "CLOSED" and self._open_time is not None:
            recovery_time = time.time() - self._open_time
            CIRCUIT_BREAKER_RECOVERY_TIME.labels(api_name=self.api_name).observe(recovery_time)
            logger.info(f"[CB-METRICS] {self.api_name} recovered in {recovery_time:.2f}s")
            self._open_time = None

        logger.debug(f"[CB-METRICS] {self.api_name} transitioned {from_state} -> {to_state}")

    def record_failure(self) -> None:
        """Record a failure event."""
        CIRCUIT_BREAKER_FAILURES.labels(api_name=self.api_name).inc()

    def record_success(self) -> None:
        """Record a success event."""
        CIRCUIT_BREAKER_SUCCESSES.labels(api_name=self.api_name).inc()

    def record_rejection(self) -> None:
        """Record a rejected call (circuit is open)."""
        CIRCUIT_BREAKER_REJECTIONS.labels(api_name=self.api_name).inc()

    def record_call_duration(self, duration: float, result: str) -> None:
        """
        Record the duration of a call through the circuit breaker.

        Args:
            duration: Call duration in seconds
            result: Result of the call (success, failure, rejected)
        """
        CIRCUIT_BREAKER_CALL_DURATION.labels(
            api_name=self.api_name,
            result=result
        ).observe(duration)


# =============================================================================
# Registry of metrics recorders
# =============================================================================
_metrics_recorders: dict[str, CircuitBreakerMetricsRecorder] = {}


def get_metrics_recorder(api_name: str) -> CircuitBreakerMetricsRecorder:
    """
    Get or create a metrics recorder for an API.

    Args:
        api_name: Name of the API

    Returns:
        CircuitBreakerMetricsRecorder instance
    """
    if api_name not in _metrics_recorders:
        _metrics_recorders[api_name] = CircuitBreakerMetricsRecorder(api_name)
    return _metrics_recorders[api_name]


def initialize_circuit_breaker_metrics(api_names: list[str]) -> None:
    """
    Initialize metrics recorders for a list of APIs.
    Call this at application startup.

    Args:
        api_names: List of API names to initialize metrics for
    """
    for api_name in api_names:
        get_metrics_recorder(api_name)
    logger.info(f"[CB-METRICS] Initialized metrics for {len(api_names)} APIs: {api_names}")


# =============================================================================
# Exports
# =============================================================================
__all__ = [
    "CIRCUIT_BREAKER_STATE",
    "CIRCUIT_BREAKER_STATE_CHANGES",
    "CIRCUIT_BREAKER_FAILURES",
    "CIRCUIT_BREAKER_SUCCESSES",
    "CIRCUIT_BREAKER_RECOVERY_TIME",
    "CIRCUIT_BREAKER_CALL_DURATION",
    "CIRCUIT_BREAKER_REJECTIONS",
    "CircuitBreakerMetricsRecorder",
    "get_metrics_recorder",
    "initialize_circuit_breaker_metrics",
]
