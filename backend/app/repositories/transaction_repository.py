# app/repositories/transaction_repository.py
"""
Transaction Repository Implementation.

Handles all database operations for portfolio transactions, including:
- Transaction CRUD operations
- Cash flow queries for TWR calculations
- Transaction statistics and summaries

Replaces DAL functions from app/models/transaction.py
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date, timezone
from bson import ObjectId
from bson.errors import InvalidId
import logging

from app.repositories.base import BaseRepository
from app.models.transaction import TransactionModel, TransactionType, CreateTransactionRequest

logger = logging.getLogger(__name__)


class TransactionRepository(BaseRepository[TransactionModel]):
    """
    Repository for transaction database operations.

    Uses the portfolio_transactions collection (not "Transactions").
    """

    collection_name = "portfolio_transactions"
    model_class = TransactionModel

    def _to_model(self, doc: Optional[Dict]) -> Optional[TransactionModel]:
        """Override to use TransactionModel.from_dict()."""
        if doc is None:
            return None
        return TransactionModel.from_dict(doc)

    async def create_transaction(
        self,
        username: str,
        request: CreateTransactionRequest,
    ) -> str:
        """
        Create a new transaction.

        Args:
            username: The user's username
            request: Transaction creation request

        Returns:
            The ID of the created transaction
        """
        # Create full transaction model
        transaction = TransactionModel(
            username=username,
            account_name=request.account_name,
            account_no=request.account_no,
            transaction_date=request.transaction_date,
            transaction_type=request.transaction_type,
            symbol=request.symbol,
            quantity=request.quantity,
            price=request.price,
            cash_flow=request.cash_flow,
            fees=request.fees,
            notes=request.notes,
        )

        doc = transaction.to_dict()

        try:
            result = await self.collection.insert_one(doc)
            transaction_id = str(result.inserted_id)
            logger.debug(
                "Created transaction %s for user %s",
                transaction_id,
                username,
            )
            return transaction_id
        except Exception as e:
            logger.error("Error creating transaction: %s", e)
            raise

    async def get_transactions(
        self,
        username: str,
        account_name: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        transaction_type: Optional[TransactionType] = None,
        symbol: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[TransactionModel]:
        """
        Get transactions with optional filters.

        Args:
            username: User identifier
            account_name: Portfolio/account name
            start_date: Filter transactions on or after this date
            end_date: Filter transactions on or before this date
            transaction_type: Filter by transaction type
            symbol: Filter by stock symbol
            limit: Maximum number of results
            offset: Number of results to skip (for pagination)

        Returns:
            List of transactions sorted by date (most recent first)
        """
        query: Dict[str, Any] = {
            "username": username,
            "account_name": account_name,
        }

        if start_date or end_date:
            query["transaction_date"] = {}
            if start_date:
                query["transaction_date"]["$gte"] = datetime.combine(
                    start_date, datetime.min.time()
                )
            if end_date:
                query["transaction_date"]["$lte"] = datetime.combine(
                    end_date, datetime.max.time()
                )

        if transaction_type:
            query["transaction_type"] = transaction_type.value if hasattr(transaction_type, 'value') else transaction_type

        if symbol:
            query["symbol"] = symbol.upper()

        return await self.get_all(
            filters=query,
            limit=limit,
            offset=offset,
            sort=[("transaction_date", -1)],
        )

    async def get_by_account(
        self,
        username: str,
        account_name: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[TransactionModel]:
        """
        Get transactions for a specific account.

        Alias for get_transactions() with fewer parameters.
        """
        return await self.get_transactions(
            username=username,
            account_name=account_name,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset,
        )

    async def get_cash_flows_between_dates(
        self,
        username: str,
        account_name: str,
        start_date: date,
        end_date: date,
    ) -> List[Dict[str, Any]]:
        """
        Get all cash flows between two dates for TWR calculation.

        Args:
            username: User identifier
            account_name: Portfolio/account name
            start_date: Start date (inclusive)
            end_date: End date (inclusive)

        Returns:
            List of {date, amount, type, symbol} dictionaries sorted by date
        """
        query = {
            "username": username,
            "account_name": account_name,
            "transaction_date": {
                "$gte": datetime.combine(start_date, datetime.min.time()),
                "$lte": datetime.combine(end_date, datetime.max.time()),
            },
        }

        try:
            cursor = self.collection.find(query).sort("transaction_date", 1)
            docs = await cursor.to_list(length=None)

            cash_flows = []
            for doc in docs:
                transaction = TransactionModel.from_dict(doc)
                cash_flows.append({
                    "date": transaction.transaction_date,
                    "amount": transaction.cash_flow,
                    "type": transaction.transaction_type,
                    "symbol": transaction.symbol,
                })

            return cash_flows
        except Exception as e:
            logger.error("Error getting cash flows: %s", e)
            raise

    async def delete_transaction(
        self,
        transaction_id: str,
        username: str,
    ) -> bool:
        """
        Delete a transaction (with ownership check).

        Args:
            transaction_id: The transaction ID
            username: The username (for ownership verification)

        Returns:
            True if deleted successfully
        """
        try:
            result = await self.collection.delete_one({
                "_id": ObjectId(transaction_id),
                "username": username,
            })
            return result.deleted_count > 0
        except InvalidId:
            logger.debug("Invalid transaction ID format: %s", transaction_id)
            return False
        except Exception as e:
            logger.error("Error deleting transaction %s: %s", transaction_id, e)
            raise

    async def update_transaction(
        self,
        transaction_id: str,
        username: str,
        updates: Dict[str, Any],
    ) -> bool:
        """
        Update a transaction (with ownership check).

        Args:
            transaction_id: The transaction ID
            username: The username (for ownership verification)
            updates: Fields to update

        Returns:
            True if updated successfully
        """
        # Add updated_at timestamp
        updates["updated_at"] = datetime.now(timezone.utc)

        # Convert date if present
        if "transaction_date" in updates and isinstance(updates["transaction_date"], date):
            updates["transaction_date"] = datetime.combine(
                updates["transaction_date"], datetime.min.time()
            )

        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(transaction_id), "username": username},
                {"$set": updates},
            )
            return result.modified_count > 0
        except InvalidId:
            logger.debug("Invalid transaction ID format: %s", transaction_id)
            return False
        except Exception as e:
            logger.error("Error updating transaction %s: %s", transaction_id, e)
            raise

    async def get_transaction_stats(
        self,
        username: str,
        account_name: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Get transaction statistics for a portfolio.

        Args:
            username: User identifier
            account_name: Portfolio/account name
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Statistics including total transactions and breakdown by type
        """
        query: Dict[str, Any] = {
            "username": username,
            "account_name": account_name,
        }

        if start_date or end_date:
            query["transaction_date"] = {}
            if start_date:
                query["transaction_date"]["$gte"] = datetime.combine(
                    start_date, datetime.min.time()
                )
            if end_date:
                query["transaction_date"]["$lte"] = datetime.combine(
                    end_date, datetime.max.time()
                )

        try:
            # Aggregation pipeline for stats by type
            pipeline = [
                {"$match": query},
                {
                    "$group": {
                        "_id": "$transaction_type",
                        "count": {"$sum": 1},
                        "total_cash_flow": {"$sum": "$cash_flow"},
                    }
                },
            ]

            cursor = self.collection.aggregate(pipeline)
            stats_by_type = {}
            async for doc in cursor:
                stats_by_type[doc["_id"]] = {
                    "count": doc["count"],
                    "total_cash_flow": doc["total_cash_flow"],
                }

            # Get total count
            total_count = await self.collection.count_documents(query)

            return {
                "total_transactions": total_count,
                "by_type": stats_by_type,
            }
        except Exception as e:
            logger.error("Error getting transaction stats: %s", e)
            raise

    async def get_summary(
        self,
        username: str,
        account_name: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Get aggregated transaction summary for an account.

        Returns totals for buys, sells, deposits, and withdrawals.
        """
        stats = await self.get_transaction_stats(
            username=username,
            account_name=account_name,
            start_date=start_date,
            end_date=end_date,
        )

        by_type = stats.get("by_type", {})

        return {
            "username": username,
            "account_name": account_name,
            "total_transactions": stats.get("total_transactions", 0),
            "total_buys": by_type.get("BUY", {}).get("total_cash_flow", 0),
            "total_sells": by_type.get("SELL", {}).get("total_cash_flow", 0),
            "total_deposits": by_type.get("DEPOSIT", {}).get("total_cash_flow", 0),
            "total_withdrawals": by_type.get("WITHDRAWAL", {}).get("total_cash_flow", 0),
            "total_dividends": by_type.get("DIVIDEND", {}).get("total_cash_flow", 0),
        }

    async def ensure_indexes(self) -> None:
        """Create indexes for efficient querying."""
        try:
            await self.collection.create_index("username")
            await self.collection.create_index([("username", 1), ("account_name", 1)])
            await self.collection.create_index(
                [("username", 1), ("account_name", 1), ("transaction_date", 1)]
            )
            await self.collection.create_index("transaction_date")
            await self.collection.create_index([("transaction_date", -1)])
            await self.collection.create_index("transaction_type")
            await self.collection.create_index("symbol")
            logger.info("Transaction indexes created")
        except Exception as e:
            logger.warning("Error creating transaction indexes: %s", e)
