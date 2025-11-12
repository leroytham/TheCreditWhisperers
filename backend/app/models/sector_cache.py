# app/models/sector_cache.py
"""
MongoDB models for sector data caching.
"""

from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any
from bson import ObjectId


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic models."""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")


class SectorNewsCache(BaseModel):
    """Model for cached sector news data."""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    sector_key: str = Field(..., description="yfinance sector key (e.g., 'technology')")
    timeframe: str = Field(..., description="Time range (e.g., '1W', '1M')")
    cache_key: str = Field(..., description="Unique cache key for Redis compatibility")

    # Cached data
    articles: List[Dict[str, Any]] = Field(default_factory=list, description="List of news articles")
    sentiment_metrics: Optional[Dict[str, Any]] = Field(None, description="Computed sentiment metrics")

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    tickers_queried: List[str] = Field(default_factory=list, description="Tickers that were queried")
    total_articles_fetched: int = Field(0, description="Total articles before deduplication")
    unique_articles: int = Field(0, description="Count after deduplication")
    deduplication_rate: float = Field(0.0, description="Percentage of duplicates removed")
    market_weight_coverage: Optional[float] = Field(None, description="Market weight coverage")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(..., description="TTL expiration timestamp")
    version: int = Field(1, description="Cache version for invalidation")

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        schema_extra = {
            "example": {
                "sector_key": "technology",
                "timeframe": "1W",
                "cache_key": "sector_news:technology:1W:limit100",
                "articles": [],
                "sentiment_metrics": {},
                "metadata": {"source": "alpha_vantage"},
                "tickers_queried": ["AAPL", "MSFT", "NVDA"],
                "total_articles_fetched": 487,
                "unique_articles": 245,
                "deduplication_rate": 49.69,
                "market_weight_coverage": 0.85
            }
        }


class SectorDailySentiment(BaseModel):
    """Model for daily sector sentiment data."""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    sector_key: str = Field(..., description="yfinance sector key")
    date: str = Field(..., description="Date in YYYY-MM-DD format")

    # Sentiment data
    sentiment_score: float = Field(..., description="Daily sentiment score")
    article_count: int = Field(..., description="Number of articles")
    headlines: List[str] = Field(default_factory=list, description="Top headlines for the day")
    ticker_mentions: int = Field(0, description="Total ticker mentions")

    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metrics")
    bullish_mentions: int = Field(0, description="Count of bullish mentions")
    bearish_mentions: int = Field(0, description="Count of bearish mentions")
    neutral_mentions: int = Field(0, description="Count of neutral mentions")
    breadth_score: Optional[float] = Field(None, description="Market breadth score")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        schema_extra = {
            "example": {
                "sector_key": "technology",
                "date": "2025-01-12",
                "sentiment_score": 0.24,
                "article_count": 1234,
                "headlines": ["Apple announces...", "Microsoft reports..."],
                "ticker_mentions": 45,
                "metadata": {"momentum": 0.15},
                "bullish_mentions": 28,
                "bearish_mentions": 17,
                "neutral_mentions": 0,
                "breadth_score": 0.35
            }
        }


class NewsArticleMaster(BaseModel):
    """Model for master news article storage (for deduplication across sectors)."""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    url: str = Field(..., description="Article URL (unique)")
    title: str = Field(..., description="Article title")
    normalized_title: str = Field(..., description="Normalized title for dedup")

    # Article details
    summary: Optional[str] = Field(None, description="Article summary")
    publish_date: str = Field(..., description="Publish date YYYY-MM-DD")
    publish_timestamp: datetime = Field(..., description="Full publish timestamp")
    provider: str = Field(..., description="News provider")
    authors: List[str] = Field(default_factory=list, description="Article authors")

    # Sentiment data
    ticker_sentiment: List[Dict[str, Any]] = Field(default_factory=list, description="Per-ticker sentiment")
    overall_sentiment_score: Optional[float] = Field(None, description="Overall article sentiment")
    overall_sentiment_label: Optional[str] = Field(None, description="Sentiment label")

    # Categorization
    topics: List[str] = Field(default_factory=list, description="Article topics")
    sectors: List[str] = Field(default_factory=list, description="Related sectors")
    tickers_mentioned: List[str] = Field(default_factory=list, description="All tickers mentioned")

    # Metadata
    source_api: str = Field("alpha_vantage", description="Source API")
    fetch_count: int = Field(1, description="Number of times fetched")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_accessed: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}
        schema_extra = {
            "example": {
                "url": "https://example.com/article",
                "title": "Apple announces new AI features",
                "normalized_title": "apple announces new ai features",
                "summary": "Apple Inc. unveiled...",
                "publish_date": "2025-01-12",
                "publish_timestamp": "2025-01-12T09:15:00Z",
                "provider": "Reuters",
                "authors": ["John Doe"],
                "ticker_sentiment": [
                    {"ticker": "AAPL", "sentiment_score": 0.45, "relevance_score": 0.89},
                    {"ticker": "MSFT", "sentiment_score": 0.12, "relevance_score": 0.34}
                ],
                "overall_sentiment_score": 0.35,
                "overall_sentiment_label": "Bullish",
                "topics": ["earnings", "technology", "AI"],
                "sectors": ["technology"],
                "tickers_mentioned": ["AAPL", "MSFT"]
            }
        }


# Helper functions for MongoDB operations
def create_cache_key(sector_key: str, timeframe: str, limit: int) -> str:
    """Generate a consistent cache key for sector news."""
    return f"sector_news:{sector_key}:{timeframe}:limit{limit}"


def calculate_expiry_time(ttl_seconds: int = 3600) -> datetime:
    """Calculate expiry time for cache entries."""
    return datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)