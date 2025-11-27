# =============================================================================
# Portfolio Models
# =============================================================================

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from bson import ObjectId


class PortfolioModel(BaseModel):
    """Portfolio persistence model."""

    id: Optional[str] = Field(None, alias="_id")
    username: str
    user_id: Optional[str] = None
    account_name: str
    portfolio_name: Optional[str] = None
    account_no: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    is_primary: bool = False

    holdings_count: int = 0
    total_value: float = 0.0
    tickers: List[str] = []

    notification_preferences: Optional[Dict[str, Any]] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }

    def to_dict(self) -> dict:
        """Convert to dictionary for MongoDB."""
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


class HoldingModel(BaseModel):
    """Individual holding within a portfolio."""

    symbol: str
    quantity: float
    purchase_price: float
    purchase_date: Optional[str] = None
    market_value: Optional[float] = None
    current_price: Optional[float] = None
    lots: List[Dict[str, Any]] = []


class PortfolioSummary(BaseModel):
    """Lightweight portfolio summary."""

    portfolio_id: str
    portfolio_name: str
    username: str
    account_name: str
    holdings_count: int
    total_value: float
    is_primary: bool


# Request/Response models
class PortfolioSentimentRequest(BaseModel):
    """Request for portfolio sentiment analysis."""

    holdings: List[HoldingModel]
    timeframe: str = "1M"


class PortfolioTimeseriesRequest(BaseModel):
    """Request for portfolio timeseries data."""

    holdings: List[HoldingModel]
    timeframe: str = "1Y"
