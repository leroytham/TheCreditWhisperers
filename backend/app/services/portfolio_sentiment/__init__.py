"""
Portfolio sentiment service package.

This package provides portfolio-level sentiment aggregation with:
- Per-holding sentiment fetching (stocks and ETFs/sectors)
- Portfolio-wide aggregation with position weighting
- Daily and rolling sentiment time series
- Comprehensive analytics (momentum, breadth, Z-score, etc.)

For backward compatibility, PortfolioSentimentService and portfolio_sentiment_service
are re-exported from this module.
"""

from .portfolio_service import PortfolioSentimentService, portfolio_sentiment_service
from .holding_fetcher import (
    fetch_holding_daily_sentiment,
    fetch_holding_rolling_sentiment,
)
from .aggregation import (
    aggregate_holdings_data,
    initialize_aggregated_metadata,
    calculate_portfolio_z_score,
    finalize_aggregated_metadata,
)

__all__ = [
    # Main service
    "PortfolioSentimentService",
    "portfolio_sentiment_service",
    # Holding fetcher
    "fetch_holding_daily_sentiment",
    "fetch_holding_rolling_sentiment",
    # Aggregation
    "aggregate_holdings_data",
    "initialize_aggregated_metadata",
    "calculate_portfolio_z_score",
    "finalize_aggregated_metadata",
]
