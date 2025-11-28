"""
Sentiment analysis service with momentum calculation.

This is the main service class that orchestrates sentiment analysis using:
- Article processor for text analysis (FinBERT fallback)
- Aggregation utilities for score calculation with decay
- Analytics utilities for z-score, HHI, and topic analysis
"""

import logging
import math
import pickle
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Optional

from app.models import News, SentimentScore, RelevanceScore
from app.config.scoring import map_alpha_vantage_label, classify_sentiment
from app.core.config import settings
from app.core.cache import redis_cache

logger = logging.getLogger(__name__)

from app.services.analytics import (
    classify_momentum,
    get_momentum_definition,
    interpret_volume,
)

from .article_processor import ArticleProcessor
from .aggregation import (
    calculate_aggregated_score_with_decay,
    calculate_z_score_from_articles,
    calculate_source_hhi,
    calculate_topic_analysis,
    generate_breadth_interpretation,
)


class SentimentService:
    """
    Hybrid sentiment analysis service that uses:
    1. Alpha Vantage pre-calculated scores when available (primary)
    2. FinBERT ML model for fallback news sources (secondary)
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            logger.info("Creating SentimentService instance...")
            cls._instance = super(SentimentService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize sentiment service components."""
        self.article_processor = ArticleProcessor()
        logger.info("SentimentService initialized (FinBERT disabled - using Alpha Vantage scores only)")

    @property
    def finbert(self):
        """Backward compatibility: access finbert through article processor."""
        return self.article_processor.finbert

    @property
    def finbert_available(self):
        """Backward compatibility: check finbert availability."""
        return self.article_processor.finbert_available

    def analyze_sentiment(self, text: str) -> Dict:
        """
        Analyze sentiment of a single text using FinBERT.
        Delegates to article processor.
        """
        return self.article_processor.analyze_sentiment(text)

    def _analyze_with_finbert(self, article: Dict) -> tuple:
        """
        Helper method to analyze an article with FinBERT.
        Delegates to article processor.
        """
        return self.article_processor.analyze_with_finbert(article)

    def _generate_news_cache_key(self, news_articles: List[Dict]) -> str:
        """
        Generate a stable cache key from a list of news articles.
        Delegates to article processor.
        """
        return self.article_processor.generate_cache_key(news_articles)

    def analyze_sentiment_with_weights(self, news_articles: List[Dict]) -> Dict:
        """
        Hybrid sentiment analysis with exponential decay and relevance weighting.

        This method intelligently chooses the best sentiment analyzer:
        1. For Alpha Vantage articles: Uses pre-calculated ticker_sentiment_score
        2. For fallback articles: Uses FinBERT ML model to analyze text
        3. Applies exponential decay for recency weighting
        4. Combines recency weight with relevance score for final weight

        Args:
            news_articles: List of news article dictionaries

        Returns:
            Dictionary containing sentiment results and metadata
        """
        if not news_articles:
            return {
                "articles_with_sentiment": [],
                "news_objects": [],
                "overall_weighted_score": None,
                "sentiment_counts": {},
                "daily_average_sentiment": {},
                "data_quality": "no_data"
            }

        results = []
        news_objects = []
        weighted_total = 0.0
        weight_sum = 0.0
        sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}

        daily_scores = defaultdict(list)
        now_utc = datetime.utcnow()

        decay_constant = settings.SENTIMENT_DECAY_CONSTANT

        for article in news_articles:
            has_alpha_vantage_score = "ticker_sentiment_score" in article

            if has_alpha_vantage_score:
                raw_score = article.get("ticker_sentiment_score", 0.0)
                av_label = article.get("ticker_sentiment_label", "Neutral")
                standard_label = map_alpha_vantage_label(av_label)
                confidence = min(abs(raw_score), 1.0)
                sentiment_source = "Alpha Vantage"
            else:
                raw_score, finbert_label, confidence = self._analyze_with_finbert(article)
                sentiment_source = "FinBERT (ProsusAI)"
                standard_label = classify_sentiment(raw_score)

            relevance_score = article.get("ticker_relevance_score", 1.0)
            if relevance_score <= 0:
                relevance_score = 1.0

            recency_weight = 0.0
            age_hours = 0.0
            pub_date_str = article.get("publish_date")

            if pub_date_str:
                try:
                    pub_datetime = datetime.strptime(pub_date_str, "%Y-%m-%d")
                    age_hours = (now_utc - pub_datetime).total_seconds() / 3600.0
                    recency_weight = math.exp(-decay_constant * age_hours)
                    combined_weight = relevance_score * recency_weight

                    weighted_total += raw_score * combined_weight
                    weight_sum += combined_weight

                    pub_date = pub_datetime.date()
                    daily_scores[pub_date].append(raw_score * combined_weight)
                except ValueError:
                    combined_weight = 0.0
            else:
                combined_weight = 0.0

            # Add sentiment data to the dictionary
            article["sentiment_label"] = standard_label
            article["sentiment_confidence"] = confidence
            article["sentiment_score_raw"] = raw_score
            article["recency_weight"] = recency_weight
            article["relevance_score"] = relevance_score
            article["combined_weight"] = combined_weight
            article["age_hours"] = age_hours
            results.append(article)

            # Update sentiment counts
            if standard_label in ["Bearish", "Somewhat-Bearish"]:
                sentiment_counts["negative"] += 1
            elif standard_label in ["Bullish", "Somewhat-Bullish"]:
                sentiment_counts["positive"] += 1
            else:
                sentiment_counts["neutral"] += 1

            # Create News model objects
            sentiment_score_obj = SentimentScore(
                value=raw_score,
                source=sentiment_source,
                confidence=confidence
            )

            relevance_score_obj = None
            ticker_relevance_score = article.get("ticker_relevance_score")
            if ticker_relevance_score is not None and ticker_relevance_score > 0:
                try:
                    relevance_source = "Alpha Vantage" if has_alpha_vantage_score else "Default"
                    relevance_score_obj = RelevanceScore(
                        value=ticker_relevance_score,
                        source=relevance_source,
                        confidence=1.0 if has_alpha_vantage_score else 0.5
                    )
                except ValueError:
                    pass

            news_obj = News(
                headline=article.get("title", ""),
                source=article.get("provider", "Unknown"),
                sentiment_score=sentiment_score_obj,
                relevance_score=relevance_score_obj
            )
            news_obj.link = article.get("link")
            news_obj.publish_date = pub_date_str
            news_obj.image = article.get("image")
            news_objects.append(news_obj)

        # Calculate daily average sentiment
        daily_avg_sentiment = {}
        all_dates = sorted(set(
            datetime.strptime(article.get("publish_date"), "%Y-%m-%d").date()
            for article in news_articles
            if article.get("publish_date")
        ))

        for date in all_dates:
            scores = daily_scores.get(date, [])
            daily_avg_sentiment[date.strftime("%Y-%m-%d")] = sum(scores) / len(scores) if scores else 0

        # Calculate overall weighted average
        data_quality = "good"
        avg_score = None

        if weight_sum >= 0.1:
            avg_score = weighted_total / weight_sum
            data_quality = "good"
        elif weight_sum > 0:
            avg_score = weighted_total / weight_sum
            data_quality = "low_confidence"
        else:
            avg_score = None
            data_quality = "insufficient_recent_data"

        return {
            "articles_with_sentiment": results,
            "news_objects": news_objects,
            "overall_weighted_score": avg_score,
            "sentiment_counts": sentiment_counts,
            "daily_average_sentiment": daily_avg_sentiment,
            "data_quality": data_quality,
            "total_weight": weight_sum,
            "decay_constant": decay_constant,
            "half_life_hours": math.log(2) / decay_constant if decay_constant > 0 else None
        }

    def analyze_sentiment_with_momentum(self, news_articles: List[Dict]) -> Dict:
        """
        Hybrid sentiment analysis with momentum calculation (MACD-style Fast vs. Slow).

        Calculates sentiment using TWO decay constants:
        1. Fast Score: Short half-life, captures current intraday sentiment
        2. Slow Score: Long half-life, captures daily trend baseline
        3. Momentum = Fast Score - Slow Score

        Args:
            news_articles: List of news article dictionaries

        Returns:
            Dictionary containing all fields from analyze_sentiment_with_weights() plus momentum data
        """
        # Check cache first
        articles_hash = self._generate_news_cache_key(news_articles)
        cache_key = f"sentiment_momentum:{articles_hash}"

        try:
            cached_result = redis_cache.get(cache_key)
            if cached_result:
                return pickle.loads(cached_result)
        except Exception as e:
            logger.error("Cache read error in analyze_sentiment_with_momentum: %s", e)

        # Calculate decay constants from configured half-lives
        half_life_fast = settings.SENTIMENT_HALF_LIFE_FAST_HOURS
        half_life_slow = settings.SENTIMENT_HALF_LIFE_SLOW_HOURS
        k_fast = math.log(2) / half_life_fast
        k_slow = math.log(2) / half_life_slow

        threshold_weak = settings.MOMENTUM_THRESHOLD_WEAK
        threshold_strong = settings.MOMENTUM_THRESHOLD_STRONG

        now_utc = datetime.utcnow()

        # Calculate fast score (short half-life)
        fast_score, fast_weight, fast_quality, _, fast_volatility, fast_breadth = calculate_aggregated_score_with_decay(
            news_articles,
            k_fast,
            now_utc,
            self._analyze_with_finbert
        )

        # Calculate slow score (long half-life)
        slow_score, slow_weight, slow_quality, articles_with_metadata_slow, slow_volatility, slow_breadth = calculate_aggregated_score_with_decay(
            news_articles,
            k_slow,
            now_utc,
            self._analyze_with_finbert
        )

        # Calculate sentiment momentum
        momentum = None
        momentum_quality = None
        momentum_classification = None

        if fast_score is not None and slow_score is not None:
            momentum = fast_score - slow_score

            if fast_quality == "insufficient_recent_data" or slow_quality == "insufficient_recent_data":
                momentum_quality = "insufficient_recent_data"
            elif fast_quality == "low_confidence" or slow_quality == "low_confidence":
                momentum_quality = "low_confidence"
            else:
                momentum_quality = "good"

            momentum_classification = classify_momentum(momentum, threshold_weak, threshold_strong)
        else:
            momentum = None
            momentum_quality = None
            momentum_classification = {
                "label": None,
                "interpretation": "Insufficient data for momentum calculation",
                "direction": None,
                "strength": None,
                "magnitude": None,
                "sign": None
            }

        # Get full results with article details
        full_results = self.analyze_sentiment_with_weights(news_articles)

        # Calculate Z-Score
        z_score_data = calculate_z_score_from_articles(
            news_articles,
            slow_score,
            k_slow
        )

        # Calculate Source Concentration and Topic Analysis
        source_concentration_data = calculate_source_hhi(articles_with_metadata_slow)
        topic_analysis_data = calculate_topic_analysis(articles_with_metadata_slow)

        # Volume interpretation
        volume_interpretation = interpret_volume(slow_weight) if slow_weight is not None else None

        # Breadth interpretation
        breadth_interpretation, breadth_quality = generate_breadth_interpretation(slow_breadth)

        # Update results with momentum fields
        full_results.update({
            # Fast & Slow scores
            "fast_score": fast_score,
            "slow_score": slow_score,
            "fast_weight": fast_weight,
            "slow_weight": slow_weight,
            "fast_quality": fast_quality,
            "slow_quality": slow_quality,

            # Momentum
            "sentiment_momentum": momentum,
            "momentum_quality": momentum_quality,

            # Momentum classification
            "momentum_label": momentum_classification["label"],
            "momentum_interpretation": momentum_classification["interpretation"],
            "momentum_direction": momentum_classification["direction"],
            "momentum_strength": momentum_classification["strength"],
            "momentum_magnitude": momentum_classification["magnitude"],
            "momentum_sign": momentum_classification["sign"],

            # Volatility
            "sentiment_volatility": slow_volatility,
            "volatility_quality": slow_quality,

            # Effective News Volume
            "effective_news_volume": slow_weight,
            "volume_interpretation": volume_interpretation,

            # Sentiment Breadth
            "sentiment_breadth_score": slow_breadth["breadth_score"] if slow_breadth else None,
            "num_bullish_articles": slow_breadth["num_bullish"] if slow_breadth else 0,
            "num_bearish_articles": slow_breadth["num_bearish"] if slow_breadth else 0,
            "total_directional_articles": slow_breadth["total_directional"] if slow_breadth else 0,
            "breadth_interpretation": breadth_interpretation,
            "breadth_quality": breadth_quality,

            # Sentiment Shock (Z-Score)
            "sentiment_z_score": z_score_data.get("z_score"),
            "z_score_interpretation": z_score_data.get("interpretation"),
            "z_score_historical_mean": z_score_data.get("historical_mean"),
            "z_score_historical_std": z_score_data.get("historical_std"),
            "z_score_days_of_history": z_score_data.get("days_of_history"),
            "z_score_quality": z_score_data.get("quality"),

            # Decay parameters
            "decay_k_fast": k_fast,
            "decay_k_slow": k_slow,
            "half_life_fast_hours": half_life_fast,
            "half_life_slow_hours": half_life_slow,

            # Thresholds
            "momentum_threshold_weak": threshold_weak,
            "momentum_threshold_strong": threshold_strong,

            # Definition
            "momentum_definition": get_momentum_definition(),

            # Source & Topic Analysis
            "source_concentration_hhi": source_concentration_data.get("hhi"),
            "concentration_interpretation": source_concentration_data.get("interpretation"),
            "top_sources": source_concentration_data.get("top_sources", []),
            "dominant_topic": topic_analysis_data.get("dominant_topic"),
            "dominant_topic_weight": topic_analysis_data.get("dominant_topic_weight"),
            "dominant_topic_percentage": topic_analysis_data.get("dominant_topic_percentage"),
            "topic_count": topic_analysis_data.get("topic_count", 0),
            "sentiment_by_topic": topic_analysis_data.get("sentiment_by_topic", {}),
            "topic_weights": topic_analysis_data.get("topic_weights", {})
        })

        # Cache the result
        try:
            redis_cache.set(cache_key, pickle.dumps(full_results), 600)
        except Exception as e:
            logger.error("Cache write error in analyze_sentiment_with_momentum: %s", e)

        return full_results


# Create a singleton instance
sentiment_service = SentimentService()
