# app/core/dependencies.py
"""
Dependency injection providers for FastAPI routes.

This module provides provider functions that can be used with FastAPI's Depends()
to enable proper dependency injection and testability.

Usage in routes:
    from fastapi import Depends
    from app.core.dependencies import get_news_service
    from app.services.news_service import NewsService

    @router.get("/news")
    async def get_news(
        ticker: str,
        news_service: NewsService = Depends(get_news_service)
    ):
        return await news_service.get_ticker_news(ticker)

Usage in tests:
    from app.core.dependencies import get_news_service

    def test_news_endpoint(client):
        mock_service = MagicMock()
        mock_service.get_ticker_news = AsyncMock(return_value=[])
        app.dependency_overrides[get_news_service] = lambda: mock_service

        response = client.get("/news?ticker=AAPL")
        assert response.status_code == 200

        app.dependency_overrides.clear()
"""

from typing import TYPE_CHECKING
from functools import lru_cache

if TYPE_CHECKING:
    from app.services.news_service import NewsService
    from app.services.sentiment_service import SentimentService
    from app.services.sector_service import SectorService
    from app.services.sector_sentiment_service import SectorSentimentService
    from app.services.stock_data_service import StockDataService
    from app.services.portfolio_sentiment_service import PortfolioSentimentService
    from app.services.market_analysis_service import MarketAnalysisService
    from app.services.twr_calculator_service import TWRCalculatorService
    from app.services.earnings_service import EarningsService


# =============================================================================
# SERVICE PROVIDERS
# =============================================================================
# Each provider returns the service singleton instance. Using @lru_cache ensures
# consistent singleton behavior while allowing dependency_overrides in tests.
#
# The @lru_cache(maxsize=1) decorator memoizes the return value, ensuring we
# always return the same instance. This can be cleared in tests via cache_clear().


@lru_cache(maxsize=1)
def get_news_service() -> "NewsService":
    """Provide NewsService instance for news fetching and aggregation."""
    from app.services.news_service import news_service_instance
    return news_service_instance


@lru_cache(maxsize=1)
def get_sentiment_service() -> "SentimentService":
    """Provide SentimentService instance for sentiment analysis."""
    from app.services.sentiment_service import sentiment_service
    return sentiment_service


@lru_cache(maxsize=1)
def get_sector_service() -> "SectorService":
    """Provide SectorService instance for sector data and mapping."""
    from app.services.sector_service import sector_service_instance
    return sector_service_instance


@lru_cache(maxsize=1)
def get_sector_sentiment_service() -> "SectorSentimentService":
    """Provide SectorSentimentService instance for sector sentiment analysis."""
    from app.services.sector_sentiment_service import sector_sentiment_service
    return sector_sentiment_service


@lru_cache(maxsize=1)
def get_stock_data_service() -> "StockDataService":
    """Provide StockDataService instance for stock data retrieval."""
    from app.services.stock_data_service import stock_data_service
    return stock_data_service


@lru_cache(maxsize=1)
def get_portfolio_sentiment_service() -> "PortfolioSentimentService":
    """Provide PortfolioSentimentService instance for portfolio sentiment analysis."""
    from app.services.portfolio_sentiment_service import portfolio_sentiment_service
    return portfolio_sentiment_service


@lru_cache(maxsize=1)
def get_market_analysis_service() -> "MarketAnalysisService":
    """Provide MarketAnalysisService instance for market analysis."""
    from app.services.market_analysis_service import market_analysis_service
    return market_analysis_service


@lru_cache(maxsize=1)
def get_twr_calculator_service() -> "TWRCalculatorService":
    """Provide TWRCalculatorService instance for time-weighted return calculations."""
    from app.services.twr_calculator_service import twr_calculator_service
    return twr_calculator_service


@lru_cache(maxsize=1)
def get_earnings_service() -> "EarningsService":
    """Provide EarningsService instance for earnings data and transcripts."""
    from app.services.earnings_service import earnings_service
    return earnings_service


# =============================================================================
# CACHE CLEARING FOR TESTS
# =============================================================================
def clear_dependency_caches():
    """
    Clear all provider caches.

    Call this in test teardown to ensure clean state between tests.
    This is automatically called by the reset_overrides fixture in conftest.py.

    Example:
        @pytest.fixture(autouse=True)
        def reset_overrides():
            yield
            app.dependency_overrides.clear()
            clear_dependency_caches()
    """
    get_news_service.cache_clear()
    get_sentiment_service.cache_clear()
    get_sector_service.cache_clear()
    get_sector_sentiment_service.cache_clear()
    get_stock_data_service.cache_clear()
    get_portfolio_sentiment_service.cache_clear()
    get_market_analysis_service.cache_clear()
    get_twr_calculator_service.cache_clear()
    get_earnings_service.cache_clear()
