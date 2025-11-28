"""
Sector sentiment service with momentum calculation.

This is the main service class that orchestrates sector-wide sentiment analysis.
It processes news articles that mention multiple tickers, extracting sentiment
data for each ticker mention within an article, filtering to only tickers in
the sector basket, and aggregating to produce sector-level metrics.
"""

import logging
import math
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from typing import Dict, List, Set

from app.core.config import settings

logger = logging.getLogger(__name__)

from .ticker_extraction import (
    extract_ticker_mentions,
    extract_all_ticker_mentions,
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


class SectorSentimentService:
    """
    Service for calculating sector-wide sentiment metrics from multi-ticker articles.

    Key Features:
    - Single-pass iteration through master article list
    - Multi-ticker processing (each article can mention multiple tickers)
    - Sector basket filtering (only count ticker mentions in the sector)
    - Combined weighting per ticker mention (relevance × recency)
    - Sector-wide aggregation (sentiment, breadth, momentum, volatility, coverage)
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            logger.info("Creating SectorSentimentService instance...")
            cls._instance = super(SectorSentimentService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize service configuration."""
        # Get decay constants from config
        self.half_life_fast = settings.SENTIMENT_HALF_LIFE_FAST_HOURS
        self.half_life_slow = settings.SENTIMENT_HALF_LIFE_SLOW_HOURS
        self.k_fast = math.log(2) / self.half_life_fast
        self.k_slow = math.log(2) / self.half_life_slow

        # Momentum thresholds
        self.threshold_weak = settings.MOMENTUM_THRESHOLD_WEAK
        self.threshold_strong = settings.MOMENTUM_THRESHOLD_STRONG

        # Sentiment classification thresholds
        self.BULLISH_THRESHOLD = 0.35
        self.BEARISH_THRESHOLD = -0.35
        self.MIN_RELEVANCE_THRESHOLD = 0.1

        logger.info("SectorSentimentService initialized: Fast half-life=%dh (k=%.4f), Slow half-life=%dh (k=%.4f), Momentum thresholds: weak=%s, strong=%s",
                    self.half_life_fast, self.k_fast, self.half_life_slow, self.k_slow, self.threshold_weak, self.threshold_strong)

    def calculate_daily_sector_sentiment(
        self,
        articles: List[Dict],
        sector_tickers: List[str],
        days: int = 30
    ) -> Dict:
        """
        Calculate daily sector sentiment scores for charting.

        Groups articles by publish_date, extracts ticker mentions for each day,
        and calculates weighted sector sentiment per day.

        Args:
            articles: List of article dictionaries with ticker_sentiment arrays
            sector_tickers: List of ticker symbols in the sector
            days: Number of days to include (default 30)

        Returns:
            Dictionary with daily scores, counts, and headlines
        """
        if not articles or not sector_tickers:
            return {}

        sector_ticker_set = set(t.upper().strip() for t in sector_tickers)
        now_utc = datetime.now(timezone.utc)

        # Group articles by date
        daily_articles = defaultdict(list)

        for article in articles:
            pub_datetime = parse_article_datetime(article)
            if pub_datetime:
                daily_articles[pub_datetime.date()].append(article)

        # Calculate sentiment for each day
        now_date = now_utc.date()
        cutoff_date = now_date - timedelta(days=days)

        valid_dates = [date for date in daily_articles.keys() if date >= cutoff_date]
        sorted_dates = sorted(valid_dates)

        daily_results = {}

        for date in sorted_dates:
            articles_for_day = daily_articles[date]

            day_ticker_mentions = []
            headlines = []
            day_datetime = datetime.combine(date, datetime.min.time()).replace(tzinfo=timezone.utc)

            for article in articles_for_day:
                mentions = extract_ticker_mentions(
                    article,
                    sector_ticker_set,
                    day_datetime
                )
                if mentions:
                    day_ticker_mentions.extend(mentions)

                    article_sentiment = sum(m["sentiment_score"] for m in mentions) / len(mentions)
                    weighted_relevance = sum(m["sentiment_score"] * m["relevance_score"] for m in mentions)

                    headlines.append({
                        "title": article.get("title", ""),
                        "url": article.get("url", ""),
                        "provider": article.get("provider", ""),
                        "sentiment_score": round(article_sentiment, 4),
                        "relevance_score": round(weighted_relevance, 4),
                        "link": article.get("url", "")
                    })

            if day_ticker_mentions:
                score, weight, _ = aggregate_ticker_mentions(day_ticker_mentions, self.k_slow)

                headlines_sorted = sorted(
                    headlines,
                    key=lambda x: abs(x.get("sentiment_score", 0)) * x.get("relevance_score", 0),
                    reverse=True
                )

                daily_results[date.strftime("%Y-%m-%d")] = {
                    "score": round(score, 4) if score is not None else 0.0,
                    "count": len(day_ticker_mentions),
                    "headlines": headlines_sorted
                }

        return daily_results

    def calculate_rolling_sector_sentiment(
        self,
        articles: List[Dict],
        sector_tickers: List[str],
        timeframe: str = "1W",
        interval_hours: int = 6,
        window_hours: int = 24
    ) -> List[Dict]:
        """
        Calculate rolling-window sector sentiment scores for charting.

        Creates time-series data points with rolling 24h windows at specified intervals.

        Args:
            articles: List of article dictionaries with ticker_sentiment arrays
            sector_tickers: List of ticker symbols in the sector
            timeframe: Time range ('1D', '1W', '1M', etc.)
            interval_hours: Hours between data points
            window_hours: Size of rolling window in hours

        Returns:
            List of data point dictionaries with timestamp, label, volume, sentiment, headlines
        """
        if not articles or not sector_tickers:
            return []

        sector_ticker_set = set(t.upper().strip() for t in sector_tickers)
        now_utc = datetime.now(timezone.utc)

        # Determine number of data points based on timeframe
        timeframe_configs = {
            '1D': {'hours': 24, 'num_points': 24 // interval_hours},
            '1W': {'hours': 168, 'num_points': 168 // interval_hours},
            '1M': {'hours': 720, 'num_points': 720 // interval_hours},
            '3M': {'hours': 2160, 'num_points': 2160 // interval_hours},
            '6M': {'hours': 4320, 'num_points': 4320 // interval_hours},
            '1Y': {'hours': 8760, 'num_points': 8760 // interval_hours},
        }

        config = timeframe_configs.get(timeframe, timeframe_configs['1W'])
        num_points = config['num_points']
        data_points = []

        # Pre-parse all article timestamps once
        parsed_articles = []
        for article in articles:
            pub_datetime = parse_article_datetime(article)
            if pub_datetime:
                parsed_articles.append((pub_datetime, article))

        # Pre-filter articles to only those within the overall timeframe
        earliest_window = now_utc - timedelta(hours=num_points * interval_hours + window_hours)
        filtered_articles = [(dt, art) for dt, art in parsed_articles if dt >= earliest_window]

        # Process each time window
        for i in range(num_points):
            point_time = now_utc - timedelta(hours=i * interval_hours)
            window_start_time = point_time - timedelta(hours=window_hours)

            window_ticker_mentions = []
            window_articles_map = {}

            for pub_datetime, article in filtered_articles:
                if window_start_time <= pub_datetime <= point_time:
                    mentions = extract_ticker_mentions(
                        article,
                        sector_ticker_set,
                        point_time,
                        pub_datetime
                    )

                    article_sentiment = 0.0
                    weighted_relevance = 0.0

                    if mentions:
                        window_ticker_mentions.extend(mentions)
                        article_sentiment = sum(m["sentiment_score"] for m in mentions) / len(mentions)
                        weighted_relevance = sum(m["sentiment_score"] * m["relevance_score"] for m in mentions)

                    article_url = article.get("url", "")
                    if article_url and article_url not in window_articles_map:
                        window_articles_map[article_url] = {
                            "title": article.get("title", ""),
                            "url": article_url,
                            "link": article_url,
                            "provider": article.get("provider", ""),
                            "sentiment_score": round(article_sentiment, 4),
                            "relevance_score": round(weighted_relevance, 4),
                            "publish_date": pub_datetime.strftime("%Y-%m-%d")
                        }

            # Calculate weighted sentiment for this window
            if window_ticker_mentions:
                score, weight, _ = aggregate_ticker_mentions(window_ticker_mentions, self.k_slow)
                avg_sentiment = score if score is not None else 0.0
            else:
                avg_sentiment = 0.0

            # Sort headlines by product of sentiment strength and relevance score
            headlines = sorted(
                window_articles_map.values(),
                key=lambda x: abs(x.get("sentiment_score", 0)) * x.get("relevance_score", 0),
                reverse=True
            )

            # Format label based on timeframe
            label = self._format_time_label(point_time, timeframe)

            data_points.append({
                "timestamp": point_time.isoformat(),
                "label": label,
                "volume": len(window_ticker_mentions),
                "sentiment": round(avg_sentiment, 4),
                "headlines": headlines
            })

        # Reverse to show oldest to newest and filter empty points
        data_points.reverse()
        filtered_data_points = [point for point in data_points if point["volume"] > 0]

        return filtered_data_points

    def _format_time_label(self, dt: datetime, timeframe: str) -> str:
        """Format time label based on timeframe."""
        hour = dt.strftime("%I").lstrip("0")
        day = str(dt.day)

        if timeframe == '1D':
            return f"{hour}{dt.strftime('%p')}"
        elif timeframe == '1W':
            return f"{dt.strftime('%a')} {hour}{dt.strftime('%p')}"
        elif timeframe == '1M':
            return f"{dt.strftime('%b')} {day} {hour}{dt.strftime('%p')}"
        else:
            return f"{dt.strftime('%b')} {day}"

    def analyze_sector_sentiment_with_momentum(
        self,
        articles: List[Dict],
        sector_tickers: List[str]
    ) -> Dict:
        """
        Analyze sector-wide sentiment with momentum from multi-ticker articles.

        This is the main entry point for sector sentiment calculation.

        Args:
            articles: List of article dictionaries with 'ticker_sentiment' arrays
            sector_tickers: List of ticker symbols in the sector

        Returns:
            Dictionary containing all sector sentiment metrics
        """
        if not articles:
            return self._empty_sector_sentiment_result()

        sector_ticker_set = set(t.upper().strip() for t in sector_tickers)
        if not sector_ticker_set:
            return self._empty_sector_sentiment_result()

        now_utc = datetime.now(timezone.utc)

        # Extract all ticker mentions
        all_ticker_mentions, articles_with_sector_mentions = extract_all_ticker_mentions(
            articles,
            sector_ticker_set,
            now_utc
        )

        if not all_ticker_mentions:
            return self._empty_sector_sentiment_result()

        # Calculate FAST and SLOW scores
        fast_score, fast_weight, fast_breadth = aggregate_ticker_mentions(
            all_ticker_mentions, self.k_fast
        )
        slow_score, slow_weight, slow_breadth = aggregate_ticker_mentions(
            all_ticker_mentions, self.k_slow
        )

        # Calculate momentum
        momentum = None
        momentum_quality = None

        if fast_score is not None and slow_score is not None:
            momentum = fast_score - slow_score
            if fast_weight >= 0.1 and slow_weight >= 0.1:
                momentum_quality = "good"
            elif fast_weight > 0 and slow_weight > 0:
                momentum_quality = "low_confidence"
            else:
                momentum_quality = "insufficient_data"

        # Calculate volatility
        volatility = calculate_volatility(all_ticker_mentions, slow_score)

        # Calculate ticker coverage
        coverage_data = calculate_ticker_coverage(all_ticker_mentions, sector_ticker_set)

        # Determine data quality
        if slow_weight >= 0.1:
            data_quality = "good"
        elif slow_weight > 0:
            data_quality = "low_confidence"
        else:
            data_quality = "insufficient_data"

        # Classify momentum, breadth, volume
        momentum_classification = classify_momentum(momentum, self.threshold_weak, self.threshold_strong)
        breadth_interpretation = interpret_breadth(slow_breadth)
        volume_interpretation = interpret_volume(slow_weight)

        # Calculate Z-Score
        z_score_data = calculate_z_score_from_ticker_mentions(
            articles,
            sector_ticker_set,
            slow_score,
            self.k_slow,
            lambda art, tickers, dt: extract_ticker_mentions(art, tickers, dt)
        )

        # Calculate source and topic analysis
        source_data = calculate_source_concentration(all_ticker_mentions, articles)
        topic_data = calculate_topic_analysis(all_ticker_mentions, articles)

        return {
            # Core sentiment scores
            "fast_score": round(fast_score, 4) if fast_score is not None else None,
            "slow_score": round(slow_score, 4) if slow_score is not None else None,
            "sentiment_momentum": round(momentum, 4) if momentum is not None else None,

            # Quality indicators
            "data_quality": data_quality,
            "momentum_quality": momentum_quality,
            "fast_weight": round(fast_weight, 4),
            "slow_weight": round(slow_weight, 4),

            # Momentum classification
            "momentum_label": momentum_classification.get("label"),
            "momentum_interpretation": momentum_classification.get("interpretation"),
            "momentum_direction": momentum_classification.get("direction"),
            "momentum_strength": momentum_classification.get("strength"),

            # Volatility
            "sentiment_volatility": round(volatility, 4) if volatility is not None else None,
            "volatility_quality": data_quality,

            # Breadth
            "sentiment_breadth_score": round(slow_breadth["breadth_score"], 4),
            "num_bullish_mentions": slow_breadth["num_bullish"],
            "num_bearish_mentions": slow_breadth["num_bearish"],
            "total_directional_mentions": slow_breadth["total_directional"],
            "breadth_interpretation": breadth_interpretation,
            "breadth_quality": "good" if slow_breadth["total_directional"] >= 10 else "low_confidence",

            # Volume/Coverage
            "effective_news_volume": round(slow_weight, 4),
            "volume_interpretation": volume_interpretation,
            "ticker_coverage": coverage_data,

            # Counts
            "total_ticker_mentions": len(all_ticker_mentions),
            "unique_articles_with_sector_mentions": articles_with_sector_mentions,
            "total_articles_analyzed": len(articles),

            # Configuration metadata
            "half_life_fast_hours": self.half_life_fast,
            "half_life_slow_hours": self.half_life_slow,
            "decay_k_fast": round(self.k_fast, 6),
            "decay_k_slow": round(self.k_slow, 6),
            "momentum_threshold_weak": self.threshold_weak,
            "momentum_threshold_strong": self.threshold_strong,

            # Entity-compatible aliases
            "avg_score": round(slow_score, 4) if slow_score is not None else None,
            "num_bullish_articles": slow_breadth["num_bullish"],
            "num_bearish_articles": slow_breadth["num_bearish"],
            "total_directional_articles": slow_breadth["total_directional"],

            # Z-Score
            "sentiment_z_score": z_score_data.get("z_score"),
            "z_score_interpretation": z_score_data.get("interpretation"),
            "z_score_historical_mean": z_score_data.get("historical_mean"),
            "z_score_historical_std": z_score_data.get("historical_std"),
            "z_score_days_of_history": z_score_data.get("days_of_history"),
            "z_score_quality": z_score_data.get("quality"),

            # Source Concentration
            "source_concentration_hhi": source_data.get("source_concentration_hhi"),
            "concentration_interpretation": source_data.get("concentration_interpretation"),
            "top_sources": source_data.get("top_sources", []),

            # Topic Analysis
            "dominant_topic": topic_data.get("dominant_topic"),
            "dominant_topic_weight": topic_data.get("dominant_topic_weight"),
            "dominant_topic_percentage": topic_data.get("dominant_topic_percentage"),
            "topic_count": topic_data.get("topic_count"),
            "sentiment_by_topic": topic_data.get("sentiment_by_topic", {}),
            "topic_weights": topic_data.get("topic_weights", {})
        }

    def _empty_sector_sentiment_result(self) -> Dict:
        """Return empty result structure when no data available."""
        return {
            "fast_score": None,
            "slow_score": None,
            "sentiment_momentum": None,
            "data_quality": "no_data",
            "momentum_quality": None,
            "fast_weight": 0.0,
            "slow_weight": 0.0,
            "momentum_label": None,
            "momentum_interpretation": "No data available",
            "momentum_direction": None,
            "momentum_strength": None,
            "sentiment_volatility": None,
            "volatility_quality": "no_data",
            "sentiment_breadth_score": 0.0,
            "num_bullish_mentions": 0,
            "num_bearish_mentions": 0,
            "total_directional_mentions": 0,
            "breadth_interpretation": "No data available",
            "breadth_quality": "no_data",
            "effective_news_volume": 0.0,
            "volume_interpretation": "No Coverage",
            "ticker_coverage": {
                "tickers_mentioned": 0,
                "total_tickers_in_sector": 0,
                "coverage_percentage": 0.0,
                "mentioned_ticker_list": []
            },
            "total_ticker_mentions": 0,
            "unique_articles_with_sector_mentions": 0,
            "total_articles_analyzed": 0,
            "half_life_fast_hours": self.half_life_fast,
            "half_life_slow_hours": self.half_life_slow,
            "decay_k_fast": round(self.k_fast, 6),
            "decay_k_slow": round(self.k_slow, 6),
            "momentum_threshold_weak": self.threshold_weak,
            "momentum_threshold_strong": self.threshold_strong
        }


# Create singleton instance
sector_sentiment_service = SectorSentimentService()
