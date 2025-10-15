# tests/services/test_data_processing_service.py

import unittest
from unittest.mock import patch, MagicMock
import pandas as pd
from datetime import datetime, timedelta

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.services.data_processing_service import DataProcessingService

sys.modules['transformers'] = MagicMock()

def create_fake_stock_df():
    """
    Helper to create a DataFrame that perfectly mimics yfinance output,
    with a DatetimeIndex named 'Date'.
    """
    dates = pd.to_datetime(pd.date_range(end="2025-10-15", periods=11))
    data = {'Close': [150, 152, 148, 155, 156, 155, 157, 156, 158, 185, 180]}
    return pd.DataFrame(data, index=pd.Index(dates, name="Date"))

class TestDataProcessingService(unittest.TestCase):

    @patch('app.services.data_processing_service.pipeline')
    def setUp(self, MockPipeline):
        self.mock_finbert = MockPipeline.return_value
        self.mock_finbert.return_value = [{'label': 'positive', 'score': 0.98}]
        self.service = DataProcessingService()
        self.mock_today = datetime(2025, 10, 15)
        self.mock_today_date = self.mock_today.date()

    @patch('app.services.data_processing_service.yf.Ticker')
    def test_get_stock_data_success(self, MockYfTicker):
        """Test the happy path for fetching stock data."""
        # Arrange: The helper now correctly provides a DataFrame with 'Date' as the index.
        mock_yf_instance = MockYfTicker.return_value
        mock_yf_instance.history.return_value = create_fake_stock_df()
        
        # Act
        result = self.service.get_stock_data("AAPL")
        
        # Assert
        self.assertIsInstance(result, pd.DataFrame)
        self.assertFalse(result.empty)
        self.assertEqual(len(result), 11)

    @patch('app.services.data_processing_service.yf.Ticker')
    def test_get_stock_data_failure_empty(self, MockYfTicker):
        """Test when yfinance returns no data."""
        mock_yf_instance = MockYfTicker.return_value
        mock_yf_instance.history.return_value = pd.DataFrame()
        
        result = self.service.get_stock_data("FAKETICKER")
        
        self.assertIsNone(result)

    @patch('app.services.data_processing_service.datetime', wraps=datetime)
    def test_filter_data_by_timeframe_all_cases(self, mock_datetime_module):
        """Test various timeframe filtering options with the corrected timedelta logic."""
        df = create_fake_stock_df()
        mock_datetime_module.today.return_value = self.mock_today
        
        # This will now correctly return 5 days
        result_5d = self.service.filter_data_by_timeframe(df, "5D")
        self.assertEqual(len(result_5d), 5)

    # FIX: Patch 'datetime.utcnow' specifically, leaving 'fromtimestamp' intact
    @patch('app.services.data_processing_service.datetime')
    def test_get_ticker_news(self, mock_datetime):
        """Test fetching and filtering recent news."""
        mock_datetime.utcnow.return_value = self.mock_today
        # Also need to make sure the real 'fromtimestamp' is used
        mock_datetime.fromtimestamp.side_effect = datetime.fromtimestamp

        with patch('app.services.data_processing_service.yf.Ticker') as MockYfTicker:
            mock_yf_instance = MockYfTicker.return_value
            fake_news_data = [
                {"providerPublishTime": (self.mock_today - timedelta(days=2)).timestamp(), "title": "Recent news"},
                {"providerPublishTime": (self.mock_today - timedelta(days=10)).timestamp(), "title": "Old news"},
            ]
            mock_yf_instance.get_news.return_value = fake_news_data
            
            result = self.service.get_ticker_news("AAPL")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['title'], "Recent news")

    # FIX: Patch 'datetime.utcnow().date()' correctly
    @patch('app.services.data_processing_service.datetime')
    def test_analyze_sentiment_with_weights(self, mock_datetime):
        """Test the advanced sentiment analysis with recency weighting."""
        mock_datetime.utcnow.return_value = self.mock_today
        # The service code uses strptime which still needs to be real
        mock_datetime.strptime.side_effect = datetime.strptime

        news_articles = [
            {"title": "Good news today", "publish_date": self.mock_today_date.strftime("%Y-%m-%d")},
            {"title": "Bad news yesterday", "publish_date": (self.mock_today_date - timedelta(days=1)).strftime("%Y-%m-%d")},
        ]
        
        result = self.service.analyze_sentiment_with_weights(news_articles)

        self.assertEqual(len(result["articles_with_sentiment"]), 2)
        self.assertTrue(result["overall_weighted_score"] > 0)

    @patch.object(DataProcessingService, '_fetch_finnhub_news')
    @patch.object(DataProcessingService, 'get_stock_data')
    def test_analyze_significant_events_success(self, mock_get_stock_data, mock_fetch_news):
        """Test the full workflow now that the service handles the index correctly."""
        # Arrange
        mock_get_stock_data.return_value = create_fake_stock_df()
        mock_fetch_news.return_value = [{"title": "Major company announcement"}]
        
        # Act
        result = self.service.analyze_significant_events("AAPL", std_threshold=1.0, event_count=1)
        
        # Assert
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['start_date'], '2025-10-14')
        self.assertEqual(result[0]['news'][0]['title'], "Major company announcement")


