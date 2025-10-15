# models/market_data.py

from __future__ import annotations
from typing import List
from .sentiment import SentimentScore

class News:
    def __init__(self, headline: str, source: str, sentiment_score: SentimentScore):
        self.headline = headline
        self.source = source
        self.sentiment_score = sentiment_score

class Ticker:
    def __init__(self, symbol: str, company_name: str, sector: Sector, market: Market):
        self.symbol = symbol
        self.company_name = company_name
        self.sector = sector
        self.market = market
        self.related_news: List[News] = []
        self.sentiment_score: float = 0.0

    def calculate_sentiment_score(self):
        """Calculates avg sentiment from the value of related news scores."""
        if not self.related_news:
            self.sentiment_score = 0.0
            return self.sentiment_score
        
        total_score_value = sum(news.sentiment_score.value for news in self.related_news)
        self.sentiment_score = total_score_value / len(self.related_news)
        return self.sentiment_score

class Sector:
    def __init__(self, name: str):
        self.name = name
        self.tickers: List[Ticker] = []
        self.sentiment_score: float = 0.0

class Market:
    def __init__(self, name: str):
        self.name = name
        self.sectors: List[Sector] = []
        self.sentiment_score: float = 0.0