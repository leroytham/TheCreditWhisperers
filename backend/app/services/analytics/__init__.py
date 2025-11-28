"""
Analytics utilities for sentiment analysis.

This package provides reusable analytics functions for:
- Z-score calculation (sentiment shock detection)
- Source concentration analysis (HHI)
- Topic analysis and sentiment breakdown by topic
- Exponential decay for time-based weighting
- Breadth metrics (bullish/bearish distribution)
- Momentum calculation (MACD-style fast vs slow)

These utilities are shared across multiple sentiment services to eliminate
code duplication and ensure consistent calculations.
"""

# Z-Score calculation
from .z_score import (
    calculate_z_score,
    interpret_z_score,
)

# Source concentration (HHI)
from .source_analysis import (
    calculate_hhi,
    interpret_hhi,
    calculate_source_concentration,
    calculate_source_concentration_from_mentions,
)

# Topic analysis
from .topic_analysis import (
    extract_topic_name,
    calculate_dominant_topic,
    calculate_sentiment_by_topic,
    analyze_topics,
    calculate_topic_analysis_from_mentions,
)

# Exponential decay
from .decay import (
    calculate_decay_constant,
    exponential_decay_weight,
    exponential_decay_weight_from_half_life,
    calculate_combined_weight,
    half_life_from_decay_constant,
    DECAY_CONSTANTS,
)

# Breadth metrics
from .breadth import (
    calculate_breadth_score,
    calculate_breadth_metrics,
    calculate_breadth_from_items,
    interpret_breadth,
    get_breadth_quality,
    DEFAULT_BULLISH_THRESHOLD,
    DEFAULT_BEARISH_THRESHOLD,
    DEFAULT_MIN_RELEVANCE_THRESHOLD,
)

# Momentum
from .momentum import (
    calculate_momentum,
    classify_momentum,
    get_momentum_quality,
    interpret_volume,
    get_momentum_definition,
    DEFAULT_THRESHOLD_WEAK,
    DEFAULT_THRESHOLD_STRONG,
)

__all__ = [
    # Z-Score
    "calculate_z_score",
    "interpret_z_score",
    # Source concentration
    "calculate_hhi",
    "interpret_hhi",
    "calculate_source_concentration",
    "calculate_source_concentration_from_mentions",
    # Topic analysis
    "extract_topic_name",
    "calculate_dominant_topic",
    "calculate_sentiment_by_topic",
    "analyze_topics",
    "calculate_topic_analysis_from_mentions",
    # Decay
    "calculate_decay_constant",
    "exponential_decay_weight",
    "exponential_decay_weight_from_half_life",
    "calculate_combined_weight",
    "half_life_from_decay_constant",
    "DECAY_CONSTANTS",
    # Breadth
    "calculate_breadth_score",
    "calculate_breadth_metrics",
    "calculate_breadth_from_items",
    "interpret_breadth",
    "get_breadth_quality",
    "DEFAULT_BULLISH_THRESHOLD",
    "DEFAULT_BEARISH_THRESHOLD",
    "DEFAULT_MIN_RELEVANCE_THRESHOLD",
    # Momentum
    "calculate_momentum",
    "classify_momentum",
    "get_momentum_quality",
    "interpret_volume",
    "get_momentum_definition",
    "DEFAULT_THRESHOLD_WEAK",
    "DEFAULT_THRESHOLD_STRONG",
]
