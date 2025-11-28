"""
Exponential decay functions for time-based weighting.

This module provides functions for calculating exponential decay weights,
commonly used to weight recent data more heavily than older data in
sentiment analysis and other time-series applications.
"""

import math
from typing import Optional


def calculate_decay_constant(half_life_hours: float) -> float:
    """
    Calculate decay constant k from half-life.

    Formula: k = ln(2) / half_life_hours

    With this constant, the weight at half_life_hours will be exactly 0.5.

    Args:
        half_life_hours: Time in hours for weight to decay to 50%

    Returns:
        Decay constant k

    Raises:
        ValueError: If half_life_hours is <= 0
    """
    if half_life_hours <= 0:
        raise ValueError("half_life_hours must be positive")
    return math.log(2) / half_life_hours


def exponential_decay_weight(
    age_hours: float,
    decay_constant: float
) -> float:
    """
    Calculate exponential decay weight for a given age.

    Formula: weight = e^(-k * age_hours)

    Example weights with 24-hour half-life (k ≈ 0.0289):
        - 0 hours: weight = 1.0 (100%)
        - 24 hours: weight = 0.5 (50%)
        - 48 hours: weight = 0.25 (25%)
        - 168 hours (7 days): weight ≈ 0.04 (4%)

    Args:
        age_hours: Age in hours (time since publication/creation)
        decay_constant: Decay constant k (use calculate_decay_constant)

    Returns:
        Decay weight between 0.0 and 1.0
    """
    if age_hours <= 0:
        return 1.0
    return math.exp(-decay_constant * age_hours)


def exponential_decay_weight_from_half_life(
    age_hours: float,
    half_life_hours: float = 24.0
) -> float:
    """
    Calculate exponential decay weight using half-life directly.

    Convenience function that calculates the decay constant internally.

    Args:
        age_hours: Age in hours
        half_life_hours: Half-life in hours (default 24)

    Returns:
        Decay weight between 0.0 and 1.0
    """
    k = calculate_decay_constant(half_life_hours)
    return exponential_decay_weight(age_hours, k)


def calculate_combined_weight(
    relevance_score: float,
    age_hours: float,
    decay_constant: float
) -> float:
    """
    Calculate combined weight from relevance and recency.

    Formula: CombinedWeight = relevance_score * e^(-k * age_hours)

    This is the standard weighting formula used throughout the sentiment
    analysis system, combining content relevance with time decay.

    Args:
        relevance_score: Content relevance score (0.0 to 1.0)
        age_hours: Age in hours
        decay_constant: Decay constant k

    Returns:
        Combined weight (relevance * recency)
    """
    recency_weight = exponential_decay_weight(age_hours, decay_constant)
    return relevance_score * recency_weight


def half_life_from_decay_constant(decay_constant: float) -> Optional[float]:
    """
    Calculate half-life from decay constant.

    Formula: half_life = ln(2) / k

    Args:
        decay_constant: Decay constant k

    Returns:
        Half-life in hours, or None if k is 0
    """
    if decay_constant <= 0:
        return None
    return math.log(2) / decay_constant


# Pre-calculated common decay constants for performance
DECAY_CONSTANTS = {
    "7h": calculate_decay_constant(7.0),    # Fast decay (7-hour half-life)
    "24h": calculate_decay_constant(24.0),  # Standard decay (24-hour half-life)
    "48h": calculate_decay_constant(48.0),  # Slow decay (48-hour half-life)
    "168h": calculate_decay_constant(168.0) # Weekly decay (7-day half-life)
}
