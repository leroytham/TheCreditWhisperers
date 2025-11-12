# app/services/cache_warmer.py
"""
Cache warming service to pre-fetch and cache data for critical sectors.
Focuses on Information Technology sector for optimal performance.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any

from app.services.news_service import news_service_instance
from app.services.sector_service import sector_service_instance
from app.services.sector_sentiment_service import sector_sentiment_service
from app.services.sector_cache_service import sector_cache_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheWarmerService:
    """Service for warming up caches with frequently accessed data."""

    def __init__(self):
        """Initialize the cache warmer service."""
        self.is_running = False
        self.last_warm_time = None

    async def warm_it_sector_cache(self) -> Dict[str, Any]:
        """
        Warm up cache for Information Technology sector.
        This pre-fetches all commonly accessed data for the IT sector.

        Returns:
            Status dictionary with warming results
        """
        logger.info("🔥 Starting cache warming for Information Technology sector...")
        start_time = datetime.now(timezone.utc)
        results = {
            "sector": "technology",
            "started_at": start_time.isoformat(),
            "tasks": {}
        }

        try:
            # 1. Warm up news cache for different timeframes
            news_timeframes = ["1W", "1M"]  # Most common timeframes
            news_limits = [100, 500, 1000]  # Different limit options

            for timeframe in news_timeframes:
                for limit in news_limits:
                    try:
                        logger.info(f"Fetching IT sector news: timeframe={timeframe}, limit={limit}")
                        news_data = await news_service_instance.get_sector_news(
                            sector_key="technology",  # yfinance key for IT sector
                            limit=limit,
                            timeframe=timeframe
                        )
                        results["tasks"][f"news_{timeframe}_{limit}"] = {
                            "status": "success",
                            "articles_cached": len(news_data.get("articles", [])),
                            "cache_source": news_data.get("cache_source", "api")
                        }
                    except Exception as e:
                        logger.error(f"Failed to warm news cache ({timeframe}, {limit}): {str(e)}")
                        results["tasks"][f"news_{timeframe}_{limit}"] = {
                            "status": "failed",
                            "error": str(e)
                        }

            # 2. Warm up daily sentiment cache for common day ranges
            day_ranges = [7, 14, 30]  # Common chart ranges

            for days in day_ranges:
                try:
                    logger.info(f"Calculating IT sector daily sentiment: days={days}")

                    # Get sector tickers for calculation
                    tickers, _ = sector_service_instance.get_sector_tickers("technology")

                    # Fetch news (will use cached data from step 1)
                    timeframe = "1M" if days > 14 else "1W"
                    news_result = await news_service_instance.get_sector_news(
                        sector_key="technology",
                        limit=5000,
                        timeframe=timeframe
                    )

                    # Calculate and cache daily sentiment
                    daily_sentiment = sector_sentiment_service.calculate_daily_sector_sentiment(
                        articles=news_result['articles'],
                        sector_tickers=tickers,
                        days=days
                    )

                    # Store in MongoDB
                    await sector_cache_service.store_daily_sentiment(
                        sector_key="technology",
                        daily_sentiment_data=daily_sentiment
                    )

                    results["tasks"][f"sentiment_{days}d"] = {
                        "status": "success",
                        "days_cached": len(daily_sentiment)
                    }
                except Exception as e:
                    logger.error(f"Failed to warm sentiment cache ({days} days): {str(e)}")
                    results["tasks"][f"sentiment_{days}d"] = {
                        "status": "failed",
                        "error": str(e)
                    }

            # 3. Also warm up XLK (IT sector ETF) cache
            # XLK is commonly used as an identifier for IT sector
            try:
                logger.info("Warming cache for XLK (Technology Select Sector SPDR)")
                xlk_data = await news_service_instance.get_sector_news(
                    sector_key="XLK",
                    limit=100,
                    timeframe="1W"
                )
                results["tasks"]["xlk_cache"] = {
                    "status": "success",
                    "articles_cached": len(xlk_data.get("articles", []))
                }
            except Exception as e:
                logger.error(f"Failed to warm XLK cache: {str(e)}")
                results["tasks"]["xlk_cache"] = {
                    "status": "failed",
                    "error": str(e)
                }

            # Calculate warming duration
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            results["completed_at"] = end_time.isoformat()
            results["duration_seconds"] = round(duration, 2)

            self.last_warm_time = end_time

            # Log summary
            success_count = sum(1 for t in results["tasks"].values() if t.get("status") == "success")
            total_count = len(results["tasks"])
            logger.info(f"✅ Cache warming completed: {success_count}/{total_count} tasks successful in {duration:.1f}s")

            return results

        except Exception as e:
            logger.error(f"Cache warming failed: {str(e)}")
            results["error"] = str(e)
            results["status"] = "failed"
            return results

    async def warm_all_sectors_cache(self) -> Dict[str, Any]:
        """
        Warm up cache for all S&P 500 sectors.
        This is a more comprehensive warming that covers all 11 sectors.

        Returns:
            Status dictionary with warming results for all sectors
        """
        logger.info("🔥 Starting cache warming for ALL S&P 500 sectors...")

        # S&P 500 sector keys
        sector_keys = [
            "technology",           # Information Technology
            "healthcare",          # Health Care
            "financials",          # Financials
            "consumer_discretionary",  # Consumer Discretionary
            "communication_services",  # Communication Services
            "industrials",         # Industrials
            "consumer_staples",    # Consumer Staples
            "energy",              # Energy
            "utilities",           # Utilities
            "real_estate",         # Real Estate
            "materials"            # Materials
        ]

        results = {
            "started_at": datetime.now(timezone.utc).isoformat(),
            "sectors": {}
        }

        for sector_key in sector_keys:
            try:
                logger.info(f"Warming cache for sector: {sector_key}")

                # Fetch news for most common configuration
                news_data = await news_service_instance.get_sector_news(
                    sector_key=sector_key,
                    limit=100,
                    timeframe="1W"
                )

                results["sectors"][sector_key] = {
                    "status": "success",
                    "articles_cached": len(news_data.get("articles", []))
                }

            except Exception as e:
                logger.error(f"Failed to warm cache for {sector_key}: {str(e)}")
                results["sectors"][sector_key] = {
                    "status": "failed",
                    "error": str(e)
                }

        results["completed_at"] = datetime.now(timezone.utc).isoformat()
        return results

    async def start_periodic_warming(self, interval_hours: int = 1):
        """
        Start periodic cache warming for IT sector.

        Args:
            interval_hours: Hours between cache warming runs
        """
        if self.is_running:
            logger.warning("Cache warmer is already running")
            return

        self.is_running = True
        logger.info(f"Starting periodic cache warming (every {interval_hours} hours)")

        while self.is_running:
            try:
                await self.warm_it_sector_cache()
                await asyncio.sleep(interval_hours * 3600)  # Convert hours to seconds
            except Exception as e:
                logger.error(f"Error in periodic cache warming: {str(e)}")
                await asyncio.sleep(300)  # Wait 5 minutes before retrying

    def stop_periodic_warming(self):
        """Stop periodic cache warming."""
        self.is_running = False
        logger.info("Stopped periodic cache warming")


# Create singleton instance
cache_warmer = CacheWarmerService()


# Convenience functions for direct use
async def warm_it_sector():
    """Convenience function to warm IT sector cache."""
    return await cache_warmer.warm_it_sector_cache()


async def warm_all_sectors():
    """Convenience function to warm all sectors cache."""
    return await cache_warmer.warm_all_sectors_cache()