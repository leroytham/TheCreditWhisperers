"""
Rolling Sentiment Service

Extracts shared logic for rolling sentiment calculations,
supporting both stock tickers and sector identifiers.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# Timeframe configuration mapping
TIMEFRAME_CONFIGS = {
    '1D': {'hours': 24, 'interval_hours': 1, 'window_hours': 24},
    '1W': {'hours': 168, 'interval_hours': 6, 'window_hours': 24},
    '1M': {'hours': 720, 'interval_hours': 12, 'window_hours': 24},
    '3M': {'days': 90, 'interval_hours': 24, 'window_hours': 24},
    '6M': {'days': 180, 'interval_hours': 24, 'window_hours': 24},
    'YTD': {'days': None, 'interval_hours': 24, 'window_hours': 24},  # Calculated dynamically
    '1Y': {'days': 365, 'interval_hours': 24, 'window_hours': 24},
    '5Y': {'days': 1825, 'interval_hours': 24, 'window_hours': 24},
    '10Y': {'days': 3650, 'interval_hours': 48, 'window_hours': 168},
    'MAX': {'days': 7300, 'interval_hours': 168, 'window_hours': 720}
}


def get_timeframe_config(timeframe: str) -> Dict[str, Any]:
    """
    Get configuration for a given timeframe.

    Handles YTD specially by calculating days from start of year.
    """
    if timeframe == 'YTD':
        now = datetime.now(timezone.utc)
        ytd_days = (now - datetime(now.year, 1, 1, tzinfo=timezone.utc)).days
        return {'days': ytd_days, 'interval_hours': 24, 'window_hours': 24}

    return TIMEFRAME_CONFIGS.get(timeframe, TIMEFRAME_CONFIGS['1W'])


def get_effective_sector_timeframe(timeframe: str) -> str:
    """
    Get effective timeframe for sectors (capped at 1M).
    """
    return timeframe if timeframe in ['1D', '1W', '1M'] else '1M'


def format_data_point_label(point_time: datetime, timeframe: str) -> str:
    """
    Format label string based on timeframe.
    """
    hour = point_time.strftime("%I").lstrip("0")
    day = str(point_time.day)

    if timeframe == '1D':
        return f"{hour}{point_time.strftime('%p')}"
    elif timeframe == '1W':
        return f"{point_time.strftime('%a')} {hour}{point_time.strftime('%p')}"
    elif timeframe == '1M':
        return f"{point_time.strftime('%b')} {day} {hour}{point_time.strftime('%p')}"
    elif timeframe in ['3M', '6M', 'YTD', '1Y']:
        return f"{point_time.strftime('%b')} {day}"
    elif timeframe == '5Y':
        return f"{point_time.strftime('%b')} {day}, {point_time.year}"
    else:
        return f"{point_time.strftime('%b')} {day}"


def calculate_rolling_stock_sentiment(
    articles_with_sentiment: List[Dict[str, Any]],
    timeframe: str,
    config: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, str]]]:
    """
    Calculate rolling sentiment data points for stock tickers.

    Args:
        articles_with_sentiment: Articles with sentiment scores
        timeframe: Timeframe string (1D, 1W, etc.)
        config: Timeframe configuration dict

    Returns:
        Tuple of (data_points, source_earliest_dates)
    """
    now = datetime.now(timezone.utc)
    data_points = []

    # Calculate number of data points
    if 'days' in config:
        num_points = config['days'] * (24 // config['interval_hours'])
    else:
        num_points = config['hours'] // config['interval_hours']

    for i in range(num_points):
        point_time = now - timedelta(hours=i * config['interval_hours'])
        window_start = point_time - timedelta(hours=config['window_hours'])

        # Find articles in the time window
        window_articles = _filter_articles_by_window(
            articles_with_sentiment,
            window_start,
            point_time
        )

        volume = len(window_articles)
        avg_sentiment = (
            sum(a.get("sentiment_score_raw", 0) for a in window_articles) / volume
            if volume > 0 else 0
        )

        # Sort by impact (sentiment * relevance)
        top_headlines = sorted(
            window_articles,
            key=lambda x: abs(x.get("sentiment_score_raw", 0)) * x.get("relevance_score", 1.0),
            reverse=True
        )

        data_points.append({
            "timestamp": point_time.isoformat(),
            "label": format_data_point_label(point_time, timeframe),
            "volume": volume,
            "sentiment": avg_sentiment,
            "headlines": [
                {
                    "title": h.get("title", ""),
                    "provider": h.get("provider", "Unknown"),
                    "sentiment_score": h.get("sentiment_score_raw", 0),
                    "relevance_score": h.get("relevance_score", 1.0),
                    "link": h.get("link", "")
                }
                for h in top_headlines
            ]
        })

    data_points.reverse()

    # Extract source earliest dates if available
    source_earliest_dates = None
    for article in articles_with_sentiment:
        if '_source_earliest_dates' in article:
            source_earliest_dates = article['_source_earliest_dates']
            break

    return data_points, source_earliest_dates


def _filter_articles_by_window(
    articles: List[Dict[str, Any]],
    window_start: datetime,
    window_end: datetime
) -> List[Dict[str, Any]]:
    """
    Filter articles to those within the specified time window.
    """
    window_articles = []

    for article in articles:
        pub_timestamp_str = article.get("publish_timestamp")
        if pub_timestamp_str:
            try:
                pub_timestamp = datetime.fromisoformat(pub_timestamp_str)
                if pub_timestamp.tzinfo is None:
                    pub_timestamp = pub_timestamp.replace(tzinfo=timezone.utc)
                if window_start <= pub_timestamp <= window_end:
                    window_articles.append(article)
            except Exception:
                # Fall back to date-only comparison
                publish_date = article.get("publish_date")
                if publish_date:
                    try:
                        window_start_date = window_start.date()
                        window_end_date = window_end.date()
                        article_date = datetime.strptime(publish_date, "%Y-%m-%d").date()
                        if window_start_date <= article_date <= window_end_date:
                            window_articles.append(article)
                    except Exception:
                        pass

    return window_articles


def build_rolling_sentiment_response(
    ticker: str,
    timeframe: str,
    data_points: List[Dict[str, Any]],
    source_earliest_dates: Optional[Dict[str, str]],
    score_defs: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Build the response dict for rolling sentiment endpoint.
    """
    has_data = any(point["volume"] > 0 for point in data_points)

    response = {
        "ticker": ticker,
        "timeframe": timeframe,
        "data": data_points,
        "has_data": has_data,
        **score_defs
    }

    if source_earliest_dates:
        response["source_earliest_dates"] = source_earliest_dates

    return response


