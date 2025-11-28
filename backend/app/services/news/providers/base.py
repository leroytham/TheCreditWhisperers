"""
Base interface for news providers.

This module defines the abstract base class for all news providers,
ensuring consistent interface across different data sources.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
import aiohttp


class NewsProvider(ABC):
    """
    Abstract base class for news data providers.

    All news providers (Alpha Vantage, Finnhub, etc.) should inherit from this
    class and implement the required methods.
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the provider with optional API key.

        Args:
            api_key: API key for the provider (None if not required)
        """
        self.api_key = api_key
        self._is_available = api_key is not None

    @property
    def is_available(self) -> bool:
        """Check if the provider is configured and available."""
        return self._is_available

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the name of this provider."""
        pass

    @abstractmethod
    async def fetch_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        **kwargs
    ) -> List[Dict]:
        """
        Fetch news articles for a ticker.

        Args:
            session: aiohttp ClientSession for async requests
            ticker: Stock ticker symbol
            **kwargs: Provider-specific parameters

        Returns:
            List of news article dictionaries
        """
        pass

    def normalize_article(self, article: Dict) -> Dict:
        """
        Normalize article data to a common format.

        Override this method to customize normalization for specific providers.

        Args:
            article: Raw article data from provider

        Returns:
            Normalized article dictionary with standard fields:
                - title: Article headline
                - link/url: Article URL
                - provider/source: News source name
                - publish_date: Date in YYYY-MM-DD format
                - publish_timestamp: ISO timestamp
                - body/summary: Article content
                - image: Optional banner image URL
        """
        return article
