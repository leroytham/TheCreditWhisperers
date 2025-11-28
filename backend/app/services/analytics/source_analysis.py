"""
Source concentration analysis using Herfindahl-Hirschman Index (HHI).

This module provides functions to measure source diversity in sentiment data,
helping identify when sentiment is dominated by a single news source.
"""

from collections import defaultdict
from typing import Dict, List, Any, Optional


def calculate_hhi(weights: Dict[str, float]) -> Optional[float]:
    """
    Calculate Herfindahl-Hirschman Index (HHI) for source concentration.

    The HHI measures market concentration by summing the squared market shares.
    In this context, it measures whether sentiment comes from diverse sources
    or is dominated by a single outlet.

    Formula: HHI = sum(share_i^2 * 10000) where share_i = weight_i / total_weight

    HHI Interpretation:
        < 1500: Low Concentration (diverse, healthy distribution)
        1500-2500: Moderate Concentration (few sources dominant)
        > 2500: High Concentration (single source bias risk)

    Args:
        weights: Dictionary mapping source names to their total weights

    Returns:
        HHI value (0-10000) or None if no data
    """
    if not weights:
        return None

    total_weight = sum(weights.values())
    if total_weight == 0:
        return None

    hhi = 0.0
    for weight in weights.values():
        share = weight / total_weight
        hhi += (share ** 2) * 10000

    return hhi


def interpret_hhi(hhi: Optional[float]) -> str:
    """
    Interpret HHI value into human-readable concentration level.

    Args:
        hhi: HHI value (0-10000)

    Returns:
        Concentration interpretation string
    """
    if hhi is None:
        return "No Data"
    elif hhi < 1500:
        return "Low Concentration"
    elif hhi < 2500:
        return "Moderate Concentration"
    else:
        return "High Concentration"


def calculate_source_concentration(
    items: List[Dict[str, Any]],
    source_key: str = "source",
    weight_key: str = "combined_weight",
    top_n: int = 5
) -> Dict[str, Any]:
    """
    Calculate source concentration metrics from a list of weighted items.

    Args:
        items: List of dictionaries containing source and weight information
        source_key: Key for source name in item dict (default "source")
        weight_key: Key for weight value in item dict (default "combined_weight")
        top_n: Number of top sources to return (default 5)

    Returns:
        Dictionary containing:
            - source_concentration_hhi: float (0-10000) or None
            - concentration_interpretation: str
            - top_sources: list of {source, weight, percentage} dicts
            - source_count: int (total unique sources)
    """
    if not items:
        return {
            "source_concentration_hhi": None,
            "concentration_interpretation": "No Data",
            "top_sources": [],
            "source_count": 0
        }

    # Aggregate weights per source
    source_weights = defaultdict(float)
    for item in items:
        source = item.get(source_key, "Unknown")
        weight = item.get(weight_key, 0.0)
        source_weights[source] += weight

    # Calculate HHI
    hhi = calculate_hhi(dict(source_weights))
    interpretation = interpret_hhi(hhi)

    # Calculate total for percentages
    total_weight = sum(source_weights.values())

    # Get top sources sorted by weight
    sorted_sources = sorted(
        source_weights.items(),
        key=lambda x: x[1],
        reverse=True
    )[:top_n]

    top_sources = [
        {
            "source": source,
            "weight": weight,
            "percentage": round((weight / total_weight * 100), 2) if total_weight > 0 else 0
        }
        for source, weight in sorted_sources
    ]

    return {
        "source_concentration_hhi": round(hhi, 2) if hhi is not None else None,
        "concentration_interpretation": interpretation,
        "top_sources": top_sources,
        "source_count": len(source_weights)
    }


def calculate_source_concentration_from_mentions(
    ticker_mentions: List[Dict[str, Any]],
    articles: List[Dict[str, Any]],
    top_n: int = 5
) -> Dict[str, Any]:
    """
    Calculate source concentration from ticker mentions with article provider mapping.

    This version is specifically designed for sector sentiment analysis where
    ticker mentions need to be mapped back to their source articles.

    Args:
        ticker_mentions: List of ticker mention dicts with 'article_url' and 'combined_weight'
        articles: List of article dicts with provider/source information
        top_n: Number of top sources to return (default 5)

    Returns:
        Dictionary with HHI metrics and top sources
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
    source_weights = defaultdict(float)
    for mention in ticker_mentions:
        article_url = mention.get("article_url", "")
        combined_weight = mention.get("combined_weight", 0.0)

        provider = url_to_provider.get(article_url, "Unknown")
        source_weights[provider] += combined_weight

    if not source_weights:
        return {
            "source_concentration_hhi": None,
            "concentration_interpretation": "Not Available",
            "top_sources": []
        }

    # Calculate HHI
    hhi = calculate_hhi(dict(source_weights))
    interpretation = interpret_hhi(hhi)

    # Calculate total for percentages
    total_weight = sum(source_weights.values())

    # Get top sources sorted by weight
    sorted_sources = sorted(
        source_weights.items(),
        key=lambda x: x[1],
        reverse=True
    )[:top_n]

    top_sources = [
        {
            "source": source,
            "weight": weight,
            "percentage": round((weight / total_weight * 100), 2) if total_weight > 0 else 0
        }
        for source, weight in sorted_sources
    ]

    return {
        "source_concentration_hhi": round(hhi, 2) if hhi is not None else None,
        "concentration_interpretation": interpretation,
        "top_sources": top_sources
    }
