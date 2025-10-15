# tests/models/test_market_data.py

import unittest
from app.models import Market, Sector, Ticker, News, SentimentScore

class TestMarketData(unittest.TestCase):

    def setUp(self):
        """Set up a basic market structure for tests."""
        self.market = Market(name="NASDAQ")
        self.sector = Sector(name="Technology")
        self.market.sectors.append(self.sector)
        self.ticker = Ticker(
            symbol="AAPL",
            company_name="Apple Inc.",
            sector=self.sector,
            market=self.market
        )
        self.sector.tickers.append(self.ticker)

    def test_market_and_sector_creation(self):
        """Test the basic creation and relationship of Market and Sector."""
        self.assertEqual(self.market.name, "NASDAQ")
        self.assertIn(self.sector, self.market.sectors)

    def test_ticker_creation(self):
        """Test the creation of a Ticker and its links."""
        self.assertEqual(self.ticker.symbol, "AAPL")
        self.assertEqual(self.ticker.sector, self.sector)
        self.assertEqual(self.ticker.market, self.market)
        self.assertIn(self.ticker, self.sector.tickers)

    def test_news_creation(self):
        """Test that a News object is created with a SentimentScore."""
        sentiment = SentimentScore(value=0.8, source="News Source")
        news_item = News(headline="New iPhone", source="Tech News", sentiment_score=sentiment)
        self.assertEqual(news_item.headline, "New iPhone")
        self.assertEqual(news_item.sentiment_score.value, 0.8)

    def test_ticker_sentiment_calculation(self):
        """Test the sentiment score calculation for a Ticker."""
        # Test with no news
        self.ticker.calculate_sentiment_score()
        self.assertEqual(self.ticker.sentiment_score, 0.0)

        # Add news items
        news1 = News("Good sales", "Source1", SentimentScore(0.7, "s1"))
        news2 = News("Bad quarter", "Source2", SentimentScore(-0.3, "s2"))
        self.ticker.related_news.extend([news1, news2])
        
        # (0.7 + (-0.3)) / 2 = 0.2
        self.ticker.calculate_sentiment_score()
        self.assertAlmostEqual(self.ticker.sentiment_score, 0.2)