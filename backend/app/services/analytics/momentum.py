"""
Sentiment momentum calculation (MACD-style fast vs slow comparison).

This module provides functions to calculate sentiment momentum - the difference
between fast-decaying and slow-decaying sentiment scores - analogous to MACD
in technical analysis.
"""

from typing import Dict, Any, Optional

# Default momentum thresholds
DEFAULT_THRESHOLD_WEAK = 0.05
DEFAULT_THRESHOLD_STRONG = 0.15


def calculate_momentum(
    fast_score: Optional[float],
    slow_score: Optional[float]
) -> Optional[float]:
    """
    Calculate sentiment momentum from fast and slow scores.

    Formula: momentum = fast_score - slow_score

    Positive momentum (+) means sentiment is improving (bullish trend)
    Negative momentum (-) means sentiment is deteriorating (bearish trend)
    Near-zero momentum means sentiment is stable

    Args:
        fast_score: Short-term sentiment score (fast decay)
        slow_score: Long-term sentiment score (slow decay)

    Returns:
        Momentum value, or None if either score is None
    """
    if fast_score is None or slow_score is None:
        return None
    return fast_score - slow_score


def classify_momentum(
    momentum: Optional[float],
    threshold_weak: float = DEFAULT_THRESHOLD_WEAK,
    threshold_strong: float = DEFAULT_THRESHOLD_STRONG
) -> Dict[str, Any]:
    """
    Classify momentum into categories with interpretation.

    Classification thresholds:
        > threshold_strong: Strong Positive Momentum
        > threshold_weak: Weak Positive Momentum
        >= -threshold_weak: Stable Sentiment
        >= -threshold_strong: Weak Negative Momentum
        < -threshold_strong: Strong Negative Momentum

    Args:
        momentum: Calculated momentum value (fast_score - slow_score)
        threshold_weak: Threshold for weak momentum (default 0.05)
        threshold_strong: Threshold for strong momentum (default 0.15)

    Returns:
        Dictionary containing:
            - label: Classification label
            - interpretation: Human-readable description
            - direction: "improving", "stable", or "deteriorating"
            - strength: "strong", "weak", or "neutral"
            - magnitude: Absolute value of momentum
            - sign: "+", "-", or "~"
    """
    if momentum is None:
        return {
            "label": None,
            "interpretation": "Insufficient data for momentum calculation",
            "direction": None,
            "strength": None,
            "magnitude": None,
            "sign": None
        }

    magnitude = abs(momentum)

    if momentum > threshold_strong:
        return {
            "label": "Strong Positive Momentum",
            "interpretation": "Sentiment rapidly improving",
            "direction": "improving",
            "strength": "strong",
            "magnitude": magnitude,
            "sign": "+"
        }
    elif momentum > threshold_weak:
        return {
            "label": "Weak Positive Momentum",
            "interpretation": "Sentiment slightly improving",
            "direction": "improving",
            "strength": "weak",
            "magnitude": magnitude,
            "sign": "+"
        }
    elif momentum >= -threshold_weak:
        return {
            "label": "Stable Sentiment",
            "interpretation": "Sentiment holding steady",
            "direction": "stable",
            "strength": "neutral",
            "magnitude": magnitude,
            "sign": "~"
        }
    elif momentum >= -threshold_strong:
        return {
            "label": "Weak Negative Momentum",
            "interpretation": "Sentiment slightly deteriorating",
            "direction": "deteriorating",
            "strength": "weak",
            "magnitude": magnitude,
            "sign": "-"
        }
    else:
        return {
            "label": "Strong Negative Momentum",
            "interpretation": "Sentiment rapidly deteriorating",
            "direction": "deteriorating",
            "strength": "strong",
            "magnitude": magnitude,
            "sign": "-"
        }


def get_momentum_quality(
    fast_quality: str,
    slow_quality: str
) -> str:
    """
    Determine momentum data quality from component qualities.

    Momentum quality inherits the worst quality from its components.

    Args:
        fast_quality: Quality of fast score ("good", "low_confidence", etc.)
        slow_quality: Quality of slow score ("good", "low_confidence", etc.)

    Returns:
        Combined quality indicator
    """
    if fast_quality == "insufficient_recent_data" or slow_quality == "insufficient_recent_data":
        return "insufficient_recent_data"
    elif fast_quality == "low_confidence" or slow_quality == "low_confidence":
        return "low_confidence"
    elif fast_quality == "no_data" or slow_quality == "no_data":
        return "no_data"
    else:
        return "good"


def interpret_volume(weight: float) -> str:
    """
    Classify effective news volume coverage.

    Args:
        weight: Total combined weight of news items

    Returns:
        Volume interpretation string
    """
    if weight < 1.0:
        return "Low Coverage"
    elif weight <= 10.0:
        return "Medium Coverage"
    else:
        return "High Coverage"


def get_momentum_definition(
    threshold_weak: float = DEFAULT_THRESHOLD_WEAK,
    threshold_strong: float = DEFAULT_THRESHOLD_STRONG
) -> str:
    """
    Get human-readable definition of momentum thresholds.

    Args:
        threshold_weak: Weak momentum threshold
        threshold_strong: Strong momentum threshold

    Returns:
        Formatted definition string
    """
    return (
        f"Momentum = FastScore - SlowScore. "
        f"Strong: |m| > {threshold_strong}, "
        f"Weak: |m| > {threshold_weak}, "
        f"Stable: |m| <= {threshold_weak}"
    )
