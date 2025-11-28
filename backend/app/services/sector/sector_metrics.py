"""
Sector-level metrics calculation.

This module handles:
- Ticker mention aggregation with decay weighting
- Volatility calculation
- Breadth metrics (bull/bear ratio)
- Ticker coverage analysis
- Z-score calculation for sector sentiment
- Source concentration (HHI)
- Topic analysis
- Momentum and volume classification
"""

import math
from datetime import datetime, timezone
from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple

from app.services.analytics import (
    calculate_z_score,
    interpret_z_score,
    calculate_hhi,
    interpret_hhi,
    interpret_breadth as analytics_interpret_breadth,
    get_breadth_quality,
    interpret_volume as analytics_interpret_volume,
    classify_momentum as analytics_classify_momentum,
    DEFAULT_THRESHOLD_WEAK,
    DEFAULT_THRESHOLD_STRONG,
)

from .ticker_extraction import calculate_combined_weight


# Constants
BULLISH_THRESHOLD = 0.35
BEARISH_THRESHOLD = -0.35


def empty_breadth_data() -> Dict:
    """Return empty breadth data structure."""
    return {
        "breadth_score": 0.0,
        "num_bullish": 0,
        "num_bearish": 0,
        "total_directional": 0
    }


def aggregate_ticker_mentions(
    ticker_mentions: List[Dict],
    decay_constant: float
) -> Tuple[Optional[float], float, Dict]:
    """
    Aggregate ticker mentions to calculate weighted average sentiment.

    Formula: AggregatedScore = Σ(sentiment_score × CombinedWeight) / Σ(CombinedWeight)

    Args:
        ticker_mentions: List of ticker mention dictionaries
        decay_constant: Decay constant k for recency weighting

    Returns:
        Tuple of (aggregated_score, total_weight, breadth_data)
    """
    if not ticker_mentions:
        return (None, 0.0, empty_breadth_data())

    weighted_total = 0.0
    weight_sum = 0.0
    num_bullish = 0
    num_bearish = 0

    for mention in ticker_mentions:
        # Calculate combined weight for this mention
        combined_weight = calculate_combined_weight(
            mention["relevance_score"],
            mention["age_hours"],
            decay_constant
        )

        # Store combined weight in mention for later use
        mention["combined_weight"] = combined_weight
        mention["recency_weight"] = math.exp(-decay_constant * mention["age_hours"]) if mention["age_hours"] > 0 else 1.0

        # Accumulate weighted sentiment
        sentiment_score = mention["sentiment_score"]
        weighted_total += sentiment_score * combined_weight
        weight_sum += combined_weight

        # Count directional sentiments for breadth calculation
        if sentiment_score >= BULLISH_THRESHOLD:
            num_bullish += 1
        elif sentiment_score <= BEARISH_THRESHOLD:
            num_bearish += 1

    # Calculate aggregated sentiment score
    if weight_sum >= 0.1:
        aggregated_score = weighted_total / weight_sum
    else:
        aggregated_score = None

    # Calculate breadth
    total_directional = num_bullish + num_bearish
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

    return (aggregated_score, weight_sum, breadth_data)


def calculate_volatility(
    ticker_mentions: List[Dict],
    aggregated_score: float
) -> Optional[float]:
    """
    Calculate weighted standard deviation of sentiment scores.

    Formula: sqrt(Σ(CombinedWeight × (score - mean)²) / Σ(CombinedWeight))

    Args:
        ticker_mentions: List of ticker mention dictionaries (with combined_weight)
        aggregated_score: Mean sentiment score

    Returns:
        Volatility (standard deviation) or None if insufficient data
    """
    if not ticker_mentions or aggregated_score is None:
        return None

    variance_sum = 0.0
    weight_sum = 0.0

    for mention in ticker_mentions:
        combined_weight = mention.get("combined_weight", 0.0)
        sentiment_score = mention["sentiment_score"]

        diff = sentiment_score - aggregated_score
        variance_sum += combined_weight * (diff ** 2)
        weight_sum += combined_weight

    if weight_sum > 0:
        variance = variance_sum / weight_sum
        return math.sqrt(variance)
    else:
        return None


