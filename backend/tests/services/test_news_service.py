import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime

# It's good practice to set up the path if running tests directly
# This ensures 'from app.services...' works
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.services.news_service import NewsService
from app.models import News

class TestNewsService(unittest.TestCase):

    @patch('app.services.news_service.SentenceTransformer')
    @patch('app.services.news_service.yf.Ticker')
    def test_get_categorized_news(self, MockYfTicker, MockSentenceTransformer):
        """
        Tests the news categorization service method.
        Mocks the ML model and the yfinance API call.
        """
        # --- Arrange (Setup Mocks) ---
        # 1. Mock the yfinance Ticker object and its get_news method
        mock_yf_instance = MockYfTicker.return_value
        fake_news_data = [
            {
                "providerPublishTime": datetime(2025, 10, 14).timestamp(),
                "title": "Apple announces new iPhone",
                "publisher": "Tech News Today"
            },
            {
                "providerPublishTime": datetime(2025, 10, 10).timestamp(),
                "title": "Old news not in date range",
                "publisher": "Tech News Yesterday"
            }
        ]
        mock_yf_instance.get_news.return_value = fake_news_data

        # 2. Mock the SentenceTransformer model and its encode/cos_sim methods
        # We'll pretend the first category ("Earnings") is always the best match
        mock_model_instance = MockSentenceTransformer.return_value
        mock_scores = torch.tensor([[0.9, 0.1, 0.2, 0.3, 0.4, 0.5]]) # Mock tensor
        
        # Patch the util.cos_sim directly if it's used in the service
        with patch('app.services.news_service.util.cos_sim', return_value=mock_scores):
            # --- Act ---
            # Initialize the service (this will use our mocked model)
            service = NewsService()
            # The service's category names will be set during its __init__
            service.cat_names = ["Earnings", "M&A", "Guidance", "Dividends", "Product Launch", "Other"]
            
            result = service.get_categorized_news("AAPL", "2025-10-12", "2025-10-15")

        # --- Assert ---
        # 1. Check that we got only the one article within the date range
        self.assertEqual(len(result), 1)
        
        # 2. Check that the returned object is a proper News model instance
        self.assertIsInstance(result[0], News)
        
        # 3. Check the content of the processed news item
        self.assertEqual(result[0].headline, "Apple announces new iPhone")
        self.assertEqual(result[0].source, "Tech News Today")
        
        # 4. Check that the "categorization" (which we faked to be 0.9) is correct
        self.assertAlmostEqual(result[0].sentiment_score.value, 0.9)
        self.assertEqual(result[0].sentiment_score.source, "ArticleCategorizer")

# A patch for 'torch' is needed if it's not installed in the test environment
# or to avoid GPU/CPU issues during testing.
try:
    import torch
except ImportError:
    # If torch isn't installed, create a mock for it
    sys.modules['torch'] = MagicMock()
    torch = sys.modules['torch']

if __name__ == '__main__':
    unittest.main()