# app/api/routes.py
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, Response, Depends
import yfinance as yf
from datetime import datetime
import asyncio
import uuid
import secrets
import logging

import msal
import os

logger = logging.getLogger(__name__)

from fastapi.responses import RedirectResponse, JSONResponse

# Import the modular services
from app.services.news_service import news_service_instance
from app.services.stock_data_service import stock_data_service
from app.services.sentiment_service import sentiment_service
from app.services.market_analysis_service import market_analysis_service
from app.services.sector_service import sector_service_instance
from app.services.sector_sentiment_service import sector_sentiment_service
from app.services.earnings_service import earnings_service
from app.services.portfolio_timeseries_service import portfolio_timeseries_service
from app.services.portfolio_sentiment_service import portfolio_sentiment_service
from app.core.cache import redis_cache, async_cache_result, cache_result
from app.core.config import settings
from app.core.http_client import http_client
from app.core.circuit_breakers import get_all_status, reset_circuit_breaker
from app.core.auth import get_current_user
from app.database import (
    get_motor_client,
    get_motor_database,
)
from app.repositories.factory import (
    get_account_repository,
    get_holding_repository,
)
from app.repositories.account_repository import AccountRepository
from app.repositories.holding_repository import HoldingRepository

# Import scoring configuration
from app.config.scoring import get_score_definitions


CLIENT_ID = os.getenv("APPLICATION_ID", "<your-client-id>")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

# Validate Azure credentials at startup
if not CLIENT_ID or CLIENT_ID == "<your-client-id>":
    logger.warning("Azure CLIENT_ID (APPLICATION_ID) is not configured. Azure authentication will not work.")
if not CLIENT_SECRET:
    logger.warning("Azure CLIENT_SECRET is not configured. Azure authentication will not work.")


router = APIRouter()

