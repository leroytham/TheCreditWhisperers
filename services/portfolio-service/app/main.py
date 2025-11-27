# =============================================================================
# Portfolio Service - FastAPI Application
# =============================================================================

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional
import logging

from app.core.config import settings
from app.core.http_client import http_client
from app.core.cache import redis_cache
from app.models.portfolio import HoldingModel, PortfolioSentimentRequest, PortfolioTimeseriesRequest
from app.services.portfolio_sentiment_service import portfolio_sentiment_service
from app.services.portfolio_timeseries_service import portfolio_timeseries_service
from app.services.service_client import service_client

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Portfolio Service...")

    # Initialize HTTP client
    await http_client.get_session()
    logger.info("HTTP client initialized")

    # Connect to Redis
    await redis_cache.connect()
    logger.info("Redis cache connected")

    yield

    # Cleanup
    logger.info("Shutting down Portfolio Service...")
    await http_client.close()
    await redis_cache.close()


app = FastAPI(
    title="Portfolio Service",
    description="Portfolio aggregation, sentiment, and timeseries analytics",
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
        "service": "portfolio-service",
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

    # Check downstream services
    market_data_ok = False
    sentiment_ok = False

    try:
        session = await http_client.get_session()
        async with session.get(f"{settings.MARKET_DATA_SERVICE_URL}/health", timeout=5) as resp:
            market_data_ok = resp.status == 200
    except:
        pass

    try:
        session = await http_client.get_session()
        async with session.get(f"{settings.SENTIMENT_SERVICE_URL}/health", timeout=5) as resp:
            sentiment_ok = resp.status == 200
    except:
        pass

    status = "ready" if (redis_ok and market_data_ok and sentiment_ok) else "degraded"

    return {
        "status": status,
        "redis": "connected" if redis_ok else "disconnected",
        "market_data_service": "healthy" if market_data_ok else "unhealthy",
        "sentiment_service": "healthy" if sentiment_ok else "unhealthy"
    }


@app.get("/health/startup")
async def startup_probe():
    """Kubernetes startup probe."""
    return {"status": "started"}


# =============================================================================
# Portfolio Sentiment Endpoints
# =============================================================================

@app.post("/api/portfolio/sentiment")
async def get_portfolio_sentiment(request: PortfolioSentimentRequest):
    """
    Get aggregated sentiment analysis for a portfolio.

    The sentiment is weighted by each holding's market value.
    """
    try:
        holdings_dicts = [h.dict() for h in request.holdings]

        result = await portfolio_sentiment_service.get_portfolio_sentiment(
            holdings_dicts,
            request.timeframe
        )

        return result

    except Exception as e:
        logger.error(f"Error in portfolio sentiment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/portfolio/sentiment/quick")
async def get_portfolio_quick_sentiment(
    holdings: List[HoldingModel],
    timeframe: str = Query(default="1W")
):
    """Quick portfolio sentiment summary."""
    try:
        holdings_dicts = [h.dict() for h in holdings]

        result = await portfolio_sentiment_service.get_portfolio_sentiment(
            holdings_dicts,
            timeframe
        )

        # Return simplified response
        return {
            "success": True,
            "timeframe": timeframe,
            "score": result.get("slow_score"),
            "momentum": result.get("sentiment_momentum"),
            "momentum_direction": result.get("momentum_label"),
            "valid_holdings": result.get("valid_holdings"),
            "coverage": result.get("coverage"),
            "data_quality": result.get("data_quality")
        }

    except Exception as e:
        logger.error(f"Error in quick portfolio sentiment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Portfolio Timeseries Endpoints
# =============================================================================

@app.post("/api/portfolio/timeseries")
async def get_portfolio_timeseries(request: PortfolioTimeseriesRequest):
    """
    Get historical portfolio value timeseries.
    """
    try:
        holdings_dicts = [h.dict() for h in request.holdings]

        result = await portfolio_timeseries_service.generate_portfolio_timeseries(
            holdings_dicts,
            request.timeframe
        )

        return {
            "success": True,
            **result
        }

    except Exception as e:
        logger.error(f"Error in portfolio timeseries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/portfolio/benchmark")
async def get_benchmark_timeseries(
    timeframe: str = Query(default="1Y"),
    ticker: str = Query(default="^GSPC")
):
    """
    Get benchmark index timeseries for comparison.

    Default is S&P 500 (^GSPC).
    """
    try:
        result = await portfolio_timeseries_service.fetch_benchmark_timeseries(
            timeframe,
            ticker
        )

        return {
            "success": True,
            **result
        }

    except Exception as e:
        logger.error(f"Error in benchmark timeseries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Holdings Data Endpoints (via downstream services)
# =============================================================================

@app.get("/api/portfolio/holdings/{ticker}/quote")
async def get_holding_quote(ticker: str):
    """Get current quote for a holding via Market Data Service."""
    try:
        result = await service_client.get_stock_quote(ticker.upper())
        if result:
            return result
        raise HTTPException(status_code=404, detail=f"Quote not found for {ticker}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting quote for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/portfolio/holdings/quotes")
async def get_batch_holding_quotes(tickers: List[str]):
    """Get batch quotes for multiple holdings."""
    try:
        upper_tickers = [t.upper() for t in tickers]
        result = await service_client.get_batch_quotes(upper_tickers)
        return result
    except Exception as e:
        logger.error(f"Error getting batch quotes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/portfolio/holdings/{ticker}/sentiment")
async def get_holding_sentiment(
    ticker: str,
    timeframe: str = Query(default="1M")
):
    """Get sentiment for a specific holding via Sentiment Service."""
    try:
        result = await service_client.get_ticker_sentiment(ticker.upper(), timeframe)
        if result:
            return result
        raise HTTPException(status_code=404, detail=f"Sentiment not found for {ticker}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sentiment for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/portfolio/holdings/{ticker}/news")
async def get_holding_news(
    ticker: str,
    timeframe: str = Query(default="1M"),
    count: int = Query(default=50, ge=1, le=200)
):
    """Get news for a specific holding via Sentiment Service."""
    try:
        result = await service_client.get_ticker_news(ticker.upper(), timeframe, count)
        if result:
            return result
        raise HTTPException(status_code=404, detail=f"News not found for {ticker}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting news for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Status Endpoints
# =============================================================================

@app.get("/api/portfolio/status/services")
async def get_service_status():
    """Get status of downstream services."""
    session = await http_client.get_session()

    services = {}

    # Market Data Service
    try:
        async with session.get(f"{settings.MARKET_DATA_SERVICE_URL}/health", timeout=5) as resp:
            services["market_data"] = {
                "url": settings.MARKET_DATA_SERVICE_URL,
                "status": "healthy" if resp.status == 200 else "unhealthy",
                "status_code": resp.status
            }
    except Exception as e:
        services["market_data"] = {
            "url": settings.MARKET_DATA_SERVICE_URL,
            "status": "unreachable",
            "error": str(e)
        }

    # Sentiment Service
    try:
        async with session.get(f"{settings.SENTIMENT_SERVICE_URL}/health", timeout=5) as resp:
            services["sentiment"] = {
                "url": settings.SENTIMENT_SERVICE_URL,
                "status": "healthy" if resp.status == 200 else "unhealthy",
                "status_code": resp.status
            }
    except Exception as e:
        services["sentiment"] = {
            "url": settings.SENTIMENT_SERVICE_URL,
            "status": "unreachable",
            "error": str(e)
        }

    return {"services": services}


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
