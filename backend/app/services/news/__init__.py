"""
News service package.

This package provides news fetching functionality with multiple data providers
and progressive loading support.

For backward compatibility, NewsService and news_service_instance are
re-exported from the parent news_service module.
"""

# Re-export providers
from .providers import (
    NewsProvider,
    AlphaVantageProvider,
    FinnhubProvider,
    NewsAPIProvider,
    MarketAuxProvider,
    create_alpha_vantage_provider,
    create_finnhub_provider,
    create_newsapi_provider,
    create_marketaux_provider,
)

__all__ = [
    # Providers
    "NewsProvider",
    "AlphaVantageProvider",
    "FinnhubProvider",
    "NewsAPIProvider",
    "MarketAuxProvider",
    "create_alpha_vantage_provider",
    "create_finnhub_provider",
    "create_newsapi_provider",
    "create_marketaux_provider",
]