@router.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring.
    Verifies MongoDB connectivity and returns service status.
    """
    import time
    start_time = time.time()

    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }

    # Check MongoDB connectivity
    try:
        # Ping MongoDB with 3 second timeout
        await asyncio.wait_for(
            get_motor_client().admin.command('ping'),
            timeout=3.0
        )
        health_status["checks"]["mongodb"] = {
            "status": "connected",
            "response_time_ms": round((time.time() - start_time) * 1000, 2)
        }
    except asyncio.TimeoutError:
        health_status["status"] = "unhealthy"
        health_status["checks"]["mongodb"] = {
            "status": "timeout",
            "error": "MongoDB ping timeout after 3 seconds"
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["mongodb"] = {
            "status": "disconnected",
            "error": str(e)
        }

    # Check Redis connectivity (if available)
    try:
        from app.core.cache import redis_cache
        if redis_cache and redis_cache._redis_client:
            redis_start = time.time()
            await redis_cache._redis_client.ping()
            health_status["checks"]["redis"] = {
                "status": "connected",
                "response_time_ms": round((time.time() - redis_start) * 1000, 2)
            }
        else:
            health_status["checks"]["redis"] = {"status": "disabled"}
    except Exception as e:
        health_status["checks"]["redis"] = {
            "status": "disconnected",
            "error": str(e)
        }

    # Return appropriate HTTP status code
    status_code = 200 if health_status["status"] == "healthy" else 503
    return health_status


@router.get("/circuit-breakers")
async def get_circuit_breaker_status():
    """
    Get status of all circuit breakers for external API monitoring.

    Returns status for each API including:
    - state: CLOSED (normal), OPEN (blocking), HALF_OPEN (testing)
    - failure_count: Number of consecutive failures
    - success_count: Successes in half-open state
    - last_failure_time: Timestamp of last failure

    Use this endpoint for monitoring API health and debugging rate limit issues.
    """
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "circuit_breakers": get_all_status()
    }


@router.post("/circuit-breakers/{api_name}/reset")
async def reset_circuit_breaker_endpoint(api_name: str):
    """
    Manually reset a circuit breaker to CLOSED state.
    Use with caution - only for admin/debugging purposes.

    Valid API names: alpha_vantage, finnhub, newsapi, marketaux, yahoo_finance
    """
    success = reset_circuit_breaker(api_name)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Circuit breaker not found for API: {api_name}"
        )
    return {
        "message": f"Circuit breaker for {api_name} reset successfully",
        "new_status": get_all_status().get(api_name)
    }


@router.get("/stocks/{ticker}/historical-data")
def get_historical_stock_data(ticker: str, timeframe: str = "1M"):
    """
    API endpoint to get historical stock data for a given ticker and timeframe.
    Example: /stocks/AAPL/historical-data?timeframe=3M
    """
    try:
        # Fetch 1 year of data for all timeframes
        period = "1y"
        
        # 1. Fetch data from the service with appropriate period
        full_data = stock_data_service.get_stock_data(ticker, period=period)
        if full_data is None:
            raise HTTPException(status_code=404, detail=f"Data not found for ticker {ticker}")

        # 2. Filter data based on the requested timeframe
        filtered_data = stock_data_service.filter_data_by_timeframe(full_data, timeframe)

        # 3. Convert DataFrame to JSON for the response
        # We reset the index to make the 'Date' a regular column
        json_data = filtered_data.reset_index().to_dict(orient="records")
        return {"ticker": ticker, "timeframe": timeframe, "data": json_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/sentiment")
async def get_stock_news_and_sentiment(ticker: str):
    """
    API endpoint to get recent news and its advanced sentiment analysis with momentum.

    This endpoint returns:
    - Weighted sentiment scores using exponential decay and relevance
    - Sentiment momentum (MACD-style Fast vs. Slow scores)
    - Detailed article-level sentiment and weights
    - Data quality indicators

    Example: /stocks/TSLA/sentiment

    Response includes:
    - overall_weighted_score: Primary sentiment score (slow/24h trend)
    - fast_score: Current intraday sentiment (7h half-life)
    - slow_score: Daily trend sentiment (24h half-life)
    - sentiment_momentum: fast_score - slow_score
    - momentum_label: "Positive Momentum", "Negative Momentum", etc.
    - momentum_interpretation: Human-readable description
    """
    try:
        # 1. Fetch recent news using the service
        news_articles = await news_service_instance.get_ticker_news(ticker)
        if not news_articles:
            return {"ticker": ticker, "message": "No recent news found."}

        # 2. Call the advanced sentiment analysis method with momentum
        sentiment_results = sentiment_service.analyze_sentiment_with_momentum(news_articles)

        # 3. Add score definitions to response
        score_defs = get_score_definitions()

        # 4. Return the rich data structure with momentum fields and score definitions
        return {
            "ticker": ticker,
            **sentiment_results,
            **score_defs
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/earnings-transcript")
async def get_earnings_transcript(ticker: str, quarter: str):
    """
    API endpoint to get earnings call transcript for a given ticker and quarter.
    
    Args:
        ticker: Stock ticker symbol (e.g., 'IBM', 'AAPL')
        quarter: Fiscal quarter in YYYYQM format (e.g., '2024Q1', '2023Q4')
    
    Returns:
        {
            "symbol": "IBM",
            "quarter": "2024Q1",
            "transcript": [
                {
                    "speaker": "Arvind Krishna",
                    "title": "CEO",
                    "content": "...",
                    "sentiment": 0.7,
                    "word_count": 234
                }
            ],
            "total_segments": 25,
            "fetched_at": "2024-10-26T10:30:00"
        }
    
    Example: /stocks/IBM/earnings-transcript?quarter=2024Q1
    """
    try:
        result = await earnings_service.fetch_earnings_transcript(ticker, quarter)
        
        if "error" in result:
            # Return 404 if no data available, 500 for other errors
            if "not available" in result["error"].lower() or "invalid quarter" in result["error"].lower():
                raise HTTPException(status_code=404, detail=result["error"])
            else:
                raise HTTPException(status_code=500, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/earnings-quarters")
async def get_available_earnings_quarters(ticker: str, years_back: int = 5):
    """
    API endpoint to get a list of potential earnings quarters to query.

    Args:
        ticker: Stock ticker symbol
        years_back: Number of years to look back (default: 5, max: 15)

    Returns:
        {
            "ticker": "IBM",
            "quarters": ["2024Q3", "2024Q2", "2024Q1", ...]
        }

    Example: /stocks/IBM/earnings-quarters?years_back=3
    """
    try:
        # Limit years_back to reasonable range
        years_back = min(max(1, years_back), 15)

        quarters = await earnings_service.get_available_quarters(ticker, years_back)

        return {
            "ticker": ticker.upper(),
            "quarters": quarters,
            "count": len(quarters)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/earnings-calendar")
async def get_earnings_calendar(ticker: str, horizon: str = "12month"):
    """
    API endpoint to get upcoming earnings calendar events for a given ticker.

    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL', 'IBM')
        horizon: Time horizon for earnings events (e.g., '3month', '6month', '12month')

    Returns:
        {
            "ticker": "AAPL",
            "earnings_events": [
                {
                    "earnings_date": "2025-01-30",
                    "fiscal_period_ending": "2024-12-31",
                    "estimated_eps": "2.35",
                    "reported_eps": null,
                    "currency": "USD",
                    "days_until": 95,
                    "surprise": null,
                    "surprise_percentage": null
                }
            ],
            "total_events": 4,
            "fetched_at": "2025-10-26T10:30:00"
        }

    Example: /stocks/AAPL/earnings-calendar?horizon=12month
    """
    try:
        result = await earnings_service.fetch_earnings_calendar(ticker, horizon)

        if "error" in result:
            # Return 404 if no data available, 500 for other errors
            if "not available" in result["error"].lower() or "not configured" in result["error"].lower():
                raise HTTPException(status_code=404, detail=result["error"])
            elif "rate limit" in result["error"].lower():
                raise HTTPException(status_code=429, detail=result["error"])
            elif "premium" in result["error"].lower():
                raise HTTPException(status_code=403, detail=result["error"])
            else:
                raise HTTPException(status_code=500, detail=result["error"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/company-overview")
async def get_company_overview(ticker: str):
    """
    API endpoint to get comprehensive company overview data from Alpha Vantage.
    
    This returns detailed company information including:
    - Basic info (name, description, sector, industry, etc.)
    - Financial ratios (P/E, P/B, EPS, etc.)
    - Analyst ratings and target price
    - Key metrics (market cap, revenue, profit margin, etc.)
    
    Args:
        ticker: Stock ticker symbol (e.g., 'IBM', 'AAPL')
    
    Returns:
        Complete company overview data from Alpha Vantage API
    
    Example: /stocks/IBM/company-overview
    """
    try:
        overview = await stock_data_service.get_company_overview(ticker)
        
        if not overview:
            raise HTTPException(
                status_code=404, 
                detail=f"Company overview data not available for ticker {ticker}"
            )
        
        return {
            "ticker": ticker.upper(),
            "data": overview
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    
@router.get("/sectors/{sector_ticker}/top-constituents")
def get_top_constituents_for_sector(sector_ticker: str):
    """
    API endpoint to get the top 10 constituents for a given sector.
    The sector_ticker must be URL-encoded if it contains special characters.
    Example: /sectors/%5EGSP500-45/top-constituents (for ^SP500-45)
    """
    try:
        # The API layer calls the service to perform the logic
        constituents = stock_data_service.get_sector_top_constituents(sector_ticker)

        if not constituents:
             return {"success": True, "sector_ticker": sector_ticker, "top_constituents": []}

        return {"success": True, "sector_ticker": sector_ticker, "top_constituents": constituents}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/sectors/{sector_identifier}/aggregated-news")
async def get_sector_aggregated_news(
    sector_identifier: str,
    limit: int = 100,
    timeframe: str = "1W"
):
    """
    API endpoint to get aggregated news for all companies in a sector.

    This endpoint:
    1. Resolves the sector identifier to a yfinance sector key
    2. Fetches the list of constituent tickers dynamically from yfinance
    3. Queries Alpha Vantage for news on each ticker in parallel
    4. Deduplicates by both URL and normalized title
    5. Returns comprehensive sector news with metadata

    Args:
        sector_identifier: Can be:
            - S&P 500 ticker (e.g., ^SP500-45 - must be URL-encoded as %5ESP500-45)
            - SPDR ETF ticker (e.g., XLK)
            - Sector name (e.g., "Information Technology")
            - yfinance sector key (e.g., "technology")
        limit: Maximum number of unique articles to return (default: 100)
        timeframe: Time range for news - "1D", "1W", "1M", etc. (default: "1W")

    Returns:
        {
            "success": true,
            "sector_key": "technology",
            "sector_name": "Information Technology",
            "tickers_queried": ["AAPL", "MSFT", "NVDA", ...],
            "total_tickers": 25,
            "total_articles_fetched": 487,
            "unique_articles": 245,
            "deduplication_rate": 49.69,
            "articles": [...],
            "timeframe": "1W",
            "cached": true,
            "metadata": {
                "url_duplicates_removed": 132,
                "title_duplicates_removed": 110,
                "total_duplicates_removed": 242
            }
        }

    Example:
        /sectors/XLK/aggregated-news?limit=50&timeframe=1W
        /sectors/%5ESP500-45/aggregated-news?limit=100
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
        logger.error("Error in get_sector_aggregated_news: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.get("/sectors/{sector_identifier}/daily-sentiment")
async def get_sector_daily_sentiment(
    sector_identifier: str,
    days: int = 30
):
    """
    API endpoint to get daily sector-wide sentiment scores for charting.

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
                "2025-10-25": {
                    "score": 0.24,
                    "count": 1234,
                    "headlines": [...]
                },
                "2025-10-24": {...}
            }
        }

    Example:
        /sectors/technology/daily-sentiment?days=30
        /sectors/XLK/daily-sentiment?days=7
    """
    try:
        # Generate cache key for this endpoint
        from app.core.cache import generate_cache_key
        cache_key = generate_cache_key(
            "sector_daily_sentiment_v1",
            sector_identifier,
            days=days
        )

        # Try to get from cache
        cached_result = await redis_cache.aget(cache_key)
        if cached_result is not None:
            logger.debug("Cache hit: returning cached daily sentiment for sector %s", sector_identifier)
            cached_result['cached'] = True
            return cached_result

        logger.debug("Cache miss: calculating daily sentiment for sector %s", sector_identifier)

        # Resolve sector identifier to yfinance key
        sector_key = sector_service_instance.resolve_sector_key(sector_identifier)

        # Get sector metadata
        sector_metadata = sector_service_instance.get_sector_metadata(sector_key)

        # Get sector tickers
        tickers, _ = sector_service_instance.get_sector_tickers(sector_key)

        # Fetch aggregated news (we need a larger timeframe to get enough days)
        # For 30 days, fetch 1M of news
        # Use higher limit (5000) to ensure full coverage for high-volume sectors
        timeframe_map = {7: "1W", 14: "2W", 30: "1M", 60: "2M", 90: "3M"}
        timeframe = timeframe_map.get(days, "1M")

        news_result = await news_service_instance.get_sector_news(
            sector_key=sector_key,
            limit=5000,  # Higher limit to ensure full coverage for high-volume sectors
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
        logger.error("Error in get_sector_daily_sentiment: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.get("/stocks/{ticker}/significant-events")
async def get_significant_events_for_ticker(ticker: str, timeframe: str = "1Y"):
    """
    API endpoint to analyze historical data for a stock, identify the top 5
    most significant price moves, and find correlated news for those events.
    Example: /stocks/NVDA/significant-events?timeframe=1M

    Optimized to reuse cached news data instead of making redundant API calls.
    """
    try:
        # Fetch cached news for the timeframe to reuse in significant events analysis
        # This avoids redundant Alpha Vantage API calls
        try:
            cached_news = await news_service_instance.get_ticker_news_for_timeframe(
                ticker,
                timeframe=timeframe,
                trigger_progressive=False  # Don't trigger progressive fetch
            )
        except Exception as e:
            logger.warning("Could not fetch cached news for significant events: %s", e)
            cached_news = None

        # Pass cached news to avoid redundant API calls
        events_with_news = market_analysis_service.analyze_significant_events(
            ticker,
            timeframe,
            news_articles=cached_news
        )

        if not events_with_news:
            return {"ticker": ticker, "message": "No significant events found matching the criteria."}

        return {"ticker": ticker, "events": events_with_news}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.post("/stocks/{ticker}/prefetch-events")
async def prefetch_significant_events(ticker: str, background_tasks: BackgroundTasks):
    """
    Trigger background prefetching of significant events for all timeframes.
    This allows instant display when users switch between timeframes.
    Example: POST /stocks/AAPL/prefetch-events
    """
    try:
        # Define all timeframes to prefetch
        timeframes = ['1D', '1M', '6M', 'YTD', '1Y']
        
        # Add background tasks for each timeframe
        for tf in timeframes:
            background_tasks.add_task(
                market_analysis_service.analyze_significant_events,
                ticker,
                tf
            )
        
        return {
            "ticker": ticker,
            "message": f"Background prefetch initiated for {len(timeframes)} timeframes",
            "timeframes": timeframes
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate prefetch: {str(e)}")

@router.get("/price")
def get_price_data(ticker: str, timeframe: str = "1Y"):
    """
    API endpoint to get historical price data for a ticker.
    Example: /api/price?ticker=AAPL&timeframe=1Y
    """
    try:
        # Use Redis cache for assembled price responses per ticker+timeframe
        cache_key = f"price:{ticker.upper()}:{timeframe}"
        try:
            cached_response = redis_cache.get(cache_key)
            if cached_response is not None:
                logger.debug("Cache hit: %s", cache_key)
                return cached_response
        except Exception:
            # If cache backend unavailable, continue without failing
            pass

        # For 1D intraday data, fetch with 1-minute interval (do not rely on 5y series)
        if timeframe == "1D":
            stock_data = stock_data_service.get_stock_data(ticker, period="1d", interval="1m")
        else:
            # For all non-1D requests, fetch a full 5-year daily series and slice server-side
            stock_data = stock_data_service.get_stock_data(ticker, period="5y", interval="1d")

        if stock_data is None or stock_data.empty:
            raise HTTPException(status_code=404, detail=f"No data found for ticker {ticker}")

        logger.debug("Raw data for %s (%s): %d rows", ticker, timeframe, len(stock_data))
        if len(stock_data) > 0:
            logger.debug("Last 3 dates in raw data: %s", stock_data.index[-3:].tolist())

        # Filter by timeframe if needed
        filtered_data = stock_data_service.filter_data_by_timeframe(stock_data, timeframe)

        logger.debug("Filtered data for %s (%s): %d rows", ticker, timeframe, len(filtered_data))
        if len(filtered_data) > 0:
            logger.debug("Last date in filtered data: %s", filtered_data.index[-1])

        # Fetch company info for metadata
        company_info = stock_data_service.get_company_info(ticker)

        # Fetch additional ticker info from yfinance
        ticker_obj = yf.Ticker(ticker)
        ticker_info = ticker_obj.info

        # Calculate previous close (last close from the previous trading day)
        prev_close = None
        if timeframe == "1D" and len(stock_data) > 0:
            # Get the close price from the previous trading day
            try:
                # Fetch 5 days to ensure we have previous close even with weekends
                hist_5d = ticker_obj.history(period="5d", interval="1d")
                logger.debug("Fetched %d days of data for prev close", len(hist_5d))
                logger.debug("Last 2 dates: %s", hist_5d.index[-2:].tolist() if len(hist_5d) >= 2 else 'N/A')

                if len(hist_5d) >= 2:
                    # Get the second-to-last day's close (previous trading day)
                    prev_close = float(hist_5d['Close'].iloc[-2])
                    logger.debug("Previous close for %s: %s", ticker, prev_close)
                elif len(hist_5d) == 1:
                    # Fallback if only one day available
                    prev_close = float(hist_5d['Close'].iloc[0])
                    logger.debug("Only 1 day available, using: %s", prev_close)
            except Exception as e:
                logger.error("Error fetching previous close for %s: %s", ticker, e)

        # Convert to the format expected by frontend
        prices = []
        for idx, row in filtered_data.iterrows():
            price_item = {
                "date": idx.strftime("%Y-%m-%d"),
                "price": float(row['Close']),
                "close": float(row['Close'])
            }
            # Add time for intraday data
            if timeframe == "1D":
                price_item["time"] = idx.strftime("%I:%M %p")
            prices.append(price_item)

        response = {
            "ticker": ticker,
            "company_name": company_info.get("name", ticker) if company_info else ticker,
            "longname": ticker_info.get("longName", ""),
            "shortname": ticker_info.get("shortName", ""),
            "currency": company_info.get("currency", "USD") if company_info else "USD",
            "exchange": ticker_info.get("exchange", ""),
            "market": ticker_info.get("market", ""),
            "market_state": ticker_info.get("marketState", ""),
            "prices": prices,
            "last_fetched": datetime.now().isoformat()
        }

        # Add prev_close for 1D timeframe
        if prev_close is not None:
            response["prev_close"] = prev_close

        # Cache the assembled response in Redis for non-1D timeframes (and short TTL for 1D)
        try:
            ttl = settings.PRICE_CACHE_TTL if timeframe != "1D" else max(30, int(settings.PRICE_CACHE_TTL / 10))
            redis_cache.set(cache_key, response, ttl=ttl)
            logger.debug("Cache set: %s (ttl=%ds)", cache_key, ttl)
        except Exception as e:
            logger.warning("Failed to set cache for %s: %s", cache_key, e)

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/news")
async def get_news_data(ticker: str, timeframe: str = "1Y"):
    """
    API endpoint to get recent news and sentiment for a ticker with momentum analysis.
    Example: /api/news?ticker=AAPL&timeframe=1Y

    Args:
        ticker: Stock ticker symbol
        timeframe: Time range for news data (1D, 1W, 1M, 3M, 6M, YTD, 1Y) - default: 1Y

    Returns comprehensive sentiment data including:
    - feed: Raw Alpha Vantage feed data with all details
    - news: Formatted/simplified news articles for backward compatibility
    - avg_score: Overall weighted sentiment score (slow/24h trend)
    - fast_score: Current intraday sentiment (7h half-life)
    - slow_score: Daily trend sentiment (24h half-life)
    - sentiment_momentum: fast_score - slow_score
    - momentum_label: Classification (e.g., "Positive Momentum")
    - momentum_interpretation: Human-readable description
    - momentum_quality: Data quality indicator
    """
    import time
    import logging
    logger = logging.getLogger(__name__)

    news_fetch_start = time.time()
    logger.info(f"[NEWS-API] Fetching news for ticker={ticker}, timeframe={timeframe}")

    try:
        # Fetch news articles using the timeframe-aware news service
        # Use preserve_all_tickers=True to get full data including all metadata
        news_articles = await news_service_instance.get_ticker_news_for_timeframe(
            ticker,
            timeframe=timeframe,
            trigger_progressive=True,
            preserve_all_tickers=True  # Get full data with all tickers and metadata
        )

        news_fetch_elapsed = (time.time() - news_fetch_start) * 1000
        logger.info(f"[NEWS-API] Fetched {len(news_articles) if news_articles else 0} articles in {news_fetch_elapsed:.0f}ms")

        # Preserve the original format for raw_feed (with ticker_sentiment arrays)
        import copy
        raw_feed = copy.deepcopy(news_articles) if news_articles else []

        # Extract ticker-specific sentiment from ticker_sentiment array for processing
        # This is needed because preserve_all_tickers=True returns array format
        if news_articles:
            for article in news_articles:
                if "ticker_sentiment" in article and isinstance(article["ticker_sentiment"], list):
                    # Find the sentiment for the queried ticker
                    for ts in article["ticker_sentiment"]:
                        if ts.get("ticker", "").upper() == ticker.upper():
                            # Extract sentiment data to root level for sentiment service
                            article["ticker_sentiment_score"] = float(ts.get("ticker_sentiment_score", 0.0))
                            article["ticker_sentiment_label"] = ts.get("ticker_sentiment_label", "Neutral")
                            article["ticker_relevance_score"] = float(ts.get("relevance_score", 0.0))
                            break

        if not news_articles:
            score_defs = get_score_definitions()
            return {
                "ticker": ticker, 
                "news": [], 
                "feed": raw_feed,
                "items": str(len(raw_feed)),
                "avg_score": 0, 
                **score_defs
            }

        # Analyze sentiment WITH MOMENTUM - this includes fast/slow scores and momentum calculation
        sentiment_results = sentiment_service.analyze_sentiment_with_momentum(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Format news for frontend - use field names that match frontend expectations
        formatted_news = []
        for article in articles_with_sentiment:
            news_item = {
                "title": article.get("title", ""),  # Frontend expects "title"
                "provider": article.get("source_domain", article.get("provider", "Unknown")),  # Try source_domain first, fallback to provider
                "sentiment_score": article.get("sentiment_score_raw", 0),  # Frontend expects "sentiment_score"
                "sentiment_label": article.get("sentiment_label", "Neutral"),  # Bullish/Bearish format
                "link": article.get("link", ""),
                "publish_date": article.get("publish_date", ""),
                "publish_timestamp": article.get("publish_timestamp", ""),  # Add full timestamp
                "image": article.get("banner_image", article.get("image", ""))  # Try banner_image first, fallback to image
            }

            # Add relevance score if available
            relevance_score = article.get("ticker_relevance_score")
            if relevance_score is not None and relevance_score > 0:
                news_item["relevance_score"] = relevance_score

            formatted_news.append(news_item)

        # Add score definitions to response
        score_defs = get_score_definitions()

        return {
            "ticker": ticker,
            "news": formatted_news,
            "feed": raw_feed,  # Add raw Alpha Vantage feed
            "items": str(len(raw_feed)),  # Number of feed items
            "avg_score": sentiment_results.get("overall_weighted_score", 0),
            # Add momentum fields to response
            "sentiment_momentum": sentiment_results.get("sentiment_momentum"),
            "fast_score": sentiment_results.get("fast_score"),
            "slow_score": sentiment_results.get("slow_score"),
            "momentum_label": sentiment_results.get("momentum_label"),
            "momentum_interpretation": sentiment_results.get("momentum_interpretation"),
            "momentum_quality": sentiment_results.get("momentum_quality"),
            "momentum_direction": sentiment_results.get("momentum_direction"),
            "momentum_strength": sentiment_results.get("momentum_strength"),
            "half_life_fast_hours": sentiment_results.get("half_life_fast_hours"),
            "half_life_slow_hours": sentiment_results.get("half_life_slow_hours"),
            "data_quality": sentiment_results.get("data_quality"),
            # Add volatility fields to response
            "sentiment_volatility": sentiment_results.get("sentiment_volatility"),
            "volatility_quality": sentiment_results.get("volatility_quality"),
            # Add effective news volume (quantity metric)
            "effective_news_volume": sentiment_results.get("effective_news_volume"),
            "volume_interpretation": sentiment_results.get("volume_interpretation"),
            # Add breadth metrics (bull/bear ratio)
            "sentiment_breadth_score": sentiment_results.get("sentiment_breadth_score"),
            "num_bullish_articles": sentiment_results.get("num_bullish_articles"),
            "num_bearish_articles": sentiment_results.get("num_bearish_articles"),
            "total_directional_articles": sentiment_results.get("total_directional_articles"),
            "breadth_interpretation": sentiment_results.get("breadth_interpretation"),
            "breadth_quality": sentiment_results.get("breadth_quality"),
            # Add Z-Score metrics (sentiment shock)
            "sentiment_z_score": sentiment_results.get("sentiment_z_score"),
            "z_score_interpretation": sentiment_results.get("z_score_interpretation"),
            "z_score_historical_mean": sentiment_results.get("z_score_historical_mean"),
            "z_score_historical_std": sentiment_results.get("z_score_historical_std"),
            "z_score_days_of_history": sentiment_results.get("z_score_days_of_history"),
            "z_score_quality": sentiment_results.get("z_score_quality"),
            # Add Source & Topic Analysis metrics
            "source_concentration_hhi": sentiment_results.get("source_concentration_hhi"),
            "concentration_interpretation": sentiment_results.get("concentration_interpretation"),
            "top_sources": sentiment_results.get("top_sources", []),
            "dominant_topic": sentiment_results.get("dominant_topic"),
            "dominant_topic_weight": sentiment_results.get("dominant_topic_weight"),
            "dominant_topic_percentage": sentiment_results.get("dominant_topic_percentage"),
            "topic_count": sentiment_results.get("topic_count", 0),
            "sentiment_by_topic": sentiment_results.get("sentiment_by_topic", {}),
            "topic_weights": sentiment_results.get("topic_weights", {}),
            **score_defs
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/news/sources")
async def get_news_sources(ticker: str):
    """
    API endpoint to get news source reliability and sentiment breakdown.
    Returns metrics for each news source including reliability score based on:
    - Article volume (consistency)
    - Sentiment consistency
    - Coverage breadth
    Example: /api/news/sources?ticker=AAPL
    """
    try:
        # Fetch news articles
        news_articles = await news_service_instance.get_ticker_news(ticker)

        if not news_articles:
            return {"ticker": ticker, "sources": []}

        # Analyze sentiment to get scores
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Group articles by source
        source_map = {}
        for article in articles_with_sentiment:
            source = article.get("provider", "Unknown")
            if source not in source_map:
                source_map[source] = {
                    "name": source,
                    "articles": [],
                    "sentiment_scores": []
                }
            
            sentiment_score = article.get("sentiment_score_raw", 0)
            source_map[source]["articles"].append(article)
            source_map[source]["sentiment_scores"].append(sentiment_score)

        # Calculate metrics for each source
        sources = []
        total_articles = len(articles_with_sentiment)
        
        for source_name, source_data in source_map.items():
            article_count = len(source_data["articles"])
            sentiment_scores = source_data["sentiment_scores"]
            
            # Calculate average sentiment
            avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0
            
            # Calculate reliability score based on multiple factors:
            # 1. Volume factor (0-0.4): More articles = more reliable
            volume_factor = min(0.4, (article_count / total_articles) * 0.8)
            
            # 2. Consistency factor (0-0.3): Lower standard deviation = more consistent
            if len(sentiment_scores) > 1:
                mean = sum(sentiment_scores) / len(sentiment_scores)
                variance = sum((x - mean) ** 2 for x in sentiment_scores) / len(sentiment_scores)
                std_dev = variance ** 0.5
                # Normalize std_dev (0-1 range maps to 0.3-0 reliability)
                consistency_factor = max(0, 0.3 - (std_dev * 0.15))
            else:
                consistency_factor = 0.15  # Neutral for single article
            
            # 3. Base reliability (0.3): All sources start with base reliability
            base_reliability = 0.3
            
            # Total reliability score (0-1 scale)
            reliability = base_reliability + volume_factor + consistency_factor
            reliability = min(1.0, max(0.0, reliability))  # Clamp to 0-1
            
            sources.append({
                "name": source_name,
                "sentiment": avg_sentiment,
                "reliability": reliability,
                "articles": article_count,
                "consistency": 1.0 - min(1.0, std_dev) if len(sentiment_scores) > 1 else 0.5
            })

        # Sort by reliability (descending)
        sources.sort(key=lambda x: x["reliability"], reverse=True)

        return {
            "ticker": ticker,
            "sources": sources
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/daily-sentiment")
@async_cache_result(ttl=600, key_prefix="daily_sentiment")  # Cache for 10 minutes
async def get_daily_sentiment(ticker: str, days: int = None, timeframe: str = None):
    """
    API endpoint to get daily sentiment data for a ticker.
    Supports configurable number of days OR timeframe (e.g., '1M', '6M', 'YTD', '1Y', '5Y', '10Y', 'MAX')
    Example: /api/daily-sentiment?ticker=AAPL&timeframe=6M
    Example: /api/daily-sentiment?ticker=AAPL&days=30
    Example: /api/daily-sentiment?ticker=AAPL&timeframe=10Y
    Cached for 10 minutes to avoid redundant sentiment calculations.
    """
    try:
        from datetime import datetime, timedelta, timezone

        # Determine days from timeframe if provided
        if timeframe:
            timeframe_days_map = {
                '1D': 1,
                '1W': 7,
                '1M': 30,
                '3M': 90,
                '6M': 180,
                'YTD': None,  # Will be calculated
                '1Y': 365,
                '5Y': 1825,
                '10Y': 3650,
                'MAX': 7300  # ~20 years max for display purposes
            }

            if timeframe == 'YTD':
                # Calculate days since start of year
                now = datetime.now(timezone.utc)
                start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)
                days = (now - start_of_year).days
            else:
                days = timeframe_days_map.get(timeframe, 30)
        elif days is None:
            # Default to 7 days if neither specified
            days = 7

        # Validate and cap days parameter
        days = min(max(days, 1), 7300)  # Max ~20 years for display

        # Fetch news articles using timeframe-aware method if timeframe specified
        if timeframe:
            news_articles = await news_service_instance.get_ticker_news_for_timeframe(
                ticker,
                timeframe=timeframe,
                trigger_progressive=True
            )
        else:
            news_articles = await news_service_instance.get_ticker_news(ticker)

        # Initialize all requested days with empty data
        today = datetime.now(timezone.utc).date()
        daily_data = {}
        for i in range(days):
            date = today - timedelta(days=days-1-i)
            date_str = date.strftime("%Y-%m-%d")
            daily_data[date_str] = {"score": 0, "count": 0, "headlines": []}

        # Add score definitions to response
        score_defs = get_score_definitions()

        if not news_articles:
            # Return empty metadata when no articles available
            empty_metadata = {
                "source_concentration_hhi": None,
                "concentration_interpretation": None,
                "dominant_source": None,
                "dominant_topic": None,
                "topic_distribution": {},
                "source_breakdown": {}
            }
            return {"ticker": ticker, "daily": daily_data, "metadata": empty_metadata, **score_defs}

        # Analyze sentiment to get scores
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Feature 3: Get topic/source metadata using momentum analysis
        momentum_results = sentiment_service.analyze_sentiment_with_momentum(news_articles)

        # Extract metadata fields
        metadata = {
            "source_concentration_hhi": momentum_results.get("source_concentration_hhi"),
            "concentration_interpretation": momentum_results.get("concentration_interpretation"),
            "dominant_source": momentum_results.get("top_sources", [{}])[0].get("source") if momentum_results.get("top_sources") else None,
            "dominant_topic": momentum_results.get("dominant_topic"),
            "topic_distribution": momentum_results.get("topic_weights", {}),
            "source_breakdown": {
                source["source"]: source["percentage"]
                for source in momentum_results.get("top_sources", [])
            }
        }

        # Group articles by date with full details for the frontend
        for article in articles_with_sentiment:
            date = article.get("publish_date")
            if not date:
                continue

            # Only add to daily_data if it's within our 7-day window
            if date not in daily_data:
                continue

            sentiment_score = article.get("sentiment_score_raw", 0)
            daily_data[date]["score"] += sentiment_score
            daily_data[date]["count"] += 1

            headline_item = {
                "title": article.get("title", ""),
                "provider": article.get("provider", "Unknown"),
                "sentiment_score": sentiment_score,
                "sentiment_label": article.get("sentiment_label", "Neutral"),  # Bullish/Bearish format
                "link": article.get("link", "")
            }

            # Add relevance score if available
            relevance_score = article.get("ticker_relevance_score")
            if relevance_score is not None and relevance_score > 0:
                headline_item["relevance_score"] = relevance_score

            daily_data[date]["headlines"].append(headline_item)

        # Calculate average scores and sort headlines by sentiment magnitude and relevance
        for date, data in daily_data.items():
            if data["count"] > 0:
                data["score"] = data["score"] / data["count"]
            # Sort headlines by absolute sentiment score and relevance (most impactful first)
            data["headlines"].sort(key=lambda x: abs(x.get("sentiment_score", 0)) * max(0.0001, x.get("relevance_score", 1.0)), reverse=True)

        return {
            "ticker": ticker,
            "daily": daily_data,
            "metadata": metadata,  # Feature 3: Topic/source metadata
            **score_defs
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/rolling-sentiment")
async def get_rolling_sentiment(ticker: str, timeframe: str = "1W"):
    """
    API endpoint to get rolling-window sentiment data for different timeframes.
    Supports: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 5Y, 10Y, MAX
    Uses progressive background fetching to pre-load future timeframes.

    Supports both individual stock tickers (e.g., AAPL) and sector identifiers
    (e.g., XLK, technology, ^SP500-45, Information Technology).

    Example: /api/rolling-sentiment?ticker=AAPL&timeframe=1W
    Example: /api/rolling-sentiment?ticker=XLK&timeframe=5Y
    Example: /api/rolling-sentiment?ticker=AAPL&timeframe=10Y
    """
    try:
        from datetime import datetime, timedelta, timezone

        # Try to resolve as sector identifier first
        is_sector = False
        sector_key = None

        try:
            sector_key = sector_service_instance.resolve_sector_key(ticker)
            is_sector = True
            logger.debug("Resolved '%s' as sector: %s", ticker, sector_key)
        except ValueError:
            # Not a sector, treat as stock ticker
            is_sector = False
            logger.debug("Treating '%s' as stock ticker", ticker)

        # Configure timeframe parameters for Rolling 24h Windows
        timeframe_configs = {
            '1D': {'hours': 24, 'interval_hours': 1, 'window_hours': 24},
            '1W': {'hours': 168, 'interval_hours': 6, 'window_hours': 24},
            '1M': {'hours': 720, 'interval_hours': 12, 'window_hours': 24},
            '3M': {'days': 90, 'interval_hours': 24, 'window_hours': 24},
            '6M': {'days': 180, 'interval_hours': 24, 'window_hours': 24},
            'YTD': {'days': (datetime.now(timezone.utc) - datetime(datetime.now(timezone.utc).year, 1, 1, tzinfo=timezone.utc)).days, 'interval_hours': 24, 'window_hours': 24},
            '1Y': {'days': 365, 'interval_hours': 24, 'window_hours': 24},
            '5Y': {'days': 1825, 'interval_hours': 24, 'window_hours': 24},
            '10Y': {'days': 3650, 'interval_hours': 48, 'window_hours': 168},  # 48h interval, 7-day rolling window
            'MAX': {'days': 7300, 'interval_hours': 168, 'window_hours': 720}  # Weekly interval, 30-day rolling window
        }

        config = timeframe_configs.get(timeframe, timeframe_configs['1W'])

        # SECTOR LIMIT: For sectors, cap timeframe at 1M for exponential decay (10 half-lives = <0.1% relevance)
        effective_timeframe = timeframe
        if is_sector:
            effective_timeframe = timeframe if timeframe in ['1D', '1W', '1M'] else '1M'
            if effective_timeframe != timeframe:
                logger.debug("Sector timeframe '%s' capped to '1M' for sector analysis", timeframe)

        if is_sector:
            # SECTOR PATH: Fetch aggregated sector news and calculate rolling sentiment
            logger.info("Fetching sector rolling sentiment for: %s (timeframe: %s)", sector_key, effective_timeframe)

            # Get sector tickers
            tickers, _ = sector_service_instance.get_sector_tickers(sector_key)

            # Fetch aggregated sector news with capped timeframe
            # Use higher limit (5000) to ensure full coverage for high-volume sectors
            # This prevents the issue where high-volume sectors get fewer days of data
            news_result = await news_service_instance.get_sector_news(
                sector_key=sector_key,
                limit=5000,
                timeframe=effective_timeframe
            )

            articles = news_result.get('articles', [])

            if not articles:
                score_defs = get_score_definitions()
                return {
                    "ticker": ticker,
                    "timeframe": effective_timeframe,
                    "data": [],
                    "has_data": False,
                    "message": "No news articles found for sector",
                    **score_defs
                }

            # Calculate rolling sector sentiment with capped timeframe config
            sector_config = timeframe_configs.get(effective_timeframe, timeframe_configs['1W'])
            data_points = sector_sentiment_service.calculate_rolling_sector_sentiment(
                articles=articles,
                sector_tickers=tickers,
                timeframe=effective_timeframe,
                interval_hours=sector_config['interval_hours'],
                window_hours=sector_config['window_hours']
            )

            has_data = any(point["volume"] > 0 for point in data_points)
            source_earliest_dates = None

        else:
            # STOCK PATH: Existing logic for individual stocks
            logger.info("Fetching stock rolling sentiment for: %s (timeframe: %s)", ticker, timeframe)

            # Fetch news articles using timeframe-aware method with progressive fetching
            news_articles = await news_service_instance.get_ticker_news_for_timeframe(
                ticker,
                timeframe=timeframe,
                trigger_progressive=True
            )

            logger.debug("Rolling sentiment: received %d articles from news service", len(news_articles) if news_articles else 0)

            # Add score definitions to response
            score_defs = get_score_definitions()

            if not news_articles:
                logger.debug("Rolling sentiment: no articles found for %s - returning empty response", ticker)
                return {
                    "ticker": ticker,
                    "timeframe": timeframe,
                    "data": [],
                    "message": "No news articles found",
                    **score_defs
                }

            # Analyze sentiment for all articles
            sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
            articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

            # Determine granularity and time range based on timeframe
            now = datetime.now(timezone.utc)
            data_points = []

            # Calculate number of data points based on config
            if 'days' in config:
                num_points = config['days'] * (24 // config['interval_hours'])
            else:
                num_points = config['hours'] // config['interval_hours']

            # Unified approach for all timeframes
            for i in range(num_points):
                point_time = now - timedelta(hours=i * config['interval_hours'])
                window_start = point_time - timedelta(hours=config['window_hours'])

                # Find articles published within this window using exact timestamps
                window_articles = []
                for a in articles_with_sentiment:
                    pub_timestamp_str = a.get("publish_timestamp")
                    if pub_timestamp_str:
                        try:
                            pub_timestamp = datetime.fromisoformat(pub_timestamp_str)
                            # Ensure timezone-aware comparison
                            if pub_timestamp.tzinfo is None:
                                pub_timestamp = pub_timestamp.replace(tzinfo=timezone.utc)
                            if window_start <= pub_timestamp <= point_time:
                                window_articles.append(a)
                        except Exception:
                            # Fallback to date-based filtering if timestamp parsing fails
                            publish_date = a.get("publish_date")
                            if publish_date:
                                window_start_date = window_start.date()
                                window_end_date = point_time.date()
                                if window_start_date <= datetime.strptime(publish_date, "%Y-%m-%d").date() <= window_end_date:
                                    window_articles.append(a)

                volume = len(window_articles)
                avg_sentiment = sum(a.get("sentiment_score_raw", 0) for a in window_articles) / volume if volume > 0 else 0

                # Sort headlines by sentiment * relevance
                # For individual stocks, relevance_score is already extracted and stored in the article
                top_headlines = sorted(
                    window_articles,
                    key=lambda x: abs(x.get("sentiment_score_raw", 0)) * x.get("relevance_score", 1.0),
                    reverse=True
                )  # Return all headlines (no limit)

                # Format label based on timeframe and interval
                # Cross-platform datetime formatting (Windows doesn't support %-I, %-d)
                if timeframe == '1D':
                    # Format: "3PM"
                    hour = point_time.strftime("%I").lstrip("0")
                    label = f"{hour}{point_time.strftime('%p')}"
                elif timeframe == '1W':
                    # Format: "Mon 3PM"
                    hour = point_time.strftime("%I").lstrip("0")
                    label = f"{point_time.strftime('%a')} {hour}{point_time.strftime('%p')}"
                elif timeframe == '1M':
                    # Format: "Jan 5 3PM"
                    day = str(point_time.day)
                    hour = point_time.strftime("%I").lstrip("0")
                    label = f"{point_time.strftime('%b')} {day} {hour}{point_time.strftime('%p')}"
                elif timeframe in ['3M', '6M']:
                    # Format: "Jan 5"
                    day = str(point_time.day)
                    label = f"{point_time.strftime('%b')} {day}"
                elif timeframe in ['YTD', '1Y']:
                    # Format: "Jan 5"
                    day = str(point_time.day)
                    label = f"{point_time.strftime('%b')} {day}"
                elif timeframe == '5Y':
                    # Format: "Jan 5, 2024"
                    day = str(point_time.day)
                    label = f"{point_time.strftime('%b')} {day}, {point_time.year}"
                else:
                    # Default: "Jan 5"
                    day = str(point_time.day)
                    label = f"{point_time.strftime('%b')} {day}"

                data_points.append({
                    "timestamp": point_time.isoformat(),
                    "label": label,
                    "volume": volume,
                    "sentiment": avg_sentiment,
                    "headlines": [{
                        "title": h.get("title", ""),
                        "provider": h.get("provider", "Unknown"),
                        "sentiment_score": h.get("sentiment_score_raw", 0),
                        "relevance_score": h.get("relevance_score", 1.0),
                        "link": h.get("link", "")
                    } for h in top_headlines]
                })

            # Reverse to show oldest to newest
            data_points.reverse()

            # Check if we have sufficient data
            has_data = any(point["volume"] > 0 for point in data_points)

            logger.debug("Rolling sentiment: generated %d data points, has_data=%s", len(data_points), has_data)
            logger.debug("Rolling sentiment: data points with volume: %d", sum(1 for p in data_points if p['volume'] > 0))

            # Extract source earliest dates metadata if available
            source_earliest_dates = None
            if articles_with_sentiment:
                for article in articles_with_sentiment:
                    if '_source_earliest_dates' in article:
                        source_earliest_dates = article['_source_earliest_dates']
                        break

        # Common return logic for both stocks and sectors
        score_defs = get_score_definitions()

        response_data = {
            "ticker": ticker,
            "timeframe": effective_timeframe,
            "data": data_points,
            "has_data": has_data,
            **score_defs
        }
        
        # Add source coverage info if available
        if source_earliest_dates:
            response_data["source_earliest_dates"] = source_earliest_dates

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/news-models")
async def get_news_models(ticker: str):
    """
    API endpoint that returns News objects using the proper model structure.
    This demonstrates that we're using the News, SentimentScore, and RelevanceScore models.
    Example: /api/news-models?ticker=AAPL
    """
    try:
        # Fetch news articles
        news_articles = await news_service_instance.get_ticker_news(ticker)

        # Add score definitions to response
        score_defs = get_score_definitions()

        if not news_articles:
            return {"ticker": ticker, "news": [], "message": "No news found", **score_defs}

        # Analyze sentiment - this creates News model objects
        sentiment_results = sentiment_service.analyze_sentiment_with_weights(news_articles)
        news_objects = sentiment_results.get("news_objects", [])

        # Convert News objects to dict format for JSON response
        formatted_news = []
        for news_obj in news_objects:
            news_item = {
                "headline": news_obj.headline,
                "source": news_obj.source,
                "sentiment_score": {
                    "value": news_obj.sentiment_score.value,
                    "label": news_obj.sentiment_score.label,
                    "source": news_obj.sentiment_score.source,
                    "confidence": news_obj.sentiment_score.confidence,
                    "timestamp": news_obj.sentiment_score.timestamp.isoformat()
                },
                "link": getattr(news_obj, 'link', None),
                "publish_date": getattr(news_obj, 'publish_date', None),
                "image": getattr(news_obj, 'image', None)
            }

            # Add relevance score if available
            if news_obj.relevance_score is not None:
                news_item["relevance_score"] = {
                    "value": news_obj.relevance_score.value,
                    "source": news_obj.relevance_score.source,
                    "confidence": news_obj.relevance_score.confidence,
                    "timestamp": news_obj.relevance_score.timestamp.isoformat()
                }

            formatted_news.append(news_item)

        return {
            "ticker": ticker,
            "news": formatted_news,
            "overall_score": sentiment_results.get("overall_weighted_score", 0),
            "sentiment_counts": sentiment_results.get("sentiment_counts", {}),
            "message": "Using News, SentimentScore, and RelevanceScore models from app.models",
            **score_defs
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")

@router.get("/search-ticker")
def search_ticker(q: str):
    """
    API endpoint to search for ticker symbols with fuzzy matching.
    Example: /api/search-ticker?q=appl

    This uses Yahoo Finance's search endpoint to find matching tickers.
    Returns quotes with symbol, name, and quoteType fields.
    """
    try:
        if not q or len(q) < 1:
            return {"quotes": []}

        # Use yahooquery's search functionality for fuzzy matching
        from yahooquery import search

        try:
            # Search using yahooquery
            results = search(q)

            if not results or 'quotes' not in results:
                return {"quotes": []}

            # Format results to match expected structure
            formatted_quotes = []
            for quote in results.get('quotes', []):
                # Only include valid quotes with symbols
                if quote.get('symbol'):
                    formatted_quotes.append({
                        "symbol": quote.get('symbol', ''),
                        "shortname": quote.get('shortname', quote.get('longname', '')),
                        "longname": quote.get('longname', quote.get('shortname', '')),
                        "quoteType": quote.get('quoteType', quote.get('typeDisp', 'EQUITY')),
                        "exchange": quote.get('exchDisp', quote.get('exchange', '')),
                        "sector": quote.get('sector', ''),
                        "industry": quote.get('industry', '')
                    })

            return {"quotes": formatted_quotes}

        except Exception as search_error:
            # Fallback to exact match with yfinance if yahooquery fails
            try:
                ticker_obj = yf.Ticker(q.upper())
                info = ticker_obj.info

                if info and "symbol" in info:
                    return {
                        "quotes": [{
                            "symbol": info.get("symbol", q.upper()),
                            "shortname": info.get("shortName", q.upper()),
                            "longname": info.get("longName", ""),
                            "quoteType": info.get("quoteType", "EQUITY"),
                            "exchange": info.get("exchange", ""),
                            "sector": info.get("sector", ""),
                            "industry": info.get("industry", "")
                        }]
                    }
            except Exception as e:
                logger.warning(f"Failed to fetch stock quote for {q}: {e}")

            return {"quotes": []}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")




# Use settings from config.py for environment-aware configuration
REDIRECT_URI = settings.get_redirect_uri()
AUTHORITY = settings.AZURE_AUTHORITY
FRONTEND_URL = settings.FRONTEND_URL
SCOPES = ["user.read"]

# Initialize MSAL Confidential Client only if credentials are valid
cca = None
if CLIENT_ID and CLIENT_ID != "<your-client-id>" and CLIENT_SECRET:
    try:
        cca = msal.ConfidentialClientApplication(
            client_id=CLIENT_ID,
            authority=AUTHORITY,
            client_credential=CLIENT_SECRET,
        )
        logger.info("Azure AD authentication initialized")
        logger.info("  Redirect URI: %s", REDIRECT_URI)
        logger.info("  Authority: %s", AUTHORITY)
        logger.info("  Frontend URL: %s", FRONTEND_URL)
    except Exception as e:
        logger.error("Failed to initialize Azure AD authentication: %s", e)
else:
    logger.warning("Azure AD authentication is disabled due to missing credentials.")


@router.get("/login")
def azure_login():
    """
    Redirects the user to Microsoft login page.
    """
    if not cca:
        raise HTTPException(
            status_code=503,
            detail="Azure AD authentication is not configured. Please check APPLICATION_ID and CLIENT_SECRET environment variables."
        )

    try:
        auth_url = cca.get_authorization_request_url(
            SCOPES,
            redirect_uri=REDIRECT_URI,
        )
        logger.info("Azure login initiated. Redirect URI: %s", REDIRECT_URI)
        return RedirectResponse(auth_url)
    except Exception as e:
        logger.error("Azure login error: %s", e)
        raise HTTPException(status_code=500, detail=f"Azure login init failed: {str(e)}")


@router.get("/auth/callback")
async def azure_auth_callback(request: Request):
    """
    Handles redirect from Azure after login.
    Exchanges authorization code for access token, then redirects to frontend.
    Uses FRONTEND_URL from settings to support both localhost and production.
    """
    if not cca:
        logger.error("Azure callback called but cca is not initialized")
        return RedirectResponse(f"{FRONTEND_URL}/login?error=not_configured")

    try:
        # Check for error from Azure
        error = request.query_params.get("error")
        error_description = request.query_params.get("error_description")

        if error:
            logger.error("Azure returned error: %s", error)
            logger.error("Error description: %s", error_description)
            return RedirectResponse(f"{FRONTEND_URL}/login?error={error}")

        code = request.query_params.get("code")
        if not code:
            logger.error("Missing authorization code in callback")
            raise HTTPException(status_code=400, detail="Missing authorization code")

        logger.debug("Exchanging authorization code for token...")
        logger.debug("Using redirect URI: %s", REDIRECT_URI)

        result = cca.acquire_token_by_authorization_code(
            code,
            scopes=SCOPES,
            redirect_uri=REDIRECT_URI,
        )

        if "error" in result:
            error_msg = result.get("error", "unknown")
            error_desc = result.get("error_description", "No description")
            logger.error("Azure token exchange error: %s", error_msg)
            logger.error("Error description: %s", error_desc)
            return RedirectResponse(f"{FRONTEND_URL}/login?error=azure_token_failed&msg={error_msg}")

        # Extract user info from Azure ID token claims
        account = result.get("id_token_claims", {})
        username = account.get("preferred_username", "unknown")
        user_id = account.get("oid", username)  # Azure Object ID (stable unique identifier)

        logger.info("Azure login success: %s (oid: %s)", username, user_id)

        # Create JWT token for API authentication
        from app.core.auth import create_access_token
        access_token = create_access_token(user_id=user_id, email=username)

        # Create redirect response and set httpOnly cookie
        response = RedirectResponse(
            url=f"{FRONTEND_URL}/portfolio?user={username}",
            status_code=302
        )

        # Set httpOnly cookie for secure token storage (immune to XSS)
        response.set_cookie(
            key=settings.COOKIE_NAME,
            value=access_token,
            max_age=settings.COOKIE_MAX_AGE,
            httponly=settings.COOKIE_HTTPONLY,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path=settings.COOKIE_PATH,
        )

        return response

    except Exception as e:
        logger.error("Azure login callback exception: %s: %s", type(e).__name__, e, exc_info=True)
        return RedirectResponse(f"{FRONTEND_URL}/login?error=azure_failed")


@router.post("/auth/logout")
async def logout(response: Response):
    """
    Clear authentication cookie to log out the user.
    Frontend should call this endpoint and then redirect to login.
    """
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        path=settings.COOKIE_PATH,
    )
    # Also clear CSRF token cookie
    response.delete_cookie(key="csrf_token", path="/")
    return {"message": "Logged out successfully"}


@router.get("/auth/csrf-token")
async def get_csrf_token(response: Response):
    """
    Generate a CSRF token for state-changing requests.
    Frontend must include this token in X-CSRF-Token header for POST/PUT/DELETE.
    The token is also set as a readable cookie for the frontend to access.
    """
    token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=token,
        httponly=False,  # Must be readable by JavaScript
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        path="/",
    )
    return {"csrf_token": token}


@router.get("/auth/me")
async def get_current_user_info(
    user_id: str = Depends(get_current_user)
):
    """
    Verify authentication status and return current user info.
    Used by frontend to check if user is authenticated after page load.
    """
    return {"user_id": user_id, "authenticated": True}


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

        # Helper function to fetch all data for a single symbol in parallel
        async def fetch_holding_data(symbol: str, total_qty: float, avg_cost: float):
            """Fetch market price, news, and sector data in parallel for a symbol."""
            logger.debug(f"[PORTFOLIO-HOLDINGS-FETCH] Starting parallel fetch for {symbol}")
            try:
                # Create parallel tasks for this symbol
                market_price_task = stock_data_service.get_current_market_price(symbol)
                news_task = get_news_data(symbol, timeframe="1W")
                # Note: get_ticker_sector_info is synchronous, but it's cached so it's fast
                # We'll call it separately after the parallel tasks

                # Execute market price and news fetching in parallel
                market_data, news_data = await asyncio.gather(
                    market_price_task,
                    news_task,
                    return_exceptions=True
                )

                # Process market data
                if isinstance(market_data, Exception) or market_data is None:
                    logger.warning(f"[PORTFOLIO-HOLDINGS-FETCH] Market data failed for {symbol}: {market_data if isinstance(market_data, Exception) else 'No data'}")
                    market_price = None
                    day_change_value = None
                    day_change_percent = None
                    previous_close = None
                    fifty_two_week_high = None
                    fifty_two_week_low = None
                else:
                    market_price = round(market_data.get("market_price", 0), 2)
                    day_change_value = round(market_data.get("day_change_value", 0), 2) if market_data.get("day_change_value") is not None else None
                    day_change_percent = round(market_data.get("day_change_percent", 0), 2) if market_data.get("day_change_percent") is not None else None
                    previous_close = market_data.get("previous_close")
                    fifty_two_week_high = market_data.get("fifty_two_week_high")
                    fifty_two_week_low = market_data.get("fifty_two_week_low")
                    logger.debug(f"[PORTFOLIO-HOLDINGS-FETCH] Market data OK for {symbol}: ${market_price:.2f}")

                # Calculate profit/loss
                if market_price:
                    pl_absolute = round((market_price - avg_cost) * total_qty, 2)
                    pl_percent = round(((market_price - avg_cost) / avg_cost) * 100, 2) if avg_cost > 0 else 0
                    is_positive = pl_absolute >= 0
                else:
                    pl_absolute, pl_percent, is_positive = None, None, None

                # Process news data
                if isinstance(news_data, Exception) or news_data is None:
                    logger.warning(f"[PORTFOLIO-HOLDINGS-FETCH] News fetch failed for {symbol}: {news_data if isinstance(news_data, Exception) else 'No data'}")
                    avg_score = 0
                    sentiment_label = "N/A"
                    news_volume = 0
                    sentiment_momentum = None
                else:
                    avg_score = news_data.get("avg_score", 0)
                    articles = news_data.get("news", [])
                    sentiment_momentum = news_data.get("sentiment_momentum")

                    # Derive qualitative sentiment label
                    if avg_score > 0.2:
                        sentiment_label = "Positive"
                    elif avg_score < -0.2:
                        sentiment_label = "Negative"
                    else:
                        sentiment_label = "Neutral"

                    news_volume = len(articles)
                    logger.debug(f"[PORTFOLIO-HOLDINGS-FETCH] News fetched for {symbol}: {news_volume} articles, sentiment={avg_score:.2f}")

                # Fetch sector info (cached, so fast)
                try:
                    sector_info = stock_data_service.get_ticker_sector_info(symbol)
                    sector = sector_info.get("sector", "N/A")
                    industry = sector_info.get("industry", "N/A")
                except Exception as e:
                    logger.warning("Sector fetch failed for %s: %s", symbol, e)
                    sector, industry = "N/A", "N/A"

                # Create range52week object if both values exist
                range52week = None
                if fifty_two_week_high is not None and fifty_two_week_low is not None:
                    range52week = {
                        "low": float(fifty_two_week_low),
                        "high": float(fifty_two_week_high)
                    }

                # Return formatted holding data
                return {
                    "symbol": symbol,
                    "quantity": round(total_qty, 2),
                    "averageCostPrice": f"{avg_cost:,.1f}",
                    "marketPrice": f"{market_price:,.1f}" if market_price else None,
                    "profitLoss": f"{pl_absolute:,.1f}" if pl_absolute is not None else None,
                    "gainLossPercent": float(pl_percent) if pl_percent is not None else None,
                    "isPositive": bool(is_positive) if is_positive is not None else None,
                    "newsVolume": news_volume,
                    "sentiment": f"{float(avg_score):,.2f}" if avg_score is not None else "0.00",
                    "sentimentMomentum": float(sentiment_momentum) if sentiment_momentum is not None else None,
                    "range52week": range52week,
                    "position": f"{market_price * total_qty:,.1f}" if market_price else f"{avg_cost * total_qty:,.1f}",
                    "day_change_percent": float(day_change_percent) if day_change_percent is not None else None,
                    "day_change_value": float(day_change_value) if day_change_value is not None else None,
                    "previous_close": float(previous_close) if previous_close is not None else None,
                    "sector": sector,
                    "industry": industry
                }

            except Exception as e:
                logger.error(f"[PORTFOLIO-HOLDINGS-ERROR] Processing failed for {symbol}: {e}", exc_info=True)
                # Return minimal data on error
                return {
                    "symbol": symbol,
                    "quantity": round(total_qty, 2),
                    "averageCostPrice": f"{avg_cost:,.1f}",
                    "marketPrice": None,
                    "profitLoss": None,
                    "gainLossPercent": None,
                    "isPositive": None,
                    "newsVolume": 0,
                    "sentiment": "0.00",
                    "position": f"{avg_cost * total_qty:,.1f}",
                    "day_change_percent": None,
                    "day_change_value": None,
                    "previous_close": None,
                    "sector": "N/A",
                    "industry": "N/A"
                }

        # Create tasks for all symbols and execute in parallel
        logger.info(f"[PORTFOLIO-HOLDINGS] Starting parallel data fetch for {len(aggregated)} unique symbols")
        fetch_start = time.time()
        tasks = [
            fetch_holding_data(
                symbol,
                data["total_qty"],
                round(data["total_cost"] / data["total_qty"], 2) if data["total_qty"] > 0 else 0.0
            )
            for symbol, data in aggregated.items()
        ]

        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

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

    For each holding, determine start price:
    - IF purchase_date >= period_start → Use YOUR purchase_price (cost basis)
    - IF purchase_date < period_start → Use market_price on period_start

    Then calculate:
    Portfolio Return = (Current Value - Start Value) / Start Value × 100
    Where:
    - Current Value = Σ(current_price × quantity)
    - Start Value = Σ(start_price × quantity)

    Example (MTD = Dec 1, 2024 → Today):

    Holding 1: AAPL bought Feb 1, 2024 @ $150
    - Purchase date (Feb 1) < MTD start (Dec 1)
    - Use market price on Dec 1: $180
    - Return: (current $195 - start $180) / $180 = +8.3%

    Holding 2: MSFT bought Dec 15, 2024 @ $370
    - Purchase date (Dec 15) >= MTD start (Dec 1)
    - Use YOUR cost basis: $370
    - Return: (current $385 - cost $370) / $370 = +4.05%

    This shows:
    - Real gains for recent purchases (YOUR money at risk)
    - Fair performance for older holdings (comparable to benchmarks)

    S&P 500 uses the same period start dates for fair comparison.

    Returns MTD, QTD, YTD, and ITD (Inception-to-Date) performance metrics.
    """
    import time
    import logging
    logger = logging.getLogger(__name__)

    start_time = time.time()
    logger.info(f"[PORTFOLIO-PERF] Request started - username={username}, account={account_name}, timeframe={timeframe}")

    try:
        from datetime import datetime, timedelta
        import pandas as pd

        # Fetch ALL current holdings using repository
        logger.debug(f"[PORTFOLIO-PERF-DB] Querying holdings: username={username}, account={account_name}")
        holdings_list = await holding_repo.get_holdings_by_account(
            username, account_name, include_closed=True
        )

        db_elapsed_ms = (time.time() - start_time) * 1000
        logger.info(f"[PORTFOLIO-PERF-DB] Found {len(holdings_list)} holdings in {db_elapsed_ms:.0f}ms")

        if not holdings_list:
            logger.info(f"[PORTFOLIO-PERF] No holdings found, returning error")
            return {"error": "No holdings found"}

        logger.debug(f"[PORTFOLIO-PERF] Processing {len(holdings_list)} holdings for performance calculation")

        # Get current date
        today = datetime.now()

        # Define time periods - START dates for each period
        first_day_of_month = today.replace(day=1)
        first_day_of_year = today.replace(month=1, day=1)

        # Calculate quarter start (approximate - use 3 months back)
        quarter_start = today - timedelta(days=90)

        periods = {
            "MTD": first_day_of_month,      # Month-to-Date
            "QTD": quarter_start,            # Quarter-to-Date (approx 3 months)
            "YTD": first_day_of_year,       # Year-to-Date
            "ITD": None,                     # Will calculate based on holdings
        }

        logger.debug("Time Periods:")
        for period_name, start_date in periods.items():
            if start_date:
                logger.debug("  %s: %s to %s", period_name, start_date.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d'))
            else:
                logger.debug("  %s: From purchase dates to %s", period_name, today.strftime('%Y-%m-%d'))

        # OPTIMIZATION: Fetch current prices ONCE for all holdings (not per period)
        logger.info("Fetching current prices for %d holdings in parallel...", len(holdings_list))
        current_prices = {}

        async def fetch_current_price(symbol: str):
            """Fetch current price using cached async function."""
            try:
                price_data = await stock_data_service.get_current_market_price(symbol)
                if price_data and price_data.get("market_price"):
                    return symbol, float(price_data["market_price"])
            except Exception as e:
                logger.warning("Error fetching current price for %s: %s", symbol, e)
            return symbol, None

        # Fetch all current prices in parallel
        unique_symbols = list(set(h.get("symbol", "").upper() for h in holdings_list if h.get("symbol")))
        current_price_tasks = [fetch_current_price(symbol) for symbol in unique_symbols]
        current_price_results = await asyncio.gather(*current_price_tasks, return_exceptions=True)

        for result in current_price_results:
            if not isinstance(result, Exception) and result:
                symbol, price = result
                if price is not None:
                    current_prices[symbol] = price

        logger.info("Fetched current prices for %d holdings", len(current_prices))

        # Calculate portfolio value at each period
        results = []

        for period_name, start_date in periods.items():
            logger.debug("Calculating %s Performance", period_name)

            # For ITD, calculate earliest purchase date
            if period_name == "ITD":
                earliest_purchase = min(
                    datetime.strptime(h.get("purchase_date", today.strftime("%Y-%m-%d")), "%Y-%m-%d")
                    for h in holdings_list
                )
                start_date = earliest_purchase
                logger.debug("ITD Start Date (earliest purchase): %s", start_date.strftime('%Y-%m-%d'))

            # Helper function to fetch start price for a holding in this period
            async def fetch_holding_period_data(holding: dict):
                """Fetch period start price for a holding using hybrid logic."""
                symbol = holding.get("symbol", "").upper()
                quantity = float(holding.get("quantity", 0))
                purchase_price = float(holding.get("purchase_price", 0))
                purchase_date_str = holding.get("purchase_date", today.strftime("%Y-%m-%d"))
                purchase_date = datetime.strptime(purchase_date_str, "%Y-%m-%d")

                try:
                    # HYBRID LOGIC: Determine which price to use for period start
                    if purchase_date >= start_date:
                        # Stock was bought WITHIN this period - use YOUR cost basis
                        period_start_price = purchase_price
                        price_source = "Purchase Price (bought in period)"
                    else:
                        # Stock was bought BEFORE this period - use market price at period start
                        # Use cached async function
                        start_str = (start_date - timedelta(days=5)).strftime("%Y-%m-%d")
                        end_str = (start_date + timedelta(days=5)).strftime("%Y-%m-%d")

                        hist_data = await stock_data_service.get_historical_price(symbol, start_str, end_str)

                        if hist_data and hist_data.get("start_price"):
                            period_start_price = float(hist_data["start_price"])
                            price_source = f"Market Price on {start_date.strftime('%Y-%m-%d')}"
                        else:
                            logger.warning("No market data for %s at period start, using purchase price", symbol)
                            period_start_price = purchase_price
                            price_source = "Purchase Price (fallback)"

                    # Get current price from pre-fetched cache
                    current_price = current_prices.get(symbol)

                    if not current_price:
                        logger.warning("No current price for %s", symbol)
                        return None

                    # Calculate position values
                    value_at_start = quantity * period_start_price
                    value_now = quantity * current_price
                    holding_return = ((current_price - period_start_price) / period_start_price) * 100

                    return {
                        "symbol": symbol,
                        "quantity": quantity,
                        "start_price": period_start_price,
                        "current_price": current_price,
                        "return": holding_return,
                        "price_source": price_source,
                        "value_at_start": value_at_start,
                        "value_now": value_now
                    }

                except Exception as e:
                    logger.error("Error fetching data for %s: %s", symbol, e)
                    return None

            # Fetch period data for all holdings in parallel
            logger.debug("Fetching period data for %d holdings in parallel...", len(holdings_list))
            period_tasks = [fetch_holding_period_data(holding) for holding in holdings_list]
            holdings_details = await asyncio.gather(*period_tasks, return_exceptions=True)

            # Filter out None/exceptions and calculate totals
            holdings_details = [h for h in holdings_details if h is not None and not isinstance(h, Exception)]

            total_value_at_period_start = sum(h["value_at_start"] for h in holdings_details)
            total_value_now = sum(h["value_now"] for h in holdings_details)

            logger.debug("Processed %d holdings successfully", len(holdings_details))

            # Step 4: Calculate TOTAL portfolio return for this period
            if total_value_at_period_start > 0:
                portfolio_return = ((total_value_now - total_value_at_period_start) / total_value_at_period_start) * 100
            else:
                portfolio_return = 0

            logger.debug("Portfolio summary - %s: Start=$%.2f, Now=$%.2f, Return=%.2f%%",
                        period_name, total_value_at_period_start, total_value_now, portfolio_return)

            # Step 5: Fetch S&P 500 performance for the SAME period
            try:
                sp500 = yf.Ticker("^GSPC")
                # Run blocking yfinance call in thread pool to prevent event loop blocking
                sp500_hist = await asyncio.wait_for(
                    asyncio.to_thread(
                        sp500.history,
                        start=(start_date - timedelta(days=5)).strftime("%Y-%m-%d"),
                        end=today.strftime("%Y-%m-%d")
                    ),
                    timeout=20.0  # 20 second timeout for S&P 500 data
                )

                if len(sp500_hist) >= 2:
                    sp500_start = float(sp500_hist['Close'].iloc[0])
                    sp500_end = float(sp500_hist['Close'].iloc[-1])
                    sp500_return = ((sp500_end - sp500_start) / sp500_start) * 100

                    logger.debug("S&P 500 %s: Start=$%.2f, Now=$%.2f, Return=%.2f%%",
                                period_name, sp500_start, sp500_end, sp500_return)
                else:
                    sp500_return = 0
                    logger.warning("Insufficient S&P 500 data for %s", period_name)

            except Exception as e:
                logger.error("Error fetching S&P 500 data: %s", e)
                sp500_return = 0

            # Step 6: Calculate outperformance
            outperformance = portfolio_return - sp500_return
            logger.debug("Outperformance vs S&P 500 for %s: %.2f%%", period_name, outperformance)

            # Step 7: Calculate top gainers and losers for attribution
            sorted_holdings = sorted(holdings_details, key=lambda x: x["return"], reverse=True)

            # Top gainers: highest positive returns (up to 5)
            top_gainers = [h for h in sorted_holdings if h["return"] > 0][:5]

            # Top losers: worst negative returns (up to 5)
            all_losers = [h for h in sorted_holdings if h["return"] < 0]
            top_losers = sorted(all_losers, key=lambda x: x["return"])[:5]  # Sort ascending, take worst 5

            # Calculate gain/loss amounts for attribution
            for holding in top_gainers + top_losers:
                value_at_start = holding["quantity"] * holding["start_price"]
                value_now = holding["quantity"] * holding["current_price"]
                holding["gain_loss"] = round(value_now - value_at_start, 2)
                holding["return_percent"] = round(holding["return"], 2)

            logger.debug("Top %d Gainers: %s", len(top_gainers), [h['symbol'] for h in top_gainers])
            logger.debug("Top %d Losers: %s", len(top_losers), [h['symbol'] for h in top_losers])

            results.append({
                "period": period_name,
                "return": round(portfolio_return, 2),
                "sp500": round(sp500_return, 2),
                "isPositive": portfolio_return >= 0,
                "outperformance": round(outperformance, 2),
                "portfolio_value_start": round(total_value_at_period_start, 2),
                "portfolio_value_current": round(total_value_now, 2),
                "holdings_count": len(holdings_details),
                "top_gainers": top_gainers,
                "top_losers": top_losers
            })

        logger.info("Portfolio performance calculation complete")

        # Feature 1: Generate historical time-series data for chart
        # Timeframe is configurable via query parameter (1D, 1W, 1M, 6M, YTD, 1Y, 3Y, 5Y)
        try:
            # Fetch account info to get open_date
            account_info = await account_repo.get_by_account_name(username, account_name)
            open_date = account_info.get("open_date") if account_info else None

            # Generate time-series data with requested timeframe
            # Fetch portfolio and benchmark data in parallel
            portfolio_task = portfolio_timeseries_service.generate_portfolio_timeseries(
                holdings_list=holdings_list,
                timeframe=timeframe,
                open_date=open_date,
                db=get_motor_database(),  # Pass db for capital flow tracking
                username=username,
                account_name=account_name
            )
            benchmark_task = portfolio_timeseries_service.fetch_benchmark_timeseries(
                timeframe=timeframe,
                benchmark_ticker="^GSPC"  # S&P 500
            )

            historical_data, benchmark_data = await asyncio.gather(
                portfolio_task,
                benchmark_task,
                return_exceptions=True
            )

            # Handle errors from parallel fetching
            if isinstance(historical_data, Exception):
                logger.warning("Error generating portfolio time-series: %s", historical_data)
                historical_data = {"timeframe": timeframe, "data_points": [], "error": str(historical_data)}
            else:
                logger.debug("Generated %d time-series data points for %s", len(historical_data.get('data_points', [])), timeframe)

            if isinstance(benchmark_data, Exception):
                logger.warning("Error fetching benchmark time-series: %s", benchmark_data)
                benchmark_data = {"timeframe": timeframe, "data_points": [], "error": str(benchmark_data)}
            else:
                logger.debug("Generated %d benchmark data points", len(benchmark_data.get('data_points', [])))

        except Exception as e:
            logger.warning("Error generating time-series data: %s", e)
            historical_data = {"timeframe": timeframe, "data_points": [], "error": str(e)}
            benchmark_data = {"timeframe": timeframe, "data_points": [], "error": str(e)}

        # Feature 7: Generate portfolio events timeline
        events = []
        try:
            # Aggregate holdings by symbol to fetch corporate actions
            unique_symbols = list(set(h.get("symbol", "").upper() for h in holdings_list if h.get("symbol")))

            # Fetch dividends for each holding (last 1 year)
            one_year_ago = today - timedelta(days=365)

            for symbol in unique_symbols:
                try:
                    ticker = yf.Ticker(symbol)
                    # Get dividend and split history with timeout protection

                    # Fetch dividends in thread pool
                    dividends = await asyncio.wait_for(
                        asyncio.to_thread(lambda: ticker.dividends),
                        timeout=10.0  # 10 second timeout
                    )
                    if not dividends.empty:
                        # Filter to last year and convert to events
                        recent_divs = dividends[dividends.index >= pd.Timestamp(one_year_ago)]
                        for div_date, div_amount in recent_divs.items():
                            # Calculate total dividend received (quantity * div_amount)
                            holding_qty = sum(float(h.get("quantity", 0)) for h in holdings_list if h.get("symbol", "").upper() == symbol)
                            total_dividend = holding_qty * float(div_amount)

                            events.append({
                                "date": div_date.strftime("%Y-%m-%d"),
                                "type": "dividend",
                                "description": f"Received dividend from {symbol}",
                                "ticker": symbol,
                                "impact_value": round(total_dividend, 2)
                            })

                    # Get stock splits in thread pool
                    splits = await asyncio.wait_for(
                        asyncio.to_thread(lambda: ticker.splits),
                        timeout=10.0  # 10 second timeout
                    )
                    if not splits.empty:
                        recent_splits = splits[splits.index >= pd.Timestamp(one_year_ago)]
                        for split_date, split_ratio in recent_splits.items():
                            events.append({
                                "date": split_date.strftime("%Y-%m-%d"),
                                "type": "split",
                                "description": f"{symbol} stock split {split_ratio}:1",
                                "ticker": symbol,
                                "impact_value": None
                            })
                except Exception as e:
                    logger.warning("Error fetching events for %s: %s", symbol, e)
                    continue

            # Add purchase events from holdings (if purchase_date is available)
            for holding in holdings_list:
                purchase_date = holding.get("purchase_date")
                if purchase_date:
                    try:
                        symbol = holding.get("symbol", "").upper()
                        quantity = float(holding.get("quantity", 0))
                        purchase_price = float(holding.get("purchase_price", 0))
                        total_cost = quantity * purchase_price

                        # Only include purchases from last year
                        purchase_dt = pd.to_datetime(purchase_date).date()
                        if purchase_dt >= one_year_ago.date():
                            events.append({
                                "date": purchase_date,
                                "type": "purchase",
                                "description": f"Purchased {quantity:.2f} shares of {symbol}",
                                "ticker": symbol,
                                "impact_value": round(total_cost, 2)
                            })
                    except Exception as e:
                        logger.warning("Error processing purchase event: %s", e)
                        continue

            # Sort events by date (most recent first)
            events.sort(key=lambda x: x["date"], reverse=True)

            logger.debug("Generated %d portfolio events", len(events))

        except Exception as e:
            logger.warning("Error generating events timeline: %s", e)
            events = []

        return {
            "username": username,
            "account_name": account_name,
            "performance": results,
            "calculation_date": today.strftime("%Y-%m-%d %H:%M:%S"),
            "historical_data": historical_data,  # Feature 1: Historical time-series
            "benchmark_data": benchmark_data,  # Benchmark comparison data (S&P 500)
            "events": events  # Feature 7: Portfolio events timeline
        }

    except Exception as e:
        logger.error("Error calculating portfolio performance: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to calculate performance: {str(e)}")


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
        import asyncio

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


# @router.get("/portfolio/holdings/{username}/{account_name}")
# async def get_portfolio_holdings(username: str, account_name: str):
#     """
#     Retrieve holdings for a user and account, aggregate duplicates,
#     calculate avg cost, market price, and P/L.
#     """
#     try:
#         holdings_cursor = holdings_col.find({
#             "username": username,
#             "client_account_name": account_name
#         })

#         holdings_list = list(holdings_cursor)
#         if not holdings_list:
#             return {"holdings": []}

#         aggregated = {}
#         for h in holdings_list:
#             symbol = h.get("symbol", "").upper()
#             qty = float(h.get("quantity", 0))
#             price = float(h.get("purchase_price", 0))
#             if symbol not in aggregated:
#                 aggregated[symbol] = {"total_qty": 0, "total_cost": 0}
#             aggregated[symbol]["total_qty"] += qty
#             aggregated[symbol]["total_cost"] += qty * price

#         results = []
#         for symbol, data in aggregated.items():
#             total_qty = data["total_qty"]
#             avg_cost = round(data["total_cost"] / total_qty, 2) if total_qty > 0 else 0.0

#             try:
#                 ticker = yf.Ticker(symbol)
#                 hist = ticker.history(period="1d")
#                 market_price = round(float(hist["Close"].iloc[-1]), 2) if not hist.empty else None
#             except Exception:
#                 market_price = None

#             if market_price:
#                 pl_absolute = round(float((market_price - avg_cost) * total_qty), 2)
#                 pl_percent = round(float(((market_price - avg_cost) / avg_cost) * 100), 2)
#                 is_positive = bool(pl_absolute >= 0)
#             else:
#                 pl_absolute, pl_percent, is_positive = None, None, None

#             results.append({
#                 "symbol": symbol,
#                 "quantity": round(float(total_qty), 2),
#                 "averageCostPrice": f"{float(avg_cost):,.1f}",
#                 "marketPrice": f"{float(market_price):,.1f}" if market_price else None,
#                 "profitLoss": f"{float(pl_absolute):,.1f}" if pl_absolute is not None else None,
#                 "gainLossPercent": float(pl_percent) if pl_percent is not None else None,
#                 "isPositive": bool(is_positive) if is_positive is not None else None,
#                 "newsVolume": "N/A",
#                 "sentiment": "N/A",
#                 "position": f"{float(market_price) * round(float(total_qty), 2):,.1f}"
#             })

#         return {"holdings": results}

#     except Exception as e:
#         print("Error fetching holdings:", e)
#         raise HTTPException(status_code=500, detail=f"Failed to fetch holdings: {str(e)}")
    








# ============================================================================
# TRANSACTION TRACKING ENDPOINTS (for Time-Weighted Returns)
# ============================================================================

@router.post("/transactions/{username}")
async def create_transaction_endpoint(username: str, transaction_data: dict):
    """
    Create a new portfolio transaction.

    Tracks buys, sells, deposits, withdrawals, dividends for accurate TWR calculation.

    Request body:
    {
        "account_name": "Main Account",
        "account_no": "ACC123",  // optional
        "transaction_date": "2024-01-15",  // YYYY-MM-DD format
        "transaction_type": "BUY",  // BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND
        "symbol": "AAPL",  // required for BUY/SELL/DIVIDEND
        "quantity": 10,  // required for BUY/SELL
        "price": 150.00,  // optional
        "cash_flow": -1500.00,  // negative = outflow (BUY/WITHDRAWAL), positive = inflow (SELL/DEPOSIT)
        "fees": 10.00,  // optional, default 0
        "notes": "Initial purchase"  // optional
    }
    """
    try:
        from app.models.transaction import CreateTransactionRequest, create_transaction
        from datetime import date

        # Parse and validate request
        transaction_request = CreateTransactionRequest(
            account_name=transaction_data.get("account_name"),
            account_no=transaction_data.get("account_no"),
            transaction_date=date.fromisoformat(transaction_data.get("transaction_date")),
            transaction_type=transaction_data.get("transaction_type"),
            symbol=transaction_data.get("symbol"),
            quantity=transaction_data.get("quantity"),
            price=transaction_data.get("price"),
            cash_flow=float(transaction_data.get("cash_flow")),
            fees=float(transaction_data.get("fees", 0.0)),
            notes=transaction_data.get("notes")
        )

        # Create transaction
        transaction_id = await create_transaction(get_motor_database(), username, transaction_request)

        return {
            "message": "Transaction created successfully",
            "transaction_id": transaction_id
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error("Error creating transaction: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create transaction: {str(e)}")


@router.get("/transactions/{username}/{account_name}")
async def get_transactions_endpoint(
    username: str,
    account_name: str,
    start_date: str = None,  # YYYY-MM-DD
    end_date: str = None,    # YYYY-MM-DD
    transaction_type: str = None,  # BUY, SELL, DEPOSIT, etc.
    symbol: str = None,
    limit: int = 100,
    skip: int = 0
):
    """
    Get transaction history for a portfolio.

    Query parameters:
    - start_date: Filter transactions on or after this date (YYYY-MM-DD)
    - end_date: Filter transactions on or before this date (YYYY-MM-DD)
    - transaction_type: Filter by type (BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND)
    - symbol: Filter by stock symbol
    - limit: Maximum number of results (default 100)
    - skip: Number of results to skip for pagination (default 0)

    Returns transactions sorted by date (most recent first)
    """
    try:
        from app.models.transaction import get_transactions, TransactionType, TransactionSummary
        from datetime import date

        # Parse optional date filters
        start_date_obj = date.fromisoformat(start_date) if start_date else None
        end_date_obj = date.fromisoformat(end_date) if end_date else None

        # Parse optional type filter
        type_filter = None
        if transaction_type:
            try:
                type_filter = TransactionType(transaction_type.upper())
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid transaction_type. Must be one of: {', '.join([t.value for t in TransactionType])}"
                )

        # Fetch transactions
        transactions = await get_transactions(
            get_motor_database(),
            username,
            account_name,
            start_date=start_date_obj,
            end_date=end_date_obj,
            transaction_type=type_filter,
            symbol=symbol.upper() if symbol else None,
            limit=limit,
            skip=skip
        )

        # Convert to summaries for response
        transaction_summaries = [
            TransactionSummary.from_transaction_model(t).model_dump()
            for t in transactions
        ]

        return {
            "transactions": transaction_summaries,
            "count": len(transaction_summaries),
            "has_more": len(transaction_summaries) == limit
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error fetching transactions: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch transactions: {str(e)}")


@router.get("/transactions/{username}/{account_name}/stats")
async def get_transaction_stats_endpoint(
    username: str,
    account_name: str,
    start_date: str = None,  # YYYY-MM-DD
    end_date: str = None     # YYYY-MM-DD
):
    """
    Get transaction statistics for a portfolio.

    Returns:
    - total_transactions: Total count
    - by_type: Breakdown by transaction type with counts and total cash flows
    """
    try:
        from app.models.transaction import get_transaction_stats
        from datetime import date

        start_date_obj = date.fromisoformat(start_date) if start_date else None
        end_date_obj = date.fromisoformat(end_date) if end_date else None

        stats = await get_transaction_stats(
            get_motor_database(),
            username,
            account_name,
            start_date=start_date_obj,
            end_date=end_date_obj
        )

        return stats

    except Exception as e:
        logger.error("Error fetching transaction stats: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


@router.delete("/transactions/{username}/{transaction_id}")
async def delete_transaction_endpoint(username: str, transaction_id: str):
    """
    Delete a transaction.

    Only the transaction owner can delete it.
    """
    try:
        from app.models.transaction import delete_transaction

        success = await delete_transaction(get_motor_database(), transaction_id, username)

        if not success:
            raise HTTPException(status_code=404, detail="Transaction not found or you don't have permission")

        return {"message": "Transaction deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting transaction: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete transaction: {str(e)}")


# ============================================================================
# TIME-WEIGHTED RETURNS (TWR) PERFORMANCE ENDPOINT
# ============================================================================

@router.get("/accounts/{username}/{account_name}/performance-twr")
async def get_portfolio_performance_twr(
    username: str,
    account_name: str,
    timeframe: str = "1Y",  # MTD, QTD, YTD, 1Y, 5Y, ITD
    account_repo: AccountRepository = Depends(get_account_repository),
):
    """
    Calculate portfolio performance using Time-Weighted Returns (TWR).

    TWR isolates investment performance from cash flow effects, providing
    accurate returns that reflect manager skill rather than deposit/withdrawal timing.

    **Key Differences from Standard Performance:**
    - Standard: Simple (End - Start) / Start ignoring cash flows ❌
    - TWR: Breaks period into sub-periods at each cash flow ✅
    - TWR: Chains sub-period returns for accurate total return ✅

    **Example:**
    - Portfolio: $100k → Deposit $50k → End $155k
    - Standard return: 55% (WRONG - includes deposit)
    - TWR: ~5% (CORRECT - isolated performance)

    **Timeframes:**
    - MTD: Month-to-Date
    - QTD: Quarter-to-Date
    - YTD: Year-to-Date
    - 1Y: Last 12 months
    - 5Y: Last 5 years
    - ITD: Inception-to-Date (portfolio creation)

    Returns:
    - twr_return: Accurate time-weighted return percentage
    - standard_return: Simple return for comparison
    - difference: Shows impact of cash flows
    - sub_periods: Detailed breakdown of calculation
    - data_quality: Confidence indicators
    """
    try:
        from app.services.twr_calculator_service import twr_calculator_service
        from datetime import datetime, date, timedelta

        # Parse timeframe to date range
        end_date = date.today()

        if timeframe == "MTD":
            start_date = date(end_date.year, end_date.month, 1)
        elif timeframe == "QTD":
            quarter_month = ((end_date.month - 1) // 3) * 3 + 1
            start_date = date(end_date.year, quarter_month, 1)
        elif timeframe == "YTD":
            start_date = date(end_date.year, 1, 1)
        elif timeframe == "1Y":
            start_date = end_date - timedelta(days=365)
        elif timeframe == "5Y":
            start_date = end_date - timedelta(days=365 * 5)
        elif timeframe == "ITD":
            # Get portfolio inception date using repository
            account = await account_repo.get_by_account_name(username, account_name)
            if account and "open_date" in account:
                start_date = datetime.strptime(account["open_date"], "%Y-%m-%d").date()
            else:
                start_date = date(2020, 1, 1)  # Fallback
        else:
            raise HTTPException(status_code=400, detail=f"Invalid timeframe: {timeframe}")

        # Calculate TWR
        db = get_motor_database()
        twr_result = await twr_calculator_service.calculate_twr(
            username, account_name, start_date, end_date, db
        )

        # Calculate standard return for comparison
        if twr_result.get("has_data") is False:
            return {
                "timeframe": timeframe,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "twr": twr_result,
                "error": twr_result.get("error"),
                "message": twr_result.get("message")
            }

        start_value = twr_result.get("start_value", 0)
        end_value = twr_result.get("end_value", 0)
        total_cash_flow = twr_result.get("total_cash_flow", 0)

        # Standard (naive) return calculation
        if start_value > 0:
            standard_return = ((end_value - start_value) / start_value) * 100
        else:
            standard_return = None

        # Calculate difference
        twr_return = twr_result.get("twr_return")
        if twr_return is not None and standard_return is not None:
            difference = standard_return - twr_return
        else:
            difference = None

        return {
            "timeframe": timeframe,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "twr": {
                "return": twr_return,
                "method": "Time-Weighted Return (Modified Dietz)",
                "description": "Isolates investment performance from cash flow timing"
            },
            "standard": {
                "return": round(standard_return, 2) if standard_return is not None else None,
                "method": "Simple Return",
                "description": "Does not account for cash flows (misleading if deposits/withdrawals occurred)"
            },
            "comparison": {
                "difference": round(difference, 2) if difference is not None else None,
                "impact": "High" if difference and abs(difference) > 5 else "Low",
                "explanation": (
                    f"Cash flows caused a {abs(difference):.1f}% distortion in standard return calculation"
                    if difference and abs(difference) > 0.5
                    else "Minimal cash flow impact - both methods agree"
                )
            },
            "portfolio_values": {
                "start": start_value,
                "end": end_value,
                "change": end_value - start_value,
                "cash_flow_impact": total_cash_flow
            },
            "sub_periods": twr_result.get("sub_periods", []),
            "data_quality": twr_result.get("data_quality", {}),
            "has_cash_flows": twr_result.get("has_cash_flows", False),
            "cash_flow_count": twr_result.get("cash_flow_count", 0)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error calculating TWR performance: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to calculate TWR: {str(e)}")


#python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
#source venv/bin/activate
#venv\Scripts\activate

#run this to start docker container (localhost only - for redis)
#docker run -d --name redis-cache -p 6379:6379 redis:latest