def calculate_ticker_coverage(
    ticker_mentions: List[Dict],
    sector_tickers: Set[str]
) -> Dict:
    """
    Calculate coverage metrics: how many sector tickers are mentioned in news.

    Args:
        ticker_mentions: List of ticker mention dictionaries
        sector_tickers: Set of all tickers in the sector

    Returns:
        Dictionary with coverage metrics
    """
    mentioned_tickers = set(m["ticker"] for m in ticker_mentions)

    coverage_count = len(mentioned_tickers)
    coverage_percentage = (coverage_count / len(sector_tickers) * 100) if sector_tickers else 0.0

    return {
        "tickers_mentioned": coverage_count,
        "total_tickers_in_sector": len(sector_tickers),
        "coverage_percentage": round(coverage_percentage, 2),
        "mentioned_ticker_list": sorted(list(mentioned_tickers))
    }


def calculate_z_score_from_ticker_mentions(
    articles: List[Dict],
    sector_tickers: Set[str],
    current_slow_score: float,
    k_slow: float,
    extract_fn: callable
) -> Dict:
    """
    Calculate Z-Score (sentiment shock) for sector from daily aggregation.

    Args:
        articles: List of article dictionaries with ticker_sentiment arrays
        sector_tickers: Set of ticker symbols in the sector
        current_slow_score: Current slow score (24h half-life baseline)
        k_slow: Slow decay constant
        extract_fn: Function to extract ticker mentions from article

    Returns:
        Dictionary with z_score, interpretation, and metadata
    """
    if not articles or current_slow_score is None:
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
    now_utc = datetime.now(timezone.utc)

    for article in articles:
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

    # Calculate daily sector sentiment scores
    daily_scores = {}
    sorted_dates = sorted(daily_articles.keys())

    for date in sorted_dates:
        articles_for_day = daily_articles[date]

        # Extract ticker mentions for this day
        day_ticker_mentions = []
        day_datetime = datetime.combine(date, datetime.min.time()).replace(tzinfo=timezone.utc)

        for article in articles_for_day:
            mentions = extract_fn(article, sector_tickers, day_datetime)
            day_ticker_mentions.extend(mentions)

        if day_ticker_mentions:
            score, weight, _ = aggregate_ticker_mentions(day_ticker_mentions, k_slow)
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

    # Use historical days (excluding most recent) as baseline
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


def calculate_source_concentration(
    ticker_mentions: List[Dict],
    articles: List[Dict] = None
) -> Dict:
    """
    Calculate Herfindahl-Hirschman Index (HHI) for source diversity.

    Args:
        ticker_mentions: List of ticker mention dicts with 'article_url' and 'combined_weight'
        articles: List of article dicts with provider information (optional)

    Returns:
        Dictionary with HHI, interpretation, and top sources
    """
    if not articles or not ticker_mentions:
        return {
            "source_concentration_hhi": None,
            "concentration_interpretation": "Not Available",
            "top_sources": []
        }

    # Build mapping of article_url -> provider
    url_to_provider = {}
    for article in articles:
        url = article.get("url", "") or article.get("link", "")
        provider = article.get("provider", "") or article.get("source", "Unknown")
        if url and provider != "Unknown":
            url_to_provider[url] = provider

    # Calculate weight per source from ticker mentions
    source_weights = {}
    for mention in ticker_mentions:
        article_url = mention.get("article_url", "")
        combined_weight = mention.get("combined_weight", 0.0)

        provider = url_to_provider.get(article_url, "Unknown")
        if provider not in source_weights:
            source_weights[provider] = 0.0
        source_weights[provider] += combined_weight

    if not source_weights:
        return {
            "source_concentration_hhi": None,
            "concentration_interpretation": "Not Available",
            "top_sources": []
        }

    # Calculate HHI using analytics package
    hhi = calculate_hhi(source_weights)
    if hhi is None:
        return {
            "source_concentration_hhi": None,
            "concentration_interpretation": "Not Available",
            "top_sources": []
        }

    interpretation = interpret_hhi(hhi)

    # Get top sources sorted by weight
    total_weight = sum(source_weights.values())
    top_sources = sorted(
        [{"source": source, "weight": weight, "percentage": (weight / total_weight) * 100}
         for source, weight in source_weights.items()],
        key=lambda x: x["weight"],
        reverse=True
    )[:5]

    return {
        "source_concentration_hhi": hhi,
        "concentration_interpretation": interpretation,
        "top_sources": top_sources
    }


