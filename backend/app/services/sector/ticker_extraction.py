"""
Ticker extraction and processing for sector sentiment analysis.

This module handles:
- Extracting ticker mentions from articles with sector basket filtering
- Combined weight calculation (relevance × recency)
- Article timestamp parsing and age calculation
"""

import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set


# Constants
DEFAULT_MIN_RELEVANCE_THRESHOLD = 0.1


def calculate_combined_weight(
    relevance_score: float,
    age_hours: float,
    decay_constant: float
) -> float:
    """
    Calculate combined weight for a ticker mention.

    Formula: CombinedWeight = relevance_score × e^(-k × age_hours)

    Args:
        relevance_score: Relevance score (0.0-1.0)
        age_hours: Age of article in hours
        decay_constant: Decay constant k (ln(2) / half_life_hours)

    Returns:
        Combined weight (float)
    """
    if age_hours > 0:
        recency_weight = math.exp(-decay_constant * age_hours)
    else:
        recency_weight = 1.0

    return relevance_score * recency_weight


def parse_article_datetime(article: Dict) -> Optional[datetime]:
    """
    Parse publication datetime from article fields.

    Tries timestamp first (preferred for precision), falls back to date.

    Args:
        article: Article dictionary with timestamp/date fields

    Returns:
        Timezone-aware datetime or None if parsing fails
    """
    pub_datetime = None

    # Try timestamp first (preferred)
    pub_timestamp_str = article.get("publish_timestamp")
    if pub_timestamp_str:
        try:
            pub_datetime = datetime.fromisoformat(pub_timestamp_str)
            if pub_datetime.tzinfo is None:
                pub_datetime = pub_datetime.replace(tzinfo=timezone.utc)
            return pub_datetime
        except (ValueError, AttributeError):
            pass

    # Fallback to date
    pub_date_str = article.get("publish_date")
    if pub_date_str:
        try:
            pub_datetime = datetime.strptime(pub_date_str, "%Y-%m-%d")
            pub_datetime = pub_datetime.replace(tzinfo=timezone.utc)
            return pub_datetime
        except ValueError:
            pass

    return None


def extract_ticker_mentions(
    article: Dict,
    sector_tickers: Set[str],
    now_utc: datetime,
    pub_datetime: datetime = None,
    min_relevance_threshold: float = DEFAULT_MIN_RELEVANCE_THRESHOLD
) -> List[Dict]:
    """
    Extract ticker mentions from an article that belong to the sector basket.

    Args:
        article: Article dictionary with 'ticker_sentiment' array
        sector_tickers: Set of ticker symbols in the sector
        now_utc: Current UTC time for recency calculation
        pub_datetime: Optional pre-parsed publication datetime (for performance)
        min_relevance_threshold: Minimum relevance score threshold

    Returns:
        List of ticker mention dictionaries, each containing:
            - ticker: str
            - sentiment_score: float
            - sentiment_label: str
            - relevance_score: float
            - age_hours: float
            - article_url: str
            - article_title: str
            - publish_date: str (YYYY-MM-DD)
    """
    ticker_sentiments = article.get("ticker_sentiment", [])
    if not ticker_sentiments:
        return []

    # Calculate article age for recency weighting
    age_hours = 0.0
    pub_date_str = None

    # Use pre-parsed datetime if provided (performance optimization)
    if pub_datetime is None:
        pub_datetime = parse_article_datetime(article)

    # Calculate age if we have a datetime
    if pub_datetime:
        age_hours = (now_utc - pub_datetime).total_seconds() / 3600.0
        pub_date_str = pub_datetime.strftime("%Y-%m-%d")

    # Extract ticker mentions that belong to sector
    ticker_mentions = []

    for ts in ticker_sentiments:
        ticker = ts.get("ticker", "").upper().strip()

        # Filter: only include tickers in sector basket
        if ticker not in sector_tickers:
            continue

        # Extract sentiment data for this ticker mention
        sentiment_score = ts.get("ticker_sentiment_score", 0.0)
        sentiment_label = ts.get("ticker_sentiment_label", "Neutral")
        relevance_score = ts.get("relevance_score", 0.0)

        # Skip if relevance is too low
        if relevance_score < min_relevance_threshold:
            continue

        ticker_mentions.append({
            "ticker": ticker,
            "sentiment_score": sentiment_score,
            "sentiment_label": sentiment_label,
            "relevance_score": relevance_score,
            "age_hours": age_hours,
            "article_url": article.get("url", "") or article.get("link", ""),
            "article_title": article.get("title", ""),
            "publish_date": pub_date_str
        })

    return ticker_mentions


def extract_all_ticker_mentions(
    articles: List[Dict],
    sector_tickers: Set[str],
    now_utc: datetime = None,
    min_relevance_threshold: float = DEFAULT_MIN_RELEVANCE_THRESHOLD
) -> tuple:
    """
    Extract all ticker mentions from a list of articles.

    Args:
        articles: List of article dictionaries
        sector_tickers: Set of ticker symbols in the sector
        now_utc: Current UTC time (defaults to now)
        min_relevance_threshold: Minimum relevance score threshold

    Returns:
        Tuple of (all_ticker_mentions, articles_with_sector_mentions_count)
    """
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)

    all_ticker_mentions = []
    articles_with_sector_mentions = 0

    for article in articles:
        ticker_mentions = extract_ticker_mentions(
            article,
            sector_tickers,
            now_utc,
            min_relevance_threshold=min_relevance_threshold
        )

        if ticker_mentions:
            all_ticker_mentions.extend(ticker_mentions)
            articles_with_sector_mentions += 1

    return all_ticker_mentions, articles_with_sector_mentions
