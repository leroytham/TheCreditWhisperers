# app/services/sector_cache_service.py
"""
Service for managing sector data caching in MongoDB.
Provides persistent caching layer beneath Redis for sector news and sentiment data.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import logging
from pymongo import UpdateOne
from pymongo.errors import DuplicateKeyError

from app.database import (
    get_sector_news_cache_collection,
    get_sector_daily_sentiment_collection,
    get_news_articles_master_collection
)
from app.models.sector_cache import (
    SectorNewsCache,
    SectorDailySentiment,
    NewsArticleMaster,
    create_cache_key,
    calculate_expiry_time
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class SectorCacheService:
    """Service for managing sector data in MongoDB cache."""

    def __init__(self):
        """Initialize the sector cache service."""
        self.sector_news_cache = get_sector_news_cache_collection()
        self.sector_daily_sentiment = get_sector_daily_sentiment_collection()
        self.news_articles_master = get_news_articles_master_collection()

    # ============= Sector News Cache Operations =============

    async def get_cached_sector_news(
        self,
        sector_key: str,
        timeframe: str,
        limit: int = 100
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached sector news from MongoDB.

        Args:
            sector_key: yfinance sector key (e.g., 'technology')
            timeframe: Time range (e.g., '1W', '1M')
            limit: Maximum number of articles

        Returns:
            Cached news data or None if not found/expired
        """
        cache_key = create_cache_key(sector_key, timeframe, limit)

        try:
            # Find non-expired cache entry
            cached_entry = self.sector_news_cache.find_one({
                "cache_key": cache_key,
                "expires_at": {"$gte": datetime.now(timezone.utc)}
            })

            if cached_entry:
                logger.info(f"MongoDB cache hit for sector news: {cache_key}")
                # Remove MongoDB-specific fields
                cached_entry.pop("_id", None)
                cached_entry.pop("expires_at", None)
                cached_entry["cached"] = True
                cached_entry["cache_source"] = "mongodb"
                return cached_entry

            logger.info(f"MongoDB cache miss for sector news: {cache_key}")
            return None

        except Exception as e:
            logger.error(f"Error retrieving cached sector news: {str(e)}")
            return None

    async def store_sector_news(
        self,
        sector_key: str,
        timeframe: str,
        limit: int,
        news_data: Dict[str, Any],
        ttl_seconds: int = None
    ) -> bool:
        """
        Store sector news in MongoDB cache.

        Args:
            sector_key: yfinance sector key
            timeframe: Time range
            limit: Maximum number of articles
            news_data: Complete news response data
            ttl_seconds: Time to live in seconds (default: SECTOR_CACHE_TTL)

        Returns:
            Success status
        """
        if ttl_seconds is None:
            ttl_seconds = settings.SECTOR_CACHE_TTL

        cache_key = create_cache_key(sector_key, timeframe, limit)
        expires_at = calculate_expiry_time(ttl_seconds)

        try:
            cache_entry = SectorNewsCache(
                sector_key=sector_key,
                timeframe=timeframe,
                cache_key=cache_key,
                articles=news_data.get("articles", []),
                sentiment_metrics=news_data.get("sentiment_metrics"),
                metadata=news_data.get("metadata", {}),
                tickers_queried=news_data.get("tickers_queried", []),
                total_articles_fetched=news_data.get("total_articles_fetched", 0),
                unique_articles=news_data.get("unique_articles", 0),
                deduplication_rate=news_data.get("deduplication_rate", 0.0),
                market_weight_coverage=news_data.get("market_weight_coverage"),
                expires_at=expires_at
            )

            # Upsert the cache entry
            result = self.sector_news_cache.replace_one(
                {"cache_key": cache_key},
                cache_entry.dict(by_alias=True),
                upsert=True
            )

            logger.info(f"Stored sector news in MongoDB: {cache_key} (TTL: {ttl_seconds}s)")
            return result.acknowledged

        except Exception as e:
            logger.error(f"Error storing sector news: {str(e)}")
            return False

    # ============= Daily Sentiment Cache Operations =============

    async def get_cached_daily_sentiment(
        self,
        sector_key: str,
        days: int = 30
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached daily sentiment data from MongoDB.

        Args:
            sector_key: yfinance sector key
            days: Number of days of data

        Returns:
            Daily sentiment data or None if not found
        """
        try:
            # Calculate date range
            end_date = datetime.now(timezone.utc).date()
            start_date = end_date - timedelta(days=days)

            # Query for daily sentiment entries
            cursor = self.sector_daily_sentiment.find({
                "sector_key": sector_key,
                "date": {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            }).sort("date", -1)

            # Format results
            daily_data = {}
            for entry in cursor:
                date_key = entry["date"]
                daily_data[date_key] = {
                    "score": entry["sentiment_score"],
                    "count": entry["article_count"],
                    "headlines": entry.get("headlines", []),
                    "ticker_mentions": entry.get("ticker_mentions", 0),
                    "metadata": entry.get("metadata", {})
                }

            if daily_data:
                logger.info(f"MongoDB cache hit for daily sentiment: {sector_key} ({len(daily_data)} days)")
                return {
                    "sector_key": sector_key,
                    "daily": daily_data,
                    "cached": True,
                    "cache_source": "mongodb"
                }

            logger.info(f"MongoDB cache miss for daily sentiment: {sector_key}")
            return None

        except Exception as e:
            logger.error(f"Error retrieving cached daily sentiment: {str(e)}")
            return None

    async def store_daily_sentiment(
        self,
        sector_key: str,
        daily_sentiment_data: Dict[str, Dict]
    ) -> bool:
        """
        Store daily sentiment data in MongoDB.

        Args:
            sector_key: yfinance sector key
            daily_sentiment_data: Dictionary with date as key and sentiment data as value

        Returns:
            Success status
        """
        try:
            operations = []

            for date_str, sentiment_data in daily_sentiment_data.items():
                entry = SectorDailySentiment(
                    sector_key=sector_key,
                    date=date_str,
                    sentiment_score=sentiment_data.get("score", 0.0),
                    article_count=sentiment_data.get("count", 0),
                    headlines=sentiment_data.get("headlines", []),
                    ticker_mentions=sentiment_data.get("ticker_mentions", 0),
                    metadata=sentiment_data.get("metadata", {}),
                    bullish_mentions=sentiment_data.get("bullish_mentions", 0),
                    bearish_mentions=sentiment_data.get("bearish_mentions", 0),
                    neutral_mentions=sentiment_data.get("neutral_mentions", 0),
                    breadth_score=sentiment_data.get("breadth_score")
                )

                # Create upsert operation
                operations.append(
                    UpdateOne(
                        {"sector_key": sector_key, "date": date_str},
                        {"$set": entry.dict(by_alias=True)},
                        upsert=True
                    )
                )

            if operations:
                result = self.sector_daily_sentiment.bulk_write(operations)
                logger.info(f"Stored {result.upserted_count + result.modified_count} daily sentiment entries for {sector_key}")
                return result.acknowledged

            return True

        except Exception as e:
            logger.error(f"Error storing daily sentiment: {str(e)}")
            return False

    # ============= News Articles Master Operations =============

    async def store_articles_master(
        self,
        articles: List[Dict[str, Any]]
    ) -> int:
        """
        Store articles in master collection for cross-sector deduplication.

        Args:
            articles: List of article dictionaries

        Returns:
            Number of new articles stored
        """
        if not articles:
            return 0

        stored_count = 0

        for article in articles:
            try:
                # Extract ticker sentiment for sectors
                ticker_sentiment = article.get("ticker_sentiment", [])
                sectors = self._extract_sectors_from_tickers(ticker_sentiment)
                tickers_mentioned = [ts.get("ticker") for ts in ticker_sentiment if ts.get("ticker")]

                # Create master article entry
                master_article = NewsArticleMaster(
                    url=article["url"],
                    title=article["title"],
                    normalized_title=article.get("normalized_title", article["title"].lower().strip()),
                    summary=article.get("summary"),
                    publish_date=article.get("publish_date", ""),
                    publish_timestamp=datetime.fromisoformat(article["publish_timestamp"])
                        if article.get("publish_timestamp") else datetime.now(timezone.utc),
                    provider=article.get("provider", "unknown"),
                    authors=article.get("authors", []),
                    ticker_sentiment=ticker_sentiment,
                    overall_sentiment_score=article.get("overall_sentiment_score"),
                    overall_sentiment_label=article.get("overall_sentiment_label"),
                    topics=article.get("topics", []),
                    sectors=sectors,
                    tickers_mentioned=tickers_mentioned,
                    source_api=article.get("source_api", "alpha_vantage")
                )

                # Try to insert (will fail if URL already exists)
                self.news_articles_master.insert_one(master_article.dict(by_alias=True))
                stored_count += 1

            except DuplicateKeyError:
                # Article already exists, update last_accessed
                self.news_articles_master.update_one(
                    {"url": article["url"]},
                    {
                        "$set": {"last_accessed": datetime.now(timezone.utc)},
                        "$inc": {"fetch_count": 1}
                    }
                )
            except Exception as e:
                logger.warning(f"Error storing article {article.get('url', 'unknown')}: {str(e)}")

        if stored_count > 0:
            logger.info(f"Stored {stored_count} new articles in master collection")

        return stored_count

    def _extract_sectors_from_tickers(self, ticker_sentiment: List[Dict]) -> List[str]:
        """
        Extract sector information from ticker sentiment data.
        This is a simplified version - you may want to enhance with actual ticker-to-sector mapping.
        """
        # This would ideally map tickers to their sectors
        # For now, returning empty list - can be enhanced later
        return []

    # ============= Cache Management Operations =============

    async def invalidate_sector_cache(self, sector_key: str) -> bool:
        """
        Invalidate all cache entries for a specific sector.

        Args:
            sector_key: yfinance sector key

        Returns:
            Success status
        """
        try:
            # Remove from sector news cache
            news_result = self.sector_news_cache.delete_many({"sector_key": sector_key})

            # Remove from daily sentiment cache
            sentiment_result = self.sector_daily_sentiment.delete_many({"sector_key": sector_key})

            logger.info(f"Invalidated cache for sector {sector_key}: "
                       f"{news_result.deleted_count} news entries, "
                       f"{sentiment_result.deleted_count} sentiment entries")

            return True

        except Exception as e:
            logger.error(f"Error invalidating sector cache: {str(e)}")
            return False

    async def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the cache.

        Returns:
            Cache statistics
        """
        try:
            news_count = self.sector_news_cache.count_documents({})
            sentiment_count = self.sector_daily_sentiment.count_documents({})
            articles_count = self.news_articles_master.count_documents({})

            # Get cache sizes
            news_stats = self.sector_news_cache.aggregate([
                {"$group": {
                    "_id": None,
                    "total_size": {"$sum": {"$bsonSize": "$$ROOT"}}
                }}
            ])

            news_size = 0
            for stat in news_stats:
                news_size = stat.get("total_size", 0)

            return {
                "sector_news_entries": news_count,
                "daily_sentiment_entries": sentiment_count,
                "master_articles": articles_count,
                "estimated_size_mb": round(news_size / (1024 * 1024), 2)
            }

        except Exception as e:
            logger.error(f"Error getting cache stats: {str(e)}")
            return {}


# Create singleton instance
sector_cache_service = SectorCacheService()