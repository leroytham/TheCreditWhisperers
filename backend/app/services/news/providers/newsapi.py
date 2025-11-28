"""
NewsAPI.org news provider.

This module handles fetching news from NewsAPI.org.
"""

import logging
from datetime import datetime
from typing import List, Dict, Optional

import aiohttp

from app.core.circuit_breakers import get_circuit_breaker, CircuitBreakerOpenError
from .base import NewsProvider

logger = logging.getLogger(__name__)


class NewsAPIProvider(NewsProvider):
    """
    NewsAPI.org news provider.

    Provides general news search without pre-calculated sentiment scores.
    Requires FinBERT fallback for sentiment analysis.
    """

    @property
    def provider_name(self) -> str:
        return "NewsAPI"

    async def fetch_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        scraper: Optional[callable] = None
    ) -> List[Dict]:
        """
        Fetch news from NewsAPI.org.

        Args:
            session: aiohttp ClientSession for async requests
            ticker: Stock ticker symbol (used as search query)
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            scraper: Optional async function to scrape article content

        Returns:
            List of news article dictionaries
        """
        if not self.is_available:
            return []

        cb = get_circuit_breaker("newsapi")
        url = (
            f"https://newsapi.org/v2/everything?"
            f"q={ticker}&from={start_date}&to={end_date}"
            f"&sortBy=publishedAt&apiKey={self.api_key}"
        )

        async def _make_request():
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                data = await response.json()
                return data.get("articles", [])

        try:
            raw_data = await cb.call(_make_request) if cb else await _make_request()
            if not raw_data:
                return []

            return await self._process_articles(raw_data, scraper, session)

        except CircuitBreakerOpenError:
            logger.warning(f"[NEWSAPI] Circuit breaker open for {ticker}")
            return []
        except Exception as e:
            logger.error(f"Error fetching from NewsAPI for {ticker}: {e}")
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
            pub_date_iso = article.get("publishedAt")
            if not pub_date_iso:
                continue

            try:
                pub_datetime = datetime.fromisoformat(
                    pub_date_iso.replace('Z', '+00:00')
                )
                pub_date = pub_datetime.strftime('%Y-%m-%d')
            except ValueError:
                continue

            body_content = scraped_contents[i] or article.get("description", "")

            source_info = article.get("source", {})
            provider_name = source_info.get("name", "Unknown") if isinstance(source_info, dict) else "Unknown"

            news_list.append({
                "title": article.get("title"),
                "link": article.get("url"),
                "provider": provider_name,
                "publish_date": pub_date,
                "publish_timestamp": pub_datetime.isoformat(),
                "body": body_content
            })

        return news_list


# Factory function
def create_newsapi_provider(api_key: Optional[str] = None) -> NewsAPIProvider:
    """Create a NewsAPI provider instance."""
    import os
    if api_key is None:
        api_key = os.getenv("NEWS_API_KEY")
    return NewsAPIProvider(api_key)
