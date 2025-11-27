# app/api/stock_routes.py
"""
Stock data and analysis routes.

Endpoints:
- GET /stocks/{ticker}/historical-data - Historical price data
- GET /stocks/{ticker}/sentiment - News sentiment analysis with momentum
- GET /stocks/{ticker}/company-overview - Company fundamentals
- GET /stocks/{ticker}/earnings-transcript - Earnings call transcripts
- GET /stocks/{ticker}/earnings-quarters - Available earnings quarters
- GET /stocks/{ticker}/earnings-calendar - Upcoming earnings dates
- GET /stocks/{ticker}/significant-events - Major price moves with news
- POST /stocks/{ticker}/prefetch-events - Background prefetch for events
"""

import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends

from app.services.stock_data_service import StockDataService
from app.services.news_service import NewsService
from app.services.sentiment_service import SentimentService
from app.services.market_analysis_service import MarketAnalysisService
from app.services.earnings_service import EarningsService
from app.core.dependencies import (
    get_stock_data_service,
    get_news_service,
    get_sentiment_service,
    get_market_analysis_service,
    get_earnings_service,
)
from app.config.scoring import get_score_definitions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stocks", tags=["Stocks"])


@router.get("/{ticker}/historical-data")
def get_historical_stock_data(
    ticker: str,
    timeframe: str = "1M",
    stock_data_service: StockDataService = Depends(get_stock_data_service),
):
    """
    Get historical stock data for a given ticker and timeframe.

    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL', 'MSFT')
        timeframe: Time period - 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 5Y

    Returns:
        JSON with ticker, timeframe, and OHLCV data array

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
        json_data = filtered_data.reset_index().to_dict(orient="records")
        return {"ticker": ticker, "timeframe": timeframe, "data": json_data}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching historical data for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/sentiment")
async def get_stock_news_and_sentiment(
    ticker: str,
    news_service: NewsService = Depends(get_news_service),
    sentiment_service: SentimentService = Depends(get_sentiment_service),
):
    """
    Get recent news and advanced sentiment analysis with momentum.

    Returns:
    - overall_weighted_score: Primary sentiment score (slow/24h trend)
    - fast_score: Current intraday sentiment (7h half-life)
    - slow_score: Daily trend sentiment (24h half-life)
    - sentiment_momentum: fast_score - slow_score
    - momentum_label: "Positive Momentum", "Negative Momentum", etc.
    - momentum_interpretation: Human-readable description

    Example: /stocks/TSLA/sentiment
    """
    try:
        # 1. Fetch recent news using the service
        news_articles = await news_service.get_ticker_news(ticker)
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
        logger.error(f"Error analyzing sentiment for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/earnings-transcript")
async def get_earnings_transcript(
    ticker: str,
    quarter: str,
    earnings_service: EarningsService = Depends(get_earnings_service),
):
    """
    Get earnings call transcript for a given ticker and quarter.

    Args:
        ticker: Stock ticker symbol (e.g., 'IBM', 'AAPL')
        quarter: Fiscal quarter in YYYYQM format (e.g., '2024Q1', '2023Q4')

    Returns:
        Transcript with speaker segments, sentiment scores, and metadata

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
        logger.error(f"Error fetching earnings transcript for {ticker} {quarter}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/earnings-quarters")
async def get_available_earnings_quarters(
    ticker: str,
    years_back: int = 5,
    earnings_service: EarningsService = Depends(get_earnings_service),
):
    """
    Get a list of potential earnings quarters to query.

    Args:
        ticker: Stock ticker symbol
        years_back: Number of years to look back (default: 5, max: 15)

    Returns:
        List of quarter identifiers in YYYYQM format

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
        logger.error(f"Error getting earnings quarters for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/earnings-calendar")
async def get_earnings_calendar(
    ticker: str,
    horizon: str = "12month",
    earnings_service: EarningsService = Depends(get_earnings_service),
):
    """
    Get upcoming earnings calendar events for a given ticker.

    Args:
        ticker: Stock ticker symbol (e.g., 'AAPL', 'IBM')
        horizon: Time horizon - '3month', '6month', '12month'

    Returns:
        List of upcoming earnings events with dates and estimates

    Example: /stocks/AAPL/earnings-calendar?horizon=12month
    """
    try:
        result = await earnings_service.fetch_earnings_calendar(ticker, horizon)

        if "error" in result:
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
        logger.error(f"Error fetching earnings calendar for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/company-overview")
async def get_company_overview(
    ticker: str,
    stock_data_service: StockDataService = Depends(get_stock_data_service),
):
    """
    Get comprehensive company overview data from Alpha Vantage.

    Returns detailed company information including:
    - Basic info (name, description, sector, industry, etc.)
    - Financial ratios (P/E, P/B, EPS, etc.)
    - Analyst ratings and target price
    - Key metrics (market cap, revenue, profit margin, etc.)

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
        logger.error(f"Error fetching company overview for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/significant-events")
async def get_significant_events_for_ticker(
    ticker: str,
    timeframe: str = "1Y",
    news_service: NewsService = Depends(get_news_service),
    market_analysis_service: MarketAnalysisService = Depends(get_market_analysis_service),
):
    """
    Analyze historical data for a stock, identify the top 5 most significant
    price moves, and find correlated news for those events.

    Optimized to reuse cached news data instead of making redundant API calls.

    Args:
        ticker: Stock ticker symbol
        timeframe: Time period - 1D, 1M, 6M, YTD, 1Y

    Example: /stocks/NVDA/significant-events?timeframe=1M
    """
    try:
        # Fetch cached news for the timeframe to reuse in significant events analysis
        try:
            cached_news = await news_service.get_ticker_news_for_timeframe(
                ticker,
                timeframe=timeframe,
                trigger_progressive=False  # Don't trigger progressive fetch
            )
        except Exception as e:
            logger.warning(f"Could not fetch cached news for significant events: {e}")
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
        logger.error(f"Error analyzing significant events for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@router.post("/{ticker}/prefetch-events")
async def prefetch_significant_events(
    ticker: str,
    background_tasks: BackgroundTasks,
    market_analysis_service: MarketAnalysisService = Depends(get_market_analysis_service),
):
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
        logger.error(f"Error initiating prefetch for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate prefetch: {str(e)}")
