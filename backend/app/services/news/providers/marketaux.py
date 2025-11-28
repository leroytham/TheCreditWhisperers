"""
MarketAux news provider.

This module handles fetching news from MarketAux API.
"""

import logging
from datetime import datetime
from typing import List, Dict, Optional

import aiohttp

from app.core.circuit_breakers import get_circuit_breaker, CircuitBreakerOpenError
from .base import NewsProvider

logger = logging.getLogger(__name__)


class MarketAuxProvider(NewsProvider):
    """
    MarketAux news API provider.

    Provides financial news without pre-calculated sentiment scores.
    Requires FinBERT fallback for sentiment analysis.
    """

    @property
    def provider_name(self) -> str:
        return "MarketAux"

    async def fetch_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        start_date: Optional[str] = None,
        scraper: Optional[callable] = None
    ) -> List[Dict]:
        """
        Fetch news from MarketAux API.

        Args:
            session: aiohttp ClientSession for async requests
            ticker: Stock ticker symbol
            start_date: Start date in YYYY-MM-DD format (published_after)
            scraper: Optional async function to scrape article content

        Returns:
            List of news article dictionaries
        """
        if not self.is_available:
            return []

        cb = get_circuit_breaker("marketaux")
        url = (
            f"https://api.marketaux.com/v1/news/all?"
            f"symbols={ticker}&published_after={start_date}"
            f"&api_token={self.api_key}"
        )

        async def _make_request():
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                data = await response.json()
                return data.get("data", [])

        try:
            raw_data = await cb.call(_make_request) if cb else await _make_request()
            if not raw_data:
                return []

            return await self._process_articles(raw_data, scraper, session)

        except CircuitBreakerOpenError:
            logger.warning(f"[MARKETAUX] Circuit breaker open for {ticker}")
            return []
        except Exception as e:
            logger.error(f"Error fetching from MarketAux for {ticker}: {e}")
            return []

    async def _process_articles(
        self,
        raw_data: List[Dict],
        scraper: Optional[callable],
        session: aiohttp.ClientSession
    ) -> List[Dict]:
        """Process raw API response into normalized article list."""
        import asyncio

        if scraper:
            scrape_tasks = [
                scraper(session, article.get("url"))
                for article in raw_data
            ]
            scraped_contents = await asyncio.gather(*scrape_tasks)
        else:
            scraped_contents = [None] * len(raw_data)

        news_list = []
        for i, article in enumerate(raw_data):
            pub_date_iso = article.get("published_at")
            if not pub_date_iso:
                continue

            try:
                pub_datetime = datetime.fromisoformat(pub_date_iso)
                pub_date = pub_datetime.strftime('%Y-%m-%d')
            except ValueError:
                continue

            body_content = scraped_contents[i] or article.get("snippet", "")

            news_list.append({
                "title": article.get("title"),
                "link": article.get("url"),
                "provider": article.get("source"),
                "publish_date": pub_date,
                "publish_timestamp": pub_datetime.isoformat(),
                "body": body_content
            })

        return news_list


# Factory function
def create_marketaux_provider(api_key: Optional[str] = None) -> MarketAuxProvider:
    """Create a MarketAux provider instance."""
    import os
    if api_key is None:
        api_key = os.getenv("MARKETAUX_API_KEY")
    return MarketAuxProvider(api_key)
