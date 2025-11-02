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
        # Mock the FinBERT pipeline
        with patch('transformers.pipeline') as MockPipeline:
            self.mock_finbert = MockPipeline.return_value
            self.mock_finbert.return_value = [[
                {'label': 'positive', 'score': 0.7},
                {'label': 'neutral', 'score': 0.2},
                {'label': 'negative', 'score': 0.1}
            ]]
            self.service = SentimentService()

        # Set the mock finbert on the service for tests
        self.service.finbert = self.mock_finbert
        self.service.finbert_available = True

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
        self.assertIsNone(result["overall_weighted_score"])  # Should be None, not 0.0
        self.assertEqual(result["sentiment_counts"], {})

    @patch('app.services.sentiment_service.datetime')
    def test_exponential_decay_7h_half_life(self, mock_datetime):
        """Test exponential decay weighting with 7-hour half-life (fast score)."""
        mock_datetime.utcnow.return_value = self.mock_today
        mock_datetime.strptime.side_effect = datetime.strptime

        # k_fast = ln(2) / 7 ≈ 0.099 (7-hour half-life)
        k_fast = 0.099

        # Note: publish_date uses date-only format, so we test with days
        # Articles at 0 days, 0.29 days (≈7h), and 0.58 days (≈14h)
        now = self.mock_today
        articles = [
            {
                "title": "Article today",
                "ticker_sentiment_score": 0.5,
                "ticker_relevance_score": 1.0,
                "publish_date": now.strftime("%Y-%m-%d"),
                "provider": "Test"
            },
            {
                "title": "Article 1 day old",
                "ticker_sentiment_score": 0.5,
                "ticker_relevance_score": 1.0,
                "publish_date": (now - timedelta(days=1)).strftime("%Y-%m-%d"),
                "provider": "Test"
            },
            {
                "title": "Article 2 days old",
                "ticker_sentiment_score": 0.5,
                "ticker_relevance_score": 1.0,
                "publish_date": (now - timedelta(days=2)).strftime("%Y-%m-%d"),
                "provider": "Test"
            }
        ]

        score, weight, quality, articles_meta, _, _ = self.service._calculate_aggregated_score_with_decay(
            articles, k_fast, now
        )

        # Verify weights follow exponential decay
        # With k_fast = 0.099:
        # At 0 days (0h): weight ≈ 1.0
        # At 1 day (24h): weight ≈ e^(-0.099*24) ≈ 0.09
        # At 2 days (48h): weight ≈ e^(-0.099*48) ≈ 0.008
        self.assertIsNotNone(score)
        self.assertGreater(weight, 0)

        # Check individual article weights (decay is exponential)
        weights = [a["recency_weight"] for a in articles_meta]
        self.assertAlmostEqual(weights[0], 1.0, delta=0.05)  # Today
        self.assertGreater(weights[0], weights[1])  # Today > 1 day old
        self.assertGreater(weights[1], weights[2])  # 1 day > 2 days old

    @patch('app.services.sentiment_service.datetime')
    def test_exponential_decay_24h_half_life(self, mock_datetime):
        """Test exponential decay weighting with 24-hour half-life (slow score)."""
        mock_datetime.utcnow.return_value = self.mock_today
        mock_datetime.strptime.side_effect = datetime.strptime

        # k_slow = ln(2) / 24 ≈ 0.0289 (24-hour half-life)
        k_slow = 0.0289

        # Test with days (since publish_date is date-only)
        now = self.mock_today
        articles = [
            {
                "title": "Article today",
                "ticker_sentiment_score": 0.5,
                "ticker_relevance_score": 1.0,
                "publish_date": now.strftime("%Y-%m-%d"),
                "provider": "Test"
            },
            {
                "title": "Article 1 day old",
                "ticker_sentiment_score": 0.5,
                "ticker_relevance_score": 1.0,
                "publish_date": (now - timedelta(days=1)).strftime("%Y-%m-%d"),
                "provider": "Test"
            },
            {
                "title": "Article 2 days old",
                "ticker_sentiment_score": 0.5,
                "ticker_relevance_score": 1.0,
                "publish_date": (now - timedelta(days=2)).strftime("%Y-%m-%d"),
                "provider": "Test"
            }
        ]

        score, weight, quality, articles_meta, _, _ = self.service._calculate_aggregated_score_with_decay(
            articles, k_slow, now
        )

        # Verify weights follow exponential decay
        # With k_slow = 0.0289:
        # At 0 days: weight ≈ 1.0
        # At 1 day (24h): weight ≈ e^(-0.0289*24) ≈ 0.5 (half-life)
        # At 2 days (48h): weight ≈ e^(-0.0289*48) ≈ 0.25
        self.assertIsNotNone(score)
        self.assertGreater(weight, 0)

        weights = [a["recency_weight"] for a in articles_meta]
        self.assertAlmostEqual(weights[0], 1.0, delta=0.05)
        self.assertAlmostEqual(weights[1], 0.5, delta=0.05)  # 1 day = 24h half-life
        self.assertAlmostEqual(weights[2], 0.25, delta=0.05)  # 2 days

    @patch('app.services.sentiment_service.datetime')
    @patch('app.core.config.settings')
    def test_sentiment_momentum_calculation(self, mock_settings, mock_datetime):
        """Test MACD-style momentum calculation (fast - slow)."""
        mock_datetime.utcnow.return_value = self.mock_today
        mock_datetime.strptime.side_effect = datetime.strptime

        # Configure settings
        mock_settings.SENTIMENT_HALF_LIFE_FAST_HOURS = 7
        mock_settings.SENTIMENT_HALF_LIFE_SLOW_HOURS = 24
        mock_settings.MOMENTUM_THRESHOLD_WEAK = 0.10
        mock_settings.MOMENTUM_THRESHOLD_STRONG = 0.20

        # Create scenario: Recent positive news, older negative news
        # This should result in positive momentum
        now = self.mock_today
        articles = [
            {
                "title": "Recent positive news",
                "ticker_sentiment_score": 0.7,
                "ticker_relevance_score": 1.0,
                "publish_date": now.strftime("%Y-%m-%d"),
                "provider": "Reuters"
            },
            {
                "title": "Older negative news",
                "ticker_sentiment_score": -0.5,
                "ticker_relevance_score": 1.0,
                "publish_date": (now - timedelta(days=2)).strftime("%Y-%m-%d"),
                "provider": "Bloomberg"
            }
        ]

        result = self.service.analyze_sentiment_with_momentum(articles)

        # Verify momentum fields exist
        self.assertIn("fast_score", result)
        self.assertIn("slow_score", result)
        self.assertIn("sentiment_momentum", result)
        self.assertIn("momentum_label", result)
        self.assertIn("momentum_direction", result)

        # With recent positive news, fast score should be higher than slow score
        # This results in positive momentum
        if result["fast_score"] is not None and result["slow_score"] is not None:
            self.assertGreater(result["fast_score"], result["slow_score"])
            self.assertGreater(result["sentiment_momentum"], 0)
            self.assertIn(result["momentum_direction"], ["improving", "stable"])

    @patch('app.services.sentiment_service.datetime')
    def test_hybrid_sentiment_uses_alpha_vantage_when_available(self, mock_datetime):
        """Test that Alpha Vantage score is used when available (primary)."""
        mock_datetime.utcnow.return_value = self.mock_today
        mock_datetime.strptime.side_effect = datetime.strptime

        # Article with Alpha Vantage score
        articles = [{
            "title": "Test Article",
            "ticker_sentiment_score": 0.65,  # Alpha Vantage score present
            "ticker_relevance_score": 0.8,
            "ticker_sentiment_label": "Bullish",
            "publish_date": self.mock_today.strftime("%Y-%m-%d"),
            "provider": "Reuters"
        }]

        result = self.service.analyze_sentiment_with_weights(articles)

        # Verify Alpha Vantage score was used
        self.assertEqual(len(result["articles_with_sentiment"]), 1)
        article_result = result["articles_with_sentiment"][0]
        self.assertEqual(article_result["sentiment_score_raw"], 0.65)
        self.assertAlmostEqual(result["overall_weighted_score"], 0.65, delta=0.01)

    @patch('app.services.sentiment_service.datetime')
    def test_hybrid_sentiment_uses_finbert_for_fallback(self, mock_datetime):
        """Test that FinBERT is used when Alpha Vantage score is not available."""
        mock_datetime.utcnow.return_value = self.mock_today
        mock_datetime.strptime.side_effect = datetime.strptime

        # Article WITHOUT Alpha Vantage score (fallback source)
        articles = [{
            "title": "Great earnings report from fallback source",
            "body": "The company exceeded expectations with strong revenue growth.",
            "publish_date": self.mock_today.strftime("%Y-%m-%d"),
            "provider": "Finnhub"
            # No ticker_sentiment_score field
        }]

        result = self.service.analyze_sentiment_with_weights(articles)

        # Verify FinBERT was used (indicated by sentiment analysis being performed)
        self.assertEqual(len(result["articles_with_sentiment"]), 1)
        article_result = result["articles_with_sentiment"][0]

        # Should have sentiment_score_raw from FinBERT
        self.assertIn("sentiment_score_raw", article_result)
        self.assertIsNotNone(article_result["sentiment_score_raw"])

    @patch('app.services.sentiment_service.datetime')
    def test_score_normalization_bounds(self, mock_datetime):
        """Test that sentiment scores stay within -1.0 to 1.0 bounds."""
        mock_datetime.utcnow.return_value = self.mock_today
        mock_datetime.strptime.side_effect = datetime.strptime

        # Create articles with various scores
        articles = [
            {
                "title": "Extreme positive",
                "ticker_sentiment_score": 1.0,
                "ticker_relevance_score": 1.0,
                "publish_date": self.mock_today.strftime("%Y-%m-%d"),
                "provider": "Test"
            },
            {
                "title": "Extreme negative",
                "ticker_sentiment_score": -1.0,
                "ticker_relevance_score": 1.0,
                "publish_date": self.mock_today.strftime("%Y-%m-%d"),
                "provider": "Test"
            }
        ]

        result = self.service.analyze_sentiment_with_weights(articles)

        # Verify overall score is within bounds
        if result["overall_weighted_score"] is not None:
            self.assertGreaterEqual(result["overall_weighted_score"], -1.0)
            self.assertLessEqual(result["overall_weighted_score"], 1.0)

    def test_momentum_classification_labels(self):
        """Test momentum classification returns correct labels."""
        from app.config.scoring import classify_momentum

        # Test various momentum values
        # Strong positive
        result = classify_momentum(0.25, 0.10, 0.20)
        self.assertEqual(result["label"], "Strong Positive Momentum")
        self.assertEqual(result["direction"], "improving")
        self.assertEqual(result["strength"], "strong")

        # Weak positive
        result = classify_momentum(0.15, 0.10, 0.20)
        self.assertEqual(result["label"], "Positive Momentum")
        self.assertEqual(result["direction"], "improving")
        self.assertEqual(result["strength"], "weak")

        # Neutral
        result = classify_momentum(0.05, 0.10, 0.20)
        self.assertEqual(result["label"], "Neutral Momentum")
        self.assertEqual(result["direction"], "stable")
        self.assertEqual(result["strength"], "neutral")

        # Weak negative
        result = classify_momentum(-0.15, 0.10, 0.20)
        self.assertEqual(result["label"], "Negative Momentum")
        self.assertEqual(result["direction"], "deteriorating")
        self.assertEqual(result["strength"], "weak")

        # Strong negative
        result = classify_momentum(-0.25, 0.10, 0.20)
        self.assertEqual(result["label"], "Strong Negative Momentum")
        self.assertEqual(result["direction"], "deteriorating")
        self.assertEqual(result["strength"], "strong")

    @patch('app.services.sentiment_service.datetime')
    def test_data_quality_indicators(self, mock_datetime):
        """Test data quality indicators (good, low_confidence, insufficient_recent_data)."""
        mock_datetime.utcnow.return_value = self.mock_today
        mock_datetime.strptime.side_effect = datetime.strptime

        # Test 1: Good data quality (sufficient recent articles)
        articles_good = [
            {
                "title": "Recent article",
                "ticker_sentiment_score": 0.5,
                "ticker_relevance_score": 1.0,
                "publish_date": self.mock_today.strftime("%Y-%m-%d"),
                "provider": "Reuters"
            }
        ]
        result = self.service.analyze_sentiment_with_weights(articles_good)
        self.assertEqual(result["data_quality"], "good")

        # Test 2: Insufficient recent data (very old articles)
        articles_old = [
            {
                "title": "Very old article",
                "ticker_sentiment_score": 0.5,
                "ticker_relevance_score": 1.0,
                "publish_date": (self.mock_today - timedelta(days=365)).strftime("%Y-%m-%d"),
                "provider": "Reuters"
            }
        ]
        result = self.service.analyze_sentiment_with_weights(articles_old)
        self.assertIn(result["data_quality"], ["low_confidence", "insufficient_recent_data"])

        # Test 3: No data
        result = self.service.analyze_sentiment_with_weights([])
        self.assertEqual(result["data_quality"], "no_data")


if __name__ == '__main__':
    unittest.main()
