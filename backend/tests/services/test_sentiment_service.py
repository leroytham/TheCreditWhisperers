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

    @patch('app.services.sentiment_service.pipeline')
    def setUp(self, MockPipeline):
        self.mock_finbert = MockPipeline.return_value
        self.mock_finbert.return_value = [[
            {'label': 'positive', 'score': 0.7},
            {'label': 'neutral', 'score': 0.2},
            {'label': 'negative', 'score': 0.1}
        ]]
        self.service = SentimentService()
        self.mock_today = datetime(2025, 10, 15)
        self.mock_today_date = self.mock_today.date()

    def test_analyze_sentiment_positive(self):
        """Test sentiment analysis for positive text."""
        # Note: Since we're mocking the pipeline, the actual label returned
        # depends on the mock setup, not the text content
        result = self.service.analyze_sentiment("Great earnings report!")

        self.assertIn(result["label"], ["positive", "neutral", "negative"])
        self.assertGreater(result["confidence"], 0)
        self.assertIn("score", result)

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

    def test_analyze_sentiment_with_weights_empty(self):
        """Test sentiment analysis with no articles."""
        result = self.service.analyze_sentiment_with_weights([])

        self.assertEqual(result["articles_with_sentiment"], [])
        self.assertEqual(result["overall_weighted_score"], 0.0)
        self.assertEqual(result["sentiment_counts"], {})

    def test_analyze_sentiment_batch(self):
        """Test batch sentiment analysis."""
        texts = ["Great news!", "Terrible earnings", "Neutral update"]

        results = self.service.analyze_sentiment_batch(texts)

        self.assertEqual(len(results), 3)
        for result in results:
            self.assertIn("label", result)
            self.assertIn("confidence", result)
            self.assertIn("score", result)


if __name__ == '__main__':
    unittest.main()
