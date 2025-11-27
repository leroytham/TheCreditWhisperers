# =============================================================================
# TheCreditWhisperers - Market Data Service
# =============================================================================
# Standalone microservice for stock prices, company info, and market data

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional
import logging

from app.core.config import settings
from app.core.http_client import http_client
from app.core.cache import get_redis_client
from app.core.circuit_breaker import get_all_circuit_breakers
from app.services.stock_data_service import stock_data_service

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Market Data Service starting...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    # Test Redis connection
    redis_client = get_redis_client()
    if redis_client:
        logger.info("Redis cache connected")
    else:
        logger.warning("Redis cache not available")

    yield

    # Cleanup
    await http_client.close()
    logger.info("Market Data Service stopped")


# Create FastAPI app
app = FastAPI(
    title="TheCreditWhisperers Market Data Service",
    description="Microservice for stock prices, company info, and market data",
    version="1.0.0",
    lifespan=lifespan,
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
    return {"status": "healthy", "service": "market-data"}


@app.get("/health/live")
async def liveness_probe():
    """Kubernetes liveness probe."""
    return {"status": "alive"}


@app.get("/health/ready")
async def readiness_probe():
    """Kubernetes readiness probe - checks Redis connectivity."""
    redis_client = get_redis_client()
    redis_status = "connected" if redis_client else "unavailable"

    if redis_client is None:
        raise HTTPException(status_code=503, detail="Redis not available")

    return {
        "status": "ready",
        "redis": redis_status,
    }


@app.get("/health/startup")
async def startup_probe():
    """Kubernetes startup probe."""
    return {"status": "started"}


# =============================================================================
# Market Data API Endpoints
# =============================================================================

@app.get("/api/market/quote/{ticker}")
async def get_quote(ticker: str):
    """
    Get current market quote for a ticker.
    Returns current price, day change, and 52-week range.
    """
    ticker = ticker.upper()
    result = await stock_data_service.get_current_market_price(ticker)

    if result is None:
        raise HTTPException(status_code=404, detail=f"Quote not found for {ticker}")

    return result


@app.get("/api/market/history/{ticker}")
async def get_history(
    ticker: str,
    period: str = Query("1y", description="Time period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max"),
    interval: str = Query("1d", description="Data interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo"),
    timeframe: Optional[str] = Query(None, description="Filter: 1D, 1M, 3M, 6M, 1Y, YTD")
):
    """
    Get historical price data for a ticker.
    """
    ticker = ticker.upper()
    df = stock_data_service.get_stock_data(ticker, period=period, interval=interval)

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No historical data for {ticker}")

    # Apply timeframe filter if specified
    if timeframe:
        df = stock_data_service.filter_data_by_timeframe(df, timeframe.upper())
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"No data for {ticker} in timeframe {timeframe}")

    # Convert DataFrame to JSON-serializable format
    records = []
    for idx, row in df.iterrows():
        records.append({
            "date": idx.isoformat(),
            "open": float(row["Open"]) if "Open" in row else None,
            "high": float(row["High"]) if "High" in row else None,
            "low": float(row["Low"]) if "Low" in row else None,
            "close": float(row["Close"]) if "Close" in row else None,
            "volume": int(row["Volume"]) if "Volume" in row else None,
        })

    return {
        "ticker": ticker,
        "period": period,
        "interval": interval,
        "timeframe": timeframe,
        "count": len(records),
        "data": records,
    }


@app.get("/api/market/history-range/{ticker}")
async def get_history_range(
    ticker: str,
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD")
):
    """
    Get historical price data for a specific date range.
    """
    ticker = ticker.upper()
    result = await stock_data_service.get_historical_price(ticker, start_date, end_date)

    if result is None:
        raise HTTPException(status_code=404, detail=f"No data for {ticker} in date range")

    return result


@app.get("/api/market/company/{ticker}")
async def get_company(ticker: str):
    """
    Get company information for a ticker.
    """
    ticker = ticker.upper()
    result = stock_data_service.get_company_info(ticker)

    if result is None:
        raise HTTPException(status_code=404, detail=f"Company info not found for {ticker}")

    return result


@app.get("/api/market/company/{ticker}/overview")
async def get_company_overview(ticker: str):
    """
    Get comprehensive company overview from Alpha Vantage.
    Includes financial ratios, analyst ratings, and key metrics.
    """
    ticker = ticker.upper()
    result = await stock_data_service.get_company_overview(ticker)

    if result is None:
        # Fall back to basic company info
        basic_info = stock_data_service.get_company_info(ticker)
        if basic_info:
            return {"source": "yfinance", **basic_info}
        raise HTTPException(status_code=404, detail=f"Company overview not found for {ticker}")

    return {"source": "alpha_vantage", **result}


@app.get("/api/market/sector/{etf}/constituents")
async def get_sector_constituents(
    etf: str,
    limit: int = Query(30, ge=1, le=100, description="Maximum number of constituents")
):
    """
    Get top constituents of an ETF (e.g., XLK for Technology, SPY for S&P 500).
    """
    etf = etf.upper()
    result = stock_data_service.get_sector_constituents(etf, limit=limit)

    if not result:
        raise HTTPException(status_code=404, detail=f"No constituents found for ETF {etf}")

    return {
        "etf": etf,
        "count": len(result),
        "constituents": result,
    }


@app.get("/api/market/batch/quotes")
async def get_batch_quotes(
    tickers: str = Query(..., description="Comma-separated list of tickers")
):
    """
    Get quotes for multiple tickers at once.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]

    if not ticker_list:
        raise HTTPException(status_code=400, detail="No tickers provided")

    if len(ticker_list) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 tickers per request")

    results = {}
    for ticker in ticker_list:
        quote = await stock_data_service.get_current_market_price(ticker)
        if quote:
            results[ticker] = quote

    return {
        "count": len(results),
        "quotes": results,
    }


# =============================================================================
# Circuit Breaker Status Endpoint
# =============================================================================

@app.get("/api/market/status/circuit-breakers")
async def get_circuit_breaker_status():
    """Get status of all circuit breakers."""
    return get_all_circuit_breakers()


# =============================================================================
# Run with uvicorn
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
