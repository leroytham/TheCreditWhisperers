# =============================================================================
# Sentiment & News Service - FastAPI Application
# =============================================================================

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
import logging

from app.core.config import settings
from app.core.http_client import http_client
from app.core.cache import redis_cache
from app.core.circuit_breaker import circuit_breakers
from app.services.news_service import news_service
from app.services.sentiment_service import sentiment_service

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Sentiment & News Service...")

    # Initialize services
    await http_client.get_session()
    logger.info("HTTP client initialized")

    # Connect to Redis
    await redis_cache.connect()
    logger.info("Redis cache connected")

    yield

    # Cleanup
    logger.info("Shutting down Sentiment & News Service...")
    await http_client.close()
    await redis_cache.close()


app = FastAPI(
    title="Sentiment & News Service",
    description="Financial news aggregation and sentiment analysis with momentum",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Health Check Endpoints
# =============================================================================

@app.get("/health")
async def health_check():
    """Basic health check."""
    return {
        "status": "healthy",
        "service": "sentiment-news-service",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/health/live")
async def liveness_probe():
    """Kubernetes liveness probe."""
    return {"status": "alive"}


@app.get("/health/ready")
async def readiness_probe():
    """Kubernetes readiness probe."""
    redis_ok = redis_cache.async_client is not None

    if redis_ok:
        return {"status": "ready", "redis": "connected"}
    else:
        return {"status": "degraded", "redis": "disconnected"}


@app.get("/health/startup")
async def startup_probe():
    """Kubernetes startup probe."""
    return {"status": "started"}


# =============================================================================
# News Endpoints
# =============================================================================

@app.get("/api/sentiment/news/{ticker}")
async def get_ticker_news(
    ticker: str,
    count: int = Query(default=100, ge=1, le=1000),
    timeframe: str = Query(default="1M", regex="^(1D|1W|1M|3M|6M|YTD|1Y)$")
):
    """
    Get news articles for a ticker.

    Args:
        ticker: Stock ticker symbol (e.g., AAPL, MSFT)
        count: Maximum number of articles (1-1000)
        timeframe: Time range filter (1D, 1W, 1M, 3M, 6M, YTD, 1Y)

    Returns:
        List of news articles with sentiment scores
    """
    try:
        ticker = ticker.upper().strip()
        articles = await news_service.get_ticker_news_for_timeframe(ticker, timeframe)

        # Sort by date and limit
        sorted_articles = sorted(
            articles,
            key=lambda x: x.get('publish_date', ''),
            reverse=True
        )[:count]

        return {
            "success": True,
            "ticker": ticker,
            "timeframe": timeframe,
            "count": len(sorted_articles),
            "articles": sorted_articles
        }
    except Exception as e:
        logger.error(f"Error fetching news for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sentiment/news/{ticker}/around-date")
async def get_news_around_date(
    ticker: str,
    target_date: str = Query(..., regex=r"^\d{4}-\d{2}-\d{2}$"),
    window: int = Query(default=2, ge=1, le=7),
    count: int = Query(default=20, ge=1, le=100)
):
    """
    Get news around a specific date.

    Args:
        ticker: Stock ticker symbol
        target_date: Target date (YYYY-MM-DD)
        window: Days before/after to include
        count: Maximum articles to return

    Returns:
        News articles within the date window
    """
    try:
        ticker = ticker.upper().strip()
        articles = await news_service.fetch_news_around_date(
            ticker, target_date, window, count
        )

        return {
            "success": True,
            "ticker": ticker,
            "target_date": target_date,
            "window_days": window,
            "count": len(articles),
            "articles": articles
        }
    except Exception as e:
        logger.error(f"Error fetching news around date for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Sentiment Analysis Endpoints
# =============================================================================

@app.get("/api/sentiment/analyze/{ticker}")
async def analyze_ticker_sentiment(
    ticker: str,
    timeframe: str = Query(default="1M", regex="^(1D|1W|1M|3M|6M|YTD|1Y)$"),
    include_articles: bool = Query(default=False)
):
    """
    Get full sentiment analysis with momentum for a ticker.

    Args:
        ticker: Stock ticker symbol
        timeframe: Time range for analysis
        include_articles: Include individual articles in response

    Returns:
        Comprehensive sentiment analysis including:
        - Fast/Slow scores with exponential decay
        - Momentum (MACD-style)
        - Volatility, Breadth, Z-Score
        - Source concentration analysis
        - Topic breakdown
    """
    try:
        ticker = ticker.upper().strip()

        # Fetch news
        articles = await news_service.get_ticker_news_for_timeframe(ticker, timeframe)

        if not articles:
            return {
                "success": True,
                "ticker": ticker,
                "timeframe": timeframe,
                "data_quality": "no_data",
                "message": "No news articles found for this ticker"
            }

        # Analyze sentiment with momentum
        analysis = sentiment_service.analyze_sentiment_with_momentum(articles)

        # Build response
        response = {
            "success": True,
            "ticker": ticker,
            "timeframe": timeframe,
            "article_count": len(articles),

            # Core scores
            "fast_score": analysis.get("fast_score"),
            "slow_score": analysis.get("slow_score"),
            "overall_weighted_score": analysis.get("overall_weighted_score"),
            "data_quality": analysis.get("data_quality"),

            # Momentum
            "sentiment_momentum": analysis.get("sentiment_momentum"),
            "momentum_label": analysis.get("momentum_label"),
            "momentum_interpretation": analysis.get("momentum_interpretation"),
            "momentum_direction": analysis.get("momentum_direction"),
            "momentum_strength": analysis.get("momentum_strength"),
            "momentum_quality": analysis.get("momentum_quality"),

            # Volatility
            "sentiment_volatility": analysis.get("sentiment_volatility"),

            # Volume
            "effective_news_volume": analysis.get("effective_news_volume"),
            "volume_interpretation": analysis.get("volume_interpretation"),

            # Breadth
            "sentiment_breadth_score": analysis.get("sentiment_breadth_score"),
            "num_bullish_articles": analysis.get("num_bullish_articles"),
            "num_bearish_articles": analysis.get("num_bearish_articles"),
            "breadth_interpretation": analysis.get("breadth_interpretation"),

            # Z-Score (shock detection)
            "sentiment_z_score": analysis.get("sentiment_z_score"),
            "z_score_interpretation": analysis.get("z_score_interpretation"),

            # Source analysis
            "source_concentration_hhi": analysis.get("source_concentration_hhi"),
            "concentration_interpretation": analysis.get("concentration_interpretation"),
            "top_sources": analysis.get("top_sources", []),

            # Topic analysis
            "dominant_topic": analysis.get("dominant_topic"),
            "sentiment_by_topic": analysis.get("sentiment_by_topic", {}),

            # Counts
            "sentiment_counts": analysis.get("sentiment_counts", {}),

            # Decay parameters (for transparency)
            "half_life_fast_hours": analysis.get("half_life_fast_hours"),
            "half_life_slow_hours": analysis.get("half_life_slow_hours"),
            "momentum_definition": analysis.get("momentum_definition")
        }

        if include_articles:
            response["articles"] = analysis.get("articles_with_sentiment", [])

        return response

    except Exception as e:
        logger.error(f"Error analyzing sentiment for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sentiment/quick/{ticker}")
async def get_quick_sentiment(
    ticker: str,
    timeframe: str = Query(default="1W", regex="^(1D|1W|1M|3M|6M|YTD|1Y)$")
):
    """
    Quick sentiment score without full analysis.

    Returns just the core metrics for fast dashboard updates.
    """
    try:
        ticker = ticker.upper().strip()
        articles = await news_service.get_ticker_news_for_timeframe(ticker, timeframe)

        if not articles:
            return {
                "ticker": ticker,
                "timeframe": timeframe,
                "score": None,
                "momentum": None,
                "data_quality": "no_data"
            }

        analysis = sentiment_service.analyze_sentiment_with_momentum(articles)

        return {
            "ticker": ticker,
            "timeframe": timeframe,
            "score": analysis.get("slow_score"),
            "momentum": analysis.get("sentiment_momentum"),
            "momentum_direction": analysis.get("momentum_direction"),
            "volatility": analysis.get("sentiment_volatility"),
            "breadth": analysis.get("sentiment_breadth_score"),
            "article_count": len(articles),
            "data_quality": analysis.get("data_quality")
        }
    except Exception as e:
        logger.error(f"Error getting quick sentiment for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sentiment/batch/analyze")
async def batch_analyze_sentiment(
    tickers: list[str],
    timeframe: str = Query(default="1W", regex="^(1D|1W|1M|3M|6M|YTD|1Y)$")
):
    """
    Batch sentiment analysis for multiple tickers.

    Args:
        tickers: List of ticker symbols (max 20)
        timeframe: Time range for analysis

    Returns:
        Dictionary of ticker -> sentiment summary
    """
    if len(tickers) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 tickers per batch")

    results = {}

    for ticker in tickers:
        try:
            ticker = ticker.upper().strip()
            articles = await news_service.get_ticker_news_for_timeframe(ticker, timeframe)

            if articles:
                analysis = sentiment_service.analyze_sentiment_with_momentum(articles)
                results[ticker] = {
                    "score": analysis.get("slow_score"),
                    "momentum": analysis.get("sentiment_momentum"),
                    "momentum_direction": analysis.get("momentum_direction"),
                    "volatility": analysis.get("sentiment_volatility"),
                    "article_count": len(articles),
                    "data_quality": analysis.get("data_quality")
                }
            else:
                results[ticker] = {
                    "score": None,
                    "momentum": None,
                    "article_count": 0,
                    "data_quality": "no_data"
                }
        except Exception as e:
            logger.error(f"Error in batch analysis for {ticker}: {e}")
            results[ticker] = {"error": str(e)}

    return {
        "success": True,
        "timeframe": timeframe,
        "results": results
    }


# =============================================================================
# Status & Monitoring Endpoints
# =============================================================================

@app.get("/api/sentiment/status/circuit-breakers")
async def get_circuit_breaker_status():
    """Get status of all circuit breakers."""
    status = {}
    for name, cb in circuit_breakers.items():
        status[name] = {
            "state": cb.state,
            "failures": cb.failures,
            "successes": cb.successes,
            "threshold": cb.failure_threshold,
            "recovery_timeout": cb.recovery_timeout
        }
    return {"circuit_breakers": status}


@app.get("/api/sentiment/status/cache")
async def get_cache_status():
    """Get Redis cache status."""
    connected = redis_cache.async_client is not None
    return {
        "connected": connected,
        "host": settings.REDIS_HOST,
        "port": settings.REDIS_PORT
    }


# =============================================================================
# Run Server
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
