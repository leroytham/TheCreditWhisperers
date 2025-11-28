"""
Finnhub news provider.

This module handles fetching company news from Finnhub API.
"""

import logging
from datetime import datetime
from typing import List, Dict, Optional

import aiohttp

from app.core.circuit_breakers import get_circuit_breaker, CircuitBreakerOpenError
from .base import NewsProvider

logger = logging.getLogger(__name__)


class FinnhubProvider(NewsProvider):
    """
    Finnhub company news API provider.

    Provides general company news without pre-calculated sentiment scores.
    Requires FinBERT fallback for sentiment analysis.
    """

    @property
    def provider_name(self) -> str:
        return "Finnhub"

    async def fetch_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        scraper: Optional[callable] = None
    ) -> List[Dict]:
        """
        Fetch news from Finnhub company news API.

        Args:
            session: aiohttp ClientSession for async requests
            ticker: Stock ticker symbol
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            scraper: Optional async function to scrape article content

        Returns:
            List of news article dictionaries
        """
        if not self.is_available:
            return []

        cb = get_circuit_breaker("finnhub")
        url = (
            f"https://finnhub.io/api/v1/company-news?"
            f"symbol={ticker}&from={start_date}&to={end_date}"
            f"&token={self.api_key}"
        )

        async def _make_request():
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                return await response.json()

        try:
            raw_news = await cb.call(_make_request) if cb else await _make_request()
            if not raw_news:
                return []

            return await self._process_articles(raw_news, scraper, session)

        except CircuitBreakerOpenError:
            logger.warning(f"[FINNHUB] Circuit breaker open for {ticker}")
            return []
        except Exception as e:
            logger.error(f"Error fetching from Finnhub for {ticker}: {e}")
            return []

    async def _process_articles(
        self,
        raw_news: List[Dict],
        scraper: Optional[callable],
        session: aiohttp.ClientSession
    ) -> List[Dict]:
        """Process raw API response into normalized article list."""
        import asyncio

        if scraper:
            # Scrape article content in parallel
            scrape_tasks = [
                scraper(session, article.get("url"))
                for article in raw_news
            ]
            scraped_contents = await asyncio.gather(*scrape_tasks)
        else:
            scraped_contents = [None] * len(raw_news)

        news_list = []
        for i, article in enumerate(raw_news):
            timestamp = article.get("datetime")
            if not timestamp:
                continue

            try:
                pub_datetime = datetime.fromtimestamp(timestamp)
            except (ValueError, TypeError):
                continue

            body_content = scraped_contents[i] or article.get("summary", "")

            news_list.append({
                "title": article.get("headline"),
                "link": article.get("url"),
                "provider": article.get("source"),
                "publish_date": pub_datetime.strftime('%Y-%m-%d'),
                "publish_timestamp": pub_datetime.isoformat(),
                "body": body_content
            })

        return news_list


# Factory function
def create_finnhub_provider(api_key: Optional[str] = None) -> FinnhubProvider:
    """Create a Finnhub provider instance."""
    import os
    if api_key is None:
        api_key = os.getenv("FINNHUB_API_TOKEN")
    return FinnhubProvider(api_key)
