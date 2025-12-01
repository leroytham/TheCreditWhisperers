# app/api/portfolio_optimized.py
"""
Optimized portfolio endpoints with batch operations and multi-level caching.
Designed for fast loading and no hanging.
"""

import asyncio
import logging
import time
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from fastapi import HTTPException, Query

from app.services.batch_services import (
    batch_market_service,
    batch_sector_service,
    batch_news_service
)
from app.services.cache_manager import (
    get_cache_manager,
    RequestCache,
    with_smart_cache
)
from app.core.cache import async_cache_result

logger = logging.getLogger(__name__)


class OptimizedPortfolioService:
    """
    Service for optimized portfolio operations with batching and caching.
    """

    def __init__(self):
        self.cache_manager = get_cache_manager()
        self._semaphore = asyncio.Semaphore(10)  # Control concurrent operations

    async def get_portfolio_holdings(
        self,
        username: str,
        account_name: str,
        request_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        sort_by: str = "position_value",
        sort_order: str = "desc"
    ) -> Dict:
        """
        Get portfolio holdings with optimized batch fetching and caching.

        Args:
            username: User identifier
            account_name: Account name
            request_id: Unique request ID for caching
            page: Page number for pagination
            page_size: Number of items per page
            sort_by: Field to sort by
            sort_order: Sort order (asc/desc)

        Returns:
            Portfolio holdings with enriched data
        """
        start_time = time.time()
        request_id = request_id or str(uuid.uuid4())[:8]
        request_cache = self.cache_manager.get_request_cache(request_id)

        logger.info(f"[PORTFOLIO-OPT-{request_id}] Starting holdings fetch for {username}/{account_name}")

        try:
            # Check L2 cache first (30 second TTL for holdings)
            cache_key = f"portfolio:holdings:{username}:{account_name}:{page}:{page_size}:{sort_by}:{sort_order}"
            cached_result = await self.cache_manager.l2_cache.get(cache_key)
            if cached_result:
                logger.info(f"[PORTFOLIO-OPT-{request_id}] Returning cached holdings")
                return cached_result

            # Import here to avoid circular dependency
            from app.database import get_holdings_collection_async
            holdings_col = get_holdings_collection_async()

            # Step 1: Fetch and aggregate holdings from database
            holdings_data = await self._fetch_and_aggregate_holdings(
                holdings_col, username, account_name, request_cache
            )

            if not holdings_data:
                result = {
                    "holdings": [],
                    "total_count": 0,
                    "page": page,
                    "page_size": page_size
                }
                await self.cache_manager.l2_cache.set(cache_key, result, ttl=30)
                return result

            # Step 2: Get unique symbols for batch operations
            symbols = list(holdings_data.keys())
            logger.info(f"[PORTFOLIO-OPT-{request_id}] Processing {len(symbols)} unique symbols")

            # Step 3: Batch fetch all data in parallel
            enriched_data = await self._batch_enrich_holdings(
                symbols, request_cache, request_id
            )

            # Step 4: Build final holdings response
            holdings = self._build_holdings_response(
                holdings_data, enriched_data
            )

            # Step 5: Apply sorting
            holdings = self._sort_holdings(holdings, sort_by, sort_order)

            # Step 6: Apply pagination
            total_count = len(holdings)
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_holdings = holdings[start_idx:end_idx]

            # Build final response
            elapsed_ms = (time.time() - start_time) * 1000
            result = {
                "holdings": paginated_holdings,
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": (total_count + page_size - 1) // page_size,
                "metadata": {
                    "request_id": request_id,
                    "response_time_ms": round(elapsed_ms, 1),
                    "unique_symbols": len(symbols),
                    "cache_stats": request_cache.get_stats()
                }
            }

            # Cache the result
            await self.cache_manager.l2_cache.set(cache_key, result, ttl=30)

            logger.info(f"[PORTFOLIO-OPT-{request_id}] Completed in {elapsed_ms:.0f}ms")
            return result

        except Exception as e:
            logger.error(f"[PORTFOLIO-OPT-{request_id}] Error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

        finally:
            # Clean up request cache
            self.cache_manager.cleanup_request_cache(request_id)

    async def _fetch_and_aggregate_holdings(
        self,
        holdings_col,
        username: str,
        account_name: str,
        request_cache: RequestCache
    ) -> Dict[str, Dict]:
        """
        Fetch holdings from database and aggregate by symbol.
        """
        cache_key = request_cache.get_key("db_holdings", username, account_name)
        cached = request_cache.get(cache_key)
        if cached:
            return cached

        # Fetch from MongoDB
        holdings_cursor = holdings_col.find({
            "username": username,
            "client_account_name": account_name
        })
        holdings_list = await holdings_cursor.to_list(length=None)

        # Aggregate by symbol
        aggregated = {}
        for holding in holdings_list:
            symbol = holding.get("symbol", "").upper()
            if not symbol:
                continue

            qty = float(holding.get("quantity", 0))
            price = float(holding.get("purchase_price", 0))

            if symbol not in aggregated:
                aggregated[symbol] = {
                    "total_qty": 0,
                    "total_cost": 0,
                    "lots": []
                }

            aggregated[symbol]["total_qty"] += qty
            aggregated[symbol]["total_cost"] += qty * price
            aggregated[symbol]["lots"].append({
                "quantity": qty,
                "purchase_price": price,
                "purchase_date": holding.get("purchase_date"),
                "holding_id": str(holding.get("_id"))
            })

        request_cache.set(cache_key, aggregated)
        return aggregated

    async def _batch_enrich_holdings(
        self,
        symbols: List[str],
        request_cache: RequestCache,
        request_id: str
    ) -> Dict[str, Dict]:
        """
        Enrich holdings with market data, news, and sector info using batch operations.
        """
        cache_key = request_cache.get_key("enriched_data", *symbols)
        cached = request_cache.get(cache_key)
        if cached:
            return cached

        # Prepare tasks for parallel execution
        tasks = []

        # Task 1: Batch market prices
        async def fetch_market():
            try:
                return await batch_market_service.get_batch_current_prices(
                    symbols, include_extended_data=True
                )
            except Exception as e:
                logger.error(f"[PORTFOLIO-OPT-{request_id}] Market fetch error: {e}")
                return {symbol: None for symbol in symbols}

        # Task 2: Batch sector info
        async def fetch_sectors():
            try:
                return await batch_sector_service.get_batch_sector_info(symbols)
            except Exception as e:
                logger.error(f"[PORTFOLIO-OPT-{request_id}] Sector fetch error: {e}")
                return {symbol: {"sector": "N/A", "industry": "N/A"} for symbol in symbols}

        # Task 3: Batch news (limited to avoid overwhelming API)
        async def fetch_news():
            try:
                # Get news for top 20 holdings by value (will be sorted later)
                top_symbols = symbols[:20] if len(symbols) > 20 else symbols

                # Fetch news individually but in parallel with semaphore
                news_tasks = []
                for symbol in top_symbols:
                    news_tasks.append(self._fetch_single_news(symbol, request_cache))

                news_results = await asyncio.gather(*news_tasks, return_exceptions=True)

                # Build results dictionary
                news_data = {}
                for symbol, result in zip(top_symbols, news_results):
                    if isinstance(result, Exception):
                        logger.warning(f"News fetch failed for {symbol}: {result}")
                        news_data[symbol] = {"news": [], "sentiment": 0, "momentum": None}
                    else:
                        news_data[symbol] = result

                # Empty news for symbols not in top 20
                for symbol in symbols:
                    if symbol not in news_data:
                        news_data[symbol] = {"news": [], "sentiment": 0, "momentum": None}

                return news_data

            except Exception as e:
                logger.error(f"[PORTFOLIO-OPT-{request_id}] News fetch error: {e}")
                return {symbol: {"news": [], "sentiment": 0, "momentum": None} for symbol in symbols}

        # Execute all tasks in parallel
        logger.info(f"[PORTFOLIO-OPT-{request_id}] Starting parallel batch fetch")
        market_data, sector_data, news_data = await asyncio.gather(
            fetch_market(),
            fetch_sectors(),
            fetch_news()
        )

        # Combine results
        enriched = {}
        for symbol in symbols:
            enriched[symbol] = {
                "market": market_data.get(symbol),
                "sector": sector_data.get(symbol, {}),
                "news": news_data.get(symbol, {})
            }

        request_cache.set(cache_key, enriched)
        return enriched

    async def _fetch_single_news(self, symbol: str, request_cache: RequestCache) -> Dict:
        """Fetch news for a single symbol with caching."""
        cache_key = request_cache.get_key("news", symbol, "1W")
        cached = request_cache.get(cache_key)
        if cached:
            return cached

        async with self._semaphore:  # Limit concurrent news fetches
            try:
                # Import here to avoid circular dependency
                from app.api.news_routes import get_news_data

                news_result = await get_news_data(symbol, timeframe="1W")

                # Extract key metrics
                result = {
                    "news": news_result.get("news", [])[:5],  # Limit to 5 articles
                    "sentiment": news_result.get("avg_score", 0),
                    "momentum": news_result.get("sentiment_momentum"),
                    "volume": len(news_result.get("news", []))
                }

                request_cache.set(cache_key, result)
                return result

            except Exception as e:
                logger.warning(f"News fetch failed for {symbol}: {e}")
                return {"news": [], "sentiment": 0, "momentum": None, "volume": 0}

    def _build_holdings_response(
        self,
        holdings_data: Dict[str, Dict],
        enriched_data: Dict[str, Dict]
    ) -> List[Dict]:
        """Build final holdings response from aggregated and enriched data."""
        holdings = []

        for symbol, holding_info in holdings_data.items():
            enriched = enriched_data.get(symbol, {})
            market = enriched.get("market", {})
            sector = enriched.get("sector", {})
            news = enriched.get("news", {})

            # Calculate average cost
            total_qty = holding_info["total_qty"]
            total_cost = holding_info["total_cost"]
            avg_cost = total_cost / total_qty if total_qty > 0 else 0

            # Extract market data
            if market:
                market_price = market.get("market_price")
                day_change_percent = market.get("day_change_percent")
                day_change_value = market.get("day_change_value")
                fifty_two_week_high = market.get("fifty_two_week_high")
                fifty_two_week_low = market.get("fifty_two_week_low")
            else:
                market_price = None
                day_change_percent = None
                day_change_value = None
                fifty_two_week_high = None
                fifty_two_week_low = None

            # Calculate P&L
            if market_price:
                position_value = market_price * total_qty
                pl_absolute = (market_price - avg_cost) * total_qty
                pl_percent = ((market_price - avg_cost) / avg_cost * 100) if avg_cost > 0 else 0
            else:
                position_value = avg_cost * total_qty
                pl_absolute = None
                pl_percent = None

            # Build holding item
            holding_item = {
                "symbol": symbol,
                "quantity": round(total_qty, 2),
                "averageCostPrice": round(avg_cost, 2),
                "marketPrice": round(market_price, 2) if market_price else None,
                "positionValue": round(position_value, 2),
                "profitLoss": round(pl_absolute, 2) if pl_absolute is not None else None,
                "profitLossPercent": round(pl_percent, 2) if pl_percent is not None else None,
                "isPositive": pl_absolute >= 0 if pl_absolute is not None else None,
                "dayChangePercent": round(day_change_percent, 2) if day_change_percent is not None else None,
                "dayChangeValue": round(day_change_value, 2) if day_change_value is not None else None,
                "sector": sector.get("sector", "N/A"),
                "industry": sector.get("industry", "N/A"),
                "newsVolume": news.get("volume", 0),
                "sentiment": round(news.get("sentiment", 0), 2),
                "sentimentMomentum": news.get("momentum"),
                "range52Week": {
                    "high": fifty_two_week_high,
                    "low": fifty_two_week_low
                } if fifty_two_week_high and fifty_two_week_low else None,
                "lots": len(holding_info.get("lots", []))
            }

            holdings.append(holding_item)

        return holdings

    def _sort_holdings(self, holdings: List[Dict], sort_by: str, sort_order: str) -> List[Dict]:
        """Sort holdings by specified field."""
        sort_fields = {
            "symbol": lambda x: x["symbol"],
            "position_value": lambda x: x["positionValue"],
            "profit_loss": lambda x: x["profitLoss"] or 0,
            "profit_loss_percent": lambda x: x["profitLossPercent"] or 0,
            "day_change_percent": lambda x: x["dayChangePercent"] or 0,
            "sentiment": lambda x: x["sentiment"]
        }

        if sort_by not in sort_fields:
            sort_by = "position_value"

        reverse = sort_order == "desc"

        try:
            return sorted(holdings, key=sort_fields[sort_by], reverse=reverse)
        except Exception as e:
            logger.warning(f"Sort failed: {e}, using default sort")
            return sorted(holdings, key=lambda x: x["positionValue"], reverse=True)

    @async_cache_result(ttl=60, key_prefix="portfolio_performance")
    async def get_portfolio_performance(
        self,
        username: str,
        account_name: str,
        request_id: Optional[str] = None,
        timeframe: str = "1Y"
    ) -> Dict:
        """
        Get portfolio performance metrics with optimized calculations.
        """
        start_time = time.time()
        request_id = request_id or str(uuid.uuid4())[:8]

        logger.info(f"[PERF-OPT-{request_id}] Starting performance calc for {username}/{account_name}")

        try:
            # Get holdings data
            holdings_result = await self.get_portfolio_holdings(
                username, account_name, request_id, page=1, page_size=1000
            )

            if not holdings_result["holdings"]:
                return {
                    "error": "No holdings found",
                    "timeframe": timeframe
                }

            holdings = holdings_result["holdings"]

            # Calculate portfolio metrics
            total_value = sum(h["positionValue"] for h in holdings)
            total_cost = sum(
                h["quantity"] * h["averageCostPrice"]
                for h in holdings
            )
            total_pl = sum(h["profitLoss"] or 0 for h in holdings)
            total_pl_percent = (total_pl / total_cost * 100) if total_cost > 0 else 0

            # Calculate daily change
            total_day_change = sum(
                (h["dayChangeValue"] or 0) * h["quantity"]
                for h in holdings
            )
            day_change_percent = (total_day_change / total_value * 100) if total_value > 0 else 0

            # Get top performers
            sorted_by_pl = sorted(
                holdings,
                key=lambda x: x["profitLossPercent"] or 0,
                reverse=True
            )

            top_gainers = [h for h in sorted_by_pl if (h["profitLossPercent"] or 0) > 0][:5]
            top_losers = [h for h in sorted_by_pl if (h["profitLossPercent"] or 0) < 0][-5:]

            # Calculate sector allocation
            sector_allocation = {}
            for holding in holdings:
                sector = holding["sector"]
                if sector != "N/A":
                    if sector not in sector_allocation:
                        sector_allocation[sector] = 0
                    sector_allocation[sector] += holding["positionValue"]

            elapsed_ms = (time.time() - start_time) * 1000

            return {
                "timeframe": timeframe,
                "totalValue": round(total_value, 2),
                "totalCost": round(total_cost, 2),
                "totalProfitLoss": round(total_pl, 2),
                "totalProfitLossPercent": round(total_pl_percent, 2),
                "dayChange": round(total_day_change, 2),
                "dayChangePercent": round(day_change_percent, 2),
                "topGainers": top_gainers,
                "topLosers": top_losers,
                "sectorAllocation": sector_allocation,
                "holdingsCount": len(holdings),
                "metadata": {
                    "request_id": request_id,
                    "response_time_ms": round(elapsed_ms, 1)
                }
            }

        except Exception as e:
            logger.error(f"[PERF-OPT-{request_id}] Error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))


# Create singleton service instance
portfolio_service = OptimizedPortfolioService()


# FastAPI route functions
async def get_optimized_portfolio_holdings(
    username: str,
    account_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort_by: str = Query("position_value"),
    sort_order: str = Query("desc", regex="^(asc|desc)$")
):
    """
    Optimized endpoint for portfolio holdings with batch operations and caching.
    """
    return await portfolio_service.get_portfolio_holdings(
        username=username,
        account_name=account_name,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order
    )


async def get_optimized_portfolio_performance(
    username: str,
    account_name: str,
    timeframe: str = Query("1Y", regex="^(1D|1W|1M|3M|6M|YTD|1Y|3Y|5Y)$")
):
    """
    Optimized endpoint for portfolio performance metrics.
    """
    return await portfolio_service.get_portfolio_performance(
        username=username,
        account_name=account_name,
        timeframe=timeframe
    )