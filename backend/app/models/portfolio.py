# models/portfolio.py
"""
This module contains classes related to a client's investment portfolio.
It defines the structure of a portfolio and the individual holdings within it.
"""

from __future__ import annotations
from typing import List, TYPE_CHECKING
from .market_data import Ticker

# This special block handles type hinting for the `Client` class.
# It prevents a circular import error (actors -> portfolio -> actors) by only
# importing the `Client` type definition when the type checker is running,
# not during actual program execution.
if TYPE_CHECKING:
    from .actors import Client

class Holding:
    """Represents a specific quantity of a Ticker owned by a client.

    This class acts as a link between a Ticker (the asset) and a Portfolio,
    specifying how much of that asset is owned.

    Attributes:
        ticker (Ticker): The financial instrument being held.
        quantity (int): The number of shares or units owned.
        purchase_price (float): The average price at which the asset was acquired.
    """
    def __init__(self, ticker: Ticker, quantity: int, purchase_price: float):
        self.ticker = ticker
        self.quantity = quantity
        self.purchase_price = purchase_price

class Portfolio:
    """Represents a client's entire collection of holdings.

    This class is the central container for a client's investments and is
    responsible for aggregating data, like sentiment, from its holdings.

    Attributes:
        portfolio_id (str): A unique identifier for the portfolio.
        owner (Client): The client who owns this portfolio.
        holdings (List[Holding]): A list of all the holdings in the portfolio.
        sentiment_score (float): The aggregated sentiment score for the portfolio.
    """
    def __init__(self, portfolio_id: str, owner: Client):
        self.portfolio_id = portfolio_id
        self.owner = owner
        self.holdings: List[Holding] = []
        self.sentiment_score: float = 0.0

    def calculate_sentiment_score(self):
        """Calculates an average sentiment score based on the tickers in its holdings.

        This method updates the `sentiment_score` attribute. In this simple
        implementation, it's a direct average of the sentiment scores of the
        tickers held. A more advanced version could be value-weighted.

        Returns:
            float: The newly calculated sentiment score.
        """
        # If the portfolio is empty, the sentiment is neutral (0.0).
        if not self.holdings:
            self.sentiment_score = 0.0
            return self.sentiment_score
        
        # Sum the sentiment scores from each holding's ticker.
        total_score = sum(h.ticker.sentiment_score for h in self.holdings)
        self.sentiment_score = total_score / len(self.holdings)
        return self.sentiment_score