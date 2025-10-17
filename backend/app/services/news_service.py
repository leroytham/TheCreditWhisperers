# app/services/news_service.py

import torch
import yfinance as yf
from datetime import datetime, timedelta, timezone
from sentence_transformers import SentenceTransformer, util
import numpy as np
import requests
from bs4 import BeautifulSoup

# Import your existing model classes
from app.models import News, SentimentScore
from app.core.cache import cache_result
from app.core.config import settings


class NewsService:
    """
    A service to fetch, categorize, and analyze financial news articles.

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
        """Initializes the service and loads the ML model into memory."""
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

    def _scrape_article_content(self, url: str) -> str:
        """
        Scrapes the main content from a given news article URL.
        This is a best-effort scrape and may not work for all sources.
        """
        if not url:
            return ""
        try:
            # Use a common user-agent to avoid being blocked
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Find all paragraph tags, which usually contain the article text
            paragraphs = soup.find_all('p')
            
            # Join the text from all paragraphs to form the article body
            article_text = ' '.join([p.get_text() for p in paragraphs])
            
            return article_text.strip()
        except Exception as e:
            print(f"Failed to scrape article content from {url}: {e}")
            return ""

    @cache_result(ttl=settings.NEWS_CACHE_TTL, key_prefix="ticker_news")
    def get_ticker_news(self, ticker: str, count: int = 100) -> list[dict]:
        """
        Gets recent news for a ticker from the last 7 days.
        Results are cached in Redis for NEWS_CACHE_TTL seconds.

        Args:
            ticker: Stock ticker symbol
            count: Number of articles to fetch from yfinance (default 100)

        Returns:
            List of news article dictionaries with title, link, provider, publish_date, image, and full body content.
        """
        try:
            ticker_obj = yf.Ticker(ticker)
            # Fetch more articles to ensure we have coverage across 7 days
            raw_news = ticker_obj.get_news(count=count)
            if not raw_news:
                return []

            news_list = []
            # Get news from the last 7 days (from 6 days ago to today)
            today = datetime.now(timezone.utc).date()
            seven_days_ago = today - timedelta(days=6)

            for article in raw_news:
                if not article:
                    continue

                # Handle new yfinance API structure where content is nested
                content = article.get("content", article) if isinstance(article, dict) else None
                if not content:
                    continue

                # Parse the publish date
                pub_date_str = content.get("pubDate") or content.get("providerPublishTime")
                if not pub_date_str:
                    continue

                # Handle ISO format dates (e.g., "2025-10-14T18:57:08Z")
                try:
                    if isinstance(pub_date_str, str) and 'T' in pub_date_str:
                        pub_date = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00')).date()
                    elif isinstance(pub_date_str, (int, float)):
                        pub_date = datetime.fromtimestamp(pub_date_str).date()
                    else:
                        continue
                except Exception:
                    continue

                # Include news from the last 7 days (6 days ago through today)
                if seven_days_ago <= pub_date <= today:
                    # Extract thumbnail URL safely
                    thumbnail = content.get("thumbnail") or {}
                    resolutions = thumbnail.get("resolutions") or []
                    image_url = None
                    if resolutions:
                        image_url = next((res.get('url') for res in resolutions if isinstance(res, dict) and res.get('url')), None)

                    # Extract provider name safely
                    provider_info = content.get("provider") or {}
                    if isinstance(provider_info, dict):
                        provider_name = provider_info.get("displayName", "Unknown")
                    else:
                        provider_name = content.get("publisher", "Unknown")

                    link = content.get("previewUrl") or content.get("link")
                    
                    # Scrape the full article content from the link
                    body_content = self._scrape_article_content(link)

                    # If scraping fails, fall back to the summary from the API
                    if not body_content:
                        body_content = content.get("summary", "")

                    news_list.append({
                        "title": content.get("title"),
                        "link": link,
                        "provider": provider_name,
                        "publish_date": pub_date.strftime("%Y-%m-%d"),
                        "image": image_url,
                        "body": body_content
                    })

            print(f"Fetched {len(news_list)} news articles for {ticker} from the last 7 days")
            return news_list
        except Exception as e:
            print(f"Error fetching news for {ticker}: {e}")
            return []

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

