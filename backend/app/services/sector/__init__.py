"""
Sector sentiment service package.

This package provides sector-wide sentiment analysis functionality with:
- Multi-ticker article processing
- Sector basket filtering
- Momentum calculation (MACD-style fast vs slow)
- Coverage metrics and topic analysis

For backward compatibility, SectorSentimentService and sector_sentiment_service
are re-exported from this module.
"""

from .sector_sentiment_service import SectorSentimentService, sector_sentiment_service
from .ticker_extraction import (
    extract_ticker_mentions,
    extract_all_ticker_mentions,
    calculate_combined_weight,
    parse_article_datetime,
)
from .sector_metrics import (
    aggregate_ticker_mentions,
    calculate_volatility,
    calculate_ticker_coverage,
    calculate_z_score_from_ticker_mentions,
    calculate_source_concentration,
    calculate_topic_analysis,
    classify_momentum,
    interpret_breadth,
    interpret_volume,
    empty_breadth_data,
)

__all__ = [
    # Main service
    "SectorSentimentService",
    "sector_sentiment_service",
    # Ticker extraction
    "extract_ticker_mentions",
    "extract_all_ticker_mentions",
    "calculate_combined_weight",
    "parse_article_datetime",
    # Sector metrics
    "aggregate_ticker_mentions",
    "calculate_volatility",
    "calculate_ticker_coverage",
    "calculate_z_score_from_ticker_mentions",
    "calculate_source_concentration",
    "calculate_topic_analysis",
    "classify_momentum",
    "interpret_breadth",
    "interpret_volume",
    "empty_breadth_data",
]
