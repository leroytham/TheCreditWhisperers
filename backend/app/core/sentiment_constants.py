"""
Centralized sentiment classification thresholds.
Single source of truth for all sentiment scoring across the backend.

This module provides:
- SentimentLabel enum for standardized sentiment labels
- SentimentThresholds class with threshold values and classification logic
- Backward-compatible exports for existing code
"""

from enum import Enum
from typing import Literal


class SentimentLabel(str, Enum):
    """Standardized sentiment classification labels."""
    BULLISH = "Bullish"
    SOMEWHAT_BULLISH = "Somewhat-Bullish"
    NEUTRAL = "Neutral"
    SOMEWHAT_BEARISH = "Somewhat-Bearish"
    BEARISH = "Bearish"


class SentimentThresholds:
    """
    Sentiment classification thresholds.

    Classification Rules:
    - score >= 0.35: Bullish
    - 0.15 <= score < 0.35: Somewhat-Bullish
    - -0.15 < score < 0.15: Neutral
    - -0.35 < score <= -0.15: Somewhat-Bearish
    - score <= -0.35: Bearish
    """
    BULLISH: float = 0.35
    SOMEWHAT_BULLISH: float = 0.15
    NEUTRAL_UPPER: float = 0.15
    NEUTRAL_LOWER: float = -0.15
    SOMEWHAT_BEARISH: float = -0.15
    BEARISH: float = -0.35

    @classmethod
    def classify(cls, score: float) -> SentimentLabel:
        """
        Classify a sentiment score into a SentimentLabel.

        Args:
            score: Sentiment score, typically between -1 and 1

        Returns:
            SentimentLabel enum value
        """
        if score >= cls.BULLISH:
            return SentimentLabel.BULLISH
        elif score >= cls.SOMEWHAT_BULLISH:
            return SentimentLabel.SOMEWHAT_BULLISH
        elif score <= cls.BEARISH:
            return SentimentLabel.BEARISH
        elif score <= cls.NEUTRAL_LOWER:
            return SentimentLabel.SOMEWHAT_BEARISH
        return SentimentLabel.NEUTRAL

    @classmethod
    def classify_str(cls, score: float) -> str:
        """
        Classify a sentiment score and return the string label.

        Args:
            score: Sentiment score, typically between -1 and 1

        Returns:
            String label (e.g., "Bullish", "Somewhat-Bearish")
        """
        return cls.classify(score).value

    @classmethod
    def is_bullish(cls, score: float) -> bool:
        """Check if score indicates bullish sentiment (>= somewhat bullish)."""
        return score >= cls.SOMEWHAT_BULLISH

    @classmethod
    def is_bearish(cls, score: float) -> bool:
        """Check if score indicates bearish sentiment (<= somewhat bearish)."""
        return score <= cls.SOMEWHAT_BEARISH

    @classmethod
    def is_neutral(cls, score: float) -> bool:
        """Check if score indicates neutral sentiment."""
        return cls.NEUTRAL_LOWER < score < cls.NEUTRAL_UPPER

    @classmethod
    def is_strong_signal(cls, score: float) -> bool:
        """Check if score indicates a strong signal (bullish or bearish)."""
        return score >= cls.BULLISH or score <= cls.BEARISH


# Backward-compatible exports for existing code
# These can be imported directly and used as before
BULLISH_STRONG_THRESHOLD = SentimentThresholds.BULLISH
BULLISH_WEAK_THRESHOLD = SentimentThresholds.SOMEWHAT_BULLISH
BEARISH_WEAK_THRESHOLD = SentimentThresholds.NEUTRAL_LOWER  # Same as SOMEWHAT_BEARISH
BEARISH_STRONG_THRESHOLD = SentimentThresholds.BEARISH


def classify_sentiment(score: float) -> str:
    """
    Classify sentiment score into label.

    Backward-compatible function that mirrors the original API.

    Args:
        score: Sentiment score, typically between -1 and 1

    Returns:
        String label (e.g., "Bullish", "Somewhat-Bearish")
    """
    return SentimentThresholds.classify_str(score)
