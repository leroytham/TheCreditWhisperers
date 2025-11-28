# app/repositories/holding_repository.py
"""
Holding Repository Implementation.

Handles all database operations for stock holdings.
Will be fully implemented in Phase 4.
"""

from typing import Optional, List, Dict, Any
import logging

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class HoldingRepository(BaseRepository):
    """
    Repository for stock holding database operations.

    TODO: Implement in Phase 4:
    - get_by_account()
    - get_by_ticker()
    - update_quantity()
    """

    collection_name = "Stock_Holding"
    model_class = None  # Will be set in Phase 4

    async def get_by_account(
        self,
        account_id: str,
        include_closed: bool = False,
    ) -> List[Dict[str, Any]]:
        """Get all holdings for an account."""
        query: Dict[str, Any] = {"account_id": account_id}
        if not include_closed:
            query["quantity"] = {"$gt": 0}

        return await self.get_all(
            filters=query,
            sort=[("ticker", 1)],
        )

    async def get_by_ticker(
        self,
        account_id: str,
        ticker: str,
    ) -> Optional[Dict[str, Any]]:
        """Get a specific holding by ticker."""
        return await self.find_one(
            {"account_id": account_id, "ticker": ticker}
        )

    async def update_quantity(
        self,
        holding_id: str,
        quantity_delta: float,
        avg_cost: Optional[float] = None,
    ) -> bool:
        """Update holding quantity (buy/sell)."""
        updates: Dict[str, Any] = {}

        # Use $inc for quantity update
        try:
            if avg_cost is not None:
                updates["avg_cost"] = avg_cost

            result = await self.collection.update_one(
                {"_id": self._to_object_id(holding_id)},
                {
                    "$inc": {"quantity": quantity_delta},
                    "$set": updates,
                } if updates else {"$inc": {"quantity": quantity_delta}},
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error updating holding quantity: %s", e)
            raise
