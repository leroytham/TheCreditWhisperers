# app/api/utility_routes.py
"""
Utility routes for system monitoring and search functionality.

Endpoints:
- GET /circuit-breakers - Get status of all API circuit breakers
- POST /circuit-breakers/{api_name}/reset - Reset a specific circuit breaker
- GET /search-ticker - Search for ticker symbols with fuzzy matching
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException
import yfinance as yf

from app.core.circuit_breakers import get_all_status, reset_circuit_breaker

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Utilities"])


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

    Args:
        api_name: Valid names: alpha_vantage, finnhub, newsapi, marketaux, yahoo_finance

    Returns:
        Confirmation message with new circuit breaker status
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


@router.get("/search-ticker")
def search_ticker(q: str):
    """
    Search for ticker symbols with fuzzy matching.

    Uses Yahoo Finance's search endpoint to find matching tickers.
    Returns quotes with symbol, name, and quoteType fields.

    Args:
        q: Search query (minimum 1 character)

    Returns:
        {
            "quotes": [
                {
                    "symbol": "AAPL",
                    "shortname": "Apple Inc.",
                    "longname": "Apple Inc.",
                    "quoteType": "EQUITY",
                    "exchange": "NASDAQ",
                    "sector": "Technology",
                    "industry": "Consumer Electronics"
                },
                ...
            ]
        }

    Example: /search-ticker?q=appl
    """
    try:
        if not q or len(q) < 1:
            return {"quotes": []}

        # Use yahooquery's search functionality for fuzzy matching
        from yahooquery import search

        try:
            results = search(q)

            if not results or 'quotes' not in results:
                return {"quotes": []}

            # Format results to match expected structure
            formatted_quotes = []
            for quote in results.get('quotes', []):
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
            logger.warning(f"yahooquery search failed, falling back to yfinance: {search_error}")
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
            except Exception:
                pass

            return {"quotes": []}

    except Exception as e:
        logger.error(f"Error searching for ticker '{q}': {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")
