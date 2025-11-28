"""
Portfolio model for MongoDB persistence.

This module provides MongoDB-integrated Portfolio models that complement
the existing domain models in portfolio.py.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
from pydantic import BaseModel, Field
from bson import ObjectId
from bson.errors import InvalidId

logger = logging.getLogger(__name__)


class PortfolioModel(BaseModel):
    """
    Represents a user's portfolio in MongoDB.

    This model provides persistence for portfolios, linking users to their
    collections of holdings and enabling portfolio-specific notifications.
    """

    # MongoDB ObjectId as string
    id: Optional[str] = Field(None, alias="_id")

    # User identification
    username: str
    user_id: Optional[str] = None  # For future JWT integration

    # Portfolio identification
    account_name: str  # Maps to client_account_name in Stock_Holding
    portfolio_name: Optional[str] = None  # Display name
    account_no: Optional[str] = None  # Maps to account_no in Stock_Holding

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    is_primary: bool = False  # User's default portfolio

    # Holdings summary (cached for performance)
    holdings_count: int = 0
    total_value: float = 0.0
    tickers: List[str] = []

    # Notification preferences (portfolio-specific overrides)
    notification_preferences: Optional[Dict[str, Any]] = None

    class Config:
        # Allow MongoDB _id field
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }

    def to_dict(self) -> dict:
        """Convert to dictionary for MongoDB insertion."""
        data = self.dict(exclude_none=True, by_alias=True)
        if "_id" in data and data["_id"]:
            data["_id"] = ObjectId(data["_id"])
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "PortfolioModel":
        """Create from MongoDB document."""
        if "_id" in data and data["_id"]:
            data["_id"] = str(data["_id"])
        return cls(**data)


class PortfolioHoldingModel(BaseModel):
    """
    Represents a holding within a portfolio (denormalized for performance).

    This is a simplified version of Stock_Holding data that can be embedded
    in notifications or cached in the portfolio document.
    """

    ticker: str
    quantity: float
    purchase_price: float
    current_price: Optional[float] = None
    market_value: Optional[float] = None
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class PortfolioSummary(BaseModel):
    """
    Lightweight portfolio summary for API responses and notifications.
    """

    portfolio_id: str
    portfolio_name: str
    username: str
    account_name: str
    holdings_count: int
    total_value: float
    is_primary: bool

    @classmethod
    def from_portfolio_model(cls, portfolio: PortfolioModel) -> "PortfolioSummary":
        """Create summary from full portfolio model."""
        return cls(
            portfolio_id=portfolio.id or "",
            portfolio_name=portfolio.portfolio_name or portfolio.account_name,
            username=portfolio.username,
            account_name=portfolio.account_name,
            holdings_count=portfolio.holdings_count,
            total_value=portfolio.total_value,
            is_primary=portfolio.is_primary
        )


# Database operations for Portfolio
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from motor.motor_asyncio import AsyncIOMotorCollection


async def get_portfolios_collection(db: AsyncIOMotorDatabase) -> "AsyncIOMotorCollection":
    """Get the portfolios collection with proper indexes."""
    collection = db.portfolios

    # Create indexes
    await collection.create_index("username")
    await collection.create_index([("username", 1), ("account_name", 1)], unique=True)
    await collection.create_index([("username", 1), ("is_primary", -1)])
    await collection.create_index("created_at")

    return collection


async def create_portfolio(db: AsyncIOMotorDatabase, portfolio: PortfolioModel) -> str:
    """Create a new portfolio in MongoDB."""
    collection = await get_portfolios_collection(db)

    # Check if this is the first portfolio for the user
    existing_count = await collection.count_documents({"username": portfolio.username})
    if existing_count == 0:
        portfolio.is_primary = True

    result = await collection.insert_one(portfolio.to_dict())
    return str(result.inserted_id)


async def get_portfolio_by_id(db: AsyncIOMotorDatabase, portfolio_id: str) -> Optional[PortfolioModel]:
    """Get a portfolio by its ID."""
    collection = await get_portfolios_collection(db)

    try:
        doc = await collection.find_one({"_id": ObjectId(portfolio_id)})
        return PortfolioModel.from_dict(doc) if doc else None
    except InvalidId:
        logger.debug(f"Invalid portfolio ID format: {portfolio_id}")
        return None
    except Exception as e:
        logger.error(f"Error fetching portfolio {portfolio_id}: {e}")
        return None


async def get_portfolio_by_account(
    db: AsyncIOMotorDatabase,
    username: str,
    account_name: str
) -> Optional[PortfolioModel]:
    """Get a portfolio by username and account name."""
    collection = await get_portfolios_collection(db)

    doc = await collection.find_one({
        "username": username,
        "account_name": account_name
    })
    return PortfolioModel.from_dict(doc) if doc else None


async def get_user_portfolios(
    db: AsyncIOMotorDatabase,
    username: str,
    include_inactive: bool = False
) -> List[PortfolioModel]:
    """Get all portfolios for a user."""
    collection = await get_portfolios_collection(db)

    query = {"username": username}
    if not include_inactive:
        query["is_active"] = True

    cursor = collection.find(query).sort("is_primary", -1)
    portfolios = []
    async for doc in cursor:
        portfolios.append(PortfolioModel.from_dict(doc))

    return portfolios


async def get_user_primary_portfolio(
    db: AsyncIOMotorDatabase,
    username: str
) -> Optional[PortfolioModel]:
    """Get the user's primary portfolio."""
    collection = await get_portfolios_collection(db)

    doc = await collection.find_one({
        "username": username,
        "is_primary": True,
        "is_active": True
    })
    return PortfolioModel.from_dict(doc) if doc else None


async def update_portfolio_holdings_cache(
    db: AsyncIOMotorDatabase,
    portfolio_id: str,
    holdings: List[Dict[str, Any]]
) -> bool:
    """Update the cached holdings information in the portfolio."""
    collection = await get_portfolios_collection(db)

    # Calculate summary
    tickers = list(set(h.get("symbol", "") for h in holdings))
    holdings_count = len(holdings)
    total_value = sum(h.get("market_value", 0) for h in holdings)

    result = await collection.update_one(
        {"_id": ObjectId(portfolio_id)},
        {
            "$set": {
                "tickers": tickers,
                "holdings_count": holdings_count,
                "total_value": total_value,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return result.modified_count > 0


async def set_primary_portfolio(
    db: AsyncIOMotorDatabase,
    username: str,
    portfolio_id: str
) -> bool:
    """Set a portfolio as the user's primary portfolio."""
    collection = await get_portfolios_collection(db)

    # First, unset any existing primary
    await collection.update_many(
        {"username": username},
        {"$set": {"is_primary": False}}
    )

    # Then set the new primary
    result = await collection.update_one(
        {"_id": ObjectId(portfolio_id), "username": username},
        {"$set": {"is_primary": True}}
    )

    return result.modified_count > 0