"""
Topic analysis for sentiment data.

This module provides functions to analyze topic distribution and calculate
sentiment breakdown by topic, enabling identification of key themes driving
overall sentiment.
"""

from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple


def extract_topic_name(topic_item: Any) -> Optional[str]:
    """
    Extract topic name from various formats.

    Args:
        topic_item: Topic data (string or dict with 'topic' key)

    Returns:
        Topic name string or None if invalid
    """
    if isinstance(topic_item, dict):
        return topic_item.get("topic", "")
    elif isinstance(topic_item, str):
        return topic_item
    return None


def calculate_dominant_topic(
    items: List[Dict[str, Any]],
    topics_key: str = "topics",
    weight_key: str = "combined_weight"
) -> Dict[str, Any]:
    """
    Find the dominant topic using weighted mode calculation.

    Each item may have multiple topics. We weight each topic by the item's
    combined weight to find which topic has the most influence.

    Args:
        items: List of dictionaries with topics and weights
        topics_key: Key for topics list in item dict (default "topics")
        weight_key: Key for weight value in item dict (default "combined_weight")

    Returns:
        Dictionary containing:
            - dominant_topic: str or None
            - dominant_topic_weight: float
            - dominant_topic_percentage: float
            - topic_count: int (total unique topics)
    """
    if not items:
        return {
            "dominant_topic": None,
            "dominant_topic_weight": 0.0,
            "dominant_topic_percentage": 0.0,
            "topic_count": 0
        }

    topic_weights = defaultdict(float)
    grand_total = 0.0

    for item in items:
        topics = item.get(topics_key, [])
        combined_weight = item.get(weight_key, 0.0)

        for topic_item in topics:
            topic_name = extract_topic_name(topic_item)
            if topic_name:
                topic_weights[topic_name] += combined_weight
                grand_total += combined_weight

    if not topic_weights:
        return {
            "dominant_topic": None,
            "dominant_topic_weight": 0.0,
            "dominant_topic_percentage": 0.0,
            "topic_count": 0
        }

    # Find topic with highest weight
    dominant_topic, dominant_weight = max(topic_weights.items(), key=lambda x: x[1])

    return {
        "dominant_topic": dominant_topic,
        "dominant_topic_weight": round(dominant_weight, 4),
        "dominant_topic_percentage": round((dominant_weight / grand_total * 100), 2) if grand_total > 0 else 0,
        "topic_count": len(topic_weights)
    }


def calculate_sentiment_by_topic(
    items: List[Dict[str, Any]],
    topics_key: str = "topics",
    sentiment_key: str = "sentiment_score_raw",
    weight_key: str = "combined_weight"
) -> Dict[str, Any]:
    """
    Calculate weighted sentiment score breakdown by topic.

    For each topic, calculates: weighted_avg = sum(sentiment * weight) / sum(weight)

    This reveals conflicts (e.g., Earnings +0.65 vs Legal -0.70) and provides
    diagnostic insight into what's driving the overall sentiment.

    Args:
        items: List of dictionaries with topics, sentiment scores, and weights
        topics_key: Key for topics list in item dict (default "topics")
        sentiment_key: Key for sentiment score in item dict (default "sentiment_score_raw")
        weight_key: Key for weight value in item dict (default "combined_weight")

    Returns:
        Dictionary containing:
            - sentiment_by_topic: dict mapping topic name to weighted avg sentiment
            - topic_weights: dict mapping topic name to total weight
    """
    topic_weighted_sentiment_sum = defaultdict(float)
    topic_total_weight_sum = defaultdict(float)

    for item in items:
        topics = item.get(topics_key, [])
        combined_weight = item.get(weight_key, 0.0)
        sentiment_score = item.get(sentiment_key, 0.0)

        for topic_item in topics:
            topic_name = extract_topic_name(topic_item)
            if topic_name:
                topic_weighted_sentiment_sum[topic_name] += sentiment_score * combined_weight
                topic_total_weight_sum[topic_name] += combined_weight

    # Calculate final scores
    sentiment_by_topic = {}
    topic_weights = {}

    for topic in topic_weighted_sentiment_sum.keys():
        total_weight = topic_total_weight_sum[topic]
        if total_weight > 0:
            sentiment_by_topic[topic] = round(
                topic_weighted_sentiment_sum[topic] / total_weight,
                4
            )
            topic_weights[topic] = round(total_weight, 4)

    return {
        "sentiment_by_topic": sentiment_by_topic,
        "topic_weights": topic_weights
    }


def analyze_topics(
    items: List[Dict[str, Any]],
    topics_key: str = "topics",
    sentiment_key: str = "sentiment_score_raw",
    weight_key: str = "combined_weight"
) -> Dict[str, Any]:
    """
    Comprehensive topic analysis combining dominant topic and sentiment breakdown.

    Args:
        items: List of dictionaries with topics, sentiment scores, and weights
        topics_key: Key for topics list in item dict
        sentiment_key: Key for sentiment score in item dict
        weight_key: Key for weight value in item dict

    Returns:
        Combined dictionary with all topic analysis metrics
    """
    dominant = calculate_dominant_topic(items, topics_key, weight_key)
    sentiment = calculate_sentiment_by_topic(items, topics_key, sentiment_key, weight_key)

    return {
        **dominant,
        **sentiment
    }


def calculate_topic_analysis_from_mentions(
    ticker_mentions: List[Dict[str, Any]],
    articles: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Calculate topic analysis from ticker mentions with article topic mapping.

    This version is specifically designed for sector sentiment analysis where
    ticker mentions need to be mapped back to their source articles' topics.

    Args:
        ticker_mentions: List of ticker mention dicts with 'article_url' and 'combined_weight'
        articles: List of article dicts with topics information

    Returns:
        Dictionary with topic analysis metrics
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
                topic_name = extract_topic_name(t)
                if topic_name:
                    topic_list.append(topic_name)
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
    topic_sentiment_weights = defaultdict(list)  # topic -> list of (sentiment, weight)
    topic_total_weights = defaultdict(float)  # topic -> total weight

    for mention in ticker_mentions:
        article_url = mention.get("article_url", "")
        topics = url_to_topics.get(article_url, [])
        sentiment = mention.get("sentiment_score", 0.0)
        weight = mention.get("combined_weight", 0.0)

        for topic in topics:
            if topic:
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

    # Find dominant topic (highest total weight)
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
        "topic_weights": dict(topic_total_weights)
    }
