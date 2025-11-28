# app/repositories/account_repository.py
"""
Account Repository Implementation.

Handles all database operations for user accounts, including:
- Account CRUD operations
- Username-based queries
- Balance updates
"""

from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
import logging

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class AccountRepository(BaseRepository):
    """
    Repository for account database operations.

    Uses the Account_Details collection.
    """

    collection_name = "Account_Details"
    model_class = None  # Uses raw dictionaries

    async def get_by_username(
        self,
        username: str,
        projection: Optional[Dict[str, int]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get all accounts for a user.

        Args:
            username: The user's username
            projection: Optional field projection (e.g., {"_id": 0, "client_account_name": 1})

        Returns:
            List of accounts sorted by account name
        """
        try:
            if projection:
                cursor = self.collection.find(
                    {"username": username},
                    projection
                )
                return await cursor.to_list(length=None)
            return await self.get_all(
                filters={"username": username},
                sort=[("client_account_name", 1)],
            )
        except Exception as e:
            logger.error("Error getting accounts for user %s: %s", username, e)
            raise

    async def get_by_account_name(
        self,
        username: str,
        account_name: str,
        projection: Optional[Dict[str, int]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Get a specific account by username and account name.

        Args:
            username: The user's username
            account_name: The account name (client_account_name)
            projection: Optional field projection

        Returns:
            The account if found, None otherwise
        """
        try:
            query = {
                "username": username,
                "client_account_name": account_name,
            }
            if projection:
                return await self.collection.find_one(query, projection)
            return await self.find_one(query)
        except Exception as e:
            logger.error("Error getting account %s/%s: %s", username, account_name, e)
            raise

    async def get_by_account_no(
        self,
        username: str,
        account_no: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Get a specific account by username and account number.

        Args:
            username: The user's username
            account_no: The account number

        Returns:
            The account if found, None otherwise
        """
        return await self.find_one({
            "username": username,
            "account_no": account_no,
        })

    async def create_account(
        self,
        username: str,
        account_name: str,
        account_no: str,
        open_date: Optional[str] = None,
        **kwargs,
    ) -> str:
        """
        Create a new account.

        Args:
            username: The user's username
            account_name: The account name (client_account_name)
            account_no: The account number
            open_date: Account open date
            **kwargs: Additional fields

        Returns:
            The ID of the created account
        """
        account_doc = {
            "username": username,
            "client_account_name": account_name,
            "account_no": account_no,
            "open_date": open_date,
            "created_at": datetime.now(timezone.utc),
            **kwargs,
        }

        try:
            result = await self.collection.insert_one(account_doc)
            account_id = str(result.inserted_id)
            logger.debug(
                "Created account %s for user %s",
                account_name,
                username,
            )
            return account_id
        except Exception as e:
            logger.error("Error creating account: %s", e)
            raise

    async def update_account(
        self,
        account_id: str,
        updates: Dict[str, Any],
    ) -> bool:
        """
        Update an account with arbitrary fields.

        Args:
            account_id: The account ID
            updates: Dictionary of fields to update

        Returns:
            True if updated successfully
        """
        updates["updated_at"] = datetime.now(timezone.utc)
        return await self.update(account_id, updates)

    async def update_account_by_query(
        self,
        query: Dict[str, Any],
        updates: Dict[str, Any],
    ) -> bool:
        """
        Update an account matching a query.

        Args:
            query: MongoDB query to match account
            updates: Dictionary of fields to update

        Returns:
            True if updated successfully
        """
        try:
            updates["updated_at"] = datetime.now(timezone.utc)
            result = await self.collection.update_one(
                query,
                {"$set": updates}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error updating account: %s", e)
            raise

    async def update_balance(
        self,
        account_id: str,
        amount_delta: float,
    ) -> Tuple[bool, float]:
        """
        Update account balance atomically.

        Args:
            account_id: The account ID
            amount_delta: Amount to add (positive) or subtract (negative)

        Returns:
            Tuple of (success, new_balance)
        """
        try:
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

    async def delete_account(
        self,
        account_id: str,
        username: str,
    ) -> bool:
        """
        Delete an account (with ownership check).

        Args:
            account_id: The account ID
            username: The username (for ownership verification)

        Returns:
            True if deleted successfully
        """
        object_id = self._to_object_id(account_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.delete_one({
                "_id": object_id,
                "username": username,
            })
            return result.deleted_count > 0
        except Exception as e:
            logger.error("Error deleting account: %s", e)
            raise

    async def account_exists(
        self,
        username: str,
        account_no: str,
    ) -> bool:
        """
        Check if an account exists by username and account number.

        Args:
            username: The user's username
            account_no: The account number

        Returns:
            True if account exists
        """
        return await self.exists({
            "username": username,
            "account_no": account_no,
        })

    async def ensure_indexes(self) -> None:
        """
        Create optimal indexes for account queries.
        """
        try:
            # Index for user lookups
            await self.collection.create_index("username")

            # Compound index for account lookups by name
            await self.collection.create_index(
                [("username", 1), ("client_account_name", 1)],
                unique=True,
            )

            # Compound index for account lookups by number
            await self.collection.create_index(
                [("username", 1), ("account_no", 1)],
                unique=True,
            )

            logger.info("Account indexes created successfully")
        except Exception as e:
            logger.error("Error creating account indexes: %s", e)
            raise
