# tests/services/test_stock_data_service.py

import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import pandas as pd
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.services.stock_data_service import StockDataService


def create_fake_stock_df():
    """
    Helper to create a DataFrame that perfectly mimics yfinance output,
    with a DatetimeIndex named 'Date'.
    """
    dates = pd.to_datetime(pd.date_range(end="2025-10-15", periods=11))
    data = {'Close': [150, 152, 148, 155, 156, 155, 157, 156, 158, 185, 180]}
    return pd.DataFrame(data, index=pd.Index(dates, name="Date"))


class TestStockDataService(unittest.TestCase):

    def setUp(self):
        self.service = StockDataService()
        self.mock_today = datetime(2025, 10, 15)

    @patch('app.services.stock_data_service.yf.Ticker')
    def test_get_stock_data_success(self, MockYfTicker):
        """Test the happy path for fetching stock data."""
        # Arrange
        mock_yf_instance = MockYfTicker.return_value
        mock_yf_instance.history.return_value = create_fake_stock_df()

        # Act
        result = self.service.get_stock_data("AAPL")

        # Assert
        self.assertIsInstance(result, pd.DataFrame)
        self.assertFalse(result.empty)
        self.assertEqual(len(result), 11)

    @patch('app.services.stock_data_service.yf.Ticker')
    def test_get_stock_data_failure_empty(self, MockYfTicker):
        """Test when yfinance returns no data."""
        mock_yf_instance = MockYfTicker.return_value
        mock_yf_instance.history.return_value = pd.DataFrame()

        result = self.service.get_stock_data("FAKETICKER")

        self.assertIsNone(result)

    @patch('app.services.stock_data_service.datetime', wraps=datetime)
    def test_filter_data_by_timeframe_5d(self, mock_datetime_module):
        """Test 5D timeframe filtering."""
        df = create_fake_stock_df()
        mock_datetime_module.today.return_value = self.mock_today

        result_5d = self.service.filter_data_by_timeframe(df, "5D")
        self.assertEqual(len(result_5d), 5)

    @patch('app.services.stock_data_service.datetime', wraps=datetime)
    def test_filter_data_by_timeframe_1m(self, mock_datetime_module):
        """Test 1M timeframe filtering."""
        df = create_fake_stock_df()
        mock_datetime_module.today.return_value = self.mock_today

        result_1m = self.service.filter_data_by_timeframe(df, "1M")
        self.assertIsInstance(result_1m, pd.DataFrame)

    def test_filter_data_by_timeframe_invalid(self):
        """Test invalid timeframe returns original DataFrame."""
        df = create_fake_stock_df()

        result = self.service.filter_data_by_timeframe(df, "INVALID")
        pd.testing.assert_frame_equal(result, df)

    @patch('app.services.stock_data_service.SentimentService.analyze_sentiment_with_momentum')
    @patch('app.services.stock_data_service.NewsService.get_ticker_news_for_timeframe', new_callable=AsyncMock)
    @patch('app.services.stock_data_service.YQTicker')
    def test_get_sector_top_constituents_success(self, MockYQTicker, mock_get_news, mock_analyze_sentiment):
        """Test fetching sector constituents."""
        # Arrange
        mock_etf = MagicMock()
        mock_etf.fund_holding_info = {
            "XLK": {
                "holdings": [
                    {"symbol": "AAPL", "holdingName": "Apple Inc.", "holdingPercent": 0.25}
                ]
            }
        }

        # Mock price data
        mock_batch = MagicMock()
        mock_batch.price = {
            "AAPL": {
                "shortName": "Apple Inc.",
                "regularMarketPrice": 150.0,
                "regularMarketChangePercent": 2.5,
                "marketCap": 3_000_000_000_000,
                "fiftyTwoWeekHigh": 200.0,
                "fiftyTwoWeekLow": 100.0
            }
        }
        mock_batch.summary_detail = {
            "AAPL": {
                "fiftyTwoWeekHigh": 200.0,
                "fiftyTwoWeekLow": 100.0
            }
        }

        MockYQTicker.side_effect = [mock_etf, mock_batch]

        mock_get_news.return_value = [
            {
                "publish_date": "2025-10-01",
                "ticker_sentiment_score": 0.25,
                "ticker_relevance_score": 1.0
            }
        ]

        mock_analyze_sentiment.return_value = {
            "slow_score": 0.2,
            "sentiment_momentum": 0.05
        }

        # Act
        result = self.service.get_sector_top_constituents("^SP500-45")

        # Assert
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["symbol"], "AAPL")
        self.assertAlmostEqual(result[0]["sentimentScore"], 0.2)
        self.assertAlmostEqual(result[0]["sentimentMomentum"], 0.05)
        self.assertEqual(result[0]["fiftyTwoWeekHigh"], 200.0)
        self.assertEqual(result[0]["fiftyTwoWeekLow"], 100.0)

    def test_get_sector_top_constituents_invalid_sector(self):
        """Test invalid sector ticker raises ValueError."""
        with self.assertRaises(ValueError):
            self.service.get_sector_top_constituents("INVALID")


if __name__ == '__main__':
    unittest.main()
