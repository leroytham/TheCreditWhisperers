"""
Sentiment service package.

This package provides sentiment analysis functionality with:
- Hybrid sentiment analysis (Alpha Vantage + FinBERT fallback)
- Momentum calculation (MACD-style fast vs slow)
- Exponential decay weighting
- Z-score, HHI, and topic analysis

For backward compatibility, SentimentService and sentiment_service are
re-exported from this module.
"""

from .sentiment_service import SentimentService, sentiment_service
from .article_processor import ArticleProcessor, article_processor
from .aggregation import (
    calculate_aggregated_score_with_decay,
    calculate_z_score_from_articles,
    calculate_source_hhi,
    calculate_topic_analysis,
    generate_breadth_interpretation,
)

__all__ = [
    # Main service
    "SentimentService",
    "sentiment_service",
    # Article processor
    "ArticleProcessor",
    "article_processor",
    # Aggregation functions
    "calculate_aggregated_score_with_decay",
    "calculate_z_score_from_articles",
    "calculate_source_hhi",
    "calculate_topic_analysis",
    "generate_breadth_interpretation",
]
