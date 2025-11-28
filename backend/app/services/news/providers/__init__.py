"""
News provider modules.

This package contains implementations of various news data providers,
each with its own API integration and data normalization logic.
"""

from .base import NewsProvider
from .alpha_vantage import AlphaVantageProvider, create_alpha_vantage_provider
from .finnhub import FinnhubProvider, create_finnhub_provider
from .newsapi import NewsAPIProvider, create_newsapi_provider
from .marketaux import MarketAuxProvider, create_marketaux_provider

__all__ = [
    # Base class
    "NewsProvider",
    # Providers
    "AlphaVantageProvider",
    "FinnhubProvider",
    "NewsAPIProvider",
    "MarketAuxProvider",
    # Factory functions
    "create_alpha_vantage_provider",
    "create_finnhub_provider",
    "create_newsapi_provider",
    "create_marketaux_provider",
]
