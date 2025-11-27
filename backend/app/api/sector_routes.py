# app/api/sector_routes.py
"""
Sector data and analysis routes.

Endpoints:
- GET /sectors/{sector_ticker}/top-constituents - Top 10 sector constituents
- GET /sectors/{sector_identifier}/aggregated-news - Aggregated sector news
- GET /sectors/{sector_identifier}/daily-sentiment - Daily sector sentiment
"""

import logging
from fastapi import APIRouter, HTTPException

from app.services.stock_data_service import stock_data_service
from app.services.news_service import news_service_instance
from app.services.sector_service import sector_service_instance
from app.services.sector_sentiment_service import sector_sentiment_service
from app.core.cache import redis_cache, generate_cache_key
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sectors", tags=["Sectors"])


@router.get("/{sector_ticker}/top-constituents")
def get_top_constituents_for_sector(sector_ticker: str):
    """
    Get the top 10 constituents for a given sector.

    Args:
        sector_ticker: S&P 500 sector ticker (URL-encoded if contains special chars)
                      Example: ^SP500-45 should be %5EGSP500-45

    Returns:
        List of top constituents with market data

    Example: /sectors/%5EGSP500-45/top-constituents
    """
    try:
        constituents = stock_data_service.get_sector_top_constituents(sector_ticker)

        if not constituents:
            return {
                "success": True,
                "sector_ticker": sector_ticker,
                "top_constituents": []
            }

        return {
            "success": True,
            "sector_ticker": sector_ticker,
            "top_constituents": constituents
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching top constituents for {sector_ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.get("/{sector_identifier}/aggregated-news")
async def get_sector_aggregated_news(
    sector_identifier: str,
    limit: int = 100,
    timeframe: str = "1W"
):
    """
    Get aggregated news for all companies in a sector.

    This endpoint:
    1. Resolves the sector identifier to a yfinance sector key
    2. Fetches the list of constituent tickers dynamically
    3. Queries Alpha Vantage for news on each ticker in parallel
    4. Deduplicates by both URL and normalized title
    5. Returns comprehensive sector news with metadata

    Args:
        sector_identifier: Can be:
            - S&P 500 ticker (e.g., ^SP500-45 - URL-encoded as %5ESP500-45)
            - SPDR ETF ticker (e.g., XLK)
            - Sector name (e.g., "Information Technology")
            - yfinance sector key (e.g., "technology")
        limit: Maximum unique articles to return (default: 100)
        timeframe: Time range - "1D", "1W", "1M", etc. (default: "1W")

    Returns:
        {
            "success": true,
            "sector_key": "technology",
            "sector_name": "Information Technology",
            "tickers_queried": ["AAPL", "MSFT", ...],
            "total_tickers": 25,
            "total_articles_fetched": 487,
            "unique_articles": 245,
            "deduplication_rate": 49.69,
            "articles": [...],
            "timeframe": "1W",
            "cached": true,
            "metadata": {...}
        }

    Example: /sectors/XLK/aggregated-news?limit=50&timeframe=1W
    """
    try:
        # Resolve sector identifier to yfinance key
        sector_key = sector_service_instance.resolve_sector_key(sector_identifier)

        # Fetch aggregated news
        result = await news_service_instance.get_sector_news(
            sector_key=sector_key,
            limit=limit,
            timeframe=timeframe
        )

        return {
            "success": True,
            **result
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching aggregated news for sector {sector_identifier}: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.get("/{sector_identifier}/daily-sentiment")
async def get_sector_daily_sentiment(
    sector_identifier: str,
    days: int = 30
):
    """
    Get daily sector-wide sentiment scores for charting.

    This endpoint:
    1. Resolves the sector identifier to a yfinance sector key
    2. Fetches aggregated news for the sector
    3. Groups articles by date and calculates daily sector sentiment
    4. Returns daily sentiment data compatible with CombinedSentimentVolumeChart

    Args:
        sector_identifier: Can be:
            - S&P 500 ticker (e.g., ^SP500-45)
            - SPDR ETF ticker (e.g., XLK)
            - Sector name (e.g., "Information Technology")
            - yfinance sector key (e.g., "technology")
        days: Number of days to include (default: 30)

    Returns:
        {
            "success": true,
            "sector_key": "technology",
            "sector_name": "Information Technology",
            "daily": {
                "2025-10-25": {"score": 0.24, "count": 1234, "headlines": [...]},
                ...
            }
        }

    Example: /sectors/technology/daily-sentiment?days=30
    """
    try:
        # Generate cache key for this endpoint
        cache_key = generate_cache_key(
            "sector_daily_sentiment_v1",
            sector_identifier,
            days=days
        )

        # Try to get from cache
        cached_result = await redis_cache.aget(cache_key)
        if cached_result is not None:
            logger.debug(f"Cache hit for daily sentiment: {sector_identifier}")
            cached_result['cached'] = True
            return cached_result

        logger.debug(f"Cache miss for daily sentiment: {sector_identifier}")

        # Resolve sector identifier to yfinance key
        sector_key = sector_service_instance.resolve_sector_key(sector_identifier)

        # Get sector metadata
        sector_metadata = sector_service_instance.get_sector_metadata(sector_key)

        # Get sector tickers
        tickers, _ = sector_service_instance.get_sector_tickers(sector_key)

        # Map days to timeframe for news fetch
        timeframe_map = {7: "1W", 14: "2W", 30: "1M", 60: "2M", 90: "3M"}
        timeframe = timeframe_map.get(days, "1M")

        # Fetch aggregated news with higher limit for full coverage
        news_result = await news_service_instance.get_sector_news(
            sector_key=sector_key,
            limit=5000,
            timeframe=timeframe
        )

        # Calculate daily sentiment
        daily_sentiment = sector_sentiment_service.calculate_daily_sector_sentiment(
            articles=news_result['articles'],
            sector_tickers=tickers,
            days=days
        )

        result = {
            "success": True,
            "sector_key": sector_key,
            "sector_name": sector_metadata['display_name'],
            "daily": daily_sentiment,
            "cached": False
        }

        # Cache the result with sentiment-specific TTL (15 minutes)
        await redis_cache.aset(cache_key, result, ttl=settings.SENTIMENT_CACHE_TTL)

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating daily sentiment for sector {sector_identifier}: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")
