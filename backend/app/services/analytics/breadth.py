"""
Sentiment breadth metrics for bullish/bearish distribution analysis.

This module provides functions to calculate sentiment breadth - the ratio
of bullish to bearish sentiment - helping identify market-wide sentiment
patterns beyond simple averages.
"""

from typing import Dict, List, Any, Optional

# Default thresholds for sentiment classification
DEFAULT_BULLISH_THRESHOLD = 0.35
DEFAULT_BEARISH_THRESHOLD = -0.35
DEFAULT_MIN_RELEVANCE_THRESHOLD = 0.1


def calculate_breadth_score(
    num_bullish: int,
    num_bearish: int
) -> float:
    """
    Calculate breadth score from bullish and bearish counts.

    Formula: breadth_score = (num_bullish - num_bearish) / total_directional

    The score ranges from -1.0 (all bearish) to +1.0 (all bullish).

    Args:
        num_bullish: Count of bullish items
        num_bearish: Count of bearish items

    Returns:
        Breadth score between -1.0 and +1.0, or 0.0 if no directional data
    """
    total_directional = num_bullish + num_bearish
    if total_directional == 0:
        return 0.0
    return (num_bullish - num_bearish) / total_directional


def calculate_breadth_metrics(
    sentiment_scores: List[float],
    relevance_scores: Optional[List[float]] = None,
    bullish_threshold: float = DEFAULT_BULLISH_THRESHOLD,
    bearish_threshold: float = DEFAULT_BEARISH_THRESHOLD,
    min_relevance_threshold: float = DEFAULT_MIN_RELEVANCE_THRESHOLD
) -> Dict[str, Any]:
    """
    Calculate comprehensive breadth metrics from sentiment scores.

    Counts the number of bullish, bearish, and neutral items, then
    calculates a breadth score showing the bull/bear ratio.

    Args:
        sentiment_scores: List of sentiment score values
        relevance_scores: Optional list of relevance scores for filtering
        bullish_threshold: Score threshold for bullish classification (default 0.35)
        bearish_threshold: Score threshold for bearish classification (default -0.35)
        min_relevance_threshold: Minimum relevance to include (default 0.1)

    Returns:
        Dictionary containing:
            - breadth_score: float (-1.0 to +1.0)
            - num_bullish: int
            - num_bearish: int
            - num_neutral: int
            - total_directional: int (bullish + bearish)
            - total_items: int
    """
    if not sentiment_scores:
        return _empty_breadth_data()

    num_bullish = 0
    num_bearish = 0
    num_neutral = 0

    for i, score in enumerate(sentiment_scores):
        # Apply relevance filter if provided
        if relevance_scores and i < len(relevance_scores):
            if relevance_scores[i] < min_relevance_threshold:
                continue

        # Classify sentiment
        if score >= bullish_threshold:
            num_bullish += 1
        elif score <= bearish_threshold:
            num_bearish += 1
        else:
            num_neutral += 1

    total_directional = num_bullish + num_bearish
    breadth_score = calculate_breadth_score(num_bullish, num_bearish)

    return {
        "breadth_score": breadth_score,
        "num_bullish": num_bullish,
        "num_bearish": num_bearish,
        "num_neutral": num_neutral,
        "total_directional": total_directional,
        "total_items": num_bullish + num_bearish + num_neutral
    }


def calculate_breadth_from_items(
    items: List[Dict[str, Any]],
    sentiment_key: str = "sentiment_score",
    relevance_key: str = "relevance_score",
    bullish_threshold: float = DEFAULT_BULLISH_THRESHOLD,
    bearish_threshold: float = DEFAULT_BEARISH_THRESHOLD,
    min_relevance_threshold: float = DEFAULT_MIN_RELEVANCE_THRESHOLD
) -> Dict[str, Any]:
    """
    Calculate breadth metrics from a list of dictionaries.

    Convenience function that extracts scores from item dictionaries
    and calculates breadth metrics.

    Args:
        items: List of dictionaries containing sentiment and relevance data
        sentiment_key: Key for sentiment score in item dict
        relevance_key: Key for relevance score in item dict
        bullish_threshold: Score threshold for bullish classification
        bearish_threshold: Score threshold for bearish classification
        min_relevance_threshold: Minimum relevance to include

    Returns:
        Dictionary with breadth metrics
    """
    if not items:
        return _empty_breadth_data()

    num_bullish = 0
    num_bearish = 0
    num_neutral = 0

    for item in items:
        score = item.get(sentiment_key, 0.0)
        relevance = item.get(relevance_key, 1.0)

        # Apply relevance filter
        if relevance < min_relevance_threshold:
            continue

        # Classify sentiment
        if score >= bullish_threshold:
            num_bullish += 1
        elif score <= bearish_threshold:
            num_bearish += 1
        else:
            num_neutral += 1

    total_directional = num_bullish + num_bearish
    breadth_score = calculate_breadth_score(num_bullish, num_bearish)

    return {
        "breadth_score": breadth_score,
        "num_bullish": num_bullish,
        "num_bearish": num_bearish,
        "num_neutral": num_neutral,
        "total_directional": total_directional,
        "total_items": num_bullish + num_bearish + num_neutral
    }


def interpret_breadth(
    breadth_score: float,
    num_bullish: int = 0,
    num_bearish: int = 0
) -> str:
    """
    Generate human-readable breadth interpretation.

    Args:
        breadth_score: Calculated breadth score (-1.0 to +1.0)
        num_bullish: Number of bullish items (for detail message)
        num_bearish: Number of bearish items (for detail message)

    Returns:
        Human-readable interpretation string
    """
    total = num_bullish + num_bearish

    if total == 0:
        return "No directional sentiment data"

    detail = f"({num_bullish} bullish vs {num_bearish} bearish)"

    if breadth_score > 0.5:
        return f"Overwhelmingly Bullish {detail}"
    elif breadth_score > 0.2:
        return f"Moderately Bullish {detail}"
    elif breadth_score >= -0.2:
        return f"Mixed Sentiment {detail}"
    elif breadth_score >= -0.5:
        return f"Moderately Bearish {detail}"
    else:
        return f"Overwhelmingly Bearish {detail}"


def get_breadth_quality(total_directional: int) -> str:
    """
    Determine data quality based on sample size.

    Args:
        total_directional: Total count of directional (non-neutral) items

    Returns:
        Quality indicator string
    """
    if total_directional >= 10:
        return "good"
    elif total_directional >= 5:
        return "low_confidence"
    else:
        return "insufficient_sample"


def _empty_breadth_data() -> Dict[str, Any]:
    """Return empty breadth data structure."""
    return {
        "breadth_score": 0.0,
        "num_bullish": 0,
        "num_bearish": 0,
        "num_neutral": 0,
        "total_directional": 0,
        "total_items": 0
    }
