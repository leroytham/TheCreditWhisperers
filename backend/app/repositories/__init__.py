# app/repositories/__init__.py
"""
Repository Pattern Implementation for Data Access Layer.

This package provides a clean abstraction over MongoDB operations, enabling:
- Separation of business logic from data access
- Easy testing via dependency injection
- Consistent query patterns across the application
- Type-safe database operations

Usage:
    from app.repositories import get_notification_repository

    # In FastAPI route handlers
    @router.get("/notifications")
    async def get_notifications(
        repo: NotificationRepository = Depends(get_notification_repository)
    ):
        return await repo.get_user_notifications(user_id="...")

    # In tests
    def test_notifications(mock_notification_repository, app):
        app.dependency_overrides[get_notification_repository] = lambda: mock_notification_repository
        ...
"""

from app.repositories.base import BaseRepository
from app.repositories.interfaces import IRepository, INotificationRepository
from app.repositories.factory import (
    get_notification_repository,
    get_transaction_repository,
    get_portfolio_repository,
    get_holding_repository,
    get_account_repository,
    clear_repository_caches,
)

__all__ = [
    # Base classes
    "BaseRepository",
    # Interfaces
    "IRepository",
    "INotificationRepository",
    # Factory functions (DI providers)
    "get_notification_repository",
    "get_transaction_repository",
    "get_portfolio_repository",
    "get_holding_repository",
    "get_account_repository",
    "clear_repository_caches",
]