def build_empty_response(
    ticker: str,
    timeframe: str,
    score_defs: Dict[str, Any],
    message: str = "No news articles found"
) -> Dict[str, Any]:
    """
    Build an empty response when no articles are found.
    """
    return {
        "ticker": ticker,
        "timeframe": timeframe,
        "data": [],
        "has_data": False,
        "message": message,
        **score_defs
    }


class RollingSentimentService:
    """
    Service class for calculating rolling sentiment data.

    Provides a high-level interface for routes.py to calculate rolling
    sentiment for stocks, integrating news fetching and sentiment analysis.

    This class wraps the module-level functions and adds service dependencies
    for a cleaner API in route handlers.
    """

    def __init__(self, news_service=None, sentiment_service=None):
        """
        Initialize with optional service dependencies.

        Args:
            news_service: News service instance (lazy-loaded if None)
            sentiment_service: Sentiment service instance (lazy-loaded if None)
        """
        self._news_service = news_service
        self._sentiment_service = sentiment_service

    @property
    def news_service(self):
        """Lazy-load news service."""
        if self._news_service is None:
            from app.services.news_service import news_service_instance
            self._news_service = news_service_instance
        return self._news_service

    @property
    def sentiment_service(self):
        """Lazy-load sentiment service."""
        if self._sentiment_service is None:
            from app.services.sentiment_service import sentiment_service
            self._sentiment_service = sentiment_service
        return self._sentiment_service

    async def get_stock_rolling_sentiment(
        self,
        ticker: str,
        timeframe: str = "1W",
        score_defs: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Calculate rolling sentiment for a stock ticker.

        Fetches news, analyzes sentiment, and generates rolling window data points.
        This is the main method routes.py should call for stock rolling sentiment.

        Args:
            ticker: Stock ticker symbol
            timeframe: Timeframe string (1D, 1W, 1M, 3M, 6M, YTD, 1Y, 5Y, 10Y, MAX)
            score_defs: Score definitions to include in response (optional)

        Returns:
            Dict with rolling sentiment data points and metadata
        """
        logger.info("Calculating stock rolling sentiment for: %s (timeframe: %s)", ticker, timeframe)

        # Get timeframe configuration
        config = get_timeframe_config(timeframe)

        # Fetch news articles
        news_articles = await self.news_service.get_ticker_news_for_timeframe(
            ticker,
            timeframe=timeframe,
            trigger_progressive=True
        )

        logger.debug("Rolling sentiment: received %d articles from news service",
                     len(news_articles) if news_articles else 0)

        # Handle empty response
        if not news_articles:
            logger.debug("Rolling sentiment: no articles found for %s", ticker)
            return build_empty_response(
                ticker,
                timeframe,
                score_defs or {},
                "No news articles found"
            )

        # Analyze sentiment for all articles
        sentiment_results = self.sentiment_service.analyze_sentiment_with_weights(news_articles)
        articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

        # Calculate rolling data points
        data_points, source_earliest_dates = calculate_rolling_stock_sentiment(
            articles_with_sentiment,
            timeframe,
            config
        )

        logger.debug("Rolling sentiment: generated %d data points", len(data_points))

        # Build response
        return build_rolling_sentiment_response(
            ticker,
            timeframe,
            data_points,
            source_earliest_dates,
            score_defs or {}
        )

    def calculate_data_points_for_articles(
        self,
        articles_with_sentiment: List[Dict[str, Any]],
        timeframe: str
    ) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, str]]]:
        """
        Calculate rolling sentiment data points from pre-analyzed articles.

        Use this when you already have articles with sentiment scores
        and just need the rolling calculations.

        Args:
            articles_with_sentiment: Articles with sentiment_score_raw field
            timeframe: Timeframe string

        Returns:
            Tuple of (data_points, source_earliest_dates)
        """
        config = get_timeframe_config(timeframe)
        return calculate_rolling_stock_sentiment(
            articles_with_sentiment,
            timeframe,
            config
        )


# Create singleton instance
rolling_sentiment_service = RollingSentimentService()
