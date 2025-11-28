"""
Portfolio-level aggregation utilities.

This module handles:
- Aggregating holdings by symbol and calculating weights
- Aggregating daily metadata across holdings
- Portfolio-wide Z-score calculation
- Topic and source aggregation
"""

import statistics
from collections import defaultdict
from typing import Dict, List, Tuple

from app.services.analytics import (
    interpret_z_score,
    interpret_volume,
    interpret_breadth,
    classify_momentum,
    calculate_hhi,
    interpret_hhi,
)


def aggregate_holdings_data(holdings_list: List[Dict]) -> Tuple[Dict[str, Dict], float]:
    """
    Aggregate holdings by symbol and calculate weights.

    Args:
        holdings_list: List of holdings with symbol, quantity, market_value

    Returns:
        Tuple of (symbol_holdings dict, total_value)
    """
    symbol_holdings = {}
    total_value = 0

    for holding in holdings_list:
        symbol = holding.get("symbol", "").upper()
        if not symbol:
            continue

        market_value = float(holding.get("market_value", 0))
        if market_value <= 0:
            continue

        if symbol not in symbol_holdings:
            symbol_holdings[symbol] = {
                "symbol": symbol,
                "market_value": 0,
                "quantity": 0
            }

        symbol_holdings[symbol]["market_value"] += market_value
        symbol_holdings[symbol]["quantity"] += float(holding.get("quantity", 0))
        total_value += market_value

    # Calculate weights
    for symbol_data in symbol_holdings.values():
        symbol_data["weight"] = symbol_data["market_value"] / total_value if total_value > 0 else 0

    return symbol_holdings, total_value


def initialize_aggregated_metadata() -> Dict:
    """Initialize the aggregated metadata structure with all fields."""
    return {
        # Fast/Slow Scores and Momentum
        "fast_score": 0,
        "slow_score": 0,
        "overall_weighted_score": 0,
        "sentiment_momentum": 0,
        "momentum_label": None,
        "momentum_interpretation": None,
        "momentum_quality": None,
        "half_life_fast_hours": None,
        "half_life_slow_hours": None,

        # News Coverage Quality
        "effective_news_volume": 0,
        "volume_interpretation": None,

        # Sentiment Breadth
        "sentiment_breadth_score": 0,
        "num_bullish_articles": 0,
        "num_bearish_articles": 0,
        "total_directional_articles": 0,
        "breadth_interpretation": None,
        "breadth_quality": None,
        "avg_score": 0,

        # Sentiment Shock (Z-Score)
        "sentiment_z_score": None,
        "z_score_interpretation": None,
        "z_score_historical_mean": None,
        "z_score_historical_std": None,
        "z_score_days_of_history": 0,
        "z_score_quality": None,

        # Volatility Metrics
        "sentiment_volatility": 0,
        "volatility_quality": None,

        # Data Quality
        "data_quality": None,

        # Source & Topic
        "source_concentration_hhi": 0,
        "concentration_interpretation": "Well Diversified",
        "dominant_source": None,
        "dominant_topic": None,
        "topic_distribution": {},
        "source_breakdown": {},
        "top_sources": [],

        # Coverage metrics
        "holdings_coverage": 0,
        "confidence_score": 0
    }


def calculate_portfolio_z_score(
    portfolio_daily_scores: Dict[str, List[Tuple[float, float]]]
) -> Dict:
    """
    Calculate portfolio-wide Z-score from daily scores.

    Args:
        portfolio_daily_scores: Dict mapping date to list of (score, weight) tuples

    Returns:
        Dictionary with Z-score data or empty dict if insufficient data
    """
    if len(portfolio_daily_scores) < 3:
        return {}

    # Calculate daily portfolio-weighted averages
    daily_portfolio_scores = {}
    for date_str, scores_weights in portfolio_daily_scores.items():
        total_weight = sum(w for _, w in scores_weights)
        if total_weight > 0:
            weighted_avg = sum(s * w for s, w in scores_weights) / total_weight
            daily_portfolio_scores[date_str] = weighted_avg

    if len(daily_portfolio_scores) < 3:
        return {}

    sorted_dates = sorted(daily_portfolio_scores.keys())
    historical_scores = [daily_portfolio_scores[d] for d in sorted_dates[:-1]]
    current_score = daily_portfolio_scores[sorted_dates[-1]]

    if len(historical_scores) < 2:
        return {}

    hist_mean = statistics.mean(historical_scores)
    hist_std = statistics.stdev(historical_scores) if len(historical_scores) >= 2 else 0

    if hist_std <= 0:
        return {
            "sentiment_z_score": None,
            "z_score_interpretation": "No Historical Variation",
            "z_score_quality": "low_confidence"
        }

    z_score = (current_score - hist_mean) / hist_std
    interpretation = interpret_z_score(z_score)
    quality = "good" if len(historical_scores) >= 5 else "low_confidence"

    return {
        "sentiment_z_score": z_score,
        "z_score_interpretation": interpretation,
        "z_score_historical_mean": hist_mean,
        "z_score_historical_std": hist_std,
        "z_score_days_of_history": len(historical_scores),
        "z_score_quality": quality
    }


