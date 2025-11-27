# =============================================================================
# News Service - Fetches news from multiple sources with fallbacks
# =============================================================================

from datetime import datetime, timedelta, timezone
import logging
import asyncio
import aiohttp
import random
from bs4 import BeautifulSoup
import yfinance as yf
from typing import List, Dict, Optional

from app.core.config import settings
from app.core.http_client import http_client
from app.core.circuit_breaker import get_circuit_breaker, CircuitBreakerOpenError
from app.core.cache import redis_cache, async_cache_result

logger = logging.getLogger(__name__)


class NewsService:
    """
    Fetches financial news from multiple sources with intelligent fallbacks.

    Primary: Alpha Vantage NEWS_SENTIMENT API (includes pre-calculated sentiment)
    Fallbacks: Finnhub, NewsAPI, MarketAux, Yahoo Finance
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            logger.info("Creating NewsService instance...")
            cls._instance = super(NewsService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize API keys and configuration."""
        self.alpha_vantage_api_key = settings.ALPHA_VANTAGE_API_KEY
        self.finnhub_api_token = settings.FINNHUB_API_TOKEN
        self.news_api_key = settings.NEWS_API_KEY
        self.marketaux_api_key = settings.MARKETAUX_API_KEY

        if not self.alpha_vantage_api_key:
            logger.warning("ALPHA_VANTAGE_API_KEY not found. Alpha Vantage news disabled.")
        if not self.finnhub_api_token:
            logger.warning("FINNHUB_API_TOKEN not found. Finnhub fallback disabled.")
        if not self.news_api_key:
            logger.warning("NEWS_API_KEY not found. NewsAPI fallback disabled.")
        if not self.marketaux_api_key:
            logger.warning("MARKETAUX_API_KEY not found. MarketAux fallback disabled.")

        # User agents for web scraping
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        ]

        # Track active background fetch tasks
        self._active_fetch_tasks = {}

    async def _fetch_alpha_vantage_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        time_from: str = None,
        time_to: str = None,
        limit: int = 1000
    ) -> List[Dict]:
        """
        Fetch news from Alpha Vantage NEWS_SENTIMENT API.

        Returns articles with pre-calculated ticker sentiment scores.
        """
        if not self.alpha_vantage_api_key:
            return []

        cb = get_circuit_breaker("alpha_vantage")
        url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit={limit}&tickers={ticker}&apikey={self.alpha_vantage_api_key}"

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

            # Check for rate limit or API error
            if "Note" in data or "Information" in data or "Error Message" in data:
                logger.warning(f"Alpha Vantage API issue for {ticker}: {data.get('Note') or data.get('Information') or data.get('Error Message')}")
                return []

            raw_data = data.get("feed", [])
            if not raw_data:
                return []

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

                # Extract ticker-specific sentiment
                ticker_sentiments = article.get("ticker_sentiment", [])
                ticker_sentiment_score = None
                ticker_sentiment_label = "Neutral"
                ticker_relevance_score = None

                for ts in ticker_sentiments:
                    if ts.get("ticker", "").upper() == ticker.upper():
                        try:
                            ticker_sentiment_score = float(ts.get("ticker_sentiment_score", "0"))
                        except (ValueError, TypeError):
                            ticker_sentiment_score = 0.0
                        ticker_sentiment_label = ts.get("ticker_sentiment_label", "Neutral")
                        try:
                            ticker_relevance_score = float(ts.get("relevance_score", "0"))
                        except (ValueError, TypeError):
                            ticker_relevance_score = None
                        break

                if ticker_sentiment_score is None:
                    continue

                news_list.append({
                    "title": article.get("title"),
                    "link": article.get("url"),
                    "provider": article.get("source"),
                    "publish_date": pub_date,
                    "publish_timestamp": pub_datetime.isoformat(),
                    "body": article.get("summary", ""),
                    "ticker_sentiment_score": ticker_sentiment_score,
                    "ticker_sentiment_label": ticker_sentiment_label,
                    "ticker_relevance_score": ticker_relevance_score,
                    "image": article.get("banner_image"),
                    "topics": article.get("topics", [])
                })

            return news_list

        except CircuitBreakerOpenError:
            logger.warning(f"[ALPHA_VANTAGE] Circuit breaker open for {ticker}")
            return []
        except Exception as e:
            logger.error(f"Error fetching Alpha Vantage news for {ticker}: {e}")
            return []

    async def _fetch_alpha_vantage_batch(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        months_back: int = 6,
        max_batches: int = None
    ) -> List[Dict]:
        """
        Fetch historical news in batches using pagination.
        """
        if not self.alpha_vantage_api_key:
            return []

        all_articles = []
        now = datetime.now(timezone.utc)
        target_start_date = now - timedelta(days=months_back * 30)

        time_from_str = target_start_date.strftime("%Y%m%dT%H%M")
        time_to_str = now.strftime("%Y%m%dT%H%M")

        batch_count = 0
        if max_batches is None:
            max_batches = 20 if months_back < 6 else 50
        max_batches = min(max_batches, 200)  # Safety ceiling

        logger.info(f"[BATCH FETCH] Starting for {ticker} from {target_start_date.date()}")

        while batch_count < max_batches:
            batch_count += 1

            if batch_count > 1:
                await asyncio.sleep(0.2)  # Rate limiting

            batch_articles = await self._fetch_alpha_vantage_news(
                session, ticker, time_from=time_from_str, time_to=time_to_str, limit=1000
            )

            if not batch_articles:
                break

            # Find earliest date
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

            all_articles.extend(batch_articles)

            if earliest_date and earliest_date <= target_start_date:
                break

            if earliest_date:
                time_to_str = (earliest_date - timedelta(seconds=1)).strftime("%Y%m%dT%H%M")
            else:
                break

        logger.info(f"[BATCH FETCH] {ticker}: {len(all_articles)} articles in {batch_count} batches")
        return all_articles

    async def _scrape_article_content(self, session: aiohttp.ClientSession, url: str) -> str:
        """Scrape article content from URL."""
        if not url:
            return ""
        try:
            await asyncio.sleep(random.uniform(0.5, 1.5))
            headers = {'User-Agent': random.choice(self.user_agents)}
            async with session.get(url, headers=headers, timeout=15) as response:
                if response.status >= 400:
                    return ""
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                paragraphs = soup.find_all('p')
                return ' '.join([p.get_text() for p in paragraphs]).strip()
        except Exception as e:
            logger.debug(f"Error scraping {url}: {e}")
            return ""

    def _get_yfinance_news_sync(self, ticker: str, count: int):
        """Helper for blocking yfinance calls."""
        ticker_obj = yf.Ticker(ticker)
        return ticker_obj.get_news(count=count)

    async def _fetch_yfinance_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        count: int,
        start_date,
        today
    ) -> List[Dict]:
        """Fetch news from Yahoo Finance."""
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

                if start_date <= pub_date <= today:
                    link = content.get("previewUrl") or content.get("link")
                    articles_to_process.append((content, pub_date, pub_datetime, link))
                    scrape_tasks.append(self._scrape_article_content(session, link))

            scraped_contents = await asyncio.gather(*scrape_tasks)

            for i, (content, pub_date, pub_datetime, link) in enumerate(articles_to_process):
                provider_info = content.get("provider") or {}
                provider_name = provider_info.get("displayName", "Unknown") if isinstance(provider_info, dict) else "Unknown"
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
            logger.error(f"Error fetching yfinance news for {ticker}: {e}")
            return []

    async def _fetch_finnhub_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        start_date_str: str,
        end_date_str: str
    ) -> List[Dict]:
        """Fetch news from Finnhub."""
        if not self.finnhub_api_token:
            return []

        cb = get_circuit_breaker("finnhub")
        url = f"https://finnhub.io/api/v1/company-news?symbol={ticker}&from={start_date_str}&to={end_date_str}&token={self.finnhub_api_token}"

        async def _make_request():
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                return await response.json()

        try:
            raw_news = await cb.call(_make_request) if cb else await _make_request()
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
        except CircuitBreakerOpenError:
            logger.warning(f"[FINNHUB] Circuit breaker open for {ticker}")
            return []
        except Exception as e:
            logger.error(f"Error fetching Finnhub news for {ticker}: {e}")
            return []

    async def _fetch_newsapi_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        start_date_str: str,
        end_date_str: str
    ) -> List[Dict]:
        """Fetch news from NewsAPI.org."""
        if not self.news_api_key:
            return []

        cb = get_circuit_breaker("newsapi")
        url = f"https://newsapi.org/v2/everything?q={ticker}&from={start_date_str}&to={end_date_str}&sortBy=publishedAt&apiKey={self.news_api_key}"

        async def _make_request():
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                return (await response.json()).get("articles", [])

        try:
            raw_data = await cb.call(_make_request) if cb else await _make_request()
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
        except CircuitBreakerOpenError:
            logger.warning(f"[NEWSAPI] Circuit breaker open for {ticker}")
            return []
        except Exception as e:
            logger.error(f"Error fetching NewsAPI news for {ticker}: {e}")
            return []

    async def _fetch_marketaux_news(
        self,
        session: aiohttp.ClientSession,
        ticker: str,
        start_date_str: str
    ) -> List[Dict]:
        """Fetch news from MarketAux."""
        if not self.marketaux_api_key:
            return []

        cb = get_circuit_breaker("marketaux")
        url = f"https://api.marketaux.com/v1/news/all?symbols={ticker}&published_after={start_date_str}&api_token={self.marketaux_api_key}"

        async def _make_request():
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                return (await response.json()).get("data", [])

        try:
            raw_data = await cb.call(_make_request) if cb else await _make_request()
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
        except CircuitBreakerOpenError:
            logger.warning(f"[MARKETAUX] Circuit breaker open for {ticker}")
            return []
        except Exception as e:
            logger.error(f"Error fetching MarketAux news for {ticker}: {e}")
            return []

    def _get_cache_ttl_for_timeframe(self, timeframe: str) -> int:
        """Get cache TTL based on timeframe."""
        ttl_map = {
            '1D': 300, '1W': 600, '1M': 600, '3M': 1800,
            '6M': 3600, 'YTD': 14400, '1Y': 43200
        }
        return ttl_map.get(timeframe, settings.NEWS_CACHE_TTL)

    def _get_timeframe_months(self, timeframe: str) -> float:
        """Convert timeframe to months of data to fetch."""
        # Always fetch 12 months for entities (filtering done in API)
        return 12

    async def get_ticker_news_for_timeframe(
        self,
        ticker: str,
        timeframe: str = '1M'
    ) -> List[Dict]:
        """
        Get news for a ticker with timeframe-specific caching.
        """
        cache_key = f"ticker_news:{ticker}:{timeframe}"

        # Try cache first
        if redis_cache.async_client:
            cached = await redis_cache.aget(cache_key)
            if cached:
                logger.info(f"[CACHE HIT] {cache_key}")
                return cached

        logger.info(f"[CACHE MISS] {cache_key}")

        months = self._get_timeframe_months(timeframe)
        session = await http_client.get_session()
        articles = await self._fetch_alpha_vantage_batch(session, ticker, months_back=int(months))

        # Cache result
        if redis_cache.async_client and articles:
            ttl = self._get_cache_ttl_for_timeframe(timeframe)
            await redis_cache.aset(cache_key, articles, ttl=ttl)

        return articles

    @async_cache_result(ttl=600, key_prefix="ticker_news")
    async def get_ticker_news(self, ticker: str, count: int = 1000) -> List[Dict]:
        """
        Get news with automatic fallback to multiple sources.

        Strategy:
        1. Try Alpha Vantage first (best sentiment scores)
        2. Fall back to aggregating from multiple sources
        """
        session = await http_client.get_session()
        news_articles = await self._fetch_alpha_vantage_news(session, ticker)

        if not news_articles:
            logger.info(f"Falling back to multi-source aggregation for {ticker}")
            today = datetime.now(timezone.utc).date()
            ninety_days_ago = today - timedelta(days=89)
            start_date_str = ninety_days_ago.strftime("%Y-%m-%d")
            end_date_str = today.strftime("%Y-%m-%d")

            tasks = [
                self._fetch_yfinance_news(session, ticker, count, ninety_days_ago, today),
                self._fetch_finnhub_news(session, ticker, start_date_str, end_date_str),
                self._fetch_newsapi_news(session, ticker, start_date_str, end_date_str),
                self._fetch_marketaux_news(session, ticker, start_date_str)
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Deduplicate by title
            all_news = {}
            for res in results:
                if isinstance(res, list):
                    for article in res:
                        if article and article.get("title"):
                            key = article["title"].lower().strip()
                            if key not in all_news:
                                all_news[key] = article

            news_articles = list(all_news.values())
            logger.info(f"Fetched {len(news_articles)} articles for {ticker} from fallback sources")
        else:
            logger.info(f"Fetched {len(news_articles)} articles for {ticker} from Alpha Vantage")

        # Sort by date, newest first
        sorted_news = sorted(news_articles, key=lambda x: x.get('publish_date', ''), reverse=True)
        return sorted_news[:count]

    async def fetch_news_around_date(
        self,
        ticker: str,
        target_date: str,
        window: int = 2,
        count: int = 20
    ) -> List[Dict]:
        """Fetch news around a specific date."""
        try:
            all_news = await self.get_ticker_news(ticker)
            if not all_news:
                return []

            target = datetime.strptime(target_date, "%Y-%m-%d").date()
            start_date = target - timedelta(days=window)
            end_date = target + timedelta(days=window)

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
            logger.error(f"Error fetching news around date for {ticker}: {e}")
            return []


# Singleton instance
news_service = NewsService()
