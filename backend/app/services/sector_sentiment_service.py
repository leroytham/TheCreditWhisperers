# app/services/sector_sentiment_service.py

import math
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from typing import List, Dict, Tuple, Set

from app.core.config import settings


class SectorSentimentService:
    """
    Service for calculating sector-wide sentiment metrics from multi-ticker articles.

    This service processes news articles that mention multiple tickers, extracting
    sentiment data for each ticker mention within an article, filtering to only
    tickers in the sector basket, and aggregating to produce sector-level metrics.

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
            print("Creating SectorSentimentService instance...")
            cls._instance = super(SectorSentimentService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize service configuration."""
        # Get decay constants from config
        # Formula: k = ln(2) / half_life_hours
        self.half_life_fast = settings.SENTIMENT_HALF_LIFE_FAST_HOURS  # Default: 7 hours
        self.half_life_slow = settings.SENTIMENT_HALF_LIFE_SLOW_HOURS  # Default: 24 hours
        self.k_fast = math.log(2) / self.half_life_fast
        self.k_slow = math.log(2) / self.half_life_slow

        # Momentum thresholds
        self.threshold_weak = settings.MOMENTUM_THRESHOLD_WEAK  # Default: 0.05
        self.threshold_strong = settings.MOMENTUM_THRESHOLD_STRONG  # Default: 0.15

        # Sentiment classification thresholds
        self.BULLISH_THRESHOLD = 0.35
        self.BEARISH_THRESHOLD = -0.35
        self.MIN_RELEVANCE_THRESHOLD = 0.1

        print(f"SectorSentimentService initialized with:")
        print(f"  Fast half-life: {self.half_life_fast}h (k={self.k_fast:.4f})")
        print(f"  Slow half-life: {self.half_life_slow}h (k={self.k_slow:.4f})")
        print(f"  Momentum thresholds: weak={self.threshold_weak}, strong={self.threshold_strong}")

    def _extract_ticker_mentions(
        self,
        article: dict,
        sector_tickers: Set[str],
        now_utc: datetime,
        pub_datetime: datetime = None
    ) -> List[Dict]:
        """
        Extract ticker mentions from an article that belong to the sector basket.

        Args:
            article: Article dictionary with 'ticker_sentiment' array
            sector_tickers: Set of ticker symbols in the sector
            now_utc: Current UTC time for recency calculation
            pub_datetime: Optional pre-parsed publication datetime (for performance optimization)
                         If provided, skips timestamp parsing from article fields

        Returns:
            List of ticker mention dictionaries, each containing:
                - ticker: str
                - sentiment_score: float
                - sentiment_label: str
                - relevance_score: float
                - recency_weight: float
                - combined_weight: float
                - age_hours: float
                - article_url: str (for traceability)
                - article_title: str (for debugging)
        """
        ticker_sentiments = article.get("ticker_sentiment", [])
        if not ticker_sentiments:
            return []

        # Calculate article age for recency weighting
        age_hours = 0.0
        recency_weight = 0.0
        pub_date_str = None  # Will be set from datetime later

        # Use pre-parsed datetime if provided (performance optimization)
        if pub_datetime is None:
            # Parse timestamp from article fields
            pub_timestamp_str = article.get("publish_timestamp")

            # Try timestamp first (preferred for precision)
            if pub_timestamp_str:
                try:
                    pub_datetime = datetime.fromisoformat(pub_timestamp_str)
                    if pub_datetime.tzinfo is None:
                        pub_datetime = pub_datetime.replace(tzinfo=timezone.utc)
                except (ValueError, AttributeError):
                    pub_datetime = None

            # Fallback to date if timestamp not available
            if pub_datetime is None:
                pub_date_str = article.get("publish_date")
                if pub_date_str:
                    try:
                        pub_datetime = datetime.strptime(pub_date_str, "%Y-%m-%d")
                        pub_datetime = pub_datetime.replace(tzinfo=timezone.utc)
                    except ValueError:
                        pass

        # Calculate age if we have a datetime and set pub_date_str for return value
        if pub_datetime:
            age_hours = (now_utc - pub_datetime).total_seconds() / 3600.0
            # Set pub_date_str from datetime if not already set
            if pub_date_str is None:
                pub_date_str = pub_datetime.strftime("%Y-%m-%d")
            # We'll calculate recency_weight later with specific k values

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
            if relevance_score < self.MIN_RELEVANCE_THRESHOLD:
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

    def _calculate_combined_weight(
        self,
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

    def _aggregate_ticker_mentions(
        self,
        ticker_mentions: List[Dict],
        decay_constant: float
    ) -> Tuple[float, float, Dict]:
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
            return (None, 0.0, self._empty_breadth_data())

        weighted_total = 0.0
        weight_sum = 0.0
        num_bullish = 0
        num_bearish = 0

        for mention in ticker_mentions:
            # Calculate combined weight for this mention
            combined_weight = self._calculate_combined_weight(
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
            if sentiment_score >= self.BULLISH_THRESHOLD:
                num_bullish += 1
            elif sentiment_score <= self.BEARISH_THRESHOLD:
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

    def _calculate_volatility(
        self,
        ticker_mentions: List[Dict],
        aggregated_score: float
    ) -> float:
        """
        Calculate weighted standard deviation of sentiment scores.

        Formula: sqrt(Σ(CombinedWeight × (score - mean)²) / Σ(CombinedWeight))

        Args:
            ticker_mentions: List of ticker mention dictionaries (with combined_weight)
            aggregated_score: Mean sentiment score

        Returns:
            Volatility (standard deviation)
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

    def _empty_breadth_data(self) -> Dict:
        """Return empty breadth data structure."""
        return {
            "breadth_score": 0.0,
            "num_bullish": 0,
            "num_bearish": 0,
            "total_directional": 0
        }

    def _calculate_ticker_coverage(
        self,
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

    def _calculate_z_score_from_ticker_mentions(
        self,
        articles: List[dict],
        sector_tickers: Set[str],
        current_slow_score: float
    ) -> Dict:
        """
        Calculate Z-Score (sentiment shock) for sector from daily aggregation.

        Groups ticker mentions by day, calculates daily sector sentiment scores,
        then computes Z-Score for most recent period vs historical baseline.

        Args:
            articles: List of article dictionaries with ticker_sentiment arrays
            sector_tickers: Set of ticker symbols in the sector
            current_slow_score: Current slow score (24h half-life baseline)

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
            # Create timezone-aware datetime for this day
            day_datetime = datetime.combine(date, datetime.min.time()).replace(tzinfo=timezone.utc)
            for article in articles_for_day:
                mentions = self._extract_ticker_mentions(
                    article,
                    sector_tickers,
                    day_datetime
                )
                day_ticker_mentions.extend(mentions)

            if day_ticker_mentions:
                # Calculate score for this day using slow decay
                score, weight, _ = self._aggregate_ticker_mentions(
                    day_ticker_mentions,
                    self.k_slow
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

        # Calculate historical statistics
        import statistics
        historical_mean = statistics.mean(historical_scores)

        if len(historical_scores) >= 2:
            historical_std = statistics.stdev(historical_scores)
        else:
            historical_std = 0.0

        # Calculate Z-Score
        if historical_std == 0:
            z_score = 0.0
            interpretation = "No Historical Variation"
            quality = "low_confidence"
        else:
            z_score = (current_slow_score - historical_mean) / historical_std

            # Classify Z-Score
            if z_score > 2.0:
                interpretation = "Extreme Positive Shock"
                quality = "good"
            elif z_score > 1.5:
                interpretation = "Strong Positive Signal"
                quality = "good"
            elif z_score > 1.0:
                interpretation = "Moderately Positive"
                quality = "good"
            elif z_score > 0.5:
                interpretation = "Slightly Positive"
                quality = "good"
            elif z_score >= -0.5:
                interpretation = "Normal Range"
                quality = "good"
            elif z_score >= -1.0:
                interpretation = "Slightly Negative"
                quality = "good"
            elif z_score >= -1.5:
                interpretation = "Moderately Negative"
                quality = "good"
            elif z_score >= -2.0:
                interpretation = "Strong Negative Signal"
                quality = "good"
            else:
                interpretation = "Extreme Negative Shock"
                quality = "good"

            # Adjust quality based on sample size
            if len(historical_scores) < 5:
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

    def _calculate_source_concentration(self, ticker_mentions: List[Dict], articles: List[Dict] = None) -> Dict:
        """
        Calculate Herfindahl-Hirschman Index (HHI) for source diversity.

        Measures whether sentiment comes from diverse sources or is dominated
        by a single outlet.

        Formula: HHI = Σ(share_i² × 10000) where share_i = source_weight / total_weight

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
            # Try both 'provider' (from news_service processing) and 'source' (raw API)
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

        # Calculate HHI
        total_weight = sum(source_weights.values())
        if total_weight == 0:
            return {
                "source_concentration_hhi": None,
                "concentration_interpretation": "Not Available",
                "top_sources": []
            }

        hhi = 0.0
        for weight in source_weights.values():
            share = weight / total_weight
            hhi += (share ** 2) * 10000

        # Interpret HHI
        if hhi < 1500:
            interpretation = "Low Concentration"
        elif hhi < 2500:
            interpretation = "Moderate Concentration"
        else:
            interpretation = "High Concentration"

        # Get top sources sorted by weight
        top_sources = sorted(
            [{"source": source, "weight": weight, "percentage": (weight / total_weight) * 100}
             for source, weight in source_weights.items()],
            key=lambda x: x["weight"],
            reverse=True
        )[:5]  # Top 5 sources

        return {
            "source_concentration_hhi": hhi,
            "concentration_interpretation": interpretation,
            "top_sources": top_sources
        }

    def _calculate_topic_analysis(self, ticker_mentions: List[Dict], articles: List[Dict] = None) -> Dict:
        """
        Calculate dominant topic and sentiment by topic from ticker mentions.

        Args:
            ticker_mentions: List of ticker mention dicts
            articles: List of article dicts with topic information (optional)

        Returns:
            Dictionary with dominant topic and sentiment breakdown by topic
        """
        if not articles or not ticker_mentions:
            print(f"[Topic Analysis] No articles ({len(articles) if articles else 0}) or ticker_mentions ({len(ticker_mentions)})")
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
                # Topics is a list of dicts with 'topic' and 'relevance_score'
                # Example: [{"topic": "Technology", "relevance_score": "0.5"}, ...]
                if isinstance(topics, list) and len(topics) > 0:
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
            print("[Topic Analysis] No topics found in articles")
            return {
                "dominant_topic": None,
                "dominant_topic_weight": 0.0,
                "dominant_topic_percentage": 0.0,
                "topic_count": 0,
                "sentiment_by_topic": {},
                "topic_weights": {}
            }

        # Calculate weighted sentiment and weight per topic
        topic_sentiment_weights = {}  # topic -> list of (sentiment, weight) tuples
        topic_total_weights = {}      # topic -> total weight
        
        matched_urls = 0  # Track how many ticker_mentions matched with topics

        for mention in ticker_mentions:
            article_url = mention.get("article_url", "")
            topics = url_to_topics.get(article_url, [])
            
            if topics:  # Count matches
                matched_urls += 1
            
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
            "topic_weights": topic_total_weights
        }

    def calculate_daily_sector_sentiment(
        self,
        articles: List[dict],
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
            Dictionary with daily scores, counts, and headlines:
            {
                "2025-10-25": {
                    "score": 0.24,
                    "count": 1234,
                    "headlines": [...]
                }
            }
        """
        if not articles or not sector_tickers:
            return {}

        sector_ticker_set = set(t.upper().strip() for t in sector_tickers)
        now_utc = datetime.now(timezone.utc)

        # Group articles by date
        daily_articles = defaultdict(list)

        for article in articles:
            # Try timestamp first for better accuracy
            pub_timestamp_str = article.get("publish_timestamp")
            pub_date = None

            if pub_timestamp_str:
                try:
                    pub_datetime = datetime.fromisoformat(pub_timestamp_str)
                    pub_date = pub_datetime.date()
                except (ValueError, AttributeError):
                    pub_date = None

            # Fallback to date field
            if pub_date is None:
                pub_date_str = article.get("publish_date")
                if pub_date_str:
                    try:
                        pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date()
                    except ValueError:
                        continue
                else:
                    continue

            daily_articles[pub_date].append(article)

        # Calculate sentiment for each day
        # Get all dates within the requested days range (oldest to newest)
        now_date = now_utc.date()
        cutoff_date = now_date - timedelta(days=days)
        
        # Filter dates to only those within the range
        valid_dates = [date for date in daily_articles.keys() if date >= cutoff_date]
        sorted_dates = sorted(valid_dates)  # Sort oldest to newest for proper x-axis ordering
        
        daily_results = {}

        for date in sorted_dates:
            articles_for_day = daily_articles[date]

            # Extract ticker mentions for this day
            day_ticker_mentions = []
            headlines = []

            for article in articles_for_day:
                # Create timezone-aware datetime for this day
                day_datetime = datetime.combine(date, datetime.min.time()).replace(tzinfo=timezone.utc)
                mentions = self._extract_ticker_mentions(
                    article,
                    sector_ticker_set,
                    day_datetime
                )
                if mentions:
                    day_ticker_mentions.extend(mentions)

                    # Calculate average sentiment and relevance score for this article from ticker mentions
                    article_sentiment = 0.0
                    article_relevance = 0.0
                    if mentions:
                        article_sentiment = sum(m["sentiment_score"] for m in mentions) / len(mentions)
                        article_relevance = sum(m["relevance_score"] for m in mentions) / len(mentions)

                    headlines.append({
                        "title": article.get("title", ""),
                        "url": article.get("url", ""),
                        "provider": article.get("provider", ""),
                        "sentiment_score": round(article_sentiment, 4),
                        "relevance_score": round(article_relevance, 4),
                        "link": article.get("url", "")  # Add link field for frontend compatibility
                    })

            if day_ticker_mentions:
                # Calculate score for this day
                score, weight, _ = self._aggregate_ticker_mentions(
                    day_ticker_mentions,
                    self.k_slow
                )

                # Sort headlines by product of sentiment strength and relevance score
                headlines_sorted = sorted(
                    headlines,
                    key=lambda x: abs(x.get("sentiment_score", 0)) * x.get("relevance_score", 0),
                    reverse=True
                )

                daily_results[date.strftime("%Y-%m-%d")] = {
                    "score": round(score, 4) if score is not None else 0.0,
                    "count": len(day_ticker_mentions),
                    "headlines": headlines_sorted  # Return all headlines (no limit)
                }

        return daily_results

    def calculate_rolling_sector_sentiment(
        self,
        articles: List[dict],
        sector_tickers: List[str],
        timeframe: str = "1W",
        interval_hours: int = 6,
        window_hours: int = 24
    ) -> List[Dict]:
        """
        Calculate rolling-window sector sentiment scores for charting.

        Creates time-series data points with rolling 24h windows at specified intervals.
        Similar to calculate_daily_sector_sentiment but with finer time granularity.

        Args:
            articles: List of article dictionaries with ticker_sentiment arrays
            sector_tickers: List of ticker symbols in the sector
            timeframe: Time range ('1D', '1W', '1M', etc.)
            interval_hours: Hours between data points (1, 6, 12, or 24)
            window_hours: Size of rolling window in hours (default 24)

        Returns:
            List of data point dictionaries:
            [
                {
                    "timestamp": "2025-10-26T15:00:00",
                    "label": "Mon 3PM",
                    "volume": 45,
                    "sentiment": 0.24,
                    "headlines": [...]
                }
            ]
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
            '5Y': {'hours': 43800, 'num_points': 43800 // interval_hours}
        }

        config = timeframe_configs.get(timeframe, timeframe_configs['1W'])
        num_points = config['num_points']
        data_points = []

        # PERFORMANCE OPTIMIZATION: Pre-parse all article timestamps once
        # This avoids parsing the same timestamp N times (once per window)
        print(f"Pre-parsing timestamps for {len(articles)} articles...")
        parsed_articles = []  # List of (pub_datetime, article) tuples

        for article in articles:
            # Try to get timestamp first (preferred), fallback to date
            pub_timestamp_str = article.get("publish_timestamp")
            pub_datetime = None

            if pub_timestamp_str:
                try:
                    # Parse ISO 8601 timestamp
                    pub_datetime = datetime.fromisoformat(pub_timestamp_str)
                    # Ensure timezone-aware for comparison
                    if pub_datetime.tzinfo is None:
                        pub_datetime = pub_datetime.replace(tzinfo=timezone.utc)
                except (ValueError, AttributeError):
                    pub_datetime = None

            # Fallback to date-only if timestamp not available or parsing failed
            if pub_datetime is None:
                pub_date_str = article.get("publish_date")
                if not pub_date_str:
                    continue
                try:
                    pub_datetime = datetime.strptime(pub_date_str, "%Y-%m-%d")
                    # Assign to midnight UTC for date-only articles
                    pub_datetime = pub_datetime.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue

            # Store parsed datetime with article
            parsed_articles.append((pub_datetime, article))

        # Pre-filter articles to only those within the overall timeframe
        # This reduces the working set significantly for long timeframes
        earliest_window = now_utc - timedelta(hours=num_points * interval_hours + window_hours)
        filtered_articles = [(dt, art) for dt, art in parsed_articles if dt >= earliest_window]
        print(f"Filtered {len(parsed_articles)} -> {len(filtered_articles)} articles within timeframe")

        # Process each time window
        for i in range(num_points):
            point_time = now_utc - timedelta(hours=i * interval_hours)
            window_start_time = point_time - timedelta(hours=window_hours)

            # Find articles within this rolling window
            window_ticker_mentions = []
            window_articles_map = {}  # Track unique articles by URL

            for pub_datetime, article in filtered_articles:
                # Check if article falls within this window (precise timestamp comparison)
                if window_start_time <= pub_datetime <= point_time:
                    # Extract ticker mentions for this article (pass pre-parsed datetime)
                    mentions = self._extract_ticker_mentions(
                        article,
                        sector_ticker_set,
                        point_time,
                        pub_datetime  # Pass pre-parsed datetime for performance
                    )

                    # Calculate sentiment and relevance if article has ticker mentions
                    article_sentiment = 0.0
                    article_relevance = 0.0
                    if mentions:
                        window_ticker_mentions.extend(mentions)
                        # Calculate average sentiment and relevance for this article from ticker mentions
                        article_sentiment = sum(m["sentiment_score"] for m in mentions) / len(mentions)
                        article_relevance = sum(m["relevance_score"] for m in mentions) / len(mentions)

                    # Always add to headlines if in time window (regardless of ticker mentions)
                    article_url = article.get("url", "")
                    if article_url and article_url not in window_articles_map:
                        window_articles_map[article_url] = {
                            "title": article.get("title", ""),
                            "url": article_url,
                            "link": article_url,
                            "provider": article.get("provider", ""),
                            "sentiment_score": round(article_sentiment, 4),
                            "relevance_score": round(article_relevance, 4),
                            "publish_date": pub_datetime.strftime("%Y-%m-%d")  # For sorting by recency
                        }

            # Calculate weighted sentiment for this window
            if window_ticker_mentions:
                score, weight, _ = self._aggregate_ticker_mentions(
                    window_ticker_mentions,
                    self.k_slow
                )
                avg_sentiment = score if score is not None else 0.0
            else:
                avg_sentiment = 0.0

            # Debug logging
            print(f"  Window {i}: {len(window_articles_map)} articles, {len(window_ticker_mentions)} mentions, sentiment={avg_sentiment:.4f}")

            # Sort headlines by product of sentiment strength and relevance score
            headlines = sorted(
                window_articles_map.values(),
                key=lambda x: abs(x.get("sentiment_score", 0)) * x.get("relevance_score", 0),
                reverse=True
            )  # Return all headlines (no limit)

            # Format label based on timeframe
            point_datetime = point_time
            if timeframe == '1D':
                label = point_datetime.strftime("%-I%p")
            elif timeframe == '1W':
                label = point_datetime.strftime("%a %-I%p")
            elif timeframe == '1M':
                label = point_datetime.strftime("%b %-d %-I%p")
            elif timeframe in ['3M', '6M']:
                label = point_datetime.strftime("%b %-d")
            elif timeframe in ['1Y', '5Y']:
                label = point_datetime.strftime("%b %-d, %Y") if timeframe == '5Y' else point_datetime.strftime("%b %-d")
            else:
                label = point_datetime.strftime("%b %-d")

            data_points.append({
                "timestamp": point_datetime.isoformat(),
                "label": label,
                "volume": len(window_ticker_mentions),
                "sentiment": round(avg_sentiment, 4),
                "headlines": headlines
            })

        # Reverse to show oldest to newest
        data_points.reverse()
        
        # Filter out data points with no volume (no news articles)
        # This prevents showing empty/zero data for time periods with no news coverage
        filtered_data_points = [point for point in data_points if point["volume"] > 0]
        
        print(f"Returning {len(filtered_data_points)} data points (filtered from {len(data_points)} total)")

        return filtered_data_points

    def analyze_sector_sentiment_with_momentum(
        self,
        articles: List[dict],
        sector_tickers: List[str]
    ) -> Dict:
        """
        Analyze sector-wide sentiment with momentum from multi-ticker articles.

        This is the main entry point for sector sentiment calculation. It:
        1. Iterates through articles once
        2. Extracts ticker mentions for tickers in sector basket
        3. Calculates fast score (7h half-life) and slow score (24h half-life)
        4. Computes momentum = fast_score - slow_score
        5. Calculates volatility, breadth, and coverage metrics

        Args:
            articles: List of article dictionaries with 'ticker_sentiment' arrays
            sector_tickers: List of ticker symbols in the sector

        Returns:
            Dictionary containing:
                - fast_score: Sentiment score with fast decay (short half-life)
                - slow_score: Sentiment score with slow decay (long half-life)
                - sentiment_momentum: fast_score - slow_score
                - sentiment_volatility: Weighted standard deviation
                - sentiment_breadth_score: Bull/bear ratio (-1.0 to +1.0)
                - num_bullish_mentions: Count of bullish ticker mentions
                - num_bearish_mentions: Count of bearish ticker mentions
                - total_directional_mentions: Total directional mentions
                - ticker_coverage: Coverage metrics
                - total_ticker_mentions: Total number of ticker mentions processed
                - unique_articles_with_sector_mentions: Count of articles mentioning sector tickers
                - data_quality: Quality indicator
                - fast_weight: Sum of fast combined weights
                - slow_weight: Sum of slow combined weights
                - [metadata fields...]
        """
        if not articles:
            return self._empty_sector_sentiment_result()

        # Convert sector_tickers to set for fast lookup
        sector_ticker_set = set(t.upper().strip() for t in sector_tickers)

        if not sector_ticker_set:
            return self._empty_sector_sentiment_result()

        # Current time for recency calculation
        now_utc = datetime.now(timezone.utc)

        # SINGLE ITERATION through article list
        # Extract all ticker mentions from all articles
        all_ticker_mentions = []
        articles_with_sector_mentions = 0

        for article in articles:
            ticker_mentions = self._extract_ticker_mentions(
                article,
                sector_ticker_set,
                now_utc
            )

            if ticker_mentions:
                all_ticker_mentions.extend(ticker_mentions)
                articles_with_sector_mentions += 1

        if not all_ticker_mentions:
            return self._empty_sector_sentiment_result()

        # Calculate FAST score (short half-life, sensitive to recent news)
        fast_score, fast_weight, fast_breadth = self._aggregate_ticker_mentions(
            all_ticker_mentions,
            self.k_fast
        )

        # Calculate SLOW score (long half-life, stable baseline)
        slow_score, slow_weight, slow_breadth = self._aggregate_ticker_mentions(
            all_ticker_mentions,
            self.k_slow
        )

        # Calculate sentiment momentum
        momentum = None
        momentum_quality = None

        if fast_score is not None and slow_score is not None:
            momentum = fast_score - slow_score

            # Determine momentum quality
            if fast_weight >= 0.1 and slow_weight >= 0.1:
                momentum_quality = "good"
            elif fast_weight > 0 and slow_weight > 0:
                momentum_quality = "low_confidence"
            else:
                momentum_quality = "insufficient_data"

        # Calculate volatility (using slow score as baseline)
        volatility = self._calculate_volatility(all_ticker_mentions, slow_score)

        # Calculate ticker coverage
        coverage_data = self._calculate_ticker_coverage(
            all_ticker_mentions,
            sector_ticker_set
        )

        # Determine data quality
        if slow_weight >= 0.1:
            data_quality = "good"
        elif slow_weight > 0:
            data_quality = "low_confidence"
        else:
            data_quality = "insufficient_data"

        # Classify momentum
        momentum_classification = self._classify_momentum(momentum)

        # Classify breadth
        breadth_interpretation = self._interpret_breadth(slow_breadth)

        # Classify volume
        volume_interpretation = self._interpret_volume(slow_weight)

        # Calculate Z-Score (sentiment shock)
        z_score_data = self._calculate_z_score_from_ticker_mentions(
            articles,
            sector_ticker_set,
            slow_score
        )

        # Calculate source concentration and topic analysis
        # Pass articles to enable proper calculation
        source_data = self._calculate_source_concentration(all_ticker_mentions, articles)
        topic_data = self._calculate_topic_analysis(all_ticker_mentions, articles)

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
            "momentum_label": momentum_classification["label"],
            "momentum_interpretation": momentum_classification["interpretation"],
            "momentum_direction": momentum_classification["direction"],
            "momentum_strength": momentum_classification["strength"],

            # Volatility
            "sentiment_volatility": round(volatility, 4) if volatility is not None else None,
            "volatility_quality": data_quality,

            # Breadth (bull/bear ratio)
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

            # Z-Score / Sentiment Shock
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

    def _classify_momentum(self, momentum: float) -> Dict:
        """Classify momentum into categories."""
        if momentum is None:
            return {
                "label": None,
                "interpretation": "Insufficient data",
                "direction": None,
                "strength": None
            }

        # Determine direction and strength
        if momentum > self.threshold_strong:
            return {
                "label": "Strong Positive Momentum",
                "interpretation": "Sentiment rapidly improving",
                "direction": "improving",
                "strength": "strong"
            }
        elif momentum > self.threshold_weak:
            return {
                "label": "Weak Positive Momentum",
                "interpretation": "Sentiment slightly improving",
                "direction": "improving",
                "strength": "weak"
            }
        elif momentum >= -self.threshold_weak:
            return {
                "label": "Stable Sentiment",
                "interpretation": "Sentiment holding steady",
                "direction": "stable",
                "strength": "neutral"
            }
        elif momentum >= -self.threshold_strong:
            return {
                "label": "Weak Negative Momentum",
                "interpretation": "Sentiment slightly deteriorating",
                "direction": "deteriorating",
                "strength": "weak"
            }
        else:
            return {
                "label": "Strong Negative Momentum",
                "interpretation": "Sentiment rapidly deteriorating",
                "direction": "deteriorating",
                "strength": "strong"
            }

    def _interpret_breadth(self, breadth_data: Dict) -> str:
        """Generate human-readable breadth interpretation."""
        total = breadth_data["total_directional"]

        if total == 0:
            return "No directional sentiment data"

        bulls = breadth_data["num_bullish"]
        bears = breadth_data["num_bearish"]
        score = breadth_data["breadth_score"]

        if score > 0.5:
            return f"Overwhelmingly Bullish ({bulls} bullish vs {bears} bearish mentions)"
        elif score > 0.2:
            return f"Moderately Bullish ({bulls} bullish vs {bears} bearish mentions)"
        elif score >= -0.2:
            return f"Mixed Sentiment ({bulls} bullish vs {bears} bearish mentions)"
        elif score >= -0.5:
            return f"Moderately Bearish ({bulls} bullish vs {bears} bearish mentions)"
        else:
            return f"Overwhelmingly Bearish ({bulls} bullish vs {bears} bearish mentions)"

    def _interpret_volume(self, weight: float) -> str:
        """Classify effective news volume coverage."""
        if weight < 1.0:
            return "Low Coverage"
        elif weight <= 10.0:
            return "Medium Coverage"
        else:
            return "High Coverage"


# Create singleton instance
sector_sentiment_service = SectorSentimentService()
