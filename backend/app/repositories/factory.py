# app/repositories/factory.py
"""
Repository Factory with Dependency Injection Providers.

This module provides singleton repository instances using @lru_cache for
efficient caching. These functions are designed to be used with FastAPI's
Depends() for automatic dependency injection.

Usage in Routes:
    from fastapi import Depends
    from app.repositories.factory import get_notification_repository

    @router.get("/notifications")
    async def get_notifications(
        repo: NotificationRepository = Depends(get_notification_repository)
    ):
        return await repo.get_user_notifications(user_id="...")

Usage in Tests:
    def test_notifications(mock_notification_repository, app):
        from app.repositories.factory import get_notification_repository
        app.dependency_overrides[get_notification_repository] = lambda: mock_notification_repository
        # ... test code ...
        app.dependency_overrides.clear()

Thread Safety:
    - @lru_cache is thread-safe for reads
    - Each repository is initialized once and reused
    - Repository instances themselves are thread-safe (Motor is async)
"""

from functools import lru_cache
from typing import TYPE_CHECKING

# Use TYPE_CHECKING to avoid circular imports
# Actual imports happen inside functions for lazy loading
if TYPE_CHECKING:
    from app.repositories.notification_repository import NotificationRepository
    from app.repositories.transaction_repository import TransactionRepository
    from app.repositories.portfolio_repository import PortfolioRepository
    from app.repositories.holding_repository import HoldingRepository
    from app.repositories.account_repository import AccountRepository
    from app.repositories.price_alert_repository import PriceAlertRepository
    from app.repositories.preference_repository import PreferenceRepository


@lru_cache(maxsize=1)
def get_notification_repository() -> "NotificationRepository":
    """
    Get singleton NotificationRepository instance.

    Returns:
        Cached NotificationRepository instance

    Note:
        This function is cached, so the same instance is returned
        on subsequent calls. Use clear_repository_caches() to reset.
    """
    from app.repositories.notification_repository import NotificationRepository

    return NotificationRepository()


@lru_cache(maxsize=1)
def get_transaction_repository() -> "TransactionRepository":
    """
    Get singleton TransactionRepository instance.

    Returns:
        Cached TransactionRepository instance
    """
    from app.repositories.transaction_repository import TransactionRepository

    return TransactionRepository()


@lru_cache(maxsize=1)
def get_portfolio_repository() -> "PortfolioRepository":
    """
    Get singleton PortfolioRepository instance.

    Returns:
        Cached PortfolioRepository instance
    """
    from app.repositories.portfolio_repository import PortfolioRepository

    return PortfolioRepository()


@lru_cache(maxsize=1)
def get_holding_repository() -> "HoldingRepository":
    """
    Get singleton HoldingRepository instance.

    Returns:
        Cached HoldingRepository instance
    """
    from app.repositories.holding_repository import HoldingRepository

    return HoldingRepository()


@lru_cache(maxsize=1)
def get_account_repository() -> "AccountRepository":
    """
    Get singleton AccountRepository instance.

    Returns:
        Cached AccountRepository instance
    """
    from app.repositories.account_repository import AccountRepository

    return AccountRepository()


@lru_cache(maxsize=1)
def get_price_alert_repository() -> "PriceAlertRepository":
    """
    Get singleton PriceAlertRepository instance.

    Returns:
        Cached PriceAlertRepository instance
    """
    from app.repositories.price_alert_repository import PriceAlertRepository

    return PriceAlertRepository()


@lru_cache(maxsize=1)
def get_preference_repository() -> "PreferenceRepository":
    """
    Get singleton PreferenceRepository instance.

    Returns:
        Cached PreferenceRepository instance
    """
    from app.repositories.preference_repository import PreferenceRepository

    return PreferenceRepository()


def clear_repository_caches() -> None:
    """
    Clear all repository caches.

    This should be called:
    - In tests (via autouse fixture) to ensure clean state between tests
    - On application shutdown if repositories hold resources
    - When database connection is reset

    Example in conftest.py:
        @pytest.fixture(autouse=True)
        def reset_repositories():
            yield
            clear_repository_caches()
    """
    get_notification_repository.cache_clear()
    get_transaction_repository.cache_clear()
    get_portfolio_repository.cache_clear()
    get_holding_repository.cache_clear()
    get_account_repository.cache_clear()
    get_price_alert_repository.cache_clear()
    get_preference_repository.cache_clear()


# Convenience function to get all repositories at once
def get_all_repositories() -> dict:
    """
    Get all repository instances.

    Useful for debugging or when you need access to multiple repositories.

    Returns:
        Dictionary mapping repository names to instances
    """
    return {
        "notification": get_notification_repository(),
        "transaction": get_transaction_repository(),
        "portfolio": get_portfolio_repository(),
        "holding": get_holding_repository(),
        "account": get_account_repository(),
        "price_alert": get_price_alert_repository(),
        "preference": get_preference_repository(),
    }
