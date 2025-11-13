# app/api/routes_optimized.py
# OPTIMIZED VERSION - Replace the get_portfolio_holdings function in routes.py with this

import uuid
import time
import logging
from typing import Dict, List, Optional, Any
import asyncio
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)

class RequestContextCache:
    """Request-scoped cache to prevent duplicate API calls within the same request"""

    def __init__(self):
        self.cache: Dict[str, Any] = {}
        self.request_id = str(uuid.uuid4())[:8]

    def get_key(self, prefix: str, *args) -> str:
        """Generate a cache key from prefix and arguments"""
        return f"{prefix}:{':'.join(str(arg) for arg in args)}"

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        return self.cache.get(key)

    def set(self, key: str, value: Any) -> None:
        """Set value in cache"""
        self.cache[key] = value

    def has(self, key: str) -> bool:
        """Check if key exists in cache"""
        return key in self.cache


@router.get("/portfolio/holdings/{username}/{account_name}")
async def get_portfolio_holdings_optimized(username: str, account_name: str):
    """
    OPTIMIZED VERSION: Retrieve holdings with deduplicated API calls and request-level caching.

    Key optimizations:
    1. Request-level cache to prevent duplicate API calls
    2. Deduplication of symbols before fetching
    3. Parallel fetching with controlled concurrency
    4. Better error handling and logging
    """

    # Initialize request context and tracking
    request_cache = RequestContextCache()
    request_id = request_cache.request_id
    start_time = time.time()

    logger.info(f"[PORTFOLIO-HOLDINGS-{request_id}] Request started - username={username}, account={account_name}")

    try:
        # Step 1: Fetch holdings from database
        logger.debug(f"[PORTFOLIO-HOLDINGS-DB-{request_id}] Querying holdings")
        holdings_cursor = holdings_col.find({
            "username": username,
            "client_account_name": account_name
        })
        holdings_list = await holdings_cursor.to_list(length=None)

        db_elapsed_ms = (time.time() - start_time) * 1000
        logger.info(f"[PORTFOLIO-HOLDINGS-DB-{request_id}] Found {len(holdings_list)} holdings in {db_elapsed_ms:.0f}ms")

        if not holdings_list:
            logger.info(f"[PORTFOLIO-HOLDINGS-{request_id}] No holdings found")
            return {"holdings": []}

        # Step 2: Aggregate duplicate holdings by symbol
        aggregated = {}
        for h in holdings_list:
            symbol = h.get("symbol", "").upper()
            if not symbol:
                continue
            qty = float(h.get("quantity", 0))
            price = float(h.get("purchase_price", 0))

            if symbol not in aggregated:
                aggregated[symbol] = {"total_qty": 0, "total_cost": 0}
            aggregated[symbol]["total_qty"] += qty
            aggregated[symbol]["total_cost"] += qty * price

        logger.info(f"[PORTFOLIO-HOLDINGS-{request_id}] Aggregated to {len(aggregated)} unique symbols from {len(holdings_list)} holdings")

        # Step 3: Get unique symbols and prepare batch fetching
        unique_symbols = list(aggregated.keys())

        # Step 4: Define optimized fetch functions with caching
        async def fetch_market_data_cached(symbol: str) -> Optional[dict]:
            """Fetch market data with request-level caching"""
            cache_key = request_cache.get_key("market", symbol)

            # Check cache first
            if request_cache.has(cache_key):
                logger.debug(f"[CACHE-HIT-{request_id}] Market data for {symbol}")
                return request_cache.get(cache_key)

            try:
                logger.debug(f"[FETCH-MARKET-{request_id}] Getting market data for {symbol}")
                data = await stock_data_service.get_current_market_price(symbol)
                request_cache.set(cache_key, data)
                return data
            except Exception as e:
                logger.warning(f"[FETCH-MARKET-ERROR-{request_id}] Failed for {symbol}: {e}")
                request_cache.set(cache_key, None)
                return None

        async def fetch_news_data_cached(symbol: str, timeframe: str = "1W") -> dict:
            """Fetch news/sentiment with request-level caching"""
            cache_key = request_cache.get_key("news", symbol, timeframe)

            # Check cache first
            if request_cache.has(cache_key):
                logger.debug(f"[CACHE-HIT-{request_id}] News data for {symbol}")
                return request_cache.get(cache_key)

            try:
                logger.debug(f"[FETCH-NEWS-{request_id}] Getting news for {symbol}")
                data = await get_news_data(symbol, timeframe=timeframe)
                request_cache.set(cache_key, data)
                return data
            except Exception as e:
                logger.warning(f"[FETCH-NEWS-ERROR-{request_id}] Failed for {symbol}: {e}")
                # Return empty data structure on error
                empty_data = {
                    "avg_score": 0,
                    "news": [],
                    "sentiment_momentum": None
                }
                request_cache.set(cache_key, empty_data)
                return empty_data

        def get_sector_info_cached(symbol: str) -> dict:
            """Get sector info with request-level caching"""
            cache_key = request_cache.get_key("sector", symbol)

            if request_cache.has(cache_key):
                logger.debug(f"[CACHE-HIT-{request_id}] Sector data for {symbol}")
                return request_cache.get(cache_key)

            try:
                data = stock_data_service.get_ticker_sector_info(symbol)
                request_cache.set(cache_key, data)
                return data
            except Exception as e:
                logger.warning(f"[FETCH-SECTOR-ERROR-{request_id}] Failed for {symbol}: {e}")
                data = {"sector": "N/A", "industry": "N/A"}
                request_cache.set(cache_key, data)
                return data

        # Step 5: Batch fetch all unique data with controlled concurrency
        logger.info(f"[BATCH-FETCH-{request_id}] Starting parallel fetch for {len(unique_symbols)} unique symbols")

        # Create semaphore to limit concurrent API calls (prevent overwhelming APIs)
        MAX_CONCURRENT_CALLS = 5
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_CALLS)

        async def fetch_symbol_data_with_limit(symbol: str) -> tuple:
            """Fetch all data for a symbol with concurrency limiting"""
            async with semaphore:
                # Fetch market and news data in parallel for this symbol
                market_task = fetch_market_data_cached(symbol)
                news_task = fetch_news_data_cached(symbol, "1W")

                market_data, news_data = await asyncio.gather(
                    market_task,
                    news_task,
                    return_exceptions=True
                )

                # Handle exceptions
                if isinstance(market_data, Exception):
                    logger.error(f"[FETCH-ERROR-{request_id}] Market data exception for {symbol}: {market_data}")
                    market_data = None

                if isinstance(news_data, Exception):
                    logger.error(f"[FETCH-ERROR-{request_id}] News data exception for {symbol}: {news_data}")
                    news_data = {"avg_score": 0, "news": [], "sentiment_momentum": None}

                # Get sector info (synchronous but cached)
                sector_info = get_sector_info_cached(symbol)

                return symbol, market_data, news_data, sector_info

        # Fetch all symbol data with controlled concurrency
        fetch_tasks = [fetch_symbol_data_with_limit(symbol) for symbol in unique_symbols]
        all_symbol_data = await asyncio.gather(*fetch_tasks, return_exceptions=True)

        # Step 6: Build symbol data lookup dictionary
        symbol_data_lookup = {}
        for result in all_symbol_data:
            if isinstance(result, Exception):
                logger.error(f"[FETCH-ERROR-{request_id}] Task failed: {result}")
                continue

            symbol, market_data, news_data, sector_info = result
            symbol_data_lookup[symbol] = {
                "market": market_data,
                "news": news_data,
                "sector": sector_info
            }

        batch_elapsed_ms = (time.time() - start_time) * 1000
        logger.info(f"[BATCH-FETCH-{request_id}] Completed in {batch_elapsed_ms:.0f}ms")

        # Step 7: Build holding responses using cached data
        holdings_response = []

        for symbol, aggregation in aggregated.items():
            total_qty = aggregation["total_qty"]
            avg_cost = aggregation["total_cost"] / total_qty if total_qty > 0 else 0

            # Get cached data for this symbol
            symbol_data = symbol_data_lookup.get(symbol, {})
            market_data = symbol_data.get("market", {})
            news_data = symbol_data.get("news", {})
            sector_info = symbol_data.get("sector", {})

            # Process market data
            if market_data:
                market_price = round(market_data.get("market_price", 0), 2)
                day_change_value = round(market_data.get("day_change_value", 0), 2) if market_data.get("day_change_value") is not None else None
                day_change_percent = round(market_data.get("day_change_percent", 0), 2) if market_data.get("day_change_percent") is not None else None
                previous_close = market_data.get("previous_close")
                fifty_two_week_high = market_data.get("fifty_two_week_high")
                fifty_two_week_low = market_data.get("fifty_two_week_low")
            else:
                market_price = None
                day_change_value = None
                day_change_percent = None
                previous_close = None
                fifty_two_week_high = None
                fifty_two_week_low = None

            # Calculate P&L
            if market_price:
                pl_absolute = round((market_price - avg_cost) * total_qty, 2)
                pl_percent = round(((market_price - avg_cost) / avg_cost) * 100, 2) if avg_cost > 0 else 0
                is_positive = pl_absolute >= 0
                position_value = market_price * total_qty
            else:
                pl_absolute = None
                pl_percent = None
                is_positive = None
                position_value = avg_cost * total_qty

            # Process news/sentiment data
            avg_score = news_data.get("avg_score", 0)
            articles = news_data.get("news", [])
            sentiment_momentum = news_data.get("sentiment_momentum")
            news_volume = len(articles)

            # Derive sentiment label
            if avg_score > 0.2:
                sentiment_label = "Positive"
            elif avg_score < -0.2:
                sentiment_label = "Negative"
            else:
                sentiment_label = "Neutral"

            # Create 52-week range object
            range52week = None
            if fifty_two_week_high is not None and fifty_two_week_low is not None:
                range52week = {
                    "low": float(fifty_two_week_low),
                    "high": float(fifty_two_week_high)
                }

            # Build holding response
            holding_item = {
                "symbol": symbol,
                "quantity": round(total_qty, 2),
                "averageCostPrice": f"{avg_cost:,.1f}",
                "marketPrice": f"{market_price:,.1f}" if market_price else None,
                "profitLoss": f"{pl_absolute:,.1f}" if pl_absolute is not None else None,
                "gainLossPercent": float(pl_percent) if pl_percent is not None else None,
                "isPositive": bool(is_positive) if is_positive is not None else None,
                "newsVolume": news_volume,
                "sentiment": f"{float(avg_score):,.2f}",
                "sentimentMomentum": float(sentiment_momentum) if sentiment_momentum is not None else None,
                "sentimentLabel": sentiment_label,
                "range52week": range52week,
                "position": f"{position_value:,.1f}",
                "day_change_percent": float(day_change_percent) if day_change_percent is not None else None,
                "day_change_value": float(day_change_value) if day_change_value is not None else None,
                "previous_close": float(previous_close) if previous_close is not None else None,
                "sector": sector_info.get("sector", "N/A"),
                "industry": sector_info.get("industry", "N/A")
            }

            holdings_response.append(holding_item)

        # Step 8: Sort holdings by position value (largest first)
        holdings_response.sort(key=lambda x: float(x["position"].replace(",", "")), reverse=True)

        total_elapsed_ms = (time.time() - start_time) * 1000
        cache_stats = {
            "request_id": request_id,
            "unique_symbols": len(unique_symbols),
            "total_holdings": len(holdings_list),
            "cache_size": len(request_cache.cache),
            "total_time_ms": round(total_elapsed_ms, 0)
        }

        logger.info(f"[PORTFOLIO-HOLDINGS-{request_id}] Request completed in {total_elapsed_ms:.0f}ms - "
                   f"Symbols: {len(unique_symbols)}, Holdings: {len(holdings_list)}, Cache entries: {len(request_cache.cache)}")

        return {
            "holdings": holdings_response,
            "metadata": cache_stats
        }

    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000
        logger.error(f"[PORTFOLIO-HOLDINGS-ERROR-{request_id}] Failed after {elapsed_ms:.0f}ms: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch portfolio holdings: {str(e)}")