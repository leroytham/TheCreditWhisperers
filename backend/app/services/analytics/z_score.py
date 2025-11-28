"""
Z-Score calculation for sentiment shock detection.

This module provides functions to calculate statistical Z-scores for sentiment
analysis, enabling detection of significant deviations from historical baselines.
"""

import statistics
from typing import Dict, List, Optional


def calculate_z_score(
    current_value: float,
    historical_values: List[float],
    min_samples: int = 2
) -> Dict[str, any]:
    """
    Calculate Z-score for a current value against historical baseline.

    The Z-score measures how many standard deviations the current value
    is from the historical mean, enabling detection of sentiment shocks.

    Formula: Z = (current_value - historical_mean) / historical_std

    Args:
        current_value: The current value to compare against history
        historical_values: List of historical values for baseline calculation
        min_samples: Minimum number of historical samples required (default 2)

    Returns:
        Dictionary containing:
            - z_score: float or None if insufficient data
            - interpretation: Human-readable classification
            - historical_mean: Mean of historical values
            - historical_std: Standard deviation of historical values
            - sample_count: Number of historical samples used
            - quality: "good", "low_confidence", or "insufficient_data"
    """
    if current_value is None:
        return _empty_z_score_result("no_data", "No Current Data")

    if not historical_values or len(historical_values) < min_samples:
        return _empty_z_score_result(
            "insufficient_history",
            "Insufficient History",
            days_of_history=len(historical_values) if historical_values else 0
        )

    # Calculate historical statistics
    historical_mean = statistics.mean(historical_values)

    if len(historical_values) >= 2:
        historical_std = statistics.stdev(historical_values)
    else:
        historical_std = 0.0

    # Calculate Z-Score
    if historical_std == 0:
        return {
            "z_score": 0.0,
            "interpretation": "No Historical Variation",
            "historical_mean": historical_mean,
            "historical_std": historical_std,
            "sample_count": len(historical_values),
            "current_value": current_value,
            "quality": "low_confidence"
        }

    z_score = (current_value - historical_mean) / historical_std
    interpretation = interpret_z_score(z_score)

    # Adjust quality based on sample size
    quality = "good" if len(historical_values) >= 5 else "low_confidence"

    return {
        "z_score": z_score,
        "interpretation": interpretation,
        "historical_mean": historical_mean,
        "historical_std": historical_std,
        "sample_count": len(historical_values),
        "current_value": current_value,
        "quality": quality
    }


def interpret_z_score(z_score: float) -> str:
    """
    Classify a Z-score into human-readable interpretation.

    Classification thresholds:
        > 2.0: Extreme Positive Shock
        > 1.5: Strong Positive Signal
        > 1.0: Moderately Positive
        > 0.5: Slightly Positive
        >= -0.5: Normal Range
        >= -1.0: Slightly Negative
        >= -1.5: Moderately Negative
        >= -2.0: Strong Negative Signal
        < -2.0: Extreme Negative Shock

    Args:
        z_score: The calculated Z-score value

    Returns:
        Human-readable interpretation string
    """
    if z_score > 2.0:
        return "Extreme Positive Shock"
    elif z_score > 1.5:
        return "Strong Positive Signal"
    elif z_score > 1.0:
        return "Moderately Positive"
    elif z_score > 0.5:
        return "Slightly Positive"
    elif z_score >= -0.5:
        return "Normal Range"
    elif z_score >= -1.0:
        return "Slightly Negative"
    elif z_score >= -1.5:
        return "Moderately Negative"
    elif z_score >= -2.0:
        return "Strong Negative Signal"
    else:
        return "Extreme Negative Shock"


def _empty_z_score_result(
    quality: str,
    interpretation: str,
    days_of_history: int = 0
) -> Dict[str, any]:
    """Return empty Z-score result structure."""
    return {
        "z_score": None,
        "interpretation": interpretation,
        "historical_mean": None,
        "historical_std": None,
        "sample_count": days_of_history,
        "current_value": None,
        "quality": quality
    }
