"""
Sentiment aggregation with exponential decay weighting.

This module handles:
- Aggregated score calculation with decay
- Z-score calculation for sentiment shock detection
- Source concentration (HHI) analysis
- Topic analysis and sentiment breakdown
"""

import math
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Optional, Tuple, Any

from app.services.analytics import (
    calculate_z_score,
    interpret_z_score,
    calculate_source_concentration,
    calculate_dominant_topic,
    calculate_sentiment_by_topic,
    interpret_breadth,
    get_breadth_quality,
    DEFAULT_BULLISH_THRESHOLD,
    DEFAULT_BEARISH_THRESHOLD,
    DEFAULT_MIN_RELEVANCE_THRESHOLD,
)


def calculate_aggregated_score_with_decay(
    news_articles: List[Dict],
    decay_constant: float,
    now_utc: datetime = None,
    analyze_article_func: callable = None
) -> Tuple[Optional[float], float, str, List[Dict], Optional[float], Dict]:
    """
    Calculate aggregated sentiment score with exponential decay, weighted volatility, and breadth.

    This is the reusable core that powers both single-score and momentum calculations.
    It applies the full weighting formula: CombinedWeight = relevance × e^(-k × age_hours)

    Args:
        news_articles: List of news article dictionaries
        decay_constant: The k value for exponential decay (k = ln(2) / half_life_hours)
        now_utc: Current UTC time for age calculation (defaults to datetime.utcnow())
        analyze_article_func: Optional function to analyze articles without pre-calculated scores

    Returns:
        Tuple of (aggregated_score, total_weight, data_quality, articles_with_metadata, volatility, breadth_data)
        - aggregated_score: Weighted average score (or None if insufficient data)
        - total_weight: Sum of all combined weights
        - data_quality: "good", "low_confidence", "insufficient_recent_data", or "no_data"
        - articles_with_metadata: List of articles with added weight/age metadata
        - volatility: Weighted standard deviation (or None if insufficient data)
        - breadth_data: Dict with breadth_score, num_bullish, num_bearish, total_directional
    """
    if not news_articles:
        return (None, 0.0, "no_data", [], None, {})

    if now_utc is None:
        now_utc = datetime.utcnow()

    weighted_total = 0.0
    weight_sum = 0.0
    articles_with_metadata = []

    for article in news_articles:
        # Detect which sentiment analyzer to use
        has_alpha_vantage_score = "ticker_sentiment_score" in article

        if has_alpha_vantage_score:
            # Use Alpha Vantage pre-calculated score
            raw_score = article.get("ticker_sentiment_score", 0.0)
        elif analyze_article_func:
            # Use provided fallback analyzer (e.g., FinBERT)
            raw_score, _, _ = analyze_article_func(article)
        else:
            # No analyzer available, use 0
            raw_score = 0.0

        # Get relevance score (default to 1.0 for fallback sources)
        relevance_score = article.get("ticker_relevance_score", 1.0)
        if relevance_score <= 0:
            relevance_score = 1.0

        # Calculate exponential decay recency weight
        recency_weight = 0.0
        age_hours = 0.0
        pub_date_str = article.get("publish_date")

        if pub_date_str:
            try:
                # Parse the publish date and calculate age in hours
                pub_datetime = datetime.strptime(pub_date_str, "%Y-%m-%d")
                age_hours = (now_utc - pub_datetime).total_seconds() / 3600.0

                # Apply exponential decay: RecencyWeight = e^(-k × age_hours)
                recency_weight = math.exp(-decay_constant * age_hours)

                # Combine relevance and recency weights
                combined_weight = relevance_score * recency_weight

                # Update aggregation sums
                weighted_total += raw_score * combined_weight
                weight_sum += combined_weight

            except ValueError:
                # Invalid date format, skip weighting for this article
                combined_weight = 0.0
        else:
            combined_weight = 0.0

        # Store metadata for this article - preserve ALL original fields
        article_meta = article.copy()
        article_meta.update({
            "sentiment_score_raw": raw_score,
            "relevance_score": relevance_score,
            "recency_weight": recency_weight,
            "combined_weight": combined_weight,
            "age_hours": age_hours,
            "source": article.get("provider", article.get("source", "Unknown")),
            "topics": article.get("topics", [])
        })
        articles_with_metadata.append(article_meta)

    # Calculate overall weighted average and determine data quality
    data_quality = "good"
    aggregated_score = None
    volatility = None

    if weight_sum >= 0.1:
        aggregated_score = weighted_total / weight_sum
        data_quality = "good"
    elif weight_sum > 0:
        aggregated_score = weighted_total / weight_sum
        data_quality = "low_confidence"
    else:
        aggregated_score = None
        data_quality = "insufficient_recent_data"

    # Calculate weighted volatility (standard deviation)
    if aggregated_score is not None and weight_sum > 0:
        variance_sum = 0.0
        for article_meta in articles_with_metadata:
            diff = article_meta["sentiment_score_raw"] - aggregated_score
            variance_sum += article_meta["combined_weight"] * (diff ** 2)

        variance = variance_sum / weight_sum
        volatility = math.sqrt(variance)
    else:
        volatility = None

    # Calculate sentiment breadth (bull/bear ratio)
    num_bullish = 0
    num_bearish = 0

    for article_meta in articles_with_metadata:
        score = article_meta["sentiment_score_raw"]
        relevance = article_meta["relevance_score"]

        # Only count articles that pass minimum relevance threshold
        if relevance >= DEFAULT_MIN_RELEVANCE_THRESHOLD:
            if score >= DEFAULT_BULLISH_THRESHOLD:
                num_bullish += 1
            elif score <= DEFAULT_BEARISH_THRESHOLD:
                num_bearish += 1

    total_directional = num_bullish + num_bearish

    # Calculate breadth score bounded between -1.0 (100% bears) and +1.0 (100% bulls)
    if total_directional > 0:
        breadth_score = (num_bullish - num_bearish) / total_directional
    else:
        breadth_score = 0.0

    breadth_data = {
        "breadth_score": breadth_score,
        "num_bullish": num_bullish,
        "num_bearish": num_bearish,
        "total_directional": total_directional
    }

    return (aggregated_score, weight_sum, data_quality, articles_with_metadata, volatility, breadth_data)


