# app/services/news_service.py

import torch
import yfinance as yf
from datetime import datetime
from sentence_transformers import SentenceTransformer, util
import numpy as np

# Import your existing model classes
from app.models import News, SentimentScore

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