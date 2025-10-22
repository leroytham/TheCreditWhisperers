# models/sentiment.py
"""
This module defines SentimentScore and RelevanceScore classes to encapsulate
sentiment analysis and relevance scoring results. Using classes instead of
simple floats allows for richer data representation, including metadata like
the source of the score and the time it was calculated.
"""

from datetime import datetime
from app.config.scoring import (
    classify_sentiment,
    validate_sentiment_score,
    validate_relevance_score,
    SENTIMENT_MIN,
    SENTIMENT_MAX,
    RELEVANCE_MIN,
    RELEVANCE_MAX
)

class SentimentScore:
    """A container for all data related to a sentiment score.

    This class ensures that sentiment values are valid and provides helpful
    properties like a human-readable label, making it a robust and
    reusable component throughout the application.

    Attributes:
        value (float): The numeric sentiment score, between -1.0 and 1.0.
        source (str): The model or API that generated the score.
        confidence (float): The confidence level of the prediction (0.0 to 1.0).
        timestamp (datetime): The date and time when the score was created.

    Sentiment Classification:
        - x >= 0.35: Bullish
        - 0.15 <= x < 0.35: Somewhat-Bullish
        - -0.15 < x < 0.15: Neutral
        - -0.35 < x <= -0.15: Somewhat-Bearish
        - x <= -0.35: Bearish
    """
    def __init__(self, value: float, source: str, confidence: float = 1.0):
        # Input validation: Ensure the sentiment score is within the expected range.
        if not validate_sentiment_score(value):
            raise ValueError(f"Sentiment value must be between {SENTIMENT_MIN} and {SENTIMENT_MAX}")

        self.value = value
        self.source = source
        self.confidence = confidence
        # Automatically capture the timestamp when an instance is created.
        self.timestamp = datetime.now()

    @property
    def label(self) -> str:
        """Returns a human-readable string label based on the score's value.

        This is implemented as a property, so it can be accessed like an
        attribute (e.g., `score.label`) but the logic is executed on each access.

        Returns:
            str: A descriptive label: Bullish, Somewhat-Bullish, Neutral,
                 Somewhat-Bearish, or Bearish.
        """
        return classify_sentiment(self.value)

    def __repr__(self) -> str:
        """Provides a clean, developer-friendly string representation of the object."""
        return f"SentimentScore(value={self.value}, label='{self.label}')"


class RelevanceScore:
    """A container for all data related to a relevance score.

    This class ensures that relevance values are valid and provides
    consistent metadata tracking across the application.

    Attributes:
        value (float): The numeric relevance score, where 0 < x <= 1.0.
        source (str): The API or system that generated the score.
        confidence (float): The confidence level of the score (0.0 to 1.0).
        timestamp (datetime): The date and time when the score was created.

    Relevance Definition:
        - 0 < x <= 1: Higher score indicates higher relevance
    """
    def __init__(self, value: float, source: str, confidence: float = 1.0):
        # Input validation: Ensure the relevance score is within the expected range.
        if not validate_relevance_score(value):
            raise ValueError(f"Relevance value must be greater than {RELEVANCE_MIN} and at most {RELEVANCE_MAX}")

        self.value = value
        self.source = source
        self.confidence = confidence
        # Automatically capture the timestamp when an instance is created.
        self.timestamp = datetime.now()

    def __repr__(self) -> str:
        """Provides a clean, developer-friendly string representation of the object."""
        return f"RelevanceScore(value={self.value}, source='{self.source}')"