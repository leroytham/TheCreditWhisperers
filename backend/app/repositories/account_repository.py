# app/repositories/account_repository.py
"""
Account Repository Implementation.

Handles all database operations for user accounts.
Will be fully implemented in Phase 5.
"""

from typing import Optional, List, Dict, Any, Tuple
import logging

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class AccountRepository(BaseRepository):
    """
    Repository for account database operations.

    TODO: Implement in Phase 5:
    - get_by_username()
    - update_balance()
    - get_account_performance()
    """

    collection_name = "Account_Details"
    model_class = None  # Will be set in Phase 5

    async def get_by_username(
        self,
        username: str,
    ) -> List[Dict[str, Any]]:
        """Get all accounts for a user."""
        return await self.get_all(
            filters={"username": username},
            sort=[("account_name", 1)],
        )

    async def update_balance(
        self,
        account_id: str,
        amount_delta: float,
    ) -> Tuple[bool, float]:
        """
        Update account balance.

        Args:
            account_id: The account ID
            amount_delta: Amount to add (positive) or subtract (negative)

        Returns:
            Tuple of (success, new_balance)
        """
        try:
            # Use findOneAndUpdate to get the new value
            result = await self.collection.find_one_and_update(
                {"_id": self._to_object_id(account_id)},
                {"$inc": {"balance": amount_delta}},
                return_document=True,
            )

            if result:
                return True, result.get("balance", 0)
            return False, 0
        except Exception as e:
            logger.error("Error updating account balance: %s", e)
            raise
