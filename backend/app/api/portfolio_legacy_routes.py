# backend/app/api/portfolio_legacy_routes.py
"""
Legacy portfolio routes using username/account_name-based URLs.

These routes are distinct from the modern portfolio_routes.py which uses portfolio_id-based URLs.
Extracted from routes.py during Large Class refactoring.

TODO: Refactor this file.
These endpoints use the legacy "username" based lookup.
They should eventually be migrated to "portfolio_id" based lookups
and merged into portfolio_routes.py.
"""
from fastapi import APIRouter, HTTPException, Depends
import yfinance as yf
from datetime import datetime
import asyncio
import uuid
import logging

logger = logging.getLogger(__name__)

# Import services
from app.services.news_service import news_service_instance
from app.services.stock_data_service import stock_data_service
from app.services.sentiment_service import sentiment_service
from app.services.portfolio_timeseries_service import portfolio_timeseries_service
from app.services.portfolio_sentiment_service import portfolio_sentiment_service
from app.services.holding_enrichment_service import holding_enrichment_service
from app.services.portfolio_performance_service import (
    calculate_period_boundaries,
    calculate_itd_start_date,
    fetch_current_prices_batch,
    calculate_holding_performance,
    fetch_sp500_return,
    aggregate_portfolio_performance,
    generate_portfolio_events,
)
from app.core.cache import async_cache_result
from app.core.config import settings
from app.core.http_client import http_client
from app.database import get_motor_database
from app.repositories.factory import (
    get_account_repository,
    get_holding_repository,
)
from app.repositories.account_repository import AccountRepository
from app.repositories.holding_repository import HoldingRepository

# Import scoring configuration
from app.config.scoring import get_score_definitions

# Import get_news_data from news_routes for holdings enrichment
from app.api.news_routes import get_news_data

router = APIRouter(tags=["Portfolio (Legacy)"])


# ============================================================================
# HELPER FUNCTIONS FOR LOT TRACKING
# ============================================================================

def reduce_lots_fifo(lots: list, quantity_to_reduce: float) -> tuple[list, float]:
    """
    Reduces lots using FIFO (First In, First Out) method.

    Args:
        lots: List of lot dictionaries with quantity, purchase_price, purchase_date
        quantity_to_reduce: Number of shares to sell

    Returns:
        Tuple of (updated_lots, realized_gain_loss)

    Raises:
        ValueError: If insufficient shares to sell
    """
    from copy import deepcopy

    # Calculate total available quantity
    total_quantity = sum(float(lot.get("quantity", 0)) for lot in lots)

    if quantity_to_reduce > total_quantity:
        raise ValueError(
            f"Insufficient shares to sell. Available: {total_quantity}, "
            f"Requested: {quantity_to_reduce}"
        )

    # Sort lots by purchase_date (oldest first) for FIFO
    sorted_lots = sorted(
        deepcopy(lots),
        key=lambda x: x.get("purchase_date", "9999-12-31")
    )

    updated_lots = []
    remaining_to_reduce = quantity_to_reduce
    realized_gain_loss = 0.0

    for lot in sorted_lots:
        lot_quantity = float(lot.get("quantity", 0))
        lot_price = float(lot.get("purchase_price", 0))

        if remaining_to_reduce <= 0:
            # No more to reduce, keep this lot as-is
            updated_lots.append(lot)
        elif lot_quantity <= remaining_to_reduce:
            # Fully consume this lot
            remaining_to_reduce -= lot_quantity
            # Don't add to updated_lots (lot is fully sold)
        else:
            # Partially consume this lot
            quantity_sold_from_lot = remaining_to_reduce
            lot["quantity"] = lot_quantity - quantity_sold_from_lot
            updated_lots.append(lot)
            remaining_to_reduce = 0

    return updated_lots, realized_gain_loss


