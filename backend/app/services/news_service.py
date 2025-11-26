# app/services/news_service.py

from datetime import datetime, timedelta, timezone
import logging
import os
from dotenv import load_dotenv
import asyncio
import aiohttp
import random
from bs4 import BeautifulSoup
import yfinance as yf
from typing import List, Dict, Tuple, Optional

# Import your existing model classes
from app.models import News, SentimentScore, RelevanceScore
from app.core.cache import async_cache_result, cache_result
from app.core.config import settings
from app.core.http_client import http_client
from app.services.sector_service import sector_service_instance
from app.services.sector_sentiment_service import sector_sentiment_service
from app.config.yfinance_sector_mapping import (
    is_all_sectors_identifier,
)


logger = logging.getLogger(__name__)


class NewsService:
    """
    A service to fetch financial news articles from Alpha Vantage API.
    """
    _instance = None

    def __new__(cls):
        # The singleton pattern ensures we only ever have one instance of this class.
        if cls._instance is None:
            print("Creating NewsService instance...")
            cls._instance = super(NewsService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initializes the service and loads API keys."""
        load_dotenv()
        self.alpha_vantage_api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        self.finnhub_api_token = os.getenv("FINNHUB_API_TOKEN")
        self.news_api_key = os.getenv("NEWS_API_KEY")
        self.marketaux_api_key = os.getenv("MARKETAUX_API_KEY")

        if not self.alpha_vantage_api_key:
            print("WARNING: ALPHA_VANTAGE_API_KEY not found. Alpha Vantage news will be disabled.")
        else:
            print("Alpha Vantage API key loaded successfully.")

        if not self.finnhub_api_token:
            print("WARNING: FINNHUB_API_TOKEN not found. Finnhub fallback will be disabled.")
        if not self.news_api_key:
            print("WARNING: NEWS_API_KEY not found. NewsAPI fallback will be disabled.")
        if not self.marketaux_api_key:
            print("WARNING: MARKETAUX_API_KEY not found. MarketAux fallback will be disabled.")

        # User agents for web scraping
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
        ]

        # Track active background fetch tasks to prevent duplicates
        # Format: {ticker}:{timeframe} -> asyncio.Task
        self._active_fetch_tasks = {}

    async def _fetch_alpha_vantage_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        time_from: str = None,
        time_to: str = None,
        limit: int = 1000,
        preserve_all_tickers: bool = False
    ) -> list[dict]:
        """
        Fetches news from Alpha Vantage NEWS_SENTIMENT API with ticker sentiment scores.

        Args:
            session: aiohttp ClientSession for async requests
            ticker: Stock ticker symbol (in yfinance format)
            time_from: Optional start time in format "YYYYMMDDTHHMM" (e.g., "20240101T0000")
            time_to: Optional end time in format "YYYYMMDDTHHMM" (e.g., "20240630T2359")
            limit: Maximum number of articles to return (default: 1000, max: 1000)
            preserve_all_tickers: If True, preserves full ticker_sentiment array for multi-ticker processing.
                                 If False, only includes sentiment for the queried ticker (default behavior).

        Returns:
            List of news article dictionaries with sentiment scores
            Returns empty list if rate limited or API error occurs
        """
        if not self.alpha_vantage_api_key:
            return []

        try:
            # Build URL with optional time parameters
            url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit={limit}&tickers={ticker}&apikey={self.alpha_vantage_api_key}"

            if time_from:
                url += f"&time_from={time_from}"
            if time_to:
                url += f"&time_to={time_to}"

            async with session.get(url, timeout=30) as response:
                response.raise_for_status()
                data = await response.json()

                # Check for rate limit or API error messages
                if "Note" in data:
                    print(f"Alpha Vantage rate limit hit: {data['Note']}")
                    return []
                if "Information" in data:
                    print(f"Alpha Vantage information message: {data['Information']}")
                    return []
                if "Error Message" in data:
                    print(f"Alpha Vantage error: {data['Error Message']}")
                    return []

                raw_data = data.get("feed", [])

                if not raw_data:
                    return []

                news_list = []
                for article in raw_data:
                    # Parse publish date and timestamp
                    time_published = article.get("time_published", "")
                    if not time_published:
                        continue

                    try:
                        # Parse the full datetime with timezone awareness
                        pub_datetime = datetime.strptime(time_published, "%Y%m%dT%H%M%S")
                        pub_datetime = pub_datetime.replace(tzinfo=timezone.utc)
                        pub_date = pub_datetime.strftime('%Y-%m-%d')
                    except ValueError:
                        continue

                    ticker_sentiments = article.get("ticker_sentiment", [])

                    # Use Alpha Vantage's summary instead of web scraping
                    body_content = article.get("summary", "")

                    if preserve_all_tickers:
                        # SECTOR MODE: Preserve all ticker sentiments for multi-ticker processing
                        # Convert all ticker sentiment scores to floats for easier processing
                        processed_ticker_sentiments = []
                        for ts in ticker_sentiments:
                            try:
                                processed_ts = {
                                    "ticker": ts.get("ticker", ""),
                                    "ticker_sentiment_score": float(ts.get("ticker_sentiment_score", "0")),
                                    "ticker_sentiment_label": ts.get("ticker_sentiment_label", "Neutral"),
                                    "relevance_score": float(ts.get("relevance_score", "0")) if ts.get("relevance_score") else 0.0
                                }
                                processed_ticker_sentiments.append(processed_ts)
                            except (ValueError, TypeError):
                                continue

                        # Get overall sentiment from article
                        overall_sentiment_score = article.get("overall_sentiment_score")
                        overall_sentiment_label = article.get("overall_sentiment_label", "Neutral")
                        
                        # Convert overall_sentiment_score to float if it exists
                        if overall_sentiment_score is not None:
                            try:
                                overall_sentiment_score = float(overall_sentiment_score)
                            except (ValueError, TypeError):
                                overall_sentiment_score = 0.0
                        else:
                            overall_sentiment_score = 0.0

                        # Include article with normalized field names for frontend compatibility
                        news_list.append({
                            "title": article.get("title"),
                            "url": article.get("url"),  # Normalized from 'link' to 'url'
                            "link": article.get("url"),  # Keep for backwards compatibility
                            "source": article.get("source"),  # Normalized from 'provider' to 'source'
                            "provider": article.get("source"),  # Keep for backwards compatibility
                            "source_domain": article.get("source_domain"),  # Add for modal
                            "time_published": time_published,  # Add for CompactNewsCard
                            "publish_date": pub_date,
                            "publish_timestamp": pub_datetime.isoformat(),
                            "summary": body_content,  # Normalized from 'body' to 'summary'
                            "body": body_content,  # Keep for backwards compatibility
                            "banner_image": article.get("banner_image"),
                            "category_within_source": article.get("category_within_source"),  # Add for modal
                            "authors": article.get("authors", []),  # Add for modal
                            "ticker_sentiment": processed_ticker_sentiments,  # Full array!
                            "overall_sentiment_score": overall_sentiment_score,  # Add for CompactNewsCard
                            "overall_sentiment_label": overall_sentiment_label,  # Add for CompactNewsCard
                            "topics": article.get("topics", [])
                        })
                    else:
                        # SINGLE TICKER MODE: Extract sentiment for queried ticker only (original behavior)
                        ticker_sentiment_score = None
                        ticker_sentiment_label = "Neutral"
                        ticker_relevance_score = None

                        # Case-insensitive ticker matching
                        for ts in ticker_sentiments:
                            if ts.get("ticker", "").upper() == ticker.upper():
                                # Convert string score to float
                                score_str = ts.get("ticker_sentiment_score", "0")
                                try:
                                    ticker_sentiment_score = float(score_str)
                                except (ValueError, TypeError):
                                    ticker_sentiment_score = 0.0

                                ticker_sentiment_label = ts.get("ticker_sentiment_label", "Neutral")

                                # Extract relevance score if available
                                relevance_str = ts.get("relevance_score")
                                if relevance_str is not None:
                                    try:
                                        ticker_relevance_score = float(relevance_str)
                                    except (ValueError, TypeError):
                                        ticker_relevance_score = None

                                break

                        # Skip articles without sentiment score for this ticker
                        if ticker_sentiment_score is None:
                            continue

                        news_list.append({
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
                        })

                return news_list

        except Exception as e:
            print(f"Error fetching news from Alpha Vantage for {ticker}: {e}")
            return []

    async def _check_rate_limit(self) -> bool:
        """
        Check and enforce Alpha Vantage rate limits (300 calls/minute).
        Uses Redis to track API calls per minute.

        Returns:
            True if rate limit is ok, False if limit exceeded
        """
        from app.core.cache import redis_cache

        if not redis_cache.async_client:
            # If Redis not available, proceed without rate limiting
            return True

        try:
            rate_limit_key = "alpha_vantage:rate_limit:calls_per_minute"
            current_calls = await redis_cache.async_client.get(rate_limit_key)

            if current_calls is None:
                # First call in this minute
                await redis_cache.async_client.setex(rate_limit_key, 60, 1)
                return True

            calls_count = int(current_calls)
            if calls_count >= 300:
                print(f"[RATE LIMIT] Alpha Vantage rate limit hit: {calls_count}/300 calls per minute")
                return False

            # Increment counter
            await redis_cache.async_client.incr(rate_limit_key)
            return True

        except Exception as e:
            print(f"Error checking rate limit: {e}")
            return True  # Proceed if rate check fails

    async def _fetch_alpha_vantage_batch(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        months_back: int = 6,
        max_batches: int = None,
        preserve_all_tickers: bool = False
    ) -> list[dict]:
        """
        Fetches historical news from Alpha Vantage in batches until we have {months_back} months of data.

        Uses pagination with time_from and time_to parameters:
        - First call: time_from=6 months ago, time_to=now, limit=1000
        - Subsequent calls: time_from=6 months ago, time_to=earliest_date_from_previous_batch, limit=1000
        - Stops when: earliest date >= 6 months ago OR no more results

        Args:
            session: aiohttp ClientSession for async requests
            ticker: Stock ticker symbol
            months_back: Number of months of historical data to fetch (default: 6)
            max_batches: Maximum number of batches to fetch (default: auto-determined by months_back)
            preserve_all_tickers: If True, preserves full ticker_sentiment array for multi-ticker processing (sector mode)

        Returns:
            List of all news articles from the time period
        """
        if not self.alpha_vantage_api_key:
            return []

        all_articles = []
        now = datetime.now(timezone.utc)
        target_start_date = now - timedelta(days=months_back * 30)  # Approximate months to days

        # Format for Alpha Vantage API: YYYYMMDDTHHMM
        time_from_str = target_start_date.strftime("%Y%m%dT%H%M")
        time_to_str = now.strftime("%Y%m%dT%H%M")

        batch_count = 0
        # Auto-determine max_batches if not provided, with safety ceiling
        if max_batches is None:
            max_batches = self._get_max_batches_for_months(months_back)
        else:
            # Safety ceiling to prevent runaway requests
            max_batches = min(max_batches, 200)

        print(f"[BATCH FETCH] Starting batch fetch for {ticker} from {target_start_date.date()} to {now.date()}")

        while batch_count < max_batches:
            # Check rate limit before making API call
            if not await self._check_rate_limit():
                print(f"[BATCH FETCH] Rate limit reached, waiting 60 seconds...")
                await asyncio.sleep(60)
                continue

            batch_count += 1
            print(f"[BATCH {batch_count}] Fetching from {time_from_str} to {time_to_str}")

            # Add small delay between requests to be polite
            if batch_count > 1:
                await asyncio.sleep(0.2)  # 200ms delay

            # Fetch batch
            batch_articles = await self._fetch_alpha_vantage_news(
                session,
                ticker,
                time_from=time_from_str,
                time_to=time_to_str,
                limit=1000,
                preserve_all_tickers=preserve_all_tickers
            )

            if not batch_articles:
                print(f"[BATCH {batch_count}] No more articles returned, stopping")
                break

            print(f"[BATCH {batch_count}] Fetched {len(batch_articles)} articles")

            # Find earliest date in this batch
            earliest_date = None
            for article in batch_articles:
                pub_timestamp_str = article.get("publish_timestamp")
                if pub_timestamp_str:
                    try:
                        pub_datetime = datetime.fromisoformat(pub_timestamp_str)
                        if earliest_date is None or pub_datetime < earliest_date:
                            earliest_date = pub_datetime
                    except ValueError:
                        continue

            # Add articles to collection
            all_articles.extend(batch_articles)

            # Check if we've reached our target date
            if earliest_date and earliest_date <= target_start_date:
                print(f"[BATCH FETCH] Reached target date: {earliest_date.date()} <= {target_start_date.date()}")
                break

            # Only stop if we got ZERO articles (truly no more data)
            # Don't stop just because we got < 1000 - there may be more historical data
            if len(batch_articles) == 0:
                print(f"[BATCH FETCH] No articles returned, stopping")
                break

            # Update time_to for next batch
            if earliest_date:
                # Set time_to to one second before earliest article in this batch
                time_to_str = (earliest_date - timedelta(seconds=1)).strftime("%Y%m%dT%H%M")
            else:
                # Can't continue without an earliest date
                break

        print(f"[BATCH FETCH] Completed! Total articles: {len(all_articles)} across {batch_count} batches")
        return all_articles

    async def _scrape_article_content(self, session: aiohttp.ClientSession, url: str) -> str:
        """
        Asynchronously scrapes the main content from a given news article URL.
        Includes rate-limiting politeness delay and user-agent rotation.
        """
        if not url:
            return ""
        try:
            # Politeness delay to avoid overwhelming servers
            await asyncio.sleep(random.uniform(0.5, 1.5))

            headers = {
                'User-Agent': random.choice(self.user_agents)
            }
            async with session.get(url, headers=headers, timeout=15) as response:
                if response.status >= 400:
                    print(f"Failed to scrape {url} with status {response.status}")
                    return ""
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                paragraphs = soup.find_all('p')
                article_text = ' '.join([p.get_text() for p in paragraphs])
                return article_text.strip()
        except asyncio.TimeoutError:
            print(f"Timeout error when scraping {url}")
            return ""
        except aiohttp.ClientError as e:
            print(f"Client error scraping {url}: {e}")
            return ""
        except Exception as e:
            print(f"Generic error scraping {url}: {e}")
            return ""

    def _get_yfinance_news_sync(self, ticker: str, count: int):
        """Helper for running blocking yfinance calls in a thread."""
        ticker_obj = yf.Ticker(ticker)
        return ticker_obj.get_news(count=count)

    async def _fetch_yfinance_news(self, session: aiohttp.ClientSession, ticker: str, count: int, start_date: datetime.date, today: datetime.date) -> list[dict]:
        """Fetches and processes news from Yahoo Finance asynchronously."""
        try:
            raw_news = await asyncio.to_thread(self._get_yfinance_news_sync, ticker, count)
            if not raw_news:
                return []

            news_list = []
            scrape_tasks = []
            articles_to_process = []

            for article in raw_news:
                content = article.get("content", article) if isinstance(article, dict) else None
                if not content:
                    continue

                pub_date_str = content.get("pubDate") or content.get("providerPublishTime")
                if not pub_date_str:
                    continue

                try:
                    if isinstance(pub_date_str, str) and 'T' in pub_date_str:
                        pub_datetime = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00'))
                        pub_date = pub_datetime.date()
                    elif isinstance(pub_date_str, (int, float)):
                        pub_datetime = datetime.fromtimestamp(pub_date_str)
                        pub_date = pub_datetime.date()
                    else:
                        continue
                except Exception:
                    continue

                # Filter by date range
                if start_date <= pub_date <= today:
                    link = content.get("previewUrl") or content.get("link")
                    articles_to_process.append((content, pub_date, pub_datetime, link))
                    scrape_tasks.append(self._scrape_article_content(session, link))

            scraped_contents = await asyncio.gather(*scrape_tasks)

            for i, (content, pub_date, pub_datetime, link) in enumerate(articles_to_process):
                provider_info = content.get("provider") or {}
                provider_name = provider_info.get("displayName", "Unknown") if isinstance(provider_info, dict) else content.get("publisher", "Unknown")
                body_content = scraped_contents[i] or content.get("summary", "")

                news_list.append({
                    "title": content.get("title"),
                    "link": link,
                    "provider": provider_name,
                    "publish_date": pub_date.strftime("%Y-%m-%d"),
                    "publish_timestamp": pub_datetime.isoformat(),
                    "body": body_content
                })
            return news_list
        except Exception as e:
            print(f"Error fetching news from yfinance for {ticker}: {e}")
            return []

    async def _fetch_finnhub_news(self, session: aiohttp.ClientSession, ticker: str, start_date_str: str, end_date_str: str) -> list[dict]:
        """Fetches and processes news from Finnhub asynchronously."""
        if not self.finnhub_api_token:
            return []

        try:
            url = f"https://finnhub.io/api/v1/company-news?symbol={ticker}&from={start_date_str}&to={end_date_str}&token={self.finnhub_api_token}"
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                raw_news = await response.json()
                if not raw_news:
                    return []

                scrape_tasks = [(article, self._scrape_article_content(session, article.get("url"))) for article in raw_news]

                results = await asyncio.gather(*(task for _, task in scrape_tasks))

                news_list = []
                for i, (article, _) in enumerate(scrape_tasks):
                    timestamp = article.get("datetime")
                    pub_datetime = datetime.fromtimestamp(timestamp)
                    body_content = results[i] or article.get("summary", "")
                    news_list.append({
                        "title": article.get("headline"),
                        "link": article.get("url"),
                        "provider": article.get("source"),
                        "publish_date": pub_datetime.strftime('%Y-%m-%d'),
                        "publish_timestamp": pub_datetime.isoformat(),
                        "body": body_content
                    })
                return news_list
        except Exception as e:
            print(f"Error fetching news from Finnhub for {ticker}: {e}")
            return []

    async def _fetch_newsapi_news(self, session: aiohttp.ClientSession, ticker: str, start_date_str: str, end_date_str: str) -> list[dict]:
        """Fetches and processes news from NewsAPI.org asynchronously."""
        if not self.news_api_key:
            return []

        try:
            url = f"https://newsapi.org/v2/everything?q={ticker}&from={start_date_str}&to={end_date_str}&sortBy=publishedAt&apiKey={self.news_api_key}"
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                raw_data = (await response.json()).get("articles", [])
                if not raw_data:
                    return []

                scrape_tasks = [(article, self._scrape_article_content(session, article.get("url"))) for article in raw_data]
                results = await asyncio.gather(*(task for _, task in scrape_tasks))

                news_list = []
                for i, (article, _) in enumerate(scrape_tasks):
                    pub_date_iso = article.get("publishedAt")
                    if pub_date_iso:
                        pub_datetime = datetime.fromisoformat(pub_date_iso.replace('Z', '+00:00'))
                        pub_date = pub_datetime.strftime('%Y-%m-%d')
                    else:
                        continue

                    body_content = results[i] or article.get("description", "")
                    news_list.append({
                        "title": article.get("title"),
                        "link": article.get("url"),
                        "provider": article.get("source", {}).get("name", "Unknown"),
                        "publish_date": pub_date,
                        "publish_timestamp": pub_datetime.isoformat(),
                        "body": body_content
                    })
                return news_list
        except Exception as e:
            print(f"Error fetching news from NewsAPI for {ticker}: {e}")
            return []

    async def _fetch_marketaux_news(self, session: aiohttp.ClientSession, ticker: str, start_date_str: str) -> list[dict]:
        """Fetches and processes news from MarketAux asynchronously."""
        if not self.marketaux_api_key:
            return []

        try:
            url = f"https://api.marketaux.com/v1/news/all?symbols={ticker}&published_after={start_date_str}&api_token={self.marketaux_api_key}"
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                raw_data = (await response.json()).get("data", [])
                if not raw_data:
                    return []

                scrape_tasks = [(article, self._scrape_article_content(session, article.get("url"))) for article in raw_data]
                results = await asyncio.gather(*(task for _, task in scrape_tasks))

                news_list = []
                for i, (article, _) in enumerate(scrape_tasks):
                    pub_date_iso = article.get("published_at")
                    if pub_date_iso:
                        pub_datetime = datetime.fromisoformat(pub_date_iso)
                        pub_date = pub_datetime.strftime('%Y-%m-%d')
                    else:
                        continue

                    body_content = results[i] or article.get("snippet", "")
                    news_list.append({
                        "title": article.get("title"),
                        "link": article.get("url"),
                        "provider": article.get("source"),
                        "publish_date": pub_date,
                        "publish_timestamp": pub_datetime.isoformat(),
                        "body": body_content
                    })
                return news_list
        except Exception as e:
            print(f"Error fetching news from MarketAux for {ticker}: {e}")
            return []

    def _get_max_batches_for_months(self, months: float) -> int:
        """
        Determines appropriate max_batches based on months of historical data requested.

        Batching strategy:
        - Short timeframes (< 6 months): 20 batches (20,000 articles max)
        - Medium timeframes (6-12 months): 50 batches (50,000 articles max)

        Args:
            months: Number of months of historical data requested

        Returns:
            Maximum number of batches to fetch
        """
        if months < 6:
            return 20
        elif months <= 12:
            return 50
        else:
            # Cap at 12 months
            return 50

    def _get_timeframe_months(self, timeframe: str, is_sector: bool = False) -> float:
        """
        Convert timeframe string to number of months for data fetching.
        
        Strategy for ENTITIES (stocks): Always fetch 1Y (12 months) worth of data for all timeframes.
        This ensures consistent data availability and better caching efficiency.
        The filtering to the actual timeframe is done in the API layer.
        
        Strategy for SECTORS: Fetch 2M worth of data to ensure better historical coverage.
        Even though exponential decay makes news >10 days old irrelevant (<0.1% weight),
        we fetch 2 months to ensure we have continuous data for the past month, accounting
        for gaps in news coverage and API data availability.
        
        Args:
            timeframe: Timeframe string ('1D', '1W', '1M', etc.)
            is_sector: If True, fetch 2M of data for better historical coverage
        """
        # SECTOR MODE: Fetch 2M of data to ensure full 1M coverage with gaps
        # This provides better historical coverage while respecting exponential decay limits
        if is_sector:
            return 2  # Fetch 2 months for sectors to ensure complete 1M coverage
        
        # ENTITY MODE: For all timeframes (1D, 1W, 1M, 3M, 6M, YTD, 1Y, 5Y, 10Y, MAX), fetch 1Y
        # This provides:
        # - Consistent data availability across all timeframes
        # - Better cache reuse (same data for multiple timeframes)
        # - Minimal API calls (1Y is optimal batch size)
        # - Fast response times even for 5Y+ timeframes
        return 12

    def _get_cache_ttl_for_timeframe(self, timeframe: str) -> int:
        """Get appropriate cache TTL based on timeframe."""
        ttl_map = {
            '1D': 300,      # 5 minutes
            '1W': 600,      # 10 minutes
            '1M': 600,      # 10 minutes
            '3M': 1800,     # 30 minutes
            '6M': 3600,     # 1 hour
            'YTD': 14400,   # 4 hours
            '1Y': 43200,    # 12 hours
        }
        return ttl_map.get(timeframe, settings.NEWS_CACHE_TTL)

    async def _background_fetch_for_timeframe(
        self,
        ticker: str,
        timeframe: str,
        next_timeframe: str = None
    ):
        """
        Background task to fetch news for a specific timeframe.
        After completion, optionally triggers fetch for next timeframe.

        Args:
            ticker: Stock ticker symbol
            timeframe: Current timeframe to fetch (e.g., '6M')
            next_timeframe: Next timeframe to queue (e.g., 'YTD')
        """
        from app.core.cache import redis_cache

        task_key = f"{ticker}:{timeframe}"

        try:
            print(f"[PROGRESSIVE FETCH] Starting background fetch for {ticker} - {timeframe}")

            # Set progress status
            if redis_cache.async_client:
                await redis_cache.aset(
                    f"fetch_progress:{ticker}:{timeframe}",
                    {"status": "in_progress", "started_at": datetime.now(timezone.utc).isoformat()},
                    ttl=3600
                )

            # Calculate months to fetch
            months = self._get_timeframe_months(timeframe)

            # Fetch data with appropriate max_batches for timeframe
            session = await http_client.get_session()
            articles = await self._fetch_alpha_vantage_batch(session, ticker, months_back=months)

            if articles:
                # Store in cache with timeframe-specific TTL
                cache_key = f"ticker_news:{ticker}:{timeframe}"
                ttl = self._get_cache_ttl_for_timeframe(timeframe)

                if redis_cache.async_client:
                    await redis_cache.aset(cache_key, articles, ttl=ttl)
                    print(f"[PROGRESSIVE FETCH] Cached {len(articles)} articles for {ticker} - {timeframe}")

                    # Mark as complete
                    await redis_cache.aset(
                        f"fetch_progress:{ticker}:{timeframe}",
                        {
                            "status": "complete",
                            "completed_at": datetime.now(timezone.utc).isoformat(),
                            "article_count": len(articles)
                        },
                        ttl=3600
                    )

                # Trigger next timeframe if specified
                if next_timeframe:
                    print(f"[PROGRESSIVE FETCH] Queueing next timeframe: {next_timeframe}")
                    await self.trigger_progressive_fetch(ticker, next_timeframe)

        except Exception as e:
            print(f"[PROGRESSIVE FETCH] Error fetching {ticker} - {timeframe}: {e}")
            if redis_cache.async_client:
                await redis_cache.aset(
                    f"fetch_progress:{ticker}:{timeframe}",
                    {"status": "error", "error": str(e), "failed_at": datetime.now(timezone.utc).isoformat()},
                    ttl=3600
                )
        finally:
            # Remove from active tasks
            if task_key in self._active_fetch_tasks:
                del self._active_fetch_tasks[task_key]

    async def trigger_progressive_fetch(
        self,
        ticker: str,
        timeframe: str,
        force: bool = False
    ):
        """
        Trigger progressive background fetching for a timeframe and queue subsequent timeframes.

        Fetching order: 1M → 6M → YTD → 1Y

        Args:
            ticker: Stock ticker symbol
            timeframe: Requested timeframe
            force: Force fetch even if already cached or in progress
        """
        from app.core.cache import redis_cache

        # Define progressive fetch order
        timeframe_progression = {
            '1D': None,      # Too small, use real-time only
            '1W': None,      # Too small, use real-time only
            '1M': '6M',
            '3M': '6M',
            '6M': 'YTD',
            'YTD': '1Y',
            '1Y': None,      # End of chain - no fetching beyond 1Y
        }

        task_key = f"{ticker}:{timeframe}"

        # Check if already cached (unless force=True)
        if not force and redis_cache.async_client:
            cache_key = f"ticker_news:{ticker}:{timeframe}"
            cached = await redis_cache.aget(cache_key)
            if cached:
                print(f"[PROGRESSIVE FETCH] {ticker} - {timeframe} already cached, skipping")

                # Still queue next timeframe if not in progress
                next_tf = timeframe_progression.get(timeframe)
                if next_tf:
                    await self.trigger_progressive_fetch(ticker, next_tf, force=False)
                return

        # Check if already in progress
        if task_key in self._active_fetch_tasks:
            task = self._active_fetch_tasks[task_key]
            if not task.done():
                print(f"[PROGRESSIVE FETCH] {ticker} - {timeframe} already in progress, skipping")
                return

        # Get next timeframe in progression
        next_timeframe = timeframe_progression.get(timeframe)

        # Start background task
        task = asyncio.create_task(
            self._background_fetch_for_timeframe(ticker, timeframe, next_timeframe)
        )
        self._active_fetch_tasks[task_key] = task

        print(f"[PROGRESSIVE FETCH] Queued background fetch for {ticker} - {timeframe}")

    async def get_ticker_news_for_timeframe(
        self,
        ticker: str,
        timeframe: str = '1M',
        trigger_progressive: bool = True,
        preserve_all_tickers: bool = False,
        is_sector: bool = False
    ) -> list[dict]:
        """
        Get news for a ticker with timeframe-specific caching and progressive background fetching.

        Args:
            ticker: Stock ticker symbol
            timeframe: Timeframe filter ('1D', '1W', '1M', '3M', '6M', 'YTD', '1Y')
            trigger_progressive: Whether to trigger background fetch for future timeframes
            preserve_all_tickers: If True, preserves full ticker_sentiment array for multi-ticker processing (sector mode)
            is_sector: If True, only fetch the requested timeframe (for sector exponential decay)

        Returns:
            List of news articles for the timeframe (may return partial data while fetching)
        """
        from app.core.cache import redis_cache

        cache_key = f"ticker_news:{ticker}:{timeframe}"

        # Try to get from cache first
        if redis_cache.async_client:
            cached = await redis_cache.aget(cache_key)
            if cached:
                print(f"[CACHE HIT] {cache_key} - {len(cached)} articles")

                # Trigger progressive fetch in background
                if trigger_progressive:
                    asyncio.create_task(self.trigger_progressive_fetch(ticker, timeframe))

                return cached

        print(f"[CACHE MISS] {cache_key}")

        # Not in cache - fetch based on timeframe
        months = self._get_timeframe_months(timeframe, is_sector=is_sector)
        print(f"[NEWS FETCH] Fetching {months} months of data for {ticker} (timeframe: {timeframe}, is_sector: {is_sector})")

        session = await http_client.get_session()
        # Always use batch fetch to get sufficient data (1Y for most timeframes, 5Y for 5Y)
        # The filtering to the actual timeframe is done in the API layer
        articles = await self._fetch_alpha_vantage_batch(
            session,
            ticker,
            months_back=months,
            preserve_all_tickers=preserve_all_tickers
        )

        print(f"[NEWS FETCH] Retrieved {len(articles) if articles else 0} articles for {ticker}")

        # Cache the result
        if redis_cache.async_client and articles:
            ttl = self._get_cache_ttl_for_timeframe(timeframe)
            await redis_cache.aset(cache_key, articles, ttl=ttl)
            print(f"[CACHE SET] Cached {len(articles)} articles with TTL {ttl}s for {cache_key}")

        # Trigger progressive fetch for next timeframe
        if trigger_progressive:
            asyncio.create_task(self.trigger_progressive_fetch(ticker, timeframe))

        return articles

    @async_cache_result(ttl=settings.NEWS_CACHE_TTL, key_prefix="ticker_news")
    async def get_ticker_news(self, ticker: str, count: int = 1000) -> list[dict]:
        """
        Gets news for a ticker, prioritizing Alpha Vantage but falling back to other sources if needed.

        Strategy:
        1. Try Alpha Vantage first (best sentiment scores)
        2. If rate limited or no results, fall back to aggregating from multiple sources

        Args:
            ticker: Stock ticker symbol
            count: Maximum number of articles (default 1000, Alpha Vantage limit)

        Returns:
            List of news articles with ticker_sentiment_score included (if from Alpha Vantage)
        """
        session = await http_client.get_session()
        # Try Alpha Vantage first
        news_articles = await self._fetch_alpha_vantage_news(session, ticker)

        # Check if we should fall back to old methods
        should_fallback = False

        if not news_articles:
            print(f"Alpha Vantage returned no articles for {ticker}. Falling back to multi-source aggregation.")
            should_fallback = True

        # If Alpha Vantage failed or returned no results, use fallback sources
        if should_fallback:
            print(f"Using fallback news sources for {ticker}...")
            today = datetime.now(timezone.utc).date()
            # Extend to 90 days to fetch maximum amount of news
            ninety_days_ago = today - timedelta(days=89)
            start_date_str = ninety_days_ago.strftime("%Y-%m-%d")
            end_date_str = today.strftime("%Y-%m-%d")

            # Fetch from all fallback sources concurrently
            tasks = [
                self._fetch_yfinance_news(session, ticker, count, ninety_days_ago, today),
                self._fetch_finnhub_news(session, ticker, start_date_str, end_date_str),
                self._fetch_newsapi_news(session, ticker, start_date_str, end_date_str),
                self._fetch_marketaux_news(session, ticker, start_date_str)
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Organize news by source and find earliest date per source
            source_news = {
                'yfinance': [],
                'finnhub': [],
                'newsapi': [],
                'marketaux': []
            }
            source_names = ['yfinance', 'finnhub', 'newsapi', 'marketaux']

            for idx, res in enumerate(results):
                if isinstance(res, list) and res:
                    source_news[source_names[idx]] = res
                elif not isinstance(res, list):
                    print(f"An error occurred in {source_names[idx]} fetch task: {res}")

            # Find the earliest date from each source
            earliest_dates_per_source = {}
            for source_name, articles in source_news.items():
                if articles:
                    dates = []
                    for article in articles:
                        try:
                            pub_date = datetime.strptime(article.get("publish_date", ""), "%Y-%m-%d").date()
                            dates.append(pub_date)
                        except (ValueError, TypeError):
                            continue

                    if dates:
                        earliest_date = min(dates)
                        earliest_dates_per_source[source_name] = earliest_date.strftime("%Y-%m-%d")
                        print(f"{source_name}: {len(articles)} articles, earliest: {earliest_date}")

            # Combine and deduplicate news from all sources (no filtering)
            all_news = {}
            combined_sources = []

            for articles in source_news.values():
                combined_sources.extend(articles)

            for article in combined_sources:
                if article and article.get("title"):
                    key = article["title"].lower().strip()
                    if key not in all_news:
                        all_news[key] = article

            news_articles = list(all_news.values())

            # Store earliest dates metadata for the frontend
            if news_articles and earliest_dates_per_source:
                # Add metadata to each article about source coverage
                for article in news_articles:
                    article['_source_earliest_dates'] = earliest_dates_per_source

            print(f"Fetched and combined {len(news_articles)} unique news articles for {ticker} from fallback sources.")
            if earliest_dates_per_source:
                print(f"Source coverage earliest dates: {earliest_dates_per_source}")
        else:
            print(f"Fetched {len(news_articles)} news articles for {ticker} from Alpha Vantage.")

        # Sort by date, newest first
        sorted_news = sorted(news_articles, key=lambda x: x['publish_date'], reverse=True)

        # Limit to requested count
        limited_news = sorted_news[:count]

        return limited_news

    async def fetch_news_around_date(
        self,
        ticker: str,
        target_date: str,
        window: int = 2,
        count: int = 20
    ) -> list[dict]:
        """
        Fetches news articles around a specific date from Alpha Vantage.
        Results are cached in Redis for NEWS_CACHE_TTL seconds.

        Args:
            ticker: Stock ticker symbol
            target_date: Target date in "YYYY-MM-DD" format
            window: Number of days before and after to search
            count: Maximum number of articles to return

        Returns:
            List of news articles near the target date
        """
        try:
            # Fetch all news from Alpha Vantage
            all_news = await self.get_ticker_news(ticker)
            if not all_news:
                return []

            target = datetime.strptime(target_date, "%Y-%m-%d").date()
            start_date = target - timedelta(days=window)
            end_date = target + timedelta(days=window)

            # Filter by date range
            filtered_news = []
            for article in all_news:
                pub_date_str = article.get("publish_date")
                if not pub_date_str:
                    continue

                try:
                    pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date()
                except ValueError:
                    continue

                if start_date <= pub_date <= end_date:
                    filtered_news.append(article)

            return filtered_news[:count]

        except Exception as e:
            print(f"Error fetching news around date for {ticker}: {e}")
            return []

    def _deduplicate_articles(self, articles: List[dict]) -> Tuple[List[dict], Dict[str, int]]:
        """
        Deduplicates articles using both URL and normalized title.

        Deduplication strategy:
        1. Primary: URL-based (exact match, case-insensitive)
        2. Secondary: Title-based (normalized, case-insensitive, whitespace stripped)

        Args:
            articles: List of article dictionaries

        Returns:
            Tuple of (unique_articles, dedup_stats) where dedup_stats contains:
            - url_duplicates_removed: Number of duplicates found by URL
            - title_duplicates_removed: Number of duplicates found by title
            - total_duplicates_removed: Total duplicates removed
        """
        seen_urls = set()
        seen_titles = set()
        unique_articles = []

        url_dupes = 0
        title_dupes = 0

        for article in articles:
            url = article.get('url', '').strip().lower()
            title = article.get('title', '').strip().lower()

            # Skip articles without both URL and title
            if not url and not title:
                continue

            # Check URL first (primary deduplication)
            if url and url in seen_urls:
                url_dupes += 1
                continue

            # Check title if URL is new or missing (secondary deduplication)
            if title and title in seen_titles:
                title_dupes += 1
                continue

            # Article is unique - add to result and trackers
            unique_articles.append(article)

            if url:
                seen_urls.add(url)
            if title:
                seen_titles.add(title)

        stats = {
            'url_duplicates_removed': url_dupes,
            'title_duplicates_removed': title_dupes,
            'total_duplicates_removed': url_dupes + title_dupes
        }

        return unique_articles, stats

    async def _assemble_sector_news_response(
        self,
        response_sector_key: str,
        display_name: str,
        tickers: List[str],
        sector_timeframe: str,
        limit: int,
    market_weight_coverage: Optional[float] = None
    ) -> Dict[str, any]:
        """Fetches and aggregates news for a provided ticker basket."""

        if not tickers:
            raise ValueError("No tickers available for sector aggregation.")

        print(
            f"Aggregating news for '{display_name}' (key: {response_sector_key}) with {len(tickers)} tickers"
        )

        failed_tickers: List[str] = []
        successful_tickers: List[str] = []
        all_articles: List[dict] = []

        batch_size = 10
        total_batches = (len(tickers) + batch_size - 1) // batch_size

        for index in range(0, len(tickers), batch_size):
            batch = tickers[index:index + batch_size]
            print(f"Fetching batch {index // batch_size + 1}/{total_batches}: {batch}")

            tasks = [
                self.get_ticker_news_for_timeframe(
                    ticker=ticker,
                    timeframe=sector_timeframe,
                    trigger_progressive=False,
                    preserve_all_tickers=True,
                    is_sector=True
                )
                for ticker in batch
            ]

            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for ticker, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    print(f"WARNING: Failed to fetch news for {ticker}: {result}")
                    failed_tickers.append(ticker)
                    continue

                successful_tickers.append(ticker)

                if result:
                    all_articles.extend(result)
                    print(f"  {ticker}: {len(result)} articles")
                else:
                    print(f"  {ticker}: 0 articles")

            if index + batch_size < len(tickers):
                await asyncio.sleep(0.2)

        print(f"Total articles fetched before deduplication: {len(all_articles)}")

        unique_articles, dedup_stats = self._deduplicate_articles(all_articles)

        print(f"Unique articles after deduplication: {len(unique_articles)}")
        print(f"Deduplication stats: {dedup_stats}")

        # Filter articles by timeframe to ensure consistent datasets
        now_utc = datetime.now(timezone.utc)
        timeframe_days_map = {
            '1D': 1,
            '1W': 7,
            '1M': 30,
            '3M': 90,
            '6M': 180,
            'YTD': None,
            '1Y': 365,
            '5Y': 1825,
            '10Y': 3650,
            'MAX': None
        }

        days_back = timeframe_days_map.get(sector_timeframe)

        if days_back is not None:
            cutoff_date = now_utc - timedelta(days=days_back)
            filtered_articles: List[dict] = []

            for article in unique_articles:
                pub_timestamp_str = article.get("publish_timestamp")
                pub_datetime = None

                if pub_timestamp_str:
                    try:
                        pub_datetime = datetime.fromisoformat(pub_timestamp_str)
                        if pub_datetime.tzinfo is None:
                            pub_datetime = pub_datetime.replace(tzinfo=timezone.utc)
                    except (ValueError, AttributeError):
                        pub_datetime = None

                if pub_datetime is None:
                    pub_date_str = article.get("publish_date")
                    if pub_date_str:
                        try:
                            pub_datetime = datetime.strptime(pub_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                        except ValueError:
                            continue

                if pub_datetime and pub_datetime >= cutoff_date:
                    filtered_articles.append(article)

            unique_articles = filtered_articles
            print(
                f"Filtered to {len(unique_articles)} articles within {sector_timeframe} timeframe"
                f" (cutoff: {cutoff_date.date()})"
            )

        unique_articles.sort(key=lambda x: x.get('publish_date', ''), reverse=True)

        limited_articles = unique_articles[:limit] if limit else unique_articles

        total_fetched = len(all_articles)
        total_unique = len(unique_articles)
        duplicates_removed = dedup_stats.get('total_duplicates_removed', 0)
        dedup_rate = (duplicates_removed / total_fetched * 100) if total_fetched > 0 else 0.0
        success_rate = (len(successful_tickers) / len(tickers) * 100) if tickers else 0.0

        print(
            f"Calculating sector sentiment metrics from {len(unique_articles)} unique articles..."
        )
        sentiment_metrics = sector_sentiment_service.analyze_sector_sentiment_with_momentum(
            articles=unique_articles,
            sector_tickers=tickers
        )
        print(
            f"Sentiment calculation complete: slow_score={sentiment_metrics.get('slow_score')}, "
            f"momentum={sentiment_metrics.get('sentiment_momentum')}, "
            f"quality={sentiment_metrics.get('data_quality')}"
        )

        coverage_value = round(market_weight_coverage, 4) if market_weight_coverage is not None else None

        return {
            'success': True,
            'sector_key': response_sector_key,
            'sector_name': display_name,
            'tickers_queried': list(tickers),
            'total_tickers': len(tickers),
            'successful_tickers': successful_tickers,
            'failed_tickers': failed_tickers,
            'success_rate': round(success_rate, 2),
            'total_market_weight_coverage': coverage_value,
            'total_articles_fetched': total_fetched,
            'unique_articles': total_unique,
            'deduplication_rate': round(dedup_rate, 2),
            'articles': limited_articles,
            'timeframe': sector_timeframe,
            'cached': False,
            'metadata': dedup_stats,
            'sentiment_metrics': sentiment_metrics
        }

    @async_cache_result(ttl=3600)  # Cache for 60 minutes (sector news is expensive to fetch)
    async def _get_all_sectors_news(
        self,
        base_etf_ticker: str,
        limit: int = 100,
        timeframe: str = "1W"
    ) -> Dict[str, any]:
        """
        Aggregates market-wide news using the holdings of the provided "all sectors" ETF.
        """
        print(
            f"Fetching aggregated news for ALL SECTORS via {base_etf_ticker} (timeframe: {timeframe})"
        )

        try:
            tickers, market_weight_coverage = sector_service_instance.get_sector_tickers(base_etf_ticker)

            if not tickers:
                raise ValueError("No tickers available for SPY sector aggregation")

            print(f"Found {len(tickers)} tickers for {base_etf_ticker}: {tickers[:5]}...")
            if market_weight_coverage is not None:
                print(f"Holding weight coverage: {market_weight_coverage:.2%}")

            metadata = sector_service_instance.get_sector_metadata(base_etf_ticker)
            display_name = f"{metadata['display_name']} ({base_etf_ticker})"

            result = await self._assemble_sector_news_response(
                response_sector_key=base_etf_ticker,
                display_name=display_name,
                tickers=tickers,
                sector_timeframe=timeframe,
                limit=limit,
                market_weight_coverage=market_weight_coverage
            )

            result['base_etf'] = base_etf_ticker
            result['sectors_included'] = 1
            result['sector_breakdown'] = {
                base_etf_ticker: {
                    'tickers': len(tickers),
                    'articles': result['total_articles_fetched']
                }
            }

            return result

        except Exception as exc:
            print(f"ERROR: Failed to fetch aggregated news for ALL SECTORS via {base_etf_ticker}: {exc}")
            raise

    async def get_sector_news(
        self,
        sector_key: str,
        limit: int = 100,
        timeframe: str = "1W"
    ) -> Dict[str, any]:
        """
        Aggregates news articles for all companies in a sector.

        This method:
        1. Gets the list of constituent tickers from yfinance.Sector().top_companies
        2. Fetches news for each ticker in parallel (batches of 10)
        3. Deduplicates by both URL and normalized title
        4. Returns comprehensive sector news with metadata

        IMPORTANT: For sectors, we ALWAYS fetch maximum 1 month of data regardless of timeframe.
        This is because sector sentiment uses exponential decay with half-life of 24 hours.
        After 10 half-lives (10 days), news relevance drops to <0.1% and becomes statistically insignificant.

        Args:
            sector_key: yfinance sector key (e.g., 'technology', 'healthcare')
            limit: Maximum number of unique articles to return (default: 100)
            timeframe: Time range for news (e.g., '1D', '1W', '1M') - capped at 1M for sectors

        Returns:
            Dictionary containing:
            - sector_key: yfinance sector key
            - sector_name: Display name of sector
            - tickers_queried: List of tickers that were queried
            - total_tickers: Number of tickers queried
            - total_articles_fetched: Total articles before deduplication
            - unique_articles: Number of unique articles after deduplication
            - deduplication_rate: Percentage of duplicates removed
            - articles: List of unique news articles (limited to 'limit')
            - timeframe: Time range used
            - cached: Whether result was from cache
            - metadata: Deduplication statistics
        """
        # Generate cache key
        from app.core.cache import redis_cache, generate_cache_key
        from app.core.config import settings

        cache_key = generate_cache_key(
            "sector_news_v2",
            sector_key,
            limit=limit,
            timeframe=timeframe
        )

        # Try to get from cache
        cached_result = await redis_cache.aget(cache_key)
        if cached_result is not None:
            print(f"[CACHE HIT] Returning cached sector news for {sector_key}")
            cached_result['cached'] = True
            return cached_result

        # SECTOR OVERRIDE: Cap timeframe at 1M maximum for exponential decay relevance
        # After 10 days (10 half-lives), news has <0.1% relevance
        sector_timeframe = timeframe if timeframe in ['1D', '1W', '1M'] else '1M'
        if sector_timeframe != timeframe:
            print(f"[SECTOR OVERRIDE] Requested timeframe '{timeframe}' capped to '1M' for sector analysis")

        print(f"[CACHE MISS] Fetching aggregated news for sector: {sector_key} (timeframe: {sector_timeframe})")

        # Check if this is "All Sectors" request
        if is_all_sectors_identifier(sector_key):
            result = await self._get_all_sectors_news(
                base_etf_ticker=sector_key,
                limit=limit,
                timeframe=sector_timeframe
            )
            result['cached'] = False
            # Cache the result with shorter TTL for news (10 minutes)
            await redis_cache.aset(cache_key, result, ttl=settings.NEWS_CACHE_TTL)
            return result

        try:
            tickers, market_weight_coverage = sector_service_instance.get_sector_tickers(sector_key)

            if not tickers:
                raise ValueError(f"No tickers found for sector: {sector_key}")

            print(f"Found {len(tickers)} tickers for sector '{sector_key}': {tickers[:5]}...")
            if market_weight_coverage is not None:
                print(f"Holding weight coverage: {market_weight_coverage:.2%}")

            sector_metadata = sector_service_instance.get_sector_metadata(sector_key)

            result = await self._assemble_sector_news_response(
                response_sector_key=sector_key,
                display_name=sector_metadata['display_name'],
                tickers=tickers,
                sector_timeframe=sector_timeframe,
                limit=limit,
                market_weight_coverage=market_weight_coverage
            )

            result['cached'] = False
            # Cache the result
            await redis_cache.aset(cache_key, result, ttl=settings.NEWS_CACHE_TTL)

            return result

        except Exception as e:
            print(f"ERROR: Failed to fetch sector news for '{sector_key}': {str(e)}")
            raise ValueError(f"Failed to fetch sector news: {str(e)}")


# Create a single, shared instance of the service that the whole app can use.
news_service_instance = NewsService()

