# models/sentiment.py
"""
This module defines a dedicated SentimentScore class to encapsulate all
information related to a sentiment analysis result. Using a class instead of
a simple float allows for richer data representation, including metadata like
the source of the score and the time it was calculated.
"""

from datetime import datetime

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
    """
    def __init__(self, value: float, source: str, confidence: float = 1.0):
        # Input validation: Ensure the sentiment score is within the expected range.
        if not -1.0 <= value <= 1.0:
            raise ValueError("Sentiment value must be between -1.0 and 1.0")
        
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
            str: A descriptive label like "Positive", "Negative", or "Neutral".
        """
        if self.value > 0.5:
            return "Very Positive"
        elif self.value > 0.1:
            return "Positive"
        elif self.value < -0.5:
            return "Very Negative"
        elif self.value < -0.1:
            return "Negative"
        else:
            return "Neutral"

    def __repr__(self) -> str:
        """Provides a clean, developer-friendly string representation of the object."""
        return f"SentimentScore(value={self.value}, label='{self.label}')"