async def apply_sell_transaction(
    holding_repo: HoldingRepository,
    username: str,
    account_name: str,
    account_no: str,
    symbol: str,
    quantity_to_sell: float,
    sell_price: float = None
) -> dict:
    """
    Applies a SELL transaction to reduce holdings using FIFO lot tracking.

    Args:
        holding_repo: HoldingRepository instance
        username: Username
        account_name: Account name
        account_no: Account number
        symbol: Stock symbol to sell
        quantity_to_sell: Number of shares to sell
        sell_price: Optional sell price (for realized gain/loss calculation)

    Returns:
        Dict with result status and details

    Raises:
        ValueError: If holding not found or insufficient shares
    """
    # Find existing holding
    holding = await holding_repo.get_holding_by_full_key(
        username, account_name, account_no, symbol
    )

    if not holding:
        raise ValueError(f"No holding found for {symbol}")

    current_quantity = float(holding.get("quantity", 0))
    current_lots = holding.get("lots", [])

    if quantity_to_sell > current_quantity:
        raise ValueError(
            f"Insufficient shares to sell. Available: {current_quantity}, "
            f"Requested: {quantity_to_sell}"
        )

    # Apply FIFO reduction
    updated_lots, realized_gain_loss = reduce_lots_fifo(current_lots, quantity_to_sell)

    new_quantity = current_quantity - quantity_to_sell

    if new_quantity <= 0:
        # Completely sold out - delete holding
        holding_id = str(holding["_id"])
        await holding_repo.delete_holding_by_id(holding_id)
        return {
            "status": "deleted",
            "symbol": symbol,
            "quantity_sold": quantity_to_sell,
            "remaining_quantity": 0,
            "realized_gain_loss": realized_gain_loss
        }
    else:
        # Partial sale - update holding
        # Recalculate weighted average price from remaining lots
        total_cost = sum(
            float(lot.get("quantity", 0)) * float(lot.get("purchase_price", 0))
            for lot in updated_lots
        )
        new_avg_price = total_cost / new_quantity if new_quantity > 0 else 0

        # Find earliest remaining purchase date
        earliest_date = min(
            lot.get("purchase_date", "9999-12-31")
            for lot in updated_lots
        ) if updated_lots else holding.get("purchase_date")

        holding_id = str(holding["_id"])
        await holding_repo.update_holding_after_sell(
            holding_id=holding_id,
            new_quantity=new_quantity,
            new_avg_price=new_avg_price,
            earliest_date=earliest_date,
            updated_lots=updated_lots,
        )

        return {
            "status": "updated",
            "symbol": symbol,
            "quantity_sold": quantity_to_sell,
            "remaining_quantity": new_quantity,
            "realized_gain_loss": realized_gain_loss
        }


# ============================================================================
# PORTFOLIO ENDPOINTS (username/account_name based)
# ============================================================================

