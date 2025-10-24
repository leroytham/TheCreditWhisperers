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


# =============================================================================
# SENTIMENT MOMENTUM CONFIGURATION
# =============================================================================

# Momentum Labels
MOMENTUM_LABEL_STRONG_POSITIVE = "Strong Positive Momentum"
MOMENTUM_LABEL_POSITIVE = "Positive Momentum"
MOMENTUM_LABEL_NEUTRAL = "Neutral Momentum"
MOMENTUM_LABEL_NEGATIVE = "Negative Momentum"
MOMENTUM_LABEL_STRONG_NEGATIVE = "Strong Negative Momentum"

# Momentum Interpretations (human-readable)
MOMENTUM_INTERPRETATION_STRONG_POSITIVE = "News is getting much better"
MOMENTUM_INTERPRETATION_POSITIVE = "News is getting better"
MOMENTUM_INTERPRETATION_NEUTRAL = "Sentiment is stable"
MOMENTUM_INTERPRETATION_NEGATIVE = "News is getting worse"
MOMENTUM_INTERPRETATION_STRONG_NEGATIVE = "News is getting much worse"

# Momentum Direction
MOMENTUM_DIRECTION_IMPROVING = "improving"
MOMENTUM_DIRECTION_STABLE = "stable"
MOMENTUM_DIRECTION_DETERIORATING = "deteriorating"

# Momentum Strength
MOMENTUM_STRENGTH_STRONG = "strong"
MOMENTUM_STRENGTH_WEAK = "weak"
MOMENTUM_STRENGTH_NEUTRAL = "neutral"


def classify_momentum(momentum: float, threshold_weak: float = 0.10, threshold_strong: float = 0.20) -> dict:
    """
    Classify sentiment momentum into categories based on magnitude and direction.

    Momentum measures the rate of change of sentiment over time using Fast vs. Slow scores:
        Momentum = FastScore - SlowScore

    Args:
        momentum: The momentum value (difference between fast and slow sentiment scores)
        threshold_weak: Threshold for weak momentum (default: 0.10)
        threshold_strong: Threshold for strong momentum (default: 0.20)

    Returns:
        Dictionary containing:
            - label: Classification label (e.g., "Positive Momentum")
            - interpretation: Human-readable interpretation (e.g., "News is getting better")
            - direction: "improving", "stable", or "deteriorating"
            - strength: "strong", "weak", or "neutral"
            - magnitude: Absolute value of momentum
            - sign: "+", "-", or "~" (for neutral)

    Classification Rules:
        - momentum >= threshold_strong:  Strong Positive Momentum
        - momentum >= threshold_weak:    Positive Momentum
        - -threshold_weak < momentum < threshold_weak: Neutral Momentum
        - momentum <= -threshold_weak:   Negative Momentum
        - momentum <= -threshold_strong: Strong Negative Momentum

    Examples:
        >>> classify_momentum(0.25, 0.10, 0.20)
        {'label': 'Strong Positive Momentum', 'interpretation': 'News is getting much better', ...}

        >>> classify_momentum(-0.15, 0.10, 0.20)
        {'label': 'Negative Momentum', 'interpretation': 'News is getting worse', ...}

        >>> classify_momentum(0.05, 0.10, 0.20)
        {'label': 'Neutral Momentum', 'interpretation': 'Sentiment is stable', ...}
    """
    magnitude = abs(momentum)

    # Classify based on thresholds
    if momentum >= threshold_strong:
        # Strong positive momentum
        return {
            "label": MOMENTUM_LABEL_STRONG_POSITIVE,
            "interpretation": MOMENTUM_INTERPRETATION_STRONG_POSITIVE,
            "direction": MOMENTUM_DIRECTION_IMPROVING,
            "strength": MOMENTUM_STRENGTH_STRONG,
            "magnitude": magnitude,
            "sign": "+"
        }
    elif momentum >= threshold_weak:
        # Weak positive momentum
        return {
            "label": MOMENTUM_LABEL_POSITIVE,
            "interpretation": MOMENTUM_INTERPRETATION_POSITIVE,
            "direction": MOMENTUM_DIRECTION_IMPROVING,
            "strength": MOMENTUM_STRENGTH_WEAK,
            "magnitude": magnitude,
            "sign": "+"
        }
    elif momentum <= -threshold_strong:
        # Strong negative momentum
        return {
            "label": MOMENTUM_LABEL_STRONG_NEGATIVE,
            "interpretation": MOMENTUM_INTERPRETATION_STRONG_NEGATIVE,
            "direction": MOMENTUM_DIRECTION_DETERIORATING,
            "strength": MOMENTUM_STRENGTH_STRONG,
            "magnitude": magnitude,
            "sign": "-"
        }
    elif momentum <= -threshold_weak:
        # Weak negative momentum
        return {
            "label": MOMENTUM_LABEL_NEGATIVE,
            "interpretation": MOMENTUM_INTERPRETATION_NEGATIVE,
            "direction": MOMENTUM_DIRECTION_DETERIORATING,
            "strength": MOMENTUM_STRENGTH_WEAK,
            "magnitude": magnitude,
            "sign": "-"
        }
    else:
        # Neutral momentum
        return {
            "label": MOMENTUM_LABEL_NEUTRAL,
            "interpretation": MOMENTUM_INTERPRETATION_NEUTRAL,
            "direction": MOMENTUM_DIRECTION_STABLE,
            "strength": MOMENTUM_STRENGTH_NEUTRAL,
            "magnitude": magnitude,
            "sign": "~"
        }


def get_momentum_definition() -> str:
    """
    Get the standardized momentum definition for API responses.

    Returns:
        String describing momentum classification thresholds
    """
    return (
        "Momentum = FastScore - SlowScore. "
        "Strong Positive (>= +0.20): News rapidly improving; "
        "Positive (>= +0.10): News improving; "
        "Neutral (-0.10 to +0.10): Sentiment stable; "
        "Negative (<= -0.10): News deteriorating; "
        "Strong Negative (<= -0.20): News rapidly deteriorating"
    )