def calculate_topic_analysis(
    ticker_mentions: List[Dict],
    articles: List[Dict] = None
) -> Dict:
    """
    Calculate dominant topic and sentiment by topic from ticker mentions.

    Args:
        ticker_mentions: List of ticker mention dicts
        articles: List of article dicts with topic information (optional)

    Returns:
        Dictionary with dominant topic and sentiment breakdown by topic
    """
    if not articles or not ticker_mentions:
        return {
            "dominant_topic": None,
            "dominant_topic_weight": 0.0,
            "dominant_topic_percentage": 0.0,
            "topic_count": 0,
            "sentiment_by_topic": {},
            "topic_weights": {}
        }

    # Build mapping of article_url -> topics
    url_to_topics = {}
    for article in articles:
        url = article.get("url", "") or article.get("link", "")
        topics = article.get("topics", [])
        if url and topics:
            topic_list = []
            for t in topics:
                if isinstance(t, dict):
                    topic_name = t.get("topic", "")
                    if topic_name:
                        topic_list.append(topic_name)
                elif isinstance(t, str):
                    topic_list.append(t)
            if topic_list:
                url_to_topics[url] = topic_list

    if not url_to_topics:
        return {
            "dominant_topic": None,
            "dominant_topic_weight": 0.0,
            "dominant_topic_percentage": 0.0,
            "topic_count": 0,
            "sentiment_by_topic": {},
            "topic_weights": {}
        }

    # Calculate weighted sentiment and weight per topic
    topic_sentiment_weights = {}
    topic_total_weights = {}

    for mention in ticker_mentions:
        article_url = mention.get("article_url", "")
        topics = url_to_topics.get(article_url, [])

        sentiment = mention.get("sentiment_score", 0.0)
        weight = mention.get("combined_weight", 0.0)

        for topic in topics:
            if not topic:
                continue

            if topic not in topic_sentiment_weights:
                topic_sentiment_weights[topic] = []
                topic_total_weights[topic] = 0.0

            topic_sentiment_weights[topic].append((sentiment, weight))
            topic_total_weights[topic] += weight

    if not topic_total_weights:
        return {
            "dominant_topic": None,
            "dominant_topic_weight": 0.0,
            "dominant_topic_percentage": 0.0,
            "topic_count": 0,
            "sentiment_by_topic": {},
            "topic_weights": {}
        }

    # Calculate average sentiment per topic
    sentiment_by_topic = {}
    for topic, sentiment_weight_pairs in topic_sentiment_weights.items():
        total_weight = sum(w for _, w in sentiment_weight_pairs)
        if total_weight > 0:
            weighted_sentiment = sum(s * w for s, w in sentiment_weight_pairs) / total_weight
            sentiment_by_topic[topic] = weighted_sentiment

    # Find dominant topic
    dominant_topic = max(topic_total_weights, key=topic_total_weights.get)
    dominant_topic_weight = topic_total_weights[dominant_topic]
    total_all_weights = sum(topic_total_weights.values())
    dominant_topic_percentage = (dominant_topic_weight / total_all_weights * 100) if total_all_weights > 0 else 0.0

    return {
        "dominant_topic": dominant_topic,
        "dominant_topic_weight": dominant_topic_weight,
        "dominant_topic_percentage": dominant_topic_percentage,
        "topic_count": len(topic_total_weights),
        "sentiment_by_topic": sentiment_by_topic,
        "topic_weights": topic_total_weights
    }


def classify_momentum(
    momentum: float,
    threshold_weak: float = DEFAULT_THRESHOLD_WEAK,
    threshold_strong: float = DEFAULT_THRESHOLD_STRONG
) -> Dict:
    """Classify momentum into categories using analytics package."""
    return analytics_classify_momentum(momentum, threshold_weak, threshold_strong)


def interpret_breadth(breadth_data: Dict) -> str:
    """Generate human-readable breadth interpretation."""
    total = breadth_data.get("total_directional", 0)

    if total == 0:
        return "No directional sentiment data"

    bulls = breadth_data["num_bullish"]
    bears = breadth_data["num_bearish"]
    score = breadth_data["breadth_score"]

    return analytics_interpret_breadth(score, bulls, bears)


def interpret_volume(weight: float) -> str:
    """Classify effective news volume coverage."""
    return analytics_interpret_volume(weight)
