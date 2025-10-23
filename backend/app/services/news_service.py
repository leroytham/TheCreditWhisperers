# app/services/news_service.py

from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv
import asyncio
import aiohttp
import random
from bs4 import BeautifulSoup
import yfinance as yf

# Import your existing model classes
from app.models import News, SentimentScore, RelevanceScore
from app.core.cache import async_cache_result, cache_result
from app.core.config import settings


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

    async def _fetch_alpha_vantage_news(self, session: aiohttp.ClientSession, ticker: str) -> list[dict]:
        """
        Fetches news from Alpha Vantage NEWS_SENTIMENT API with ticker sentiment scores.

        Args:
            session: aiohttp ClientSession for async requests
            ticker: Stock ticker symbol

        Returns:
            List of news article dictionaries with sentiment scores
            Returns empty list if rate limited or API error occurs
        """
        if not self.alpha_vantage_api_key:
            return []

        try:
            url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=1000&tickers={ticker}&apikey={self.alpha_vantage_api_key}"
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

                    # Extract ticker-specific sentiment score and relevance score
                    ticker_sentiment_score = None
                    ticker_sentiment_label = "Neutral"
                    ticker_relevance_score = None
                    ticker_sentiments = article.get("ticker_sentiment", [])

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

                    # Use Alpha Vantage's summary instead of web scraping
                    body_content = article.get("summary", "")

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
                        "image": article.get("banner_image")
                    })

                return news_list

        except Exception as e:
            print(f"Error fetching news from Alpha Vantage for {ticker}: {e}")
            return []

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
        async with aiohttp.ClientSession() as session:
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


# Create a single, shared instance of the service that the whole app can use.
news_service_instance = NewsService()