def calculate_z_score_from_articles(
    news_articles: List[Dict],
    current_slow_score: float,
    decay_constant_slow: float
) -> Dict:
    """
    Calculate Z-Score (sentiment shock) from available news articles without database.

    Groups articles by day, calculates daily sentiment scores, then computes
    Z-Score for most recent period vs historical baseline.

    Args:
        news_articles: List of news article dictionaries
        current_slow_score: Current slow score (24h half-life baseline)
        decay_constant_slow: Slow decay constant for consistency

    Returns:
        Dictionary with z_score, interpretation, and metadata
    """
    if not news_articles or current_slow_score is None:
        return {
            "z_score": None,
            "interpretation": "No Data",
            "historical_mean": None,
            "historical_std": None,
            "days_of_history": 0,
            "quality": "no_data"
        }

    # Group articles by date
    daily_articles = defaultdict(list)
    for article in news_articles:
        pub_date_str = article.get("publish_date")
        if pub_date_str:
            try:
                pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date()
                daily_articles[pub_date].append(article)
            except ValueError:
                continue

    if len(daily_articles) < 3:
        return {
            "z_score": None,
            "interpretation": "Insufficient History",
            "historical_mean": None,
            "historical_std": None,
            "days_of_history": len(daily_articles),
            "quality": "insufficient_history"
        }

    # Calculate daily sentiment scores
    daily_scores = {}
    sorted_dates = sorted(daily_articles.keys())

    for date in sorted_dates:
        articles_for_day = daily_articles[date]
        score, weight, quality, _, _, _ = calculate_aggregated_score_with_decay(
            articles_for_day,
            decay_constant_slow,
            datetime.combine(date, datetime.min.time())
        )
        if score is not None and weight >= 0.1:
            daily_scores[date] = score

    if len(daily_scores) < 3:
        return {
            "z_score": None,
            "interpretation": "Insufficient Valid Days",
            "historical_mean": None,
            "historical_std": None,
            "days_of_history": len(daily_scores),
            "quality": "insufficient_history"
        }

    # Use all historical days except the most recent one as baseline
    sorted_score_dates = sorted(daily_scores.keys())
    historical_scores = [daily_scores[d] for d in sorted_score_dates[:-1]]

    if len(historical_scores) < 2:
        return {
            "z_score": None,
            "interpretation": "Insufficient Historical Baseline",
            "historical_mean": None,
            "historical_std": None,
            "days_of_history": len(historical_scores),
            "quality": "insufficient_history"
        }

    # Use analytics package for z-score calculation
    z_score_result = calculate_z_score(
        current_value=current_slow_score,
        historical_values=historical_scores,
        min_samples=2
    )

    z_score = z_score_result.get("z_score")
    historical_mean = z_score_result.get("mean")
    historical_std = z_score_result.get("std")

    # Get interpretation
    if z_score is not None:
        interpretation = interpret_z_score(z_score)
        quality = "good" if len(historical_scores) >= 5 else "low_confidence"
    else:
        interpretation = z_score_result.get("error", "No Historical Variation")
        quality = "low_confidence"

    return {
        "z_score": z_score,
        "interpretation": interpretation,
        "historical_mean": historical_mean,
        "historical_std": historical_std,
        "days_of_history": len(historical_scores),
        "current_score": current_slow_score,
        "quality": quality
    }


