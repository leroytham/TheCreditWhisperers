# tests/models/test_sentiment.py

import unittest
from app.models import SentimentScore

class TestSentimentScore(unittest.TestCase):

    def test_sentiment_creation(self):
        """Test successful creation of a SentimentScore object."""
        score = SentimentScore(value=0.75, source="Test Model")
        self.assertEqual(score.value, 0.75)
        self.assertEqual(score.source, "Test Model")
        self.assertIsNotNone(score.timestamp)

    def test_sentiment_value_validation(self):
        """Test that value must be between -1.0 and 1.0."""
        with self.assertRaises(ValueError):
            SentimentScore(value=1.1, source="Invalid Model")
        with self.assertRaises(ValueError):
            SentimentScore(value=-1.1, source="Invalid Model")

    def test_sentiment_label_property(self):
        """Test the correctness of the label property."""
        self.assertEqual(SentimentScore(0.8, "Test").label, "Very Positive")
        self.assertEqual(SentimentScore(0.3, "Test").label, "Positive")
        self.assertEqual(SentimentScore(0.0, "Test").label, "Neutral")
        self.assertEqual(SentimentScore(-0.4, "Test").label, "Negative")
        self.assertEqual(SentimentScore(-0.9, "Test").label, "Very Negative")

    def test_repr_method(self):
        """Test the string representation of the object."""
        score = SentimentScore(value=0.6, source="Test Model")
        self.assertEqual(repr(score), "SentimentScore(value=0.6, label='Very Positive')")