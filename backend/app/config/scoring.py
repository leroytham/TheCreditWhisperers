"""
Central configuration for sentiment and relevance scoring throughout the application.

This module defines the standardized thresholds, classifications, and definitions
for sentiment scores and relevance scores used across all services and APIs.
"""

# Sentiment Score Thresholds
SENTIMENT_THRESHOLD_BULLISH = 0.35
SENTIMENT_THRESHOLD_SOMEWHAT_BULLISH = 0.15
SENTIMENT_THRESHOLD_NEUTRAL_UPPER = 0.15
SENTIMENT_THRESHOLD_NEUTRAL_LOWER = -0.15
SENTIMENT_THRESHOLD_SOMEWHAT_BEARISH = -0.15
SENTIMENT_THRESHOLD_BEARISH = -0.35

# Sentiment Score Range
SENTIMENT_MIN = -1.0
SENTIMENT_MAX = 1.0

# Relevance Score Range
RELEVANCE_MIN = 0.0  # Exclusive (0 < x)
RELEVANCE_MAX = 1.0  # Inclusive (x <= 1)

# Sentiment Labels
SENTIMENT_LABEL_BULLISH = "Bullish"
SENTIMENT_LABEL_SOMEWHAT_BULLISH = "Somewhat-Bullish"
SENTIMENT_LABEL_NEUTRAL = "Neutral"
SENTIMENT_LABEL_SOMEWHAT_BEARISH = "Somewhat-Bearish"
SENTIMENT_LABEL_BEARISH = "Bearish"

# Score Definitions (for API responses and documentation)
SENTIMENT_SCORE_DEFINITION = "x <= -0.35: Bearish; -0.35 < x <= -0.15: Somewhat-Bearish; -0.15 < x < 0.15: Neutral; 0.15 <= x < 0.35: Somewhat-Bullish; x >= 0.35: Bullish"

RELEVANCE_SCORE_DEFINITION = (
    "0 < x <= 1, with a higher score indicating higher relevance."
)


def classify_sentiment(score: float) -> str:
    """
    Classify a sentiment score into one of five categories.

    Args:
        score: Sentiment score value (expected range: -1.0 to 1.0)

    Returns:
        String label: Bullish, Somewhat-Bullish, Neutral, Somewhat-Bearish, or Bearish

    Classification Rules:
        - x >= 0.35: Bullish
        - 0.15 <= x < 0.35: Somewhat-Bullish
        - -0.15 < x < 0.15: Neutral
        - -0.35 < x <= -0.15: Somewhat-Bearish
        - x <= -0.35: Bearish
    """
    if score >= SENTIMENT_THRESHOLD_BULLISH:
        return SENTIMENT_LABEL_BULLISH
    elif score >= SENTIMENT_THRESHOLD_SOMEWHAT_BULLISH:
        return SENTIMENT_LABEL_SOMEWHAT_BULLISH
    elif score > SENTIMENT_THRESHOLD_SOMEWHAT_BEARISH:
        return SENTIMENT_LABEL_NEUTRAL
    elif score > SENTIMENT_THRESHOLD_BEARISH:
        return SENTIMENT_LABEL_SOMEWHAT_BEARISH
    else:
        return SENTIMENT_LABEL_BEARISH


def validate_sentiment_score(score: float) -> bool:
    """
    Validate that a sentiment score is within the acceptable range.

    Args:
        score: Sentiment score value to validate

    Returns:
        True if score is within [-1.0, 1.0], False otherwise
    """
    return SENTIMENT_MIN <= score <= SENTIMENT_MAX


def validate_relevance_score(score: float) -> bool:
    """
    Validate that a relevance score is within the acceptable range.

    Args:
        score: Relevance score value to validate

    Returns:
        True if score is within (0.0, 1.0], False otherwise
    """
    return RELEVANCE_MIN < score <= RELEVANCE_MAX


def get_score_definitions() -> dict:
    """
    Get the standardized score definitions for API responses.

    Returns:
        Dictionary containing sentiment and relevance score definitions
    """
    return {
        "sentiment_score_definition": SENTIMENT_SCORE_DEFINITION,
        "relevance_score_definition": RELEVANCE_SCORE_DEFINITION
    }


# Alpha Vantage Label Mapping (direct 1:1 mapping)
ALPHA_VANTAGE_LABEL_MAP = {
    "Bearish": SENTIMENT_LABEL_BEARISH,
    "Somewhat-Bearish": SENTIMENT_LABEL_SOMEWHAT_BEARISH,
    "Neutral": SENTIMENT_LABEL_NEUTRAL,
    "Somewhat-Bullish": SENTIMENT_LABEL_SOMEWHAT_BULLISH,
    "Somewhat Bullish": SENTIMENT_LABEL_SOMEWHAT_BULLISH,  # Alternative format
    "Bullish": SENTIMENT_LABEL_BULLISH,
}


def map_alpha_vantage_label(av_label: str) -> str:
    """
    Map Alpha Vantage sentiment label to standardized label.

    Args:
        av_label: Label from Alpha Vantage API

    Returns:
        Standardized sentiment label
    """
    return ALPHA_VANTAGE_LABEL_MAP.get(av_label, SENTIMENT_LABEL_NEUTRAL)
