# tests/models/test_portfolio.py

import unittest
from unittest.mock import Mock
from app.models import Portfolio, Holding, Ticker, Client

class TestPortfolio(unittest.TestCase):

    def setUp(self):
        """Set up a mock Client and Tickers for portfolio testing."""
        # Using Mock to avoid full dependency on actors and market_data
        self.mock_client = Mock(spec=Client)
        self.portfolio = Portfolio(portfolio_id="P123", owner=self.mock_client)
        
        self.ticker1 = Mock(spec=Ticker)
        self.ticker1.sentiment_score = 0.5

        self.ticker2 = Mock(spec=Ticker)
        self.ticker2.sentiment_score = -0.1

    def test_portfolio_creation(self):
        """Test that a Portfolio is correctly linked to its owner."""
        self.assertEqual(self.portfolio.portfolio_id, "P123")
        self.assertEqual(self.portfolio.owner, self.mock_client)
        self.assertEqual(len(self.portfolio.holdings), 0)

    def test_add_holding(self):
        """Test adding a Holding to a Portfolio."""
        holding = Holding(ticker=self.ticker1, quantity=100, purchase_price=150.0)
        self.portfolio.holdings.append(holding)
        self.assertEqual(len(self.portfolio.holdings), 1)
        self.assertEqual(self.portfolio.holdings[0].ticker, self.ticker1)

    def test_portfolio_sentiment_calculation(self):
        """Test the sentiment score calculation for a Portfolio."""
        # Test with no holdings
        self.portfolio.calculate_sentiment_score()
        self.assertEqual(self.portfolio.sentiment_score, 0.0)

        # Add holdings
        self.portfolio.holdings.append(Holding(self.ticker1, 100, 150.0))
        self.portfolio.holdings.append(Holding(self.ticker2, 50, 200.0))

        # (0.5 + (-0.1)) / 2 = 0.2
        self.portfolio.calculate_sentiment_score()
        self.assertAlmostEqual(self.portfolio.sentiment_score, 0.2)