@router.post("/portfolio/save")
async def save_portfolio(
    data: dict,
    account_repo: AccountRepository = Depends(get_account_repository),
    holding_repo: HoldingRepository = Depends(get_holding_repository),
):
    """
    Save a new portfolio (Account Details + Holdings) into MongoDB.
    Only saves if ALL stock symbols are valid.
    """
    try:
        username = data.get("username")
        account = data.get("accountDetails")
        holdings = data.get("holdings", [])

        if not username or not account:
            raise HTTPException(status_code=400, detail="Missing username or account details")

        account_name = account["accountName"].strip()
        account_no = account["accountNumber"].strip()

        # 1. Check if account already exists
        existing_account = await account_repo.get_by_account_no(username, account_no)

        if existing_account:
            raise HTTPException(status_code=400, detail="Account already exists for this user.")

        # 2. Validate ALL stock symbols before saving
        invalid_symbols = []
        for h in holdings:
            symbol = h.get("symbol", "").upper().strip()
            quantity = float(h.get("quantity", 0))
            purchase_price = float(h.get("purchasePrice", 0))

            if not symbol or quantity <= 0 or purchase_price <= 0:
                invalid_symbols.append(symbol or "(empty)")
                continue

            # Validate using yfinance
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="1d")
                if hist.empty:
                    invalid_symbols.append(symbol)
            except Exception:
                invalid_symbols.append(symbol)

        # 3. If any invalid stock symbol, reject the entire save
        if invalid_symbols:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid stock symbols detected: {', '.join(invalid_symbols)}. "
                       f"Portfolio not saved."
            )

        # 4. Insert account (all stocks are valid at this point)
        await account_repo.create_account(
            username=username,
            account_name=account_name,
            account_no=account_no,
            open_date=account["openDate"],
        )

        # 5. Insert holdings or merge if exists
        holdings_added, holdings_updated = 0, 0

        for h in holdings:
            symbol = h["symbol"].upper().strip()
            quantity = float(h["quantity"])
            purchase_price = float(h["purchasePrice"])
            purchase_date = h["purchaseDate"]

            existing_holding = await holding_repo.get_holding_by_full_key(
                username, account_name, account_no, symbol
            )

            if existing_holding:
                # Weighted average update
                old_qty = float(existing_holding["quantity"])
                old_price = float(existing_holding["purchase_price"])
                new_qty = old_qty + quantity
                new_price = ((old_qty * old_price) + (quantity * purchase_price)) / new_qty

                # Create new lot entry
                new_lot = {
                    "lot_id": str(uuid.uuid4()),
                    "quantity": quantity,
                    "purchase_price": purchase_price,
                    "purchase_date": purchase_date,
                    "created_at": datetime.utcnow()
                }

                # Determine earliest purchase date (preserve for backward compatibility)
                existing_purchase_date = existing_holding.get("purchase_date", purchase_date)
                earliest_date = min(existing_purchase_date, purchase_date) if existing_purchase_date else purchase_date

                await holding_repo.add_lot_to_holding(
                    username=username,
                    account_name=account_name,
                    account_no=account_no,
                    symbol=symbol,
                    new_lot=new_lot,
                    new_quantity=new_qty,
                    new_avg_price=new_price,
                    earliest_purchase_date=earliest_date,
                )
                holdings_updated += 1
            else:
                # Initialize first lot
                first_lot = {
                    "lot_id": str(uuid.uuid4()),
                    "quantity": quantity,
                    "purchase_price": purchase_price,
                    "purchase_date": purchase_date,
                    "created_at": datetime.utcnow()
                }

                holding_record = {
                    "username": username,
                    "client_account_name": account_name,
                    "account_no": account_no,
                    "symbol": symbol,
                    "quantity": quantity,
                    "purchase_price": purchase_price,
                    "purchase_date": purchase_date,
                    "lots": [first_lot],  # Initialize lots array
                    "created_at": datetime.utcnow()
                }
                await holding_repo.create(holding_record)
                holdings_added += 1

        return {
            "message": "Portfolio saved successfully!",
            "account_added": True,
            "holdings_added": holdings_added,
            "holdings_updated": holdings_updated
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error("Error saving portfolio: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save portfolio: {str(e)}")


@router.get("/accounts/{username}")
async def get_accounts_for_user(
    username: str,
    account_repo: AccountRepository = Depends(get_account_repository),
):
    """
    Get all client accounts for a given username.
    Returns client_account_name and account_no.
    """
    try:
        accounts = await account_repo.get_by_username(
            username,
            projection={"_id": 0, "client_account_name": 1, "account_no": 1}
        )

        if not accounts:
            return {"accounts": []}

        return {"accounts": accounts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch accounts: {str(e)}")


@router.get("/portfolio/{username}/{account_name}")
async def get_portfolio_details(
    username: str,
    account_name: str,
    account_repo: AccountRepository = Depends(get_account_repository),
    holding_repo: HoldingRepository = Depends(get_holding_repository),
):
    """
    Returns the account details and all holdings for this user/account.
    """
    try:
        # Fetch account details
        account = await account_repo.get_by_account_name(
            username, account_name, projection={"_id": 0}
        )
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        # Fetch holdings (include closed to match original behavior)
        holdings = await holding_repo.get_holdings_by_account(
            username, account_name, include_closed=True
        )
        # Remove _id from holdings for API response
        for h in holdings:
            h.pop("_id", None)

        return {"account": account, "holdings": holdings}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch portfolio: {str(e)}")


@router.put("/portfolio/update")
async def update_portfolio(
    data: dict,
    account_repo: AccountRepository = Depends(get_account_repository),
    holding_repo: HoldingRepository = Depends(get_holding_repository),
):
    try:
        username = data.get("username")
        account = data.get("accountDetails")
        holdings = data.get("holdings", [])

        if not username or not account:
            raise HTTPException(status_code=400, detail="Missing username or account details")

        if not holdings:
            raise HTTPException(status_code=400, detail="Holdings list is empty")

        # Step 1: Validate all stock symbols
        invalid_symbols = []
        for h in holdings:
            symbol = h.get("symbol")
            if not symbol:
                invalid_symbols.append("(empty symbol)")
                continue

            ticker = yf.Ticker(symbol)
            info = ticker.info
            if not info or "shortName" not in info:
                invalid_symbols.append(symbol)

        if invalid_symbols:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid stock symbol(s): {', '.join(invalid_symbols)}"
            )

        # Step 2: Update the account details
        updated = await account_repo.update_account_by_query(
            {"username": username, "client_account_name": account["accountName"]},
            {
                "account_no": account.get("accountNumber"),
                "open_date": account.get("openDate"),
            }
        )

        if not updated:
            # Check if account exists
            existing = await account_repo.get_by_account_name(username, account["accountName"])
            if not existing:
                raise HTTPException(status_code=404, detail="Account not found")

        # Step 3: Clear old holdings for this account
        await holding_repo.delete_many({
            "username": username,
            "client_account_name": account["accountName"]
        })

        # Step 4: Insert validated holdings
        new_holdings = []
        for h in holdings:
            new_holdings.append({
                "username": username,
                "client_account_name": account["accountName"],
                "symbol": h["symbol"].upper(),
                "quantity": float(h["quantity"]) if h["quantity"] else 0,
                "purchase_price": float(h["purchasePrice"]) if h["purchasePrice"] else 0,
                "purchase_date": h["purchaseDate"],
                "updated_at": datetime.utcnow()
            })

        if new_holdings:
            await holding_repo.create_many(new_holdings)

        return {"message": "Portfolio updated successfully!"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating portfolio: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Invalid Stock Symbol: {str(e)}")


@router.get("/portfolio/holdings/{username}/{account_name}")
async def get_portfolio_holdings(
    username: str,
    account_name: str,
    holding_repo: HoldingRepository = Depends(get_holding_repository),
):
    """
    Retrieve holdings for a user and account, aggregate duplicates,
    calculate avg cost, market price, P/L, and attach live news + sentiment data.

    OPTIMIZED VERSION: Uses parallel fetching with asyncio.gather to fetch
    market data, news, and sector info concurrently for all holdings.
    """
    import time
    import logging
    logger = logging.getLogger(__name__)

    start_time = time.time()
    logger.info(f"[PORTFOLIO-HOLDINGS] Request started - username={username}, account={account_name}")

    try:
        # Query MongoDB for holdings using repository
        logger.debug(f"[PORTFOLIO-HOLDINGS-DB] Querying holdings: username={username}, account={account_name}")
        holdings_list = await holding_repo.get_holdings_by_account(
            username, account_name, include_closed=True
        )

        db_elapsed_ms = (time.time() - start_time) * 1000
        logger.info(f"[PORTFOLIO-HOLDINGS-DB] Found {len(holdings_list)} holdings in {db_elapsed_ms:.0f}ms")

        if not holdings_list:
            logger.info(f"[PORTFOLIO-HOLDINGS] No holdings found, returning empty list")
            return {"holdings": []}

        # Aggregate duplicate holdings
        aggregated = {}
        for h in holdings_list:
            symbol = h.get("symbol", "").upper()
            qty = float(h.get("quantity", 0))
            price = float(h.get("purchase_price", 0))
            if symbol not in aggregated:
                aggregated[symbol] = {"total_qty": 0, "total_cost": 0}
            aggregated[symbol]["total_qty"] += qty
            aggregated[symbol]["total_cost"] += qty * price

        logger.info(f"[PORTFOLIO-HOLDINGS-DB] Aggregated to {len(aggregated)} unique symbols from {len(holdings_list)} holdings")

        # Build holdings list for batch enrichment
        holdings_to_enrich = [
            {
                "symbol": symbol,
                "quantity": data["total_qty"],
                "avg_cost": round(data["total_cost"] / data["total_qty"], 2) if data["total_qty"] > 0 else 0.0
            }
            for symbol, data in aggregated.items()
        ]

        # Use HoldingEnrichmentService for parallel data fetching
        logger.info(f"[PORTFOLIO-HOLDINGS] Starting parallel data fetch for {len(aggregated)} unique symbols")
        fetch_start = time.time()

        results = await holding_enrichment_service.enrich_holdings_batch(
            holdings_to_enrich,
            news_fetcher=get_news_data,
            news_timeframe="1W"
        )

        # Filter out any exceptions
        holdings_results = [r for r in results if not isinstance(r, Exception)]

        fetch_elapsed_ms = (time.time() - fetch_start) * 1000
        logger.info(f"[PORTFOLIO-HOLDINGS] Parallel fetch completed: {len(holdings_results)}/{len(aggregated)} successful in {fetch_elapsed_ms:.0f}ms")

        total_elapsed_ms = (time.time() - start_time) * 1000
        logger.info(f"[PORTFOLIO-HOLDINGS] Request completed in {total_elapsed_ms:.0f}ms")

        return {"holdings": holdings_results}

    except Exception as e:
        total_elapsed_ms = (time.time() - start_time) * 1000
        logger.error(f"[PORTFOLIO-HOLDINGS] Request failed after {total_elapsed_ms:.0f}ms: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch holdings: {str(e)}")


@router.get("/portfolio/performance/{username}/{account_name}")
async def get_portfolio_performance(
    username: str,
    account_name: str,
    timeframe: str = "1Y",
    holding_repo: HoldingRepository = Depends(get_holding_repository),
    account_repo: AccountRepository = Depends(get_account_repository),
):
    """
    Calculate portfolio performance vs S&P 500 for different time periods.

    Query Parameters:
        timeframe: Time period for historical chart data (1D, 1W, 1M, 6M, YTD, 1Y, 3Y, 5Y). Default: 1Y

    HYBRID LOGIC - SMART PERFORMANCE CALCULATION:
    Uses COST BASIS for recent purchases, MARKET PRICE for older holdings.

    Returns MTD, QTD, YTD, and ITD (Inception-to-Date) performance metrics.
    """
    import time
    start_time = time.time()
    logger.info(f"[PORTFOLIO-PERF] Request started - username={username}, account={account_name}, timeframe={timeframe}")

    try:
        # Step 1: Fetch holdings
        holdings_list = await holding_repo.get_holdings_by_account(
            username, account_name, include_closed=True
        )

        db_elapsed_ms = (time.time() - start_time) * 1000
        logger.info(f"[PORTFOLIO-PERF-DB] Found {len(holdings_list)} holdings in {db_elapsed_ms:.0f}ms")

        if not holdings_list:
            return {"error": "No holdings found"}

        today = datetime.now()

        # Step 2: Fetch current prices ONCE for all holdings
        current_prices = await fetch_current_prices_batch(holdings_list)

        # Step 3: Calculate performance for each period
        period_names = ["MTD", "QTD", "YTD", "ITD"]
        results = []

        for period_name in period_names:
            # Get period boundaries
            start_date, _ = calculate_period_boundaries(period_name, today)

            # For ITD, calculate from earliest purchase
            if period_name == "ITD":
                start_date = calculate_itd_start_date(holdings_list, today)

            # Calculate performance for each holding in parallel
            tasks = [
                calculate_holding_performance(holding, start_date, current_prices, today)
                for holding in holdings_list
            ]
            holdings_performance = await asyncio.gather(*tasks, return_exceptions=True)

            # Filter valid results
            valid_performance = [
                h for h in holdings_performance
                if h is not None and not isinstance(h, Exception)
            ]

            # Fetch S&P 500 return for comparison
            sp500_return = await fetch_sp500_return(start_date, today)

            # Aggregate into portfolio-level metrics
            portfolio_result = aggregate_portfolio_performance(
                valid_performance, period_name, sp500_return
            )

            results.append({
                "period": portfolio_result.period,
                "return": portfolio_result.return_percent,
                "sp500": portfolio_result.sp500_return,
                "isPositive": portfolio_result.is_positive,
                "outperformance": portfolio_result.outperformance,
                "portfolio_value_start": portfolio_result.portfolio_value_start,
                "portfolio_value_current": portfolio_result.portfolio_value_current,
                "holdings_count": portfolio_result.holdings_count,
                "top_gainers": portfolio_result.top_gainers,
                "top_losers": portfolio_result.top_losers
            })

        logger.info("Portfolio performance calculation complete")

        # Step 4: Generate historical time-series data
        historical_data, benchmark_data = await _fetch_timeseries_data(
            holdings_list, timeframe, username, account_name, account_repo
        )

        # Step 5: Generate portfolio events timeline
        events = await generate_portfolio_events(holdings_list, today)

        return {
            "username": username,
            "account_name": account_name,
            "performance": results,
            "calculation_date": today.strftime("%Y-%m-%d %H:%M:%S"),
            "historical_data": historical_data,
            "benchmark_data": benchmark_data,
            "events": events
        }

    except Exception as e:
        logger.error("Error calculating portfolio performance: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to calculate performance: {str(e)}")


async def _fetch_timeseries_data(
    holdings_list: list,
    timeframe: str,
    username: str,
    account_name: str,
    account_repo: AccountRepository
) -> tuple:
    """
    Helper to fetch portfolio and benchmark time-series data in parallel.

    Returns:
        Tuple of (historical_data, benchmark_data)
    """
    try:
        account_info = await account_repo.get_by_account_name(username, account_name)
        open_date = account_info.get("open_date") if account_info else None

        portfolio_task = portfolio_timeseries_service.generate_portfolio_timeseries(
            holdings_list=holdings_list,
            timeframe=timeframe,
            open_date=open_date,
            db=get_motor_database(),
            username=username,
            account_name=account_name
        )
        benchmark_task = portfolio_timeseries_service.fetch_benchmark_timeseries(
            timeframe=timeframe,
            benchmark_ticker="^GSPC"
        )

        historical_data, benchmark_data = await asyncio.gather(
            portfolio_task, benchmark_task, return_exceptions=True
        )

        if isinstance(historical_data, Exception):
            logger.warning("Error generating portfolio time-series: %s", historical_data)
            historical_data = {"timeframe": timeframe, "data_points": [], "error": str(historical_data)}

        if isinstance(benchmark_data, Exception):
            logger.warning("Error fetching benchmark time-series: %s", benchmark_data)
            benchmark_data = {"timeframe": timeframe, "data_points": [], "error": str(benchmark_data)}

        return historical_data, benchmark_data

    except Exception as e:
        logger.warning("Error generating time-series data: %s", e)
        return (
            {"timeframe": timeframe, "data_points": [], "error": str(e)},
            {"timeframe": timeframe, "data_points": [], "error": str(e)}
        )


@router.get("/portfolio/news/{username}/{account_name}")
@async_cache_result(ttl=settings.NEWS_CACHE_TTL, key_prefix="portfolio_news")
async def get_portfolio_news(
    username: str,
    account_name: str,
    holding_repo: HoldingRepository = Depends(get_holding_repository),
):
    """
    Feature 6: Optimized portfolio-level news aggregation endpoint.

    Fetches news for all holdings in parallel and returns full Alpha Vantage feed format.
    Significantly reduces response time from ~5 seconds to <1 second.

    Returns aggregated news from all holdings in the portfolio with full metadata
    compatible with DetailedRelatedNews component.

    Example: /api/portfolio/news/john_doe/Investment%20Account
    """
    try:
        logger.info("Portfolio news aggregation started for %s/%s", username, account_name)

        # Fetch holdings using repository
        holdings_list = await holding_repo.get_holdings_by_account(
            username, account_name, include_closed=True
        )

        if not holdings_list:
            raise HTTPException(
                status_code=404,
                detail=f"No holdings found for user '{username}' and account '{account_name}'"
            )

        # Get unique tickers
        unique_tickers = list(set(
            h.get("symbol", "").upper()
            for h in holdings_list
            if h.get("symbol") and float(h.get("quantity", 0)) > 0
        ))

        if not unique_tickers:
            score_defs = get_score_definitions()
            return {
                "username": username,
                "account_name": account_name,
                "news": [],
                "feed": [],
                "tickers": [],
                "items": "0",
                **score_defs
            }

        logger.info("Fetching news for %d tickers: %s", len(unique_tickers), unique_tickers)

        # Feature 6: Parallel bulk fetching with preserve_all_tickers mode
        # Use asyncio.gather to fetch all ticker news in parallel

        # Fetch raw Alpha Vantage data for all tickers in parallel
        session = await http_client.get_session()
        raw_feed_tasks = [
            news_service_instance._fetch_alpha_vantage_news(
                session, ticker, limit=1000, preserve_all_tickers=True
            )
            for ticker in unique_tickers
        ]
        raw_feed_results = await asyncio.gather(*raw_feed_tasks, return_exceptions=True)

        # Collect all raw feed articles with full metadata
        all_raw_articles = []
        seen_urls = set()  # Deduplicate by URL

        for ticker, raw_articles in zip(unique_tickers, raw_feed_results):
            if isinstance(raw_articles, Exception):
                logger.warning("Error fetching raw feed for %s: %s", ticker, raw_articles)
                continue

            if not raw_articles:
                continue

            # Add articles to feed, deduplicating by URL
            for article in raw_articles:
                url = article.get("url") or article.get("link")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_raw_articles.append(article)

        # Sort by time_published (most recent first)
        all_raw_articles.sort(
            key=lambda x: x.get("time_published", ""),
            reverse=True
        )

        # Create simplified news array for backward compatibility
        simplified_news = []
        for article in all_raw_articles:
            # Extract primary ticker from ticker_sentiment array
            ticker_sentiment_array = article.get("ticker_sentiment", [])
            primary_ticker = ""
            sentiment_score = article.get("overall_sentiment_score", 0)
            sentiment_label = article.get("overall_sentiment_label", "Neutral")
            relevance_score = 0.0

            # Find the ticker with highest relevance score in our portfolio
            if ticker_sentiment_array:
                portfolio_ticker_sentiments = [
                    ts for ts in ticker_sentiment_array
                    if ts.get("ticker", "").upper() in unique_tickers
                ]
                if portfolio_ticker_sentiments:
                    # Use ticker with highest relevance
                    best_match = max(
                        portfolio_ticker_sentiments,
                        key=lambda x: x.get("relevance_score", 0)
                    )
                    primary_ticker = best_match.get("ticker", "")
                    relevance_score = best_match.get("relevance_score", 0)
                    # Use ticker-specific sentiment if available
                    sentiment_score = best_match.get("ticker_sentiment_score", sentiment_score)
                    sentiment_label = best_match.get("ticker_sentiment_label", sentiment_label)

            simplified_news.append({
                "ticker": primary_ticker,
                "title": article.get("title", ""),
                "provider": article.get("provider") or article.get("source", "Unknown"),
                "sentiment_score": sentiment_score,
                "sentiment_label": sentiment_label,
                "link": article.get("link") or article.get("url", ""),
                "publish_date": article.get("publish_date", ""),
                "publish_timestamp": article.get("publish_timestamp", ""),
                "image": article.get("banner_image", ""),
                "relevance_score": relevance_score
            })

        logger.info("Aggregated %d unique articles from %d holdings", len(all_raw_articles), len(unique_tickers))

        # Get score definitions
        score_defs = get_score_definitions()

        # Calculate portfolio-level sentiment aggregates (optional, for future use)
        total_articles = len(all_raw_articles)

        # Build API metadata for portfolio context
        api_metadata = {
            "items": str(total_articles),
            "tickers_queried": unique_tickers,  # Indicate multi-ticker portfolio
            "is_portfolio": True,  # Flag for frontend to know this is portfolio data
            **score_defs
        }

        return {
            "username": username,
            "account_name": account_name,
            "feed": all_raw_articles,  # Full Alpha Vantage feed with all metadata
            "news": simplified_news,  # Simplified format for backward compatibility
            "tickers": unique_tickers,
            "total_articles": total_articles,
            **api_metadata
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in portfolio news aggregation: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch portfolio news: {str(e)}")


@router.get("/portfolio/sentiment/{username}/{account_name}")
async def get_portfolio_sentiment(
    username: str,
    account_name: str,
    holding_repo: HoldingRepository = Depends(get_holding_repository),
):
    """
    Feature 5: Aggregate sentiment analysis by sector for the portfolio.

    Returns:
    - overall_sentiment: Portfolio-weighted average sentiment score
    - sentiment_by_sector: Sector breakdown with sentiment, holdings count, value, and weight

    Example: /api/portfolio/sentiment/john_doe/Investment%20Account
    """
    try:
        from collections import defaultdict

        logger.info("Portfolio sector sentiment aggregation started for %s/%s", username, account_name)

        # Fetch holdings with sector data using repository
        holdings_list = await holding_repo.get_holdings_by_account(
            username, account_name, include_closed=True
        )

        if not holdings_list:
            raise HTTPException(
                status_code=404,
                detail=f"No holdings found for user '{username}' and account '{account_name}'"
            )

        # Aggregate holdings by symbol and fetch sector + sentiment data
        symbol_data = {}  # {symbol: {sector, industry, quantity, market_value, sentiment}}

        for holding in holdings_list:
            symbol = holding.get("symbol", "").upper()
            if not symbol:
                continue

            quantity = float(holding.get("quantity", 0))
            if quantity == 0:
                continue

            # Get market price
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                market_price = info.get("currentPrice") or info.get("regularMarketPrice")

                if not market_price:
                    logger.warning("No market price for %s, skipping", symbol)
                    continue

                market_value = quantity * float(market_price)

                # Get sector info (Feature 2)
                sector_info = stock_data_service.get_ticker_sector_info(symbol)
                sector = sector_info.get("sector", "N/A")
                industry = sector_info.get("industry", "N/A")

                # Initialize or update symbol data
                if symbol not in symbol_data:
                    symbol_data[symbol] = {
                        "sector": sector,
                        "industry": industry,
                        "quantity": 0,
                        "market_value": 0,
                        "sentiment": None
                    }

                symbol_data[symbol]["quantity"] += quantity
                symbol_data[symbol]["market_value"] += market_value

            except Exception as e:
                logger.warning("Error processing %s: %s", symbol, e)
                continue

        # Fetch sentiment for each symbol
        for symbol in symbol_data.keys():
            try:
                news_articles = await news_service_instance.get_ticker_news(symbol)
                if news_articles:
                    sentiment_results = sentiment_service.analyze_sentiment_with_momentum(news_articles)
                    sentiment_score = sentiment_results.get("overall_weighted_score")
                    symbol_data[symbol]["sentiment"] = sentiment_score
            except Exception as e:
                logger.warning("Sentiment fetch failed for %s: %s", symbol, e)
                symbol_data[symbol]["sentiment"] = None

        # Aggregate by sector
        sector_aggregates = defaultdict(lambda: {
            "sentiment_score": 0,
            "holdings_count": 0,
            "total_value": 0,
            "weight_in_portfolio": 0,
            "weighted_sentiment_sum": 0,
            "sentiment_weight_sum": 0
        })

        total_portfolio_value = sum(data["market_value"] for data in symbol_data.values())
        overall_weighted_sentiment = 0
        overall_sentiment_weight = 0

        for symbol, data in symbol_data.items():
            sector = data["sector"]
            if sector == "N/A":
                continue

            market_value = data["market_value"]
            sentiment = data["sentiment"]

            sector_aggregates[sector]["holdings_count"] += 1
            sector_aggregates[sector]["total_value"] += market_value

            # Weight sentiment by market value
            if sentiment is not None:
                sector_aggregates[sector]["weighted_sentiment_sum"] += sentiment * market_value
                sector_aggregates[sector]["sentiment_weight_sum"] += market_value

                overall_weighted_sentiment += sentiment * market_value
                overall_sentiment_weight += market_value

        # Calculate final sector metrics
        sentiment_by_sector = {}
        for sector, data in sector_aggregates.items():
            weight_in_portfolio = data["total_value"] / total_portfolio_value if total_portfolio_value > 0 else 0

            # Calculate weighted average sentiment for sector
            if data["sentiment_weight_sum"] > 0:
                sector_sentiment = data["weighted_sentiment_sum"] / data["sentiment_weight_sum"]
            else:
                sector_sentiment = None

            sentiment_by_sector[sector] = {
                "sentiment_score": round(sector_sentiment, 4) if sector_sentiment is not None else None,
                "holdings_count": data["holdings_count"],
                "total_value": round(data["total_value"], 2),
                "weight_in_portfolio": round(weight_in_portfolio, 4)
            }

        # Calculate overall portfolio sentiment
        if overall_sentiment_weight > 0:
            overall_sentiment = overall_weighted_sentiment / overall_sentiment_weight
        else:
            overall_sentiment = None

        logger.info("Processed %d holdings across %d sectors. Overall sentiment: %s",
                    len(symbol_data), len(sentiment_by_sector), overall_sentiment)

        return {
            "username": username,
            "account_name": account_name,
            "overall_sentiment": round(overall_sentiment, 4) if overall_sentiment is not None else None,
            "sentiment_by_sector": sentiment_by_sector,
            "total_portfolio_value": round(total_portfolio_value, 2)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in portfolio sentiment aggregation: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to aggregate sentiment: {str(e)}")


@router.get("/portfolio/daily-sentiment/{username}/{account_name}")
async def get_portfolio_daily_sentiment(
    username: str,
    account_name: str,
    days: int = None,
    timeframe: str = None,
    holding_repo: HoldingRepository = Depends(get_holding_repository),
):
    """
    Get aggregated daily sentiment data for a portfolio.
    Supports configurable number of days OR timeframe (e.g., '1M', '6M', 'YTD', '1Y')

    Example: /api/portfolio/daily-sentiment/john_doe/Investment%20Account?timeframe=6M
    Example: /api/portfolio/daily-sentiment/john_doe/Investment%20Account?days=30
    """
    try:
        logger.info("Portfolio daily sentiment aggregation started for %s/%s (timeframe=%s, days=%s)",
                    username, account_name, timeframe, days)

        # Fetch holdings using repository
        holdings_list = await holding_repo.get_holdings_by_account(
            username, account_name, include_closed=True
        )

        if not holdings_list:
            raise HTTPException(
                status_code=404,
                detail=f"No holdings found for user '{username}' and account '{account_name}'"
            )

        # Get market values for weighting
        enriched_holdings = []
        for holding in holdings_list:
            symbol = holding.get("symbol", "").upper()
            if not symbol:
                continue

            quantity = float(holding.get("quantity", 0))
            if quantity == 0:
                continue

            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                market_price = info.get("currentPrice") or info.get("regularMarketPrice")

                if market_price:
                    market_value = quantity * float(market_price)
                    enriched_holdings.append({
                        "symbol": symbol,
                        "quantity": quantity,
                        "market_value": market_value
                    })
            except Exception as e:
                logger.warning("Error getting market value for %s: %s", symbol, e)
                continue

        if not enriched_holdings:
            raise HTTPException(
                status_code=500,
                detail="Could not fetch market values for holdings"
            )

        # Get aggregated sentiment data
        result = await portfolio_sentiment_service.get_portfolio_daily_sentiment(
            enriched_holdings,
            days=days,
            timeframe=timeframe
        )

        # Add score definitions
        score_defs = get_score_definitions()

        return {
            "username": username,
            "account_name": account_name,
            **result,
            **score_defs
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in portfolio daily sentiment: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch portfolio daily sentiment: {str(e)}")


@router.get("/portfolio/rolling-sentiment/{username}/{account_name}")
async def get_portfolio_rolling_sentiment(
    username: str,
    account_name: str,
    timeframe: str = "1W",
    holding_repo: HoldingRepository = Depends(get_holding_repository),
):
    """
    Get aggregated rolling-window sentiment data for a portfolio.
    Supports: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 5Y, 10Y, MAX

    Example: /api/portfolio/rolling-sentiment/john_doe/Investment%20Account?timeframe=1W
    Example: /api/portfolio/rolling-sentiment/john_doe/Investment%20Account?timeframe=1Y
    """
    try:
        logger.info("Portfolio rolling sentiment aggregation started for %s/%s (timeframe=%s)",
                    username, account_name, timeframe)

        # Fetch holdings using repository
        holdings_list = await holding_repo.get_holdings_by_account(
            username, account_name, include_closed=True
        )

        if not holdings_list:
            raise HTTPException(
                status_code=404,
                detail=f"No holdings found for user '{username}' and account '{account_name}'"
            )

        # Get market values for weighting
        enriched_holdings = []
        for holding in holdings_list:
            symbol = holding.get("symbol", "").upper()
            if not symbol:
                continue

            quantity = float(holding.get("quantity", 0))
            if quantity == 0:
                continue

            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                market_price = info.get("currentPrice") or info.get("regularMarketPrice")

                if market_price:
                    market_value = quantity * float(market_price)
                    enriched_holdings.append({
                        "symbol": symbol,
                        "quantity": quantity,
                        "market_value": market_value
                    })
            except Exception as e:
                logger.warning("Error getting market value for %s: %s", symbol, e)
                continue

        if not enriched_holdings:
            raise HTTPException(
                status_code=500,
                detail="Could not fetch market values for holdings"
            )

        # Get aggregated rolling sentiment data
        result = await portfolio_sentiment_service.get_portfolio_rolling_sentiment(
            enriched_holdings,
            timeframe=timeframe
        )

        # Add score definitions
        score_defs = get_score_definitions()

        return {
            "username": username,
            "account_name": account_name,
            **result,
            **score_defs
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in portfolio rolling sentiment: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch portfolio rolling sentiment: {str(e)}")
