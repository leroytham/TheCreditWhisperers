"""
SentimentScore Value Object

An immutable value object for sentiment scores that encapsulates
classification logic and provides type-safe sentiment handling.
"""

from dataclasses import dataclass
from typing import Optional

from app.core.sentiment_constants import SentimentThresholds, SentimentLabel


@dataclass(frozen=True)
class SentimentScore:
    """
    Immutable value object representing a sentiment score.

    This class encapsulates a raw sentiment score (typically between -1 and 1)
    and provides computed properties for classification and analysis.

    Example:
        >>> score = SentimentScore(0.42)
        >>> score.label
        <SentimentLabel.BULLISH: 'Bullish'>
        >>> score.is_bullish
        True
        >>> float(score)
        0.42
    """

    value: float

    @property
    def label(self) -> SentimentLabel:
        """Get the classified sentiment label."""
        return SentimentThresholds.classify(self.value)

    @property
    def label_str(self) -> str:
        """Get the sentiment label as a string."""
        return self.label.value

    @property
    def is_bullish(self) -> bool:
        """Check if score indicates bullish sentiment (>= 0.15)."""
        return SentimentThresholds.is_bullish(self.value)

    @property
    def is_bearish(self) -> bool:
        """Check if score indicates bearish sentiment (<= -0.15)."""
        return SentimentThresholds.is_bearish(self.value)

    @property
    def is_neutral(self) -> bool:
        """Check if score indicates neutral sentiment."""
        return SentimentThresholds.is_neutral(self.value)

    @property
    def is_strong_signal(self) -> bool:
        """Check if score is a strong signal (bullish or bearish)."""
        return SentimentThresholds.is_strong_signal(self.value)

    @classmethod
    def from_raw(cls, value: Optional[float]) -> "SentimentScore":
        """
        Create a SentimentScore from a nullable value.
        Returns a neutral score (0.0) if value is None.

        Args:
            value: The raw sentiment score or None

        Returns:
            A SentimentScore instance
        """
        return cls(value if value is not None else 0.0)

    def __float__(self) -> float:
        """Allow using SentimentScore where float is expected (backward compatibility)."""
        return self.value

    def __repr__(self) -> str:
        return f"SentimentScore(value={self.value}, label='{self.label_str}')"

    def format(self, decimals: int = 2) -> str:
        """
        Format the score for display with sign and precision.

        Args:
            decimals: Number of decimal places (default: 2)

        Returns:
            Formatted string (e.g., "+0.35", "-0.15")
        """
        sign = "+" if self.value >= 0 else ""
        return f"{sign}{self.value:.{decimals}f}"
