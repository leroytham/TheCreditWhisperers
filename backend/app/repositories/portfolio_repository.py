# app/repositories/portfolio_repository.py
"""
Portfolio Repository Implementation.

Handles all database operations for portfolios.
Will be fully implemented in Phase 4.
"""

from typing import Optional, List, Dict, Any
import logging

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class PortfolioRepository(BaseRepository):
    """
    Repository for portfolio database operations.

    TODO: Implement in Phase 4:
    - get_by_username()
    - get_primary_portfolio()
    - set_primary_portfolio()
    """

    collection_name = "portfolios"
    model_class = None  # Will be set in Phase 4

    async def get_by_username(
        self,
        username: str,
        include_inactive: bool = False,
    ) -> List[Dict[str, Any]]:
        """Get all portfolios for a user."""
        query: Dict[str, Any] = {"username": username}
        if not include_inactive:
            query["is_active"] = True

        return await self.get_all(
            filters=query,
            sort=[("is_primary", -1), ("created_at", -1)],
        )

    async def get_primary_portfolio(
        self,
        username: str,
    ) -> Optional[Dict[str, Any]]:
        """Get the user's primary portfolio."""
        return await self.find_one(
            {"username": username, "is_primary": True}
        )

    async def set_primary_portfolio(
        self,
        username: str,
        portfolio_id: str,
    ) -> bool:
        """Set a portfolio as the user's primary."""
        # First, unset current primary
        await self.update_many(
            {"username": username, "is_primary": True},
            {"is_primary": False},
        )

        # Set new primary
        return await self.update(portfolio_id, {"is_primary": True})
