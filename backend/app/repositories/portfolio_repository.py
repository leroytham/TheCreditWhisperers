# app/repositories/portfolio_repository.py
"""
Portfolio Repository Implementation.

Handles all database operations for portfolios, including:
- Portfolio CRUD operations
- User portfolio listing
- Primary portfolio management
- Holdings cache updates

Replaces DAL functions from app/models/portfolio_model.py
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
import logging

from app.repositories.base import BaseRepository
from app.models.portfolio_model import PortfolioModel

logger = logging.getLogger(__name__)


class PortfolioRepository(BaseRepository[PortfolioModel]):
    """
    Repository for portfolio database operations.
    """

    collection_name = "portfolios"
    model_class = PortfolioModel

    def _to_model(self, doc: Optional[Dict]) -> Optional[PortfolioModel]:
        """Override to use PortfolioModel.from_dict()."""
        if doc is None:
            return None
        return PortfolioModel.from_dict(doc)

    async def create_portfolio(self, portfolio: PortfolioModel) -> str:
        """
        Create a new portfolio.

        If this is the user's first portfolio, it will be set as primary.

        Args:
            portfolio: The portfolio model to create

        Returns:
            The ID of the created portfolio
        """
        # Check if this is the first portfolio for the user
        existing_count = await self.count({"username": portfolio.username})
        if existing_count == 0:
            portfolio.is_primary = True

        doc = portfolio.to_dict() if hasattr(portfolio, 'to_dict') else self._to_dict(portfolio)

        try:
            result = await self.collection.insert_one(doc)
            portfolio_id = str(result.inserted_id)
            logger.debug(
                "Created portfolio %s for user %s",
                portfolio_id,
                portfolio.username,
            )
            return portfolio_id
        except Exception as e:
            logger.error("Error creating portfolio: %s", e)
            raise

    async def get_by_username(
        self,
        username: str,
        include_inactive: bool = False,
    ) -> List[PortfolioModel]:
        """
        Get all portfolios for a user.

        Args:
            username: The user's username
            include_inactive: Include inactive portfolios

        Returns:
            List of portfolios sorted by primary status then creation date
        """
        query: Dict[str, Any] = {"username": username}
        if not include_inactive:
            query["is_active"] = True

        return await self.get_all(
            filters=query,
            sort=[("is_primary", -1), ("created_at", -1)],
        )

    async def get_by_account(
        self,
        username: str,
        account_name: str,
    ) -> Optional[PortfolioModel]:
        """
        Get a portfolio by username and account name.

        Args:
            username: The user's username
            account_name: The account name

        Returns:
            The portfolio if found, None otherwise
        """
        return await self.find_one({
            "username": username,
            "account_name": account_name,
        })

    async def get_primary_portfolio(
        self,
        username: str,
    ) -> Optional[PortfolioModel]:
        """
        Get the user's primary portfolio.

        Args:
            username: The user's username

        Returns:
            The primary portfolio if set, None otherwise
        """
        return await self.find_one({
            "username": username,
            "is_primary": True,
            "is_active": True,
        })

    async def set_primary_portfolio(
        self,
        username: str,
        portfolio_id: str,
    ) -> bool:
        """
        Set a portfolio as the user's primary.

        Args:
            username: The user's username
            portfolio_id: The portfolio to set as primary

        Returns:
            True if successful
        """
        # First, unset any existing primary
        await self.collection.update_many(
            {"username": username},
            {"$set": {"is_primary": False}},
        )

        # Set new primary
        object_id = self._to_object_id(portfolio_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.update_one(
                {"_id": object_id, "username": username},
                {"$set": {"is_primary": True}},
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error setting primary portfolio: %s", e)
            raise

    async def update_holdings_cache(
        self,
        portfolio_id: str,
        holdings: List[Dict[str, Any]],
    ) -> bool:
        """
        Update the cached holdings information in the portfolio.

        Args:
            portfolio_id: The portfolio ID
            holdings: List of holding dictionaries

        Returns:
            True if updated successfully
        """
        object_id = self._to_object_id(portfolio_id)
        if object_id is None:
            return False

        # Calculate summary
        tickers = list(set(h.get("symbol", "") for h in holdings if h.get("symbol")))
        holdings_count = len(holdings)
        total_value = sum(h.get("market_value", 0) or 0 for h in holdings)

        try:
            result = await self.collection.update_one(
                {"_id": object_id},
                {
                    "$set": {
                        "tickers": tickers,
                        "holdings_count": holdings_count,
                        "total_value": total_value,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error updating holdings cache: %s", e)
            raise

    async def deactivate_portfolio(
        self,
        portfolio_id: str,
        username: str,
    ) -> bool:
        """
        Deactivate a portfolio (soft delete).

        Args:
            portfolio_id: The portfolio ID
            username: The username (for ownership verification)

        Returns:
            True if deactivated successfully
        """
        object_id = self._to_object_id(portfolio_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.update_one(
                {"_id": object_id, "username": username},
                {
                    "$set": {
                        "is_active": False,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error deactivating portfolio: %s", e)
            raise

    async def get_user_portfolio_ids(self, username: str) -> List[str]:
        """
        Get all portfolio IDs for a user.

        Args:
            username: The user's username

        Returns:
            List of portfolio ID strings
        """
        try:
            cursor = self.collection.find(
                {"username": username, "is_active": True},
                {"_id": 1},
            )
            docs = await cursor.to_list(length=None)
            return [str(doc["_id"]) for doc in docs]
        except Exception as e:
            logger.error("Error getting portfolio IDs: %s", e)
            raise

    async def ensure_indexes(self) -> None:
        """Create indexes for efficient querying."""
        try:
            await self.collection.create_index("username")
            await self.collection.create_index(
                [("username", 1), ("account_name", 1)],
                unique=True,
            )
            await self.collection.create_index([("username", 1), ("is_primary", -1)])
            await self.collection.create_index([("username", 1), ("is_active", 1)])
            await self.collection.create_index("created_at")
            await self.collection.create_index("tickers")
            logger.info("Portfolio indexes created")
        except Exception as e:
            logger.warning("Error creating portfolio indexes: %s", e)
