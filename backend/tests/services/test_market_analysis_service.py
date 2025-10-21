# tests/services/test_market_analysis_service.py

import unittest
from unittest.mock import patch, MagicMock
import pandas as pd
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.services.market_analysis_service import MarketAnalysisService


def create_fake_stock_df():
    """Helper to create a DataFrame with significant price moves."""
    dates = pd.to_datetime(pd.date_range(end="2025-10-15", periods=11))
    data = {'Close': [150, 152, 148, 155, 156, 155, 157, 156, 158, 185, 180]}
    return pd.DataFrame(data, index=pd.Index(dates, name="Date"))


class TestMarketAnalysisService(unittest.TestCase):

    def setUp(self):
        self.service = MarketAnalysisService()
        self.mock_today = datetime(2025, 10, 15)

    def test_detect_large_moves_success(self):
        """Test detecting large price movements."""
        df = create_fake_stock_df()

        result = self.service.detect_large_moves(df, top_n=3, threshold_std=1.0)

        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        for move in result:
            self.assertIn("date", move)
            self.assertIn("pct_change", move)
            self.assertIn("close", move)

    def test_detect_large_moves_empty_df(self):
        """Test with empty DataFrame."""
        result = self.service.detect_large_moves(pd.DataFrame(), top_n=3)

        self.assertEqual(result, [])

    @patch.object(MarketAnalysisService, 'fetch_finnhub_news')
    @patch('app.services.market_analysis_service.stock_data_service.get_stock_data')
    def test_analyze_significant_events_success(self, mock_get_stock_data, mock_fetch_news):
        """Test the full workflow for analyzing significant events."""
        # Arrange
        mock_get_stock_data.return_value = create_fake_stock_df()
        mock_fetch_news.return_value = [{"title": "Major company announcement"}]

        # Act
        result = self.service.analyze_significant_events("AAPL", std_threshold=1.0, event_count=1)

        # Assert
        self.assertIsInstance(result, list)
        if len(result) > 0:
            self.assertIn("start_date", result[0])
            self.assertIn("total_move_pct", result[0])
            self.assertIn("news", result[0])

    @patch.object(MarketAnalysisService, 'fetch_finnhub_news')
    @patch('app.services.market_analysis_service.stock_data_service.get_stock_data')
    def test_analyze_significant_events_no_data(self, mock_get_stock_data, mock_fetch_news):
        """Test when no stock data is available."""
        mock_get_stock_data.return_value = None

        result = self.service.analyze_significant_events("INVALID")

        self.assertEqual(result, [])

    @patch('app.services.market_analysis_service.requests.get')
    def test_fetch_finnhub_news_success(self, mock_requests_get):
        """Test fetching news from Finnhub API."""
        # Arrange
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {
                "datetime": 1697000000,
                "headline": "Test headline",
                "url": "https://example.com",
                "source": "Reuters"
            }
        ]
        mock_requests_get.return_value = mock_response

        # Act
        result = self.service.fetch_finnhub_news("AAPL", datetime(2025, 10, 15))

        # Assert
        self.assertIsInstance(result, list)
        if self.service.finnhub_api_token:
            self.assertGreater(len(result), 0)

    def test_calculate_volatility(self):
        """Test volatility calculation."""
        df = create_fake_stock_df()

        volatility = self.service.calculate_volatility(df, window=5)

        self.assertIsInstance(volatility, float)
        self.assertGreater(volatility, 0)

    def test_calculate_volatility_empty_df(self):
        """Test volatility with empty DataFrame."""
        result = self.service.calculate_volatility(pd.DataFrame())

        self.assertEqual(result, 0.0)


if __name__ == '__main__':
    unittest.main()
