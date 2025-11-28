"""
Alpha Vantage news provider.

This module handles fetching news from Alpha Vantage NEWS_SENTIMENT API,
which provides pre-calculated sentiment scores for financial news.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional

import aiohttp

from app.core.circuit_breakers import get_circuit_breaker, CircuitBreakerOpenError
from .base import NewsProvider

logger = logging.getLogger(__name__)


class AlphaVantageProvider(NewsProvider):
    """
    Alpha Vantage NEWS_SENTIMENT API provider.

    Features:
    - Pre-calculated ticker sentiment scores
    - Relevance scores for each ticker
    - Topic categorization
    - Batch fetching with pagination
    - Rate limit handling
    """

    @property
    def provider_name(self) -> str:
        return "Alpha Vantage"

    async def fetch_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        time_from: Optional[str] = None,
        time_to: Optional[str] = None,
        limit: int = 1000,
        preserve_all_tickers: bool = False
    ) -> List[Dict]:
        """
        Fetch news from Alpha Vantage NEWS_SENTIMENT API.

        Args:
            session: aiohttp ClientSession for async requests
            ticker: Stock ticker symbol
            time_from: Optional start time in format "YYYYMMDDTHHMM"
            time_to: Optional end time in format "YYYYMMDDTHHMM"
            limit: Maximum number of articles to return (default: 1000, max: 1000)
            preserve_all_tickers: If True, preserves full ticker_sentiment array
                                 for multi-ticker processing (sector mode)

        Returns:
            List of news article dictionaries with sentiment scores
        """
        if not self.is_available:
            return []

        cb = get_circuit_breaker("alpha_vantage")

        # Build URL with optional time parameters
        url = (
            f"https://www.alphavantage.co/query?"
            f"function=NEWS_SENTIMENT&limit={limit}&tickers={ticker}"
            f"&apikey={self.api_key}"
        )

        if time_from:
            url += f"&time_from={time_from}"
        if time_to:
            url += f"&time_to={time_to}"

        async def _make_request():
            async with session.get(url, timeout=30) as response:
                response.raise_for_status()
                return await response.json()

        try:
            data = await cb.call(_make_request) if cb else await _make_request()

            # Check for rate limit or API error messages
            if "Note" in data:
                logger.warning(f"Alpha Vantage rate limit hit: {data['Note']}")
                return []
            if "Information" in data:
                logger.info(f"Alpha Vantage information: {data['Information']}")
                return []
            if "Error Message" in data:
                logger.error(f"Alpha Vantage error: {data['Error Message']}")
                return []

            raw_data = data.get("feed", [])
            if not raw_data:
                return []

            return self._process_articles(raw_data, ticker, preserve_all_tickers)

        except CircuitBreakerOpenError:
            logger.warning(f"[ALPHA_VANTAGE] Circuit breaker open for {ticker}")
            return []
        except Exception as e:
            logger.error(f"Error fetching from Alpha Vantage for {ticker}: {e}")
            return []

    async def fetch_batch(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        months_back: int = 6,
        max_batches: Optional[int] = None,
        preserve_all_tickers: bool = False,
        rate_limit_checker: Optional[callable] = None
    ) -> List[Dict]:
        """
        Fetch historical news in batches using pagination.

        Uses time_from and time_to parameters to paginate through history:
        - First call: time_from=N months ago, time_to=now, limit=1000
        - Subsequent calls: time_from=N months ago, time_to=earliest_from_previous
        - Stops when: earliest date >= target date OR no more results

        Args:
            session: aiohttp ClientSession
            ticker: Stock ticker symbol
            months_back: Number of months of historical data (default: 6)
            max_batches: Maximum batches to fetch (auto-determined if None)
            preserve_all_tickers: Preserve full ticker_sentiment array
            rate_limit_checker: Optional async function to check rate limits

        Returns:
            List of all news articles from the time period
        """
        if not self.is_available:
            return []

        all_articles = []
        now = datetime.now(timezone.utc)
        target_start_date = now - timedelta(days=months_back * 30)

        # Format for Alpha Vantage API: YYYYMMDDTHHMM
        time_from_str = target_start_date.strftime("%Y%m%dT%H%M")
        time_to_str = now.strftime("%Y%m%dT%H%M")

        batch_count = 0
        if max_batches is None:
            max_batches = self._get_max_batches_for_months(months_back)
        else:
            max_batches = min(max_batches, 200)  # Safety ceiling

        logger.info(
            f"[BATCH FETCH] Starting for {ticker} from "
            f"{target_start_date.date()} to {now.date()}"
        )

        while batch_count < max_batches:
            # Check rate limit if checker provided
            if rate_limit_checker:
                if not await rate_limit_checker():
                    logger.warning("[BATCH FETCH] Rate limit reached, waiting 60s")
                    await asyncio.sleep(60)
                    continue

            batch_count += 1
            logger.debug(f"[BATCH {batch_count}] Fetching {time_from_str} to {time_to_str}")

            # Politeness delay between requests
            if batch_count > 1:
                await asyncio.sleep(0.2)

            # Fetch batch
            batch_articles = await self.fetch_news(
                session,
                ticker,
                time_from=time_from_str,
                time_to=time_to_str,
                limit=1000,
                preserve_all_tickers=preserve_all_tickers
            )

            if not batch_articles:
                logger.debug(f"[BATCH {batch_count}] No more articles, stopping")
                break

            logger.debug(f"[BATCH {batch_count}] Fetched {len(batch_articles)} articles")

            # Find earliest date in this batch
            earliest_date = self._find_earliest_date(batch_articles)

            # Add to collection
            all_articles.extend(batch_articles)

            # Check if we've reached our target date
            if earliest_date and earliest_date <= target_start_date:
                logger.debug(
                    f"[BATCH FETCH] Reached target date: "
                    f"{earliest_date.date()} <= {target_start_date.date()}"
                )
                break

            # Update time_to for next batch
            if earliest_date:
                time_to_str = (earliest_date - timedelta(seconds=1)).strftime("%Y%m%dT%H%M")
            else:
                break

        logger.info(
            f"[BATCH FETCH] Completed! Total: {len(all_articles)} "
            f"articles across {batch_count} batches"
        )
        return all_articles

    def _process_articles(
        self,
        raw_data: List[Dict],
        ticker: str,
        preserve_all_tickers: bool
    ) -> List[Dict]:
        """Process raw API response into normalized article list."""
        news_list = []

        for article in raw_data:
            time_published = article.get("time_published", "")
            if not time_published:
                continue

            try:
                pub_datetime = datetime.strptime(time_published, "%Y%m%dT%H%M%S")
                pub_datetime = pub_datetime.replace(tzinfo=timezone.utc)
                pub_date = pub_datetime.strftime('%Y-%m-%d')
            except ValueError:
                continue

            body_content = article.get("summary", "")
            ticker_sentiments = article.get("ticker_sentiment", [])

            if preserve_all_tickers:
                # SECTOR MODE: Preserve all ticker sentiments
                processed_article = self._process_sector_article(
                    article, pub_date, pub_datetime, body_content, ticker_sentiments
                )
                if processed_article:
                    news_list.append(processed_article)
            else:
                # SINGLE TICKER MODE: Extract sentiment for queried ticker only
                processed_article = self._process_single_ticker_article(
                    article, ticker, pub_date, pub_datetime, body_content, ticker_sentiments
                )
                if processed_article:
                    news_list.append(processed_article)

        return news_list

    def _process_sector_article(
        self,
        article: Dict,
        pub_date: str,
        pub_datetime: datetime,
        body_content: str,
        ticker_sentiments: List[Dict]
    ) -> Optional[Dict]:
        """Process article for sector mode (preserve all tickers)."""
        processed_sentiments = []
        for ts in ticker_sentiments:
            try:
                processed_sentiments.append({
                    "ticker": ts.get("ticker", ""),
                    "ticker_sentiment_score": float(ts.get("ticker_sentiment_score", "0")),
                    "ticker_sentiment_label": ts.get("ticker_sentiment_label", "Neutral"),
                    "relevance_score": float(ts.get("relevance_score", "0")) if ts.get("relevance_score") else 0.0
                })
            except (ValueError, TypeError):
                continue

        overall_sentiment_score = article.get("overall_sentiment_score")
        if overall_sentiment_score is not None:
            try:
                overall_sentiment_score = float(overall_sentiment_score)
            except (ValueError, TypeError):
                overall_sentiment_score = 0.0
        else:
            overall_sentiment_score = 0.0

        return {
            "title": article.get("title"),
            "url": article.get("url"),
            "link": article.get("url"),  # Backward compatibility
            "source": article.get("source"),
            "provider": article.get("source"),  # Backward compatibility
            "source_domain": article.get("source_domain"),
            "time_published": article.get("time_published"),
            "publish_date": pub_date,
            "publish_timestamp": pub_datetime.isoformat(),
            "summary": body_content,
            "body": body_content,  # Backward compatibility
            "banner_image": article.get("banner_image"),
            "category_within_source": article.get("category_within_source"),
            "authors": article.get("authors", []),
            "ticker_sentiment": processed_sentiments,
            "overall_sentiment_score": overall_sentiment_score,
            "overall_sentiment_label": article.get("overall_sentiment_label", "Neutral"),
            "topics": article.get("topics", [])
        }

    def _process_single_ticker_article(
        self,
        article: Dict,
        ticker: str,
        pub_date: str,
        pub_datetime: datetime,
        body_content: str,
        ticker_sentiments: List[Dict]
    ) -> Optional[Dict]:
        """Process article for single ticker mode."""
        ticker_sentiment_score = None
        ticker_sentiment_label = "Neutral"
        ticker_relevance_score = None

        # Case-insensitive ticker matching
        for ts in ticker_sentiments:
            if ts.get("ticker", "").upper() == ticker.upper():
                try:
                    ticker_sentiment_score = float(ts.get("ticker_sentiment_score", "0"))
                except (ValueError, TypeError):
                    ticker_sentiment_score = 0.0

                ticker_sentiment_label = ts.get("ticker_sentiment_label", "Neutral")

                relevance_str = ts.get("relevance_score")
                if relevance_str is not None:
                    try:
                        ticker_relevance_score = float(relevance_str)
                    except (ValueError, TypeError):
                        ticker_relevance_score = None
                break

        # Skip articles without sentiment score for this ticker
        if ticker_sentiment_score is None:
            return None

        return {
            "title": article.get("title"),
            "link": article.get("url"),
            "provider": article.get("source"),
            "publish_date": pub_date,
            "publish_timestamp": pub_datetime.isoformat(),
            "body": body_content,
            "ticker_sentiment_score": ticker_sentiment_score,
            "ticker_sentiment_label": ticker_sentiment_label,
            "ticker_relevance_score": ticker_relevance_score,
            "image": article.get("banner_image"),
            "topics": article.get("topics", [])
        }

    def _find_earliest_date(self, articles: List[Dict]) -> Optional[datetime]:
        """Find the earliest publish date in a list of articles."""
        earliest_date = None
        for article in articles:
            pub_timestamp_str = article.get("publish_timestamp")
            if pub_timestamp_str:
                try:
                    pub_datetime = datetime.fromisoformat(pub_timestamp_str)
                    if earliest_date is None or pub_datetime < earliest_date:
                        earliest_date = pub_datetime
                except ValueError:
                    continue
        return earliest_date

    def _get_max_batches_for_months(self, months: float) -> int:
        """Determine appropriate max_batches based on months requested."""
        if months < 6:
            return 20
        elif months <= 12:
            return 50
        else:
            return 50  # Cap at 12 months worth


# Factory function for convenience
def create_alpha_vantage_provider(api_key: Optional[str] = None) -> AlphaVantageProvider:
    """Create an Alpha Vantage provider instance."""
    import os
    if api_key is None:
        api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    return AlphaVantageProvider(api_key)