def calculate_source_hhi(articles_with_metadata: List[Dict]) -> Dict:
    """
    Calculate Herfindahl-Hirschman Index (HHI) for source diversity.

    Uses the shared analytics function for consistency.

    Args:
        articles_with_metadata: List of article dicts with 'source' and 'combined_weight'

    Returns:
        Dictionary with HHI, interpretation, and top sources
    """
    return calculate_source_concentration(
        items=articles_with_metadata,
        source_key="source",
        weight_key="combined_weight",
        top_n=5
    )


def calculate_topic_analysis(articles_with_metadata: List[Dict]) -> Dict:
    """
    Calculate topic analysis including dominant topic and sentiment by topic.

    Uses the shared analytics functions for consistency.

    Args:
        articles_with_metadata: List of article dicts with 'topics', 'sentiment_score_raw',
                               and 'combined_weight'

    Returns:
        Dictionary with dominant topic, topic weights, and sentiment by topic
    """
    # Calculate dominant topic
    dominant_topic_data = calculate_dominant_topic(
        items=articles_with_metadata,
        topic_key="topics",
        weight_key="combined_weight"
    )

    # Calculate sentiment by topic
    sentiment_by_topic_data = calculate_sentiment_by_topic(
        items=articles_with_metadata,
        topic_key="topics",
        sentiment_key="sentiment_score_raw",
        weight_key="combined_weight"
    )

    return {
        "dominant_topic": dominant_topic_data.get("dominant_topic"),
        "dominant_topic_weight": dominant_topic_data.get("dominant_topic_weight"),
        "dominant_topic_percentage": dominant_topic_data.get("dominant_topic_percentage"),
        "topic_count": dominant_topic_data.get("topic_count", 0),
        "sentiment_by_topic": sentiment_by_topic_data.get("sentiment_by_topic", {}),
        "topic_weights": sentiment_by_topic_data.get("topic_weights", {})
    }


def generate_breadth_interpretation(breadth_data: Dict) -> Tuple[str, str]:
    """
    Generate human-readable interpretation for breadth metrics.

    Args:
        breadth_data: Dictionary with breadth_score, num_bullish, num_bearish, total_directional

    Returns:
        Tuple of (interpretation, quality)
    """
    if not breadth_data or breadth_data.get("total_directional", 0) == 0:
        return "Insufficient directional articles for breadth calculation", "insufficient_sample"

    total = breadth_data["total_directional"]
    bulls = breadth_data["num_bullish"]
    bears = breadth_data["num_bearish"]
    score = breadth_data["breadth_score"]

    quality = get_breadth_quality(total)
    interpretation = interpret_breadth(score, bulls, bears)

    return interpretation, quality
