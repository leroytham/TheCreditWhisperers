# app/repositories/holding_repository.py
"""
Holding Repository Implementation.

Handles all database operations for stock holdings, including:
- Holding CRUD operations
- Account-based holding queries
- Quantity and cost basis updates
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class HoldingRepository(BaseRepository):
    """
    Repository for stock holding database operations.

    Uses the Stock_Holding collection.
    """

    collection_name = "Stock_Holding"
    model_class = None  # Uses raw dictionaries

    async def get_holdings_by_account(
        self,
        username: str,
        account_name: str,
        include_closed: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Get all holdings for an account.

        Args:
            username: The user's username
            account_name: The account name (client_account_name)
            include_closed: Include closed positions (quantity = 0)

        Returns:
            List of holdings sorted by ticker
        """
        query: Dict[str, Any] = {
            "username": username,
            "client_account_name": account_name,
        }

        if not include_closed:
            query["quantity"] = {"$gt": 0}

        return await self.get_all(
            filters=query,
            sort=[("symbol", 1)],
        )

    async def get_by_ticker(
        self,
        username: str,
        account_name: str,
        ticker: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Get a specific holding by ticker.

        Args:
            username: The user's username
            account_name: The account name
            ticker: Stock ticker symbol

        Returns:
            The holding if found, None otherwise
        """
        return await self.find_one({
            "username": username,
            "client_account_name": account_name,
            "symbol": ticker.upper(),
        })

    async def get_user_holdings(
        self,
        username: str,
        include_closed: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Get all holdings for a user across all accounts.

        Args:
            username: The user's username
            include_closed: Include closed positions

        Returns:
            List of all holdings
        """
        query: Dict[str, Any] = {"username": username}

        if not include_closed:
            query["quantity"] = {"$gt": 0}

        return await self.get_all(
            filters=query,
            sort=[("client_account_name", 1), ("symbol", 1)],
        )

    async def update_quantity(
        self,
        holding_id: str,
        quantity_delta: float,
        avg_cost: Optional[float] = None,
    ) -> bool:
        """
        Update holding quantity (buy/sell).

        Uses atomic $inc for quantity update.

        Args:
            holding_id: The holding ID
            quantity_delta: Amount to add (positive) or subtract (negative)
            avg_cost: New average cost (for buys)

        Returns:
            True if updated successfully
        """
        object_id = self._to_object_id(holding_id)
        if object_id is None:
            return False

        try:
            update_ops: Dict[str, Any] = {
                "$inc": {"quantity": quantity_delta},
            }

            if avg_cost is not None:
                update_ops["$set"] = {"avg_cost": avg_cost}

            result = await self.collection.update_one(
                {"_id": object_id},
                update_ops,
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error updating holding quantity: %s", e)
            raise

    async def create_holding(
        self,
        username: str,
        account_name: str,
        ticker: str,
        quantity: float,
        avg_cost: float,
        **kwargs,
    ) -> str:
        """
        Create a new holding.

        Args:
            username: The user's username
            account_name: The account name
            ticker: Stock ticker symbol
            quantity: Number of shares
            avg_cost: Average cost per share
            **kwargs: Additional fields (account_no, etc.)

        Returns:
            The ID of the created holding
        """
        holding_doc = {
            "username": username,
            "client_account_name": account_name,
            "symbol": ticker.upper(),
            "quantity": quantity,
            "avg_cost": avg_cost,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            **kwargs,
        }

        try:
            result = await self.collection.insert_one(holding_doc)
            holding_id = str(result.inserted_id)
            logger.debug(
                "Created holding %s for %s/%s",
                ticker,
                username,
                account_name,
            )
            return holding_id
        except Exception as e:
            logger.error("Error creating holding: %s", e)
            raise

    async def get_or_create_holding(
        self,
        username: str,
        account_name: str,
        ticker: str,
        quantity: float = 0,
        avg_cost: float = 0,
    ) -> Dict[str, Any]:
        """
        Get an existing holding or create a new one.

        Args:
            username: The user's username
            account_name: The account name
            ticker: Stock ticker symbol
            quantity: Initial quantity (if creating)
            avg_cost: Initial average cost (if creating)

        Returns:
            The existing or newly created holding
        """
        existing = await self.get_by_ticker(username, account_name, ticker)
        if existing:
            return existing

        holding_id = await self.create_holding(
            username=username,
            account_name=account_name,
            ticker=ticker,
            quantity=quantity,
            avg_cost=avg_cost,
        )

        return await self.get_by_id(holding_id)

    async def update_holding(
        self,
        holding_id: str,
        updates: Dict[str, Any],
    ) -> bool:
        """
        Update a holding with arbitrary fields.

        Args:
            holding_id: The holding ID
            updates: Dictionary of fields to update

        Returns:
            True if updated successfully
        """
        updates["updated_at"] = datetime.now(timezone.utc)
        return await self.update(holding_id, updates)

    async def delete_holding(
        self,
        holding_id: str,
        username: str,
    ) -> bool:
        """
        Delete a holding (with ownership check).

        Args:
            holding_id: The holding ID
            username: The username (for ownership verification)

        Returns:
            True if deleted successfully
        """
        object_id = self._to_object_id(holding_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.delete_one({
                "_id": object_id,
                "username": username,
            })
            return result.deleted_count > 0
        except Exception as e:
            logger.error("Error deleting holding: %s", e)
            raise

    async def get_account_tickers(
        self,
        username: str,
        account_name: str,
    ) -> List[str]:
        """
        Get all ticker symbols held in an account.

        Args:
            username: The user's username
            account_name: The account name

        Returns:
            List of ticker symbols
        """
        try:
            cursor = self.collection.find(
                {
                    "username": username,
                    "client_account_name": account_name,
                    "quantity": {"$gt": 0},
                },
                {"symbol": 1},
            )
            docs = await cursor.to_list(length=None)
            return [doc["symbol"] for doc in docs if doc.get("symbol")]
        except Exception as e:
            logger.error("Error getting account tickers: %s", e)
            raise

    async def get_total_value(
        self,
        username: str,
        account_name: str,
    ) -> float:
        """
        Get total market value of holdings in an account.

        Requires holdings to have market_value field populated.

        Args:
            username: The user's username
            account_name: The account name

        Returns:
            Total market value
        """
        try:
            pipeline = [
                {
                    "$match": {
                        "username": username,
                        "client_account_name": account_name,
                        "quantity": {"$gt": 0},
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": "$market_value"},
                    }
                },
            ]
            cursor = self.collection.aggregate(pipeline)
            result = await cursor.to_list(length=1)
            return result[0]["total"] if result else 0.0
        except Exception as e:
            logger.error("Error getting total value: %s", e)
            raise

    async def add_lot_to_holding(
        self,
        username: str,
        account_name: str,
        account_no: str,
        symbol: str,
        new_lot: Dict[str, Any],
        new_quantity: float,
        new_avg_price: float,
        earliest_purchase_date: str,
    ) -> bool:
        """
        Add a lot to an existing holding and update aggregated values.

        Uses atomic $set and $push operations.

        Args:
            username: The user's username
            account_name: The account name
            account_no: The account number
            symbol: Stock ticker symbol
            new_lot: The lot data to add
            new_quantity: New total quantity
            new_avg_price: New weighted average price
            earliest_purchase_date: Earliest purchase date to preserve

        Returns:
            True if updated successfully
        """
        try:
            result = await self.collection.update_one(
                {
                    "username": username,
                    "client_account_name": account_name,
                    "account_no": account_no,
                    "symbol": symbol.upper(),
                },
                {
                    "$set": {
                        "quantity": new_quantity,
                        "purchase_price": round(new_avg_price, 2),
                        "purchase_date": earliest_purchase_date,
                        "updated_at": datetime.now(timezone.utc),
                    },
                    "$push": {
                        "lots": new_lot,
                    },
                },
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error adding lot to holding: %s", e)
            raise

    async def get_holding_by_full_key(
        self,
        username: str,
        account_name: str,
        account_no: str,
        symbol: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Get a holding by all key fields.

        Args:
            username: The user's username
            account_name: The account name
            account_no: The account number
            symbol: Stock ticker symbol

        Returns:
            The holding if found, None otherwise
        """
        return await self.find_one({
            "username": username,
            "client_account_name": account_name,
            "account_no": account_no,
            "symbol": symbol.upper(),
        })

    async def delete_holding_by_id(self, holding_id: str) -> bool:
        """
        Delete a holding by its MongoDB ObjectId.

        Args:
            holding_id: The ObjectId as string

        Returns:
            True if deleted successfully
        """
        object_id = self._to_object_id(holding_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.delete_one({"_id": object_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error("Error deleting holding by ID: %s", e)
            raise

    async def update_holding_after_sell(
        self,
        holding_id: str,
        new_quantity: float,
        new_avg_price: float,
        earliest_date: str,
        updated_lots: List[Dict[str, Any]],
    ) -> bool:
        """
        Update holding after a partial sell operation.

        Args:
            holding_id: The holding's ObjectId as string
            new_quantity: New total quantity after sell
            new_avg_price: New weighted average price
            earliest_date: Earliest remaining purchase date
            updated_lots: Updated lots array after FIFO reduction

        Returns:
            True if updated successfully
        """
        object_id = self._to_object_id(holding_id)
        if object_id is None:
            return False

        try:
            result = await self.collection.update_one(
                {"_id": object_id},
                {
                    "$set": {
                        "quantity": new_quantity,
                        "purchase_price": round(new_avg_price, 2),
                        "purchase_date": earliest_date,
                        "lots": updated_lots,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error("Error updating holding after sell: %s", e)
            raise
