"""
Circuit Breaker Registry for External APIs

Provides centralized circuit breaker management for all external API calls.
Each API has its own circuit breaker with tailored thresholds.

Usage:
    from app.core.circuit_breakers import get_circuit_breaker, CircuitBreakerOpenError

    cb = get_circuit_breaker("alpha_vantage")
    try:
        result = await cb.call(fetch_func, *args)
    except CircuitBreakerOpenError:
        # Handle circuit open - return cached/fallback data
        pass
"""

import logging
from typing import Dict, Optional
from app.services.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    with_circuit_breaker,
)

logger = logging.getLogger(__name__)

# Circuit breaker configurations per API
# Thresholds are tuned based on API characteristics:
# - Alpha Vantage: Strict rate limits (5 calls/min free tier), slow recovery
# - Finnhub/NewsAPI/MarketAux: Fallback sources, more lenient
# - Yahoo Finance: Generally stable, quick recovery

_circuit_breakers: Dict[str, CircuitBreaker] = {
    "alpha_vantage": CircuitBreaker(
        name="AlphaVantage",
        failure_threshold=3,      # Open after 3 failures
        recovery_timeout=120,     # Wait 2 minutes (rate limit recovery)
        success_threshold=2       # Need 2 successes to close
    ),
    "finnhub": CircuitBreaker(
        name="Finnhub",
        failure_threshold=5,      # More lenient - fallback source
        recovery_timeout=60,      # 1 minute recovery
        success_threshold=2
    ),
    "newsapi": CircuitBreaker(
        name="NewsAPI",
        failure_threshold=5,      # More lenient - fallback source
        recovery_timeout=60,      # 1 minute recovery
        success_threshold=2
    ),
    "marketaux": CircuitBreaker(
        name="MarketAux",
        failure_threshold=5,      # More lenient - fallback source
        recovery_timeout=60,      # 1 minute recovery
        success_threshold=2
    ),
    "yahoo_finance": CircuitBreaker(
        name="YahooFinance",
        failure_threshold=5,      # Usually stable
        recovery_timeout=30,      # Quick recovery
        success_threshold=2
    ),
}


def get_circuit_breaker(api_name: str) -> Optional[CircuitBreaker]:
    """
    Get circuit breaker for a specific API.

    Args:
        api_name: API identifier (alpha_vantage, finnhub, newsapi, marketaux, yahoo_finance)

    Returns:
        CircuitBreaker instance or None if not found
    """
    cb = _circuit_breakers.get(api_name)
    if cb is None:
        logger.warning(f"No circuit breaker configured for API: {api_name}")
    return cb


def get_all_status() -> Dict[str, Dict]:
    """
    Get status of all circuit breakers.

    Returns:
        Dictionary with status for each circuit breaker
    """
    return {name: cb.get_status() for name, cb in _circuit_breakers.items()}


def reset_circuit_breaker(api_name: str) -> bool:
    """
    Manually reset a circuit breaker to CLOSED state.
    Use with caution - only for admin/debugging purposes.

    Args:
        api_name: API identifier

    Returns:
        True if reset successful, False if not found
    """
    cb = _circuit_breakers.get(api_name)
    if cb is None:
        return False

    cb._transition_to_closed()
    logger.info(f"[CIRCUIT-RESET] Manually reset circuit breaker for {api_name}")
    return True


# Re-export for convenience
__all__ = [
    "get_circuit_breaker",
    "get_all_status",
    "reset_circuit_breaker",
    "CircuitBreakerOpenError",
    "with_circuit_breaker",
]
