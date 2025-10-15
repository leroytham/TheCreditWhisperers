# app/services/data_processing_service.py

import os
import sys
import warnings
import io
import pandas as pd
from datetime import datetime, timedelta
from collections import defaultdict
import yfinance as yf
from yahooquery import Ticker as YQTicker # Use an alias to avoid name conflicts
import requests
import numpy as np
from dotenv import load_dotenv

# Suppress verbose library outputs
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
warnings.filterwarnings('ignore')
from transformers import pipeline

from app.models import News, SentimentScore # Assuming you might integrate these later

class DataProcessingService:
    """
    Service for fetching and analyzing financial data.
    Uses a singleton pattern to ensure the FinBERT model is loaded only once.
    """
    _instance = None

    def __init__(self):
        # Add the sector-to-ETF mapping as a class attribute
        self.sector_etf_map = {
            '^SP500-25': 'XLY',   # Consumer Discretionary
            '^SP500-30': 'XLP',   # Consumer Staples
            '^SP500-35': 'XLV',   # Health Care
            '^SP500-40': 'XLF',   # Financials
            '^SP500-45': 'XLK',   # Tech
            '^SP500-50': 'XLC',   # Communication Services
            '^SP500-55': 'XLU',   # Utilities
            '^SP500-60': 'XLRE',  # Real Estate
            '^SP500-15': 'XLB',   # Materials
            '^SP500-20': 'XLI',   # Industrials
            '^GSPE': 'XLE',       # Energy
        }

    def __new__(cls):
        if cls._instance is None:
            print("Creating DataProcessingService instance and loading FinBERT model...")
            cls._instance = super(DataProcessingService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Loads the FinBERT model and other resources."""
        # Use a context manager to suppress the model loading messages
        original_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            self.finbert = pipeline("text-classification", model="ProsusAI/finbert")
        finally:
            sys.stdout = original_stdout
        print("FinBERT model loaded successfully.")

        # Now, load environment variables from the .env file
        load_dotenv()
        self.finnhub_api_token = os.getenv("FINNHUB_API_TOKEN")
        if not self.finnhub_api_token:
            print("WARNING: FINNHUB_API_TOKEN not found in .env file. News fetching for events will fail.")
        print("FinBERT model and environment variables loaded.")

    # --- Methods refactored from the script ---

    def get_stock_data(self, ticker: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame | None:
        """Downloads historical stock data for a ticker."""
        try:
            ticker_obj = yf.Ticker(ticker)
            data = ticker_obj.history(period=period, interval=interval)
            if data.empty:
                return None
            data.index = data.index.tz_localize(None) # Make timezone naive
            return data
        except Exception:
            return None

    def filter_data_by_timeframe(self, df: pd.DataFrame, timeframe: str) -> pd.DataFrame | None:
        """Filters a DataFrame based on a timeframe string like '1M', 'YTD', etc."""
        if df is None or df.empty:
            return df
        
        end_date = datetime.today()
        time_deltas = {
            "5D": 4, "1M": 29, "3M": 89, "6M": 179, "1Y": 364
        }

        if timeframe in time_deltas:
            start_date = end_date - timedelta(days=time_deltas[timeframe])
        elif timeframe == "YTD":
            start_date = datetime(end_date.year, 1, 1)
        else:
            # Return the original dataframe if timeframe is not recognized
            return df
            
        return df[(df.index >= start_date) & (df.index <= end_date)]

    def get_ticker_news(self, ticker: str, count: int = 20) -> list[dict]:
        """Gets recent news for a ticker from the last 7 days."""
        try:
            ticker_obj = yf.Ticker(ticker)
            raw_news = ticker_obj.get_news(count=count)
            if not raw_news:
                return []
            
            news_list = []
            seven_days_ago = (datetime.utcnow() - timedelta(days=7)).date()
            
            for article in raw_news:
                pub_date = datetime.fromtimestamp(article["providerPublishTime"]).date()
                if pub_date >= seven_days_ago:
                    news_list.append({
                        "title": article.get("title"),
                        "link": article.get("link"),
                        "provider": article.get("publisher"),
                        "publish_date": pub_date.strftime("%Y-%m-%d"),
                        "image": next((res.get('url') for res in article.get('thumbnail', {}).get('resolutions', []) if res), None)
                    })
            return news_list
        except Exception:
            return []

    def analyze_sentiment_with_weights(self, news_articles: list[dict]) -> dict:
        """
        Analyzes sentiment with recency weighting using the loaded FinBERT model.
        """
        if not news_articles:
            return {
                "articles_with_sentiment": [],
                "overall_weighted_score": 0.0,
                "sentiment_counts": {},
                "daily_average_sentiment": {}
            }

        results = []
        weighted_total = 0
        weight_sum = 0
        sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}

        daily_scores = defaultdict(list)
        today = datetime.utcnow().date()
        seven_days_ago = today - timedelta(days=6)

        # Normalized recency weights
        raw_weights = {0: 1.0, 1: 0.8, 2: 0.6, 3: 0.5, 4: 0.4, 5: 0.35, 6: 0.3}
        total_raw = sum(raw_weights.values())
        weights = {k: v / total_raw for k, v in raw_weights.items()}

        for article in news_articles:
            title = article.get("title", "")
            if not title:
                continue

            # IMPORTANT: Use the model loaded by the service instance
            sentiment_scores = self.finbert(title, truncation=True, return_all_scores=True)[0]
            scores_dict = {r['label'].lower(): r['score'] for r in sentiment_scores}

            label = max(scores_dict, key=scores_dict.get)
            confidence = scores_dict[label]

            if label == "positive":
                raw_score = scores_dict["positive"]
            elif label == "negative":
                raw_score = -scores_dict["negative"]
            else:
                raw_score = scores_dict["positive"] - scores_dict["negative"]

            recency_weight = 0
            pub_date_str = article.get("publish_date")
            if pub_date_str:
                pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date()
                if seven_days_ago <= pub_date <= today:
                    days_old = (today - pub_date).days
                    recency_weight = weights.get(days_old, 0)
                    weighted_total += raw_score * recency_weight
                    weight_sum += recency_weight
                    daily_scores[pub_date].append(raw_score * recency_weight)

            article["sentiment_label"] = label
            article["sentiment_confidence"] = confidence
            article["sentiment_score_raw"] = raw_score
            article["sentiment_weight"] = recency_weight
            results.append(article)
            sentiment_counts[label] += 1

        daily_avg_sentiment = {}
        for i in range(7):
            date = seven_days_ago + timedelta(days=i)
            scores = daily_scores.get(date, [])
            daily_avg_sentiment[date.strftime("%Y-%m-%d")] = sum(scores) / len(scores) if scores else 0

        avg_score = weighted_total / weight_sum if weight_sum else 0

        return {
            "articles_with_sentiment": results,
            "overall_weighted_score": avg_score,
            "sentiment_counts": sentiment_counts,
            "daily_average_sentiment": daily_avg_sentiment,
        }
    
    def get_sector_top_constituents(self, sector_ticker: str) -> list[dict]:
        """
        Fetches the top 10 holdings for a given S&P 500 sector ticker.
        """
        etf_ticker = self.sector_etf_map.get(sector_ticker)
        if not etf_ticker:
            raise ValueError(f"Invalid or unsupported sector ticker: {sector_ticker}")

        try:
            etf = YQTicker(etf_ticker)
            holdings_data = etf.fund_holding_info

            if not holdings_data or "holdings" not in holdings_data.get(etf_ticker, {}):
                return [] # Return empty list if no holdings data

            holdings = holdings_data[etf_ticker]["holdings"]
            top_symbols = [h.get("symbol") for h in holdings[:10] if h.get("symbol")]

            if not top_symbols:
                return []

            # Batch request for faster price lookup
            price_data = YQTicker(top_symbols).price

            top_constituents = []
            for h in holdings[:10]:
                symbol = h.get("symbol")
                if not symbol or symbol not in price_data:
                    continue

                p = price_data.get(symbol, {})
                top_constituents.append({
                    "symbol": symbol,
                    "name": p.get("shortName") or h.get("holdingName"),
                    "price": p.get("regularMarketPrice"),
                    "percentChange": p.get("regularMarketChangePercent"),
                    "percentOfAssets": h.get("holdingPercent"),
                })
            
            return top_constituents
        except Exception as e:
            # In a real app, you'd log this error
            print(f"Error fetching constituents for {etf_ticker}: {e}")
            return []
        
    def analyze_significant_events(self, ticker: str, std_threshold: float = 2.0, event_count: int = 5) -> list[dict]:
        """
        Identifies significant price moves for a ticker and finds correlated news.
        """
        # 1. Fetch Data
        df = self.get_stock_data(ticker, period="1y")
        if df is None or df.empty:
            return []
        df = df.reset_index()

        # 2. Calculate Metrics
        df['pct_change'] = df['Close'].pct_change()
        daily_return_std = df['pct_change'].std()
        
        df['is_big_move'] = df['pct_change'].abs() > (std_threshold * daily_return_std)
        df['direction'] = np.sign(df['pct_change'])

        # 3. Find and Group Events (Streaks)
        streaks_broken = (df['is_big_move'] != df['is_big_move'].shift()) | \
                         (df['direction'] != df['direction'].shift())
        df['streak_id'] = streaks_broken.cumsum()
        
        big_move_streaks = df[df['is_big_move'] == True]
        if big_move_streaks.empty:
            return []

        grouped_streaks = big_move_streaks.groupby('streak_id').agg(
            start_date=('Date', 'min'),
            total_move_pct=('pct_change', 'sum')
        ).reset_index()

        # 4. Rank and Select Top Events
        grouped_streaks['importance'] = grouped_streaks['total_move_pct'].abs()
        top_events = grouped_streaks.sort_values(by='importance', ascending=False).head(event_count)

        # 5. Fetch News for Each Top Event
        final_results = []
        for event in top_events.itertuples():
            news = self._fetch_finnhub_news(ticker, event.start_date)
            final_results.append({
                "start_date": event.start_date.strftime('%Y-%m-%d'),
                "total_move_pct": event.total_move_pct,
                "news": news
            })
            
        return final_results

    def _fetch_finnhub_news(self, ticker: str, target_date: datetime, window: int = 3) -> list[dict]:
        """Helper method to fetch news from Finnhub API."""
        if not self.finnhub_api_token:
            return [{"error": "Finnhub API token not configured."}]
        
        start_date = target_date - timedelta(days=window)
        end_date = target_date + timedelta(days=window)
        
        try:
            url = f"https://finnhub.io/api/v1/company-news?symbol={ticker}&from={start_date.strftime('%Y-%m-%d')}&to={end_date.strftime('%Y-%m-%d')}&token={self.finnhub_api_token}"
            response = requests.get(url)
            response.raise_for_status()
            news_data = response.json()
            
            return [
                {
                    "date": datetime.fromtimestamp(n.get("datetime")).strftime('%Y-%m-%d'),
                    "title": n.get("headline"),
                    "link": n.get("url"),
                    "publisher": n.get("source")
                } for n in news_data[:5] # Return top 5 news items
            ]
        except requests.exceptions.RequestException as e:
            print(f"Finnhub API error for {ticker}: {e}")
            return [{"error": f"Failed to fetch news from Finnhub: {e}"}]

# Create a single, shared instance for the entire application
data_service_instance = DataProcessingService()