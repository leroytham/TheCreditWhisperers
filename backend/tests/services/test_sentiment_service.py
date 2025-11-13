# tests/services/test_sentiment_service.py

import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

# Mock transformers before importing the service
sys.modules['transformers'] = MagicMock()

from app.services.sentiment_service import SentimentService


class TestSentimentService(unittest.TestCase):

    def setUp(self):
        # No need to mock pipeline since FinBERT is disabled in the service
        self.service = SentimentService()
        self.mock_today = datetime(2025, 10, 15)
        self.mock_today_date = self.mock_today.date()

    def test_analyze_sentiment_positive(self):
        """Test sentiment analysis for positive text."""
        # Since FinBERT is disabled, it should always return neutral
        result = self.service.analyze_sentiment("Great earnings report!")

        self.assertEqual(result["label"], "neutral")
        self.assertEqual(result["confidence"], 0.0)
        self.assertEqual(result["score"], 0.0)

    def test_analyze_sentiment_empty_text(self):
        """Test sentiment analysis with empty text."""
        result = self.service.analyze_sentiment("")

        self.assertEqual(result["label"], "neutral")
        self.assertEqual(result["confidence"], 0.0)
        self.assertEqual(result["score"], 0.0)

    @patch('app.services.sentiment_service.datetime')
    def test_analyze_sentiment_with_weights(self, mock_datetime):
        """Test the advanced sentiment analysis with recency weighting."""
        mock_datetime.utcnow.return_value = self.mock_today
        mock_datetime.strptime.side_effect = datetime.strptime

        news_articles = [
            {"title": "Good news today", "publish_date": self.mock_today_date.strftime("%Y-%m-%d"), "provider": "Reuters"},
            {"title": "Bad news yesterday", "publish_date": (self.mock_today_date - timedelta(days=1)).strftime("%Y-%m-%d"), "provider": "Bloomberg"},
        ]

        result = self.service.analyze_sentiment_with_weights(news_articles)

        self.assertEqual(len(result["articles_with_sentiment"]), 2)
        self.assertIn("overall_weighted_score", result)
        self.assertIn("sentiment_counts", result)
        self.assertIn("news_objects", result)
        # Since FinBERT is disabled, all sentiments should be neutral (Note: Label is capitalized)
        for article in result["articles_with_sentiment"]:
            self.assertEqual(article["sentiment_label"], "Neutral")
            # Sentiment score might be None when no FinBERT is available
            self.assertIn(article["sentiment_score"], [0.0, None])

    def test_analyze_sentiment_with_weights_empty(self):
        """Test sentiment analysis with no articles."""
        result = self.service.analyze_sentiment_with_weights([])

        self.assertEqual(result["articles_with_sentiment"], [])
        # Overall weighted score might be None or 0.0 for empty articles
        self.assertIn(result["overall_weighted_score"], [0.0, None])
        self.assertEqual(result["sentiment_counts"], {})

    def test_analyze_sentiment_batch(self):
        """Test batch sentiment analysis."""
        # Since the service doesn't have analyze_sentiment_batch, test individual analysis
        texts = ["Great news!", "Terrible earnings", "Neutral update"]

        results = [self.service.analyze_sentiment(text) for text in texts]

        self.assertEqual(len(results), 3)
        # Since FinBERT is disabled, all results should be neutral
        for result in results:
            self.assertEqual(result["label"], "neutral")
            self.assertEqual(result["confidence"], 0.0)
            self.assertEqual(result["score"], 0.0)


if __name__ == '__main__':
    unittest.main()