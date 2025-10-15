# models/market_data.py
"""
This module defines the classes that represent the broader financial market,
including news, tickers, sectors, and the markets they belong to.
These classes are fundamental for organizing and analyzing market-wide data
and sentiment.
"""

from __future__ import annotations
from typing import List
from .sentiment import SentimentScore

class News:
    """Represents a single news article or data point related to a ticker.

    Attributes:
        headline (str): The title of the news article.
        source (str): The publisher or source of the news (e.g., "Bloomberg").
        sentiment_score (SentimentScore): The sentiment analysis result for this news item.
    """
    def __init__(self, headline: str, source: str, sentiment_score: SentimentScore):
        self.headline = headline
        self.source = source
        self.sentiment_score = sentiment_score

class Ticker:
    """Represents a single tradable asset, like a stock (e.g., AAPL).

    This class is central to the market data model, linking a company to its
    news, sector, and market. It also calculates its own aggregated sentiment.

    Attributes:
        symbol (str): The ticker symbol (e.g., "AAPL").
        company_name (str): The full name of the company.
        sector (Sector): The sector this ticker belongs to.
        market (Market): The market this ticker trades on.
        related_news (List[News]): A list of news items associated with this ticker.
        sentiment_score (float): The aggregated sentiment score, calculated from news.
    """
    def __init__(self, symbol: str, company_name: str, sector: Sector, market: Market):
        self.symbol = symbol
        self.company_name = company_name
        self.sector = sector
        self.market = market
        self.related_news: List[News] = []
        self.sentiment_score: float = 0.0

    def calculate_sentiment_score(self):
        """Calculates the average sentiment from the scores of its related news.

        This method updates the `sentiment_score` attribute by averaging the `value`
        of the SentimentScore object from each news item. If there is no news,
        the score defaults to 0.0.

        Returns:
            float: The newly calculated sentiment score.
        """
        if not self.related_news:
            self.sentiment_score = 0.0
            return self.sentiment_score
        
        # Sum up the numerical value of each news item's sentiment score
        total_score_value = sum(news.sentiment_score.value for news in self.related_news)
        self.sentiment_score = total_score_value / len(self.related_news)
        return self.sentiment_score

class Sector:
    """Represents an industry sector that groups multiple tickers (e.g., "Technology").

    Attributes:
        name (str): The name of the sector.
        tickers (List[Ticker]): A list of tickers belonging to this sector.
        sentiment_score (float): An aggregated sentiment score for the sector.
                                 (Note: Calculation logic is not yet implemented).
    """
    def __init__(self, name: str):
        self.name = name
        self.tickers: List[Ticker] = []
        self.sentiment_score: float = 0.0

class Market:
    """Represents a financial market or exchange (e.g., "NASDAQ").

    Attributes:
        name (str): The name of the market.
        sectors (List[Sector]): A list of sectors that exist within this market.
        sentiment_score (float): An aggregated sentiment score for the entire market.
                                 (Note: Calculation logic is not yet implemented).
    """
    def __init__(self, name: str):
        self.name = name
        self.sectors: List[Sector] = []
        self.sentiment_score: float = 0.0