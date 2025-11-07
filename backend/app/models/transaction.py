"""
Transaction model for MongoDB persistence.

This module provides transaction tracking for portfolio changes, enabling
accurate Time-Weighted Return (TWR) calculations that account for cash flows.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator
from bson import ObjectId


class TransactionType(str, Enum):
    """Types of portfolio transactions."""
    BUY = "BUY"                      # Purchase of securities
    SELL = "SELL"                    # Sale of securities
    DEPOSIT = "DEPOSIT"              # Cash deposit into portfolio
    WITHDRAWAL = "WITHDRAWAL"        # Cash withdrawal from portfolio
    DIVIDEND = "DIVIDEND"            # Dividend payment received
    SPLIT = "SPLIT"                  # Stock split adjustment
    REINVEST = "REINVEST"            # Dividend reinvestment


class TransactionModel(BaseModel):
    """
    Represents a portfolio transaction in MongoDB.

    Tracks all changes to portfolio positions and cash flows, enabling
    accurate Time-Weighted Return (TWR) calculations.
    """

    # MongoDB ObjectId as string
    id: Optional[str] = Field(None, alias="_id")

    # Portfolio identification
    username: str
    account_name: str  # Maps to client_account_name in Stock_Holding
    account_no: Optional[str] = None

    # Transaction details
    transaction_date: date  # End-of-day granularity (YYYY-MM-DD)
    transaction_type: TransactionType

    # Security details (for BUY/SELL/DIVIDEND/SPLIT/REINVEST transactions)
    symbol: Optional[str] = None  # Stock ticker (e.g., "AAPL")
    quantity: Optional[float] = None  # Number of shares
    price: Optional[float] = None  # Price per share

    # Cash flow amount (critical for TWR calculation)
    # Positive = money flowing INTO portfolio (BUY, DEPOSIT, DIVIDEND)
    # Negative = money flowing OUT of portfolio (SELL, WITHDRAWAL)
    # For BUY: -1 * (quantity * price + fees)
    # For SELL: +1 * (quantity * price - fees)
    # For DEPOSIT/WITHDRAWAL: the cash amount
    cash_flow: float

    # Additional details
    fees: float = 0.0  # Trading fees/commissions
    notes: Optional[str] = None  # User notes or description

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(datetime.UTC if hasattr(datetime, 'UTC') else timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(datetime.UTC if hasattr(datetime, 'UTC') else timezone.utc))
    source: str = "manual"  # "manual", "import", "system"

    @model_validator(mode='after')
    def validate_transaction(self):
        """Validate transaction fields based on transaction type."""
        # Validate cash_flow is non-zero
        if self.cash_flow == 0:
            raise ValueError("cash_flow cannot be zero")

        # Validate cash_flow sign matches transaction type
        if self.transaction_type in [TransactionType.DEPOSIT, TransactionType.SELL, TransactionType.DIVIDEND]:
            if self.cash_flow < 0:
                raise ValueError(f"{self.transaction_type} must have positive cash_flow")
        elif self.transaction_type in [TransactionType.WITHDRAWAL, TransactionType.BUY]:
            if self.cash_flow > 0:
                raise ValueError(f"{self.transaction_type} must have negative cash_flow")

        # Validate symbol is provided for security transactions
        if self.transaction_type in [TransactionType.BUY, TransactionType.SELL,
                                      TransactionType.DIVIDEND, TransactionType.SPLIT,
                                      TransactionType.REINVEST]:
            if not self.symbol:
                raise ValueError(f"{self.transaction_type} requires a symbol")

        # Validate quantity is provided for security transactions
        if self.transaction_type in [TransactionType.BUY, TransactionType.SELL,
                                      TransactionType.REINVEST, TransactionType.SPLIT]:
            if not self.quantity or self.quantity <= 0:
                raise ValueError(f"{self.transaction_type} requires positive quantity")

        return self

    class Config:
        populate_by_name = True  # Renamed from allow_population_by_field_name in v2
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }
        use_enum_values = True

    def to_dict(self) -> dict:
        """Convert to dictionary for MongoDB insertion."""
        data = self.model_dump(by_alias=True, exclude_none=False)

        # Remove None id field if not set, or convert to ObjectId if set
        if "_id" in data:
            if data["_id"] is None:
                del data["_id"]
            else:
                data["_id"] = ObjectId(data["_id"])

        # Convert date to datetime for MongoDB storage
        if "transaction_date" in data and isinstance(data["transaction_date"], date):
            data["transaction_date"] = datetime.combine(data["transaction_date"], datetime.min.time())

        # Remove other None values
        data = {k: v for k, v in data.items() if v is not None}

        return data

    @classmethod
    def from_dict(cls, data: dict) -> "TransactionModel":
        """Create from MongoDB document."""
        if "_id" in data and data["_id"]:
            data["_id"] = str(data["_id"])
        # Convert datetime back to date
        if "transaction_date" in data and isinstance(data["transaction_date"], datetime):
            data["transaction_date"] = data["transaction_date"].date()
        return cls(**data)


class CreateTransactionRequest(BaseModel):
    """Request model for creating a new transaction."""

    account_name: str
    account_no: Optional[str] = None
    transaction_date: date
    transaction_type: TransactionType
    symbol: Optional[str] = None
    quantity: Optional[float] = None
    price: Optional[float] = None
    cash_flow: float
    fees: float = 0.0
    notes: Optional[str] = None


class TransactionSummary(BaseModel):
    """Lightweight transaction summary for API responses."""

    transaction_id: str
    transaction_date: date
    transaction_type: TransactionType
    symbol: Optional[str]
    quantity: Optional[float]
    cash_flow: float
    notes: Optional[str]

    @classmethod
    def from_transaction_model(cls, transaction: TransactionModel) -> "TransactionSummary":
        """Create summary from full transaction model."""
        return cls(
            transaction_id=transaction.id or "",
            transaction_date=transaction.transaction_date,
            transaction_type=transaction.transaction_type,
            symbol=transaction.symbol,
            quantity=transaction.quantity,
            cash_flow=transaction.cash_flow,
            notes=transaction.notes
        )


# Database operations for Transactions
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from motor.motor_asyncio import AsyncIOMotorCollection


async def get_transactions_collection(db: AsyncIOMotorDatabase) -> "AsyncIOMotorCollection":
    """Get the portfolio_transactions collection with proper indexes."""
    collection = db.portfolio_transactions

    # Create indexes for efficient querying
    await collection.create_index("username")
    await collection.create_index([("username", 1), ("account_name", 1)])
    await collection.create_index([("username", 1), ("account_name", 1), ("transaction_date", 1)])
    await collection.create_index("transaction_date")
    await collection.create_index([("transaction_date", -1)])  # Descending for recent first
    await collection.create_index("transaction_type")
    await collection.create_index("symbol")

    return collection


async def create_transaction(
    db: AsyncIOMotorDatabase,
    username: str,
    transaction: CreateTransactionRequest
) -> str:
    """Create a new transaction in MongoDB."""
    collection = await get_transactions_collection(db)

    # Create full transaction model
    transaction_model = TransactionModel(
        username=username,
        account_name=transaction.account_name,
        account_no=transaction.account_no,
        transaction_date=transaction.transaction_date,
        transaction_type=transaction.transaction_type,
        symbol=transaction.symbol,
        quantity=transaction.quantity,
        price=transaction.price,
        cash_flow=transaction.cash_flow,
        fees=transaction.fees,
        notes=transaction.notes
    )

    result = await collection.insert_one(transaction_model.to_dict())
    return str(result.inserted_id)


async def get_transaction_by_id(
    db: AsyncIOMotorDatabase,
    transaction_id: str
) -> Optional[TransactionModel]:
    """Get a transaction by its ID."""
    collection = await get_transactions_collection(db)

    try:
        doc = await collection.find_one({"_id": ObjectId(transaction_id)})
        return TransactionModel.from_dict(doc) if doc else None
    except:
        return None


async def get_transactions(
    db: AsyncIOMotorDatabase,
    username: str,
    account_name: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    transaction_type: Optional[TransactionType] = None,
    symbol: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
) -> List[TransactionModel]:
    """
    Get transactions with optional filters.

    Args:
        db: Database connection
        username: User identifier
        account_name: Portfolio/account name
        start_date: Filter transactions on or after this date
        end_date: Filter transactions on or before this date
        transaction_type: Filter by transaction type
        symbol: Filter by stock symbol
        limit: Maximum number of results
        skip: Number of results to skip (for pagination)

    Returns:
        List of transactions sorted by date (most recent first)
    """
    collection = await get_transactions_collection(db)

    # Build query
    query = {
        "username": username,
        "account_name": account_name
    }

    if start_date or end_date:
        query["transaction_date"] = {}
        if start_date:
            query["transaction_date"]["$gte"] = datetime.combine(start_date, datetime.min.time())
        if end_date:
            query["transaction_date"]["$lte"] = datetime.combine(end_date, datetime.max.time())

    if transaction_type:
        query["transaction_type"] = transaction_type.value

    if symbol:
        query["symbol"] = symbol.upper()

    # Execute query
    cursor = collection.find(query).sort("transaction_date", -1).skip(skip).limit(limit)

    transactions = []
    async for doc in cursor:
        transactions.append(TransactionModel.from_dict(doc))

    return transactions


async def get_cash_flows_between_dates(
    db: AsyncIOMotorDatabase,
    username: str,
    account_name: str,
    start_date: date,
    end_date: date
) -> List[Dict[str, Any]]:
    """
    Get all cash flows between two dates for TWR calculation.

    Returns list of {date, amount} dictionaries sorted by date.
    """
    collection = await get_transactions_collection(db)

    query = {
        "username": username,
        "account_name": account_name,
        "transaction_date": {
            "$gte": datetime.combine(start_date, datetime.min.time()),
            "$lte": datetime.combine(end_date, datetime.max.time())
        }
    }

    cursor = collection.find(query).sort("transaction_date", 1)

    cash_flows = []
    async for doc in cursor:
        transaction = TransactionModel.from_dict(doc)
        cash_flows.append({
            "date": transaction.transaction_date,
            "amount": transaction.cash_flow,
            "type": transaction.transaction_type,
            "symbol": transaction.symbol
        })

    return cash_flows


async def delete_transaction(
    db: AsyncIOMotorDatabase,
    transaction_id: str,
    username: str
) -> bool:
    """Delete a transaction (with ownership check)."""
    collection = await get_transactions_collection(db)

    try:
        result = await collection.delete_one({
            "_id": ObjectId(transaction_id),
            "username": username  # Ensure user owns this transaction
        })
        return result.deleted_count > 0
    except:
        return False


async def update_transaction(
    db: AsyncIOMotorDatabase,
    transaction_id: str,
    username: str,
    updates: Dict[str, Any]
) -> bool:
    """Update a transaction (with ownership check)."""
    collection = await get_transactions_collection(db)

    # Add updated_at timestamp
    updates["updated_at"] = datetime.now(timezone.utc)

    # Convert date if present
    if "transaction_date" in updates and isinstance(updates["transaction_date"], date):
        updates["transaction_date"] = datetime.combine(updates["transaction_date"], datetime.min.time())

    try:
        result = await collection.update_one(
            {"_id": ObjectId(transaction_id), "username": username},
            {"$set": updates}
        )
        return result.modified_count > 0
    except:
        return False


async def get_transaction_stats(
    db: AsyncIOMotorDatabase,
    username: str,
    account_name: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> Dict[str, Any]:
    """Get transaction statistics for a portfolio."""
    collection = await get_transactions_collection(db)

    # Build query
    query = {
        "username": username,
        "account_name": account_name
    }

    if start_date or end_date:
        query["transaction_date"] = {}
        if start_date:
            query["transaction_date"]["$gte"] = datetime.combine(start_date, datetime.min.time())
        if end_date:
            query["transaction_date"]["$lte"] = datetime.combine(end_date, datetime.max.time())

    # Count by type
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$transaction_type",
            "count": {"$sum": 1},
            "total_cash_flow": {"$sum": "$cash_flow"}
        }}
    ]

    cursor = collection.aggregate(pipeline)
    stats_by_type = {}
    async for doc in cursor:
        stats_by_type[doc["_id"]] = {
            "count": doc["count"],
            "total_cash_flow": doc["total_cash_flow"]
        }

    # Get total count
    total_count = await collection.count_documents(query)

    return {
        "total_transactions": total_count,
        "by_type": stats_by_type
    }