def finalize_aggregated_metadata(
    aggregated_metadata: Dict,
    total_weight_with_data: float,
    valid_holdings: int,
    weighted_scores: Dict,
    topic_weights: Dict,
    topic_sentiment_weighted: Dict,
    source_weights: Dict,
    portfolio_daily_scores: Dict,
    total_bullish: int,
    total_bearish: int,
    total_directional: int,
    total_articles_analyzed: int
) -> Dict:
    """
    Finalize and normalize aggregated metadata.

    Args:
        aggregated_metadata: Base metadata structure
        total_weight_with_data: Total portfolio weight with sentiment data
        valid_holdings: Number of holdings with valid sentiment data
        weighted_scores: Dict with weighted score accumulators
        topic_weights: Topic weight accumulator
        topic_sentiment_weighted: Topic sentiment accumulator
        source_weights: Source weight accumulator
        portfolio_daily_scores: Daily scores for Z-score calculation
        total_bullish: Total bullish article count
        total_bearish: Total bearish article count
        total_directional: Total directional article count
        total_articles_analyzed: Total articles analyzed

    Returns:
        Finalized metadata dictionary
    """
    if total_weight_with_data <= 0:
        return aggregated_metadata

    # Normalize weighted scores
    aggregated_metadata["fast_score"] = weighted_scores.get("fast", 0) / total_weight_with_data
    aggregated_metadata["slow_score"] = weighted_scores.get("slow", 0) / total_weight_with_data
    aggregated_metadata["overall_weighted_score"] = weighted_scores.get("overall", 0) / total_weight_with_data
    aggregated_metadata["sentiment_momentum"] = weighted_scores.get("momentum", 0) / total_weight_with_data
    aggregated_metadata["effective_news_volume"] = weighted_scores.get("volume", 0) / total_weight_with_data
    aggregated_metadata["sentiment_breadth_score"] = (
        weighted_scores.get("breadth", 0) / total_weight_with_data if total_directional > 0 else 0
    )
    aggregated_metadata["sentiment_volatility"] = weighted_scores.get("volatility", 0) / total_weight_with_data
    aggregated_metadata["avg_score"] = aggregated_metadata["overall_weighted_score"]

    # Aggregate bull/bear counts
    aggregated_metadata["num_bullish_articles"] = total_bullish
    aggregated_metadata["num_bearish_articles"] = total_bearish
    aggregated_metadata["total_directional_articles"] = total_directional

    # Classify momentum
    momentum_value = aggregated_metadata["sentiment_momentum"]
    if momentum_value is not None:
        momentum_classification = classify_momentum(momentum_value, 0.05, 0.15)
        aggregated_metadata["momentum_label"] = momentum_classification.get("label")
        aggregated_metadata["momentum_interpretation"] = momentum_classification.get("interpretation")
        aggregated_metadata["momentum_quality"] = "good" if valid_holdings >= 3 else "low_confidence"

    # Classify volume
    aggregated_metadata["volume_interpretation"] = interpret_volume(aggregated_metadata["effective_news_volume"])

    # Classify breadth
    if total_directional >= 10:
        aggregated_metadata["breadth_quality"] = "good"
    elif total_directional >= 5:
        aggregated_metadata["breadth_quality"] = "low_confidence"
    else:
        aggregated_metadata["breadth_quality"] = "insufficient_sample"

    if total_directional > 0:
        aggregated_metadata["breadth_interpretation"] = interpret_breadth(
            aggregated_metadata["sentiment_breadth_score"],
            total_bullish,
            total_bearish
        )
    else:
        aggregated_metadata["breadth_interpretation"] = "Insufficient directional articles"

    # Classify volatility
    aggregated_metadata["volatility_quality"] = "good" if valid_holdings >= 3 else "low_confidence"

    # Calculate Z-score
    z_score_data = calculate_portfolio_z_score(portfolio_daily_scores)
    aggregated_metadata.update(z_score_data)

    # Set overall data quality
    aggregated_metadata["data_quality"] = "good" if valid_holdings >= 3 else "low_confidence"

    # Normalize topic distribution
    if topic_weights:
        total_topic_weight = sum(topic_weights.values())
        if total_topic_weight > 0:
            aggregated_metadata["topic_distribution"] = {
                topic: weight / total_topic_weight
                for topic, weight in topic_weights.items()
            }
            aggregated_metadata["topic_weights"] = dict(topic_weights)

            # Find dominant topic
            dominant_topic, dominant_weight = max(topic_weights.items(), key=lambda x: x[1])
            aggregated_metadata["dominant_topic"] = dominant_topic
            aggregated_metadata["dominant_topic_weight"] = dominant_weight
            aggregated_metadata["dominant_topic_percentage"] = (dominant_weight / total_topic_weight) * 100

            # Calculate sentiment by topic
            if topic_sentiment_weighted:
                aggregated_metadata["sentiment_by_topic"] = {}
                for topic, weighted_sentiment in topic_sentiment_weighted.items():
                    topic_weight_total = topic_weights.get(topic, 0)
                    if topic_weight_total > 0:
                        aggregated_metadata["sentiment_by_topic"][topic] = weighted_sentiment / topic_weight_total

    # Normalize source breakdown
    if source_weights:
        total_source_weight = sum(source_weights.values())
        if total_source_weight > 0:
            aggregated_metadata["source_breakdown"] = {
                source: weight / total_source_weight
                for source, weight in source_weights.items()
            }
            aggregated_metadata["dominant_source"] = max(source_weights.items(), key=lambda x: x[1])[0]

            # Create top sources list
            sorted_sources = sorted(source_weights.items(), key=lambda x: x[1], reverse=True)[:5]
            aggregated_metadata["top_sources"] = [
                {
                    "source": source,
                    "weight": weight / total_source_weight,
                    "percentage": round((weight / total_source_weight * 100), 2)
                }
                for source, weight in sorted_sources
            ]

    # Calculate HHI for source concentration
    if aggregated_metadata["source_breakdown"]:
        hhi = calculate_hhi(aggregated_metadata["source_breakdown"])
        if hhi is not None:
            aggregated_metadata["source_concentration_hhi"] = hhi
            aggregated_metadata["concentration_interpretation"] = interpret_hhi(hhi)

    aggregated_metadata["total_articles_analyzed"] = total_articles_analyzed

    return aggregated_metadata
