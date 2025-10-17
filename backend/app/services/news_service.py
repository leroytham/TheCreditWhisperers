# app/services/news_service.py

import torch
import yfinance as yf
from datetime import datetime, timedelta, timezone
from sentence_transformers import SentenceTransformer, util
import numpy as np
import requests
from bs4 import BeautifulSoup
import os
from dotenv import load_dotenv
import asyncio
import aiohttp
import random


# Import your existing model classes
from app.models import News, SentimentScore
from app.core.cache import async_cache_result, cache_result
from app.core.config import settings


class NewsService:
    """
    A service to fetch, categorize, and analyze financial news articles from multiple sources.
    This class is designed as a singleton to ensure the machine learning
    model is loaded only once.
    """
    _instance = None

    def __new__(cls):
        # The singleton pattern ensures we only ever have one instance of this class.
        if cls._instance is None:
            print("Creating NewsService instance and loading ML model...")
            cls._instance = super(NewsService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initializes the service, loads the ML model, and API keys."""
        load_dotenv()
        self.finnhub_api_token = os.getenv("FINNHUB_API_TOKEN")
        self.news_api_key = os.getenv("NEWS_API_KEY")
        self.alpha_vantage_api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        self.marketaux_api_key = os.getenv("MARKETAUX_API_KEY")

        if not self.finnhub_api_token:
            print("WARNING: FINNHUB_API_TOKEN not found. News fetching from Finnhub will be disabled.")
        if not self.news_api_key:
            print("WARNING: NEWS_API_KEY not found. News fetching from News API will be disabled.")
        if not self.alpha_vantage_api_key:
            print("WARNING: ALPHA_VANTAGE_API_KEY not found. News fetching from Alpha Vantage will be disabled.")
        if not self.marketaux_api_key:
            print("WARNING: MARKETAUX_API_KEY not found. News fetching from MarketAux will be disabled.")

        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
        ]

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"NewsService is using device: {self.device}")

        # Load the sentence transformer model
        self.model = SentenceTransformer("all-MiniLM-L6-v2", device=self.device)

        # Define the categories for news classification
        self.categories = {
            "Earnings": "quarterly earnings report, revenue, profit, EPS",
            "M&A": "merger acquisition deal buyout takeover",
            "Guidance": "future outlook guidance forecast expectations",
            "Dividends": "dividend payout cash distribution shareholder returns",
            "Product Launch": "new product release innovation launch update",
            "Other": "general corporate news"
        }
        self.cat_names = list(self.categories.keys())

        # Pre-compute embeddings for the categories for faster comparison
        self.cat_embeddings = self.model.encode(
            list(self.categories.values()),
            convert_to_tensor=True,
            device=self.device
        )

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
        
    async def _fetch_yfinance_news(self, session: aiohttp.ClientSession, ticker: str, count: int, seven_days_ago: datetime.date, today: datetime.date) -> list[dict]:
        """Fetches and processes news from Yahoo Finance asynchronously."""
        try:
            raw_news = await asyncio.to_thread(self._get_yfinance_news_sync, ticker, count)
            if not raw_news: return []

            news_list = []
            scrape_tasks = []
            articles_to_process = []

            for article in raw_news:
                content = article.get("content", article) if isinstance(article, dict) else None
                if not content: continue

                pub_date_str = content.get("pubDate") or content.get("providerPublishTime")
                if not pub_date_str: continue

                try:
                    if isinstance(pub_date_str, str) and 'T' in pub_date_str:
                        pub_date = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00')).date()
                    elif isinstance(pub_date_str, (int, float)):
                        pub_date = datetime.fromtimestamp(pub_date_str).date()
                    else: continue
                except Exception: continue

                if seven_days_ago <= pub_date <= today:
                    link = content.get("previewUrl") or content.get("link")
                    articles_to_process.append((content, pub_date, link))
                    scrape_tasks.append(self._scrape_article_content(session, link))

            scraped_contents = await asyncio.gather(*scrape_tasks)

            for i, (content, pub_date, link) in enumerate(articles_to_process):
                provider_info = content.get("provider") or {}
                provider_name = provider_info.get("displayName", "Unknown") if isinstance(provider_info, dict) else content.get("publisher", "Unknown")
                body_content = scraped_contents[i] or content.get("summary", "")

                news_list.append({
                    "title": content.get("title"), "link": link, "provider": provider_name,
                    "publish_date": pub_date.strftime("%Y-%m-%d"), "body": body_content
                })
            return news_list
        except Exception as e:
            print(f"Error fetching news from yfinance for {ticker}: {e}")
            return []

    async def _fetch_finnhub_news(self, session: aiohttp.ClientSession, ticker: str, start_date_str: str, end_date_str: str) -> list[dict]:
        """Fetches and processes news from Finnhub asynchronously."""
        if not self.finnhub_api_token: return []
        
        try:
            url = f"https://finnhub.io/api/v1/company-news?symbol={ticker}&from={start_date_str}&to={end_date_str}&token={self.finnhub_api_token}"
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                raw_news = await response.json()
                if not raw_news: return []

                scrape_tasks = [(article, self._scrape_article_content(session, article.get("url"))) for article in raw_news]
                
                results = await asyncio.gather(*(task for _, task in scrape_tasks))

                news_list = []
                for i, (article, _) in enumerate(scrape_tasks):
                    body_content = results[i] or article.get("summary", "")
                    news_list.append({
                        "title": article.get("headline"), "link": article.get("url"), "provider": article.get("source"),
                        "publish_date": datetime.fromtimestamp(article.get("datetime")).strftime('%Y-%m-%d'),
                        "body": body_content
                    })
                return news_list
        except Exception as e:
            print(f"Error fetching news from Finnhub for {ticker}: {e}")
            return []

    async def _fetch_newsapi_news(self, session: aiohttp.ClientSession, ticker: str, start_date_str: str, end_date_str: str) -> list[dict]:
        """Fetches and processes news from NewsAPI.org asynchronously."""
        if not self.news_api_key: return []

        try:
            url = f"https://newsapi.org/v2/everything?q={ticker}&from={start_date_str}&to={end_date_str}&sortBy=publishedAt&apiKey={self.news_api_key}"
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                raw_news = (await response.json()).get("articles", [])
                if not raw_news: return []
                
                scrape_tasks = [(article, self._scrape_article_content(session, article.get("url"))) for article in raw_news]
                results = await asyncio.gather(*(task for _, task in scrape_tasks))
                
                news_list = []
                for i, (article, _) in enumerate(scrape_tasks):
                    fallback_content = article.get("description") or article.get("content", "")
                    body_content = results[i] or fallback_content
                    news_list.append({
                        "title": article.get("title"), "link": article.get("url"),
                        "provider": article.get("source", {}).get("name"),
                        "publish_date": datetime.fromisoformat(article.get("publishedAt").replace('Z', '+00:00')).strftime('%Y-%m-%d'),
                        "body": body_content
                    })
                return news_list
        except Exception as e:
            print(f"Error fetching news from NewsAPI for {ticker}: {e}")
            return []

    async def _fetch_alpha_vantage_news(self, session: aiohttp.ClientSession, ticker: str) -> list[dict]:
        """Fetches and processes news from Alpha Vantage asynchronously."""
        if not self.alpha_vantage_api_key: return []
        try:
            url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers={ticker}&apikey={self.alpha_vantage_api_key}"
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                raw_data = (await response.json()).get("feed", [])
                if not raw_data: return []

                scrape_tasks = [(article, self._scrape_article_content(session, article.get("url"))) for article in raw_data]
                results = await asyncio.gather(*(task for _, task in scrape_tasks))
                
                news_list = []
                for i, (article, _) in enumerate(scrape_tasks):
                    time_published = article.get("time_published", "")
                    if time_published: pub_date = datetime.strptime(time_published, "%Y%m%dT%H%M%S").strftime('%Y-%m-%d')
                    else: continue
                    
                    body_content = results[i] or article.get("summary", "")
                    news_list.append({
                        "title": article.get("title"), "link": article.get("url"), "provider": article.get("source"),
                        "publish_date": pub_date, "body": body_content
                    })
                return news_list
        except Exception as e:
            print(f"Error fetching news from Alpha Vantage for {ticker}: {e}")
            return []

    async def _fetch_marketaux_news(self, session: aiohttp.ClientSession, ticker: str, start_date_str: str) -> list[dict]:
        """Fetches and processes news from MarketAux asynchronously."""
        if not self.marketaux_api_key: return []
        try:
            url = f"https://api.marketaux.com/v1/news/all?symbols={ticker}&published_after={start_date_str}&api_token={self.marketaux_api_key}"
            async with session.get(url, timeout=10) as response:
                response.raise_for_status()
                raw_data = (await response.json()).get("data", [])
                if not raw_data: return []

                scrape_tasks = [(article, self._scrape_article_content(session, article.get("url"))) for article in raw_data]
                results = await asyncio.gather(*(task for _, task in scrape_tasks))
                
                news_list = []
                for i, (article, _) in enumerate(scrape_tasks):
                    pub_date_iso = article.get("published_at")
                    if pub_date_iso: pub_date = datetime.fromisoformat(pub_date_iso).strftime('%Y-%m-%d')
                    else: continue
                    
                    body_content = results[i] or article.get("snippet", "")
                    news_list.append({
                        "title": article.get("title"), "link": article.get("url"), "provider": article.get("source"),
                        "publish_date": pub_date, "body": body_content
                    })
                return news_list
        except Exception as e:
            print(f"Error fetching news from MarketAux for {ticker}: {e}")
            return []


    @async_cache_result(ttl=settings.NEWS_CACHE_TTL, key_prefix="ticker_news")
    async def get_ticker_news(self, ticker: str, count: int = 100) -> list[dict]:
        """
        Gets recent news for a ticker from multiple sources concurrently, merging and deduplicating them.
        """
        today = datetime.now(timezone.utc).date()
        seven_days_ago = today - timedelta(days=6)
        start_date_str = seven_days_ago.strftime("%Y-%m-%d")
        end_date_str = today.strftime("%Y-%m-%d")

        async with aiohttp.ClientSession() as session:
            # --- Create tasks to run concurrently ---
            tasks = [
                self._fetch_yfinance_news(session, ticker, count, seven_days_ago, today),
                self._fetch_finnhub_news(session, ticker, start_date_str, end_date_str),
                self._fetch_newsapi_news(session, ticker, start_date_str, end_date_str),
                self._fetch_alpha_vantage_news(session, ticker),
                self._fetch_marketaux_news(session, ticker, start_date_str)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
        # --- Combine and Deduplicate ---
        all_news = {}
        combined_sources = []
        for res in results:
            if isinstance(res, list):
                combined_sources.extend(res)
            else:
                print(f"An error occurred in a fetch task: {res}")

        for article in combined_sources:
            if article and article.get("title"):
                key = article["title"].lower().strip()
                if key not in all_news:
                    all_news[key] = article
        
        # Sort by date, newest first
        sorted_news = sorted(all_news.values(), key=lambda x: x['publish_date'], reverse=True)
        
        print(f"Fetched and combined {len(sorted_news)} unique news articles for {ticker} from 5 sources.")
        return sorted_news

    @cache_result(ttl=settings.NEWS_CACHE_TTL, key_prefix="news_around_date")
    def fetch_news_around_date(
        self,
        ticker: str,
        target_date: str,
        window: int = 2,
        count: int = 20
    ) -> list[dict]:
        """
        Fetches news articles around a specific date.
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
            ticker_obj = yf.Ticker(ticker)
            raw_news = ticker_obj.get_news(count=100)
            if not raw_news:
                return []

            target = datetime.strptime(target_date, "%Y-%m-%d").date()
            start_date = target - timedelta(days=window)
            end_date = target + timedelta(days=window)

            filtered_news = []
            for article in raw_news:
                if not article:
                    continue

                content = article.get("content", article) if isinstance(article, dict) else None
                if not content:
                    continue

                pub_date_str = content.get("pubDate") or content.get("providerPublishTime")
                if not pub_date_str:
                    continue

                try:
                    if isinstance(pub_date_str, str) and 'T' in pub_date_str:
                        pub_date = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00')).date()
                    elif isinstance(pub_date_str, (int, float)):
                        pub_date = datetime.fromtimestamp(pub_date_str).date()
                    else:
                        continue
                except Exception:
                    continue

                if start_date <= pub_date <= end_date:
                    filtered_news.append({
                        "title": content.get("title"),
                        "link": content.get("previewUrl") or content.get("link"),
                        "provider": content.get("provider", {}).get("displayName", "Unknown"),
                        "publish_date": pub_date.strftime("%Y-%m-%d")
                    })

            return filtered_news[:count]
        except Exception as e:
            print(f"Error fetching news around date for {ticker}: {e}")
            return []

    def get_categorized_news(self, ticker: str, start_date: str, end_date: str) -> list[News]:
        """
        Fetches press releases for a ticker and categorizes them.

        Args:
            ticker (str): The stock ticker symbol (e.g., "AAPL").
            start_date (str): The start date in "YYYY-MM-DD" format.
            end_date (str): The end date in "YYYY-MM-DD" format.

        Returns:
            list[News]: A list of categorized News model objects.
        """
        ticker_obj = yf.Ticker(ticker)
        raw_news = ticker_obj.get_news()
        if not raw_news:
            return []

        news_model_list = []
        start = datetime.strptime(start_date, "%Y-%m-%d").date() # Change %M to %m
        end = datetime.strptime(end_date, "%Y-%m-%d").date()     # Change %M to %m

        for article in raw_news:
            pub_date = datetime.fromtimestamp(article["providerPublishTime"]).date()

            if start <= pub_date:
                title = article.get("title", "")
                
                # --- Categorization Logic ---
                text_emb = self.model.encode(title, convert_to_tensor=True, device=self.device)
                scores = util.cos_sim(text_emb, self.cat_embeddings)[0]
                best_idx = scores.argmax().item()
                
                # Create a SentimentScore object from the categorization confidence
                sentiment = SentimentScore(
                    value=scores[best_idx].item(),
                    source="ArticleCategorizer",
                    confidence=1.0 # The confidence here is the category match score
                )

                # --- Create a News Model Object ---
                # This integrates the script's output with your existing OOP structure.
                news_item = News(
                    headline=title,
                    source=article.get("publisher", "N/A"),
                    sentiment_score=sentiment # Use the rich object
                )
                # We can add the category as an extra attribute if needed, 
                # or embed it in the sentiment source.
                # For now, let's print it to show it works.
                print(f"Categorized '{title}' as '{self.cat_names[best_idx]}'")

                news_model_list.append(news_item)

        return news_model_list


# Create a single, shared instance of the service that the whole app can use.
news_service_instance = NewsService()

