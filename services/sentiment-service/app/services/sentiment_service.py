# =============================================================================
# Sentiment Service - Analyzes sentiment with MACD-style momentum
# =============================================================================

import math
import hashlib
import pickle
import statistics
from datetime import datetime
from collections import defaultdict
from typing import List, Dict, Optional, Tuple
import logging

from app.core.config import settings
from app.core.cache import redis_cache

logger = logging.getLogger(__name__)


# Sentiment classification thresholds - centralized constants
# These values define the boundaries for sentiment classification:
# - BULLISH_STRONG_THRESHOLD (0.35): Strong bullish sentiment
# - BULLISH_WEAK_THRESHOLD (0.15): Somewhat bullish sentiment
# - BEARISH_WEAK_THRESHOLD (-0.15): Somewhat bearish sentiment
# - BEARISH_STRONG_THRESHOLD (-0.35): Strong bearish sentiment
BULLISH_STRONG_THRESHOLD = 0.35
BULLISH_WEAK_THRESHOLD = 0.15
BEARISH_WEAK_THRESHOLD = -0.15
BEARISH_STRONG_THRESHOLD = -0.35


def map_alpha_vantage_label(av_label: str) -> str:
    """Map Alpha Vantage labels to standardized format."""
    mapping = {
        "Bearish": "Bearish",
        "Somewhat-Bearish": "Somewhat-Bearish",
        "Neutral": "Neutral",
        "Somewhat-Bullish": "Somewhat-Bullish",
        "Bullish": "Bullish"
    }
    return mapping.get(av_label, "Neutral")


def classify_sentiment(score: float) -> str:
    """Classify sentiment score into label."""
    if score >= BULLISH_STRONG_THRESHOLD:
        return "Bullish"
    elif score >= BULLISH_WEAK_THRESHOLD:
        return "Somewhat-Bullish"
    elif score <= BEARISH_STRONG_THRESHOLD:
        return "Bearish"
    elif score <= BEARISH_WEAK_THRESHOLD:
        return "Somewhat-Bearish"
    return "Neutral"


def classify_momentum(
    momentum: float,
    threshold_weak: float = 0.10,
    threshold_strong: float = 0.20
) -> Dict:
    """Classify momentum value."""
    abs_momentum = abs(momentum)

    if abs_momentum < threshold_weak:
        return {
            "label": "Stable",
            "interpretation": "Sentiment is stable with minimal change",
            "direction": "stable",
            "strength": "neutral",
            "magnitude": abs_momentum,
            "sign": "~"
        }

    direction = "improving" if momentum > 0 else "deteriorating"
    sign = "+" if momentum > 0 else "-"

    if abs_momentum >= threshold_strong:
        return {
            "label": f"Strong {'Positive' if momentum > 0 else 'Negative'} Momentum",
            "interpretation": f"Sentiment is {'significantly improving' if momentum > 0 else 'significantly deteriorating'}",
            "direction": direction,
            "strength": "strong",
            "magnitude": abs_momentum,
            "sign": sign
        }
    else:
        return {
            "label": f"Weak {'Positive' if momentum > 0 else 'Negative'} Momentum",
            "interpretation": f"Sentiment is {'slightly improving' if momentum > 0 else 'slightly deteriorating'}",
            "direction": direction,
            "strength": "weak",
            "magnitude": abs_momentum,
            "sign": sign
        }


def get_momentum_definition() -> str:
    """Return human-readable momentum definition."""
    return (
        "Momentum = FastScore - SlowScore. "
        "FastScore uses 7-hour half-life (sensitive to breaking news). "
        "SlowScore uses 24-hour half-life (stable baseline). "
        "Positive momentum (+) indicates improving sentiment. "
        "Negative momentum (-) indicates deteriorating sentiment."
    )


class SentimentService:
    """
    Sentiment analysis with exponential decay weighting and momentum calculation.

    Uses MACD-style Fast vs. Slow score comparison:
    - Fast Score: Short half-life for current sentiment
    - Slow Score: Long half-life for baseline trend
    - Momentum: Fast - Slow (direction of sentiment change)
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            logger.info("Creating SentimentService instance...")
            cls._instance = super(SentimentService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize service (FinBERT disabled, using Alpha Vantage scores)."""
        self.finbert = None
        self.finbert_available = False
        logger.info("SentimentService initialized (using Alpha Vantage scores)")

    def analyze_sentiment(self, text: str) -> Dict:
        """Analyze sentiment of text (fallback for non-Alpha Vantage articles)."""
        if not text or not self.finbert_available:
            return {"label": "neutral", "confidence": 0.0, "score": 0.0}
        # FinBERT analysis would go here if enabled
        return {"label": "neutral", "confidence": 0.0, "score": 0.0}

    def _generate_news_cache_key(self, news_articles: List[Dict]) -> str:
        """Generate stable cache key from article list."""
        if not news_articles:
            return "empty"

        article_ids = sorted([
            f"{article.get('link', article.get('url', ''))}:{article.get('publish_date', '')}"
            for article in news_articles
        ])
        combined = ":".join(article_ids)
        return hashlib.md5(combined.encode()).hexdigest()[:16]

    def _calculate_aggregated_score_with_decay(
        self,
        news_articles: List[Dict],
        decay_constant: float,
        now_utc: datetime = None
    ) -> Tuple[Optional[float], float, str, List[Dict], Optional[float], Dict]:
        """
        Calculate aggregated sentiment with exponential decay weighting.

        Returns: (score, total_weight, quality, articles_with_meta, volatility, breadth)
        """
        if not news_articles:
            return (None, 0.0, "no_data", [], None, {})

        if now_utc is None:
            now_utc = datetime.utcnow()

        weighted_total = 0.0
        weight_sum = 0.0
        articles_with_metadata = []

        for article in news_articles:
            # Get sentiment score
            raw_score = article.get("ticker_sentiment_score", 0.0)

            # Get relevance (default 1.0)
            relevance_score = article.get("ticker_relevance_score", 1.0)
            if relevance_score <= 0:
                relevance_score = 1.0

            # Calculate decay weight
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
                except ValueError:
                    combined_weight = 0.0
            else:
                combined_weight = 0.0

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

        # Calculate score and quality
        if weight_sum >= 0.1:
            aggregated_score = weighted_total / weight_sum
            data_quality = "good"
        elif weight_sum > 0:
            aggregated_score = weighted_total / weight_sum
            data_quality = "low_confidence"
        else:
            aggregated_score = None
            data_quality = "insufficient_recent_data"

        # Calculate volatility
        volatility = None
        if aggregated_score is not None and weight_sum > 0:
            variance_sum = 0.0
            for meta in articles_with_metadata:
                diff = meta["sentiment_score_raw"] - aggregated_score
                variance_sum += meta["combined_weight"] * (diff ** 2)
            volatility = math.sqrt(variance_sum / weight_sum)

        # Calculate breadth (bull/bear ratio)
        MIN_RELEVANCE = 0.1
        num_bullish = sum(1 for m in articles_with_metadata
                        if m["relevance_score"] >= MIN_RELEVANCE and m["sentiment_score_raw"] >= 0.35)
        num_bearish = sum(1 for m in articles_with_metadata
                        if m["relevance_score"] >= MIN_RELEVANCE and m["sentiment_score_raw"] <= -0.35)
        total_directional = num_bullish + num_bearish

        breadth_score = (num_bullish - num_bearish) / total_directional if total_directional > 0 else 0.0
        breadth_data = {
            "breadth_score": breadth_score,
            "num_bullish": num_bullish,
            "num_bearish": num_bearish,
            "total_directional": total_directional
        }

        return (aggregated_score, weight_sum, data_quality, articles_with_metadata, volatility, breadth_data)

    def _calculate_z_score(
        self,
        news_articles: List[Dict],
        current_slow_score: float,
        decay_constant_slow: float
    ) -> Dict:
        """Calculate Z-Score (sentiment shock) from article history."""
        if not news_articles or current_slow_score is None:
            return {
                "z_score": None,
                "interpretation": "No Data",
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
                "days_of_history": len(daily_articles),
                "quality": "insufficient_history"
            }

        # Calculate daily scores
        daily_scores = {}
        sorted_dates = sorted(daily_articles.keys())

        for date in sorted_dates:
            articles_for_day = daily_articles[date]
            score, weight, _, _, _, _ = self._calculate_aggregated_score_with_decay(
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
                "days_of_history": len(daily_scores),
                "quality": "insufficient_history"
            }

        sorted_score_dates = sorted(daily_scores.keys())
        historical_scores = [daily_scores[d] for d in sorted_score_dates[:-1]]

        if len(historical_scores) < 2:
            return {
                "z_score": None,
                "interpretation": "Insufficient Historical Baseline",
                "quality": "insufficient_history"
            }

        historical_mean = statistics.mean(historical_scores)
        historical_std = statistics.stdev(historical_scores) if len(historical_scores) >= 2 else 0.0

        if historical_std == 0:
            return {
                "z_score": 0.0,
                "interpretation": "No Historical Variation",
                "historical_mean": historical_mean,
                "historical_std": 0.0,
                "quality": "low_confidence"
            }

        z_score = (current_slow_score - historical_mean) / historical_std

        # Classify
        if z_score > 2.0:
            interpretation = "Extreme Positive Shock"
        elif z_score > 1.5:
            interpretation = "Strong Positive Signal"
        elif z_score > 1.0:
            interpretation = "Moderately Positive"
        elif z_score >= -1.0:
            interpretation = "Normal Range"
        elif z_score >= -1.5:
            interpretation = "Moderately Negative"
        elif z_score >= -2.0:
            interpretation = "Strong Negative Signal"
        else:
            interpretation = "Extreme Negative Shock"

        return {
            "z_score": z_score,
            "interpretation": interpretation,
            "historical_mean": historical_mean,
            "historical_std": historical_std,
            "days_of_history": len(historical_scores),
            "current_score": current_slow_score,
            "quality": "good" if len(historical_scores) >= 5 else "low_confidence"
        }

    def _calculate_source_concentration(self, articles_with_metadata: List[Dict]) -> Dict:
        """Calculate Herfindahl-Hirschman Index for source diversity."""
        source_weights = defaultdict(float)

        for article in articles_with_metadata:
            source = article.get("source", "Unknown")
            source_weights[source] += article.get("combined_weight", 0)

        grand_total = sum(source_weights.values())
        if grand_total == 0:
            return {"source_concentration_hhi": None, "concentration_interpretation": "No Data", "top_sources": []}

        hhi = sum((w / grand_total) ** 2 * 10000 for w in source_weights.values())

        if hhi < 1500:
            interpretation = "Low Concentration"
        elif hhi < 2500:
            interpretation = "Moderate Concentration"
        else:
            interpretation = "High Concentration"

        sorted_sources = sorted(source_weights.items(), key=lambda x: x[1], reverse=True)[:5]
        top_sources = [
            {"source": s, "weight": w, "percentage": round(w / grand_total * 100, 2)}
            for s, w in sorted_sources
        ]

        return {
            "source_concentration_hhi": round(hhi, 2),
            "concentration_interpretation": interpretation,
            "top_sources": top_sources
        }

    def _calculate_dominant_topic(self, articles_with_metadata: List[Dict]) -> Dict:
        """Find dominant topic by weighted mode."""
        topic_weights = defaultdict(float)
        grand_total = 0.0

        for article in articles_with_metadata:
            topics = article.get("topics", [])
            combined_weight = article.get("combined_weight", 0)

            for topic_item in topics:
                if isinstance(topic_item, dict):
                    topic_name = topic_item.get("topic", "Unknown")
                else:
                    topic_name = str(topic_item)
                topic_weights[topic_name] += combined_weight
                grand_total += combined_weight

        if not topic_weights:
            return {"dominant_topic": None, "topic_count": 0}

        dominant_topic, dominant_weight = max(topic_weights.items(), key=lambda x: x[1])

        return {
            "dominant_topic": dominant_topic,
            "dominant_topic_weight": round(dominant_weight, 4),
            "dominant_topic_percentage": round(dominant_weight / grand_total * 100, 2) if grand_total > 0 else 0,
            "topic_count": len(topic_weights)
        }

    def _calculate_sentiment_by_topic(self, articles_with_metadata: List[Dict]) -> Dict:
        """Calculate weighted sentiment breakdown by topic."""
        topic_sentiment_sum = defaultdict(float)
        topic_weight_sum = defaultdict(float)

        for article in articles_with_metadata:
            topics = article.get("topics", [])
            combined_weight = article.get("combined_weight", 0)
            sentiment = article.get("sentiment_score_raw", 0.0)

            for topic_item in topics:
                if isinstance(topic_item, dict):
                    topic_name = topic_item.get("topic", "Unknown")
                else:
                    topic_name = str(topic_item)
                topic_sentiment_sum[topic_name] += sentiment * combined_weight
                topic_weight_sum[topic_name] += combined_weight

        sentiment_by_topic = {}
        topic_weights = {}

        for topic in topic_sentiment_sum:
            total_weight = topic_weight_sum[topic]
            if total_weight > 0:
                sentiment_by_topic[topic] = round(topic_sentiment_sum[topic] / total_weight, 4)
                topic_weights[topic] = round(total_weight, 4)

        return {"sentiment_by_topic": sentiment_by_topic, "topic_weights": topic_weights}

    def analyze_sentiment_with_weights(self, news_articles: List[Dict]) -> Dict:
        """Analyze sentiment with exponential decay weighting."""
        if not news_articles:
            return {
                "articles_with_sentiment": [],
                "overall_weighted_score": None,
                "sentiment_counts": {},
                "data_quality": "no_data"
            }

        decay_constant = settings.SENTIMENT_DECAY_CONSTANT
        now_utc = datetime.utcnow()

        results = []
        weighted_total = 0.0
        weight_sum = 0.0
        sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
        daily_scores = defaultdict(list)

        for article in news_articles:
            raw_score = article.get("ticker_sentiment_score", 0.0)
            av_label = article.get("ticker_sentiment_label", "Neutral")
            standard_label = map_alpha_vantage_label(av_label)
            confidence = min(abs(raw_score), 1.0)

            relevance_score = article.get("ticker_relevance_score", 1.0)
            if relevance_score <= 0:
                relevance_score = 1.0

            recency_weight = 0.0
            age_hours = 0.0
            combined_weight = 0.0
            pub_date_str = article.get("publish_date")

            if pub_date_str:
                try:
                    pub_datetime = datetime.strptime(pub_date_str, "%Y-%m-%d")
                    age_hours = (now_utc - pub_datetime).total_seconds() / 3600.0
                    recency_weight = math.exp(-decay_constant * age_hours)
                    combined_weight = relevance_score * recency_weight

                    weighted_total += raw_score * combined_weight
                    weight_sum += combined_weight

                    daily_scores[pub_datetime.date()].append(raw_score * combined_weight)
                except ValueError:
                    pass

            article["sentiment_label"] = standard_label
            article["sentiment_confidence"] = confidence
            article["sentiment_score_raw"] = raw_score
            article["recency_weight"] = recency_weight
            article["relevance_score"] = relevance_score
            article["combined_weight"] = combined_weight
            article["age_hours"] = age_hours
            results.append(article)

            if standard_label in ["Bearish", "Somewhat-Bearish"]:
                sentiment_counts["negative"] += 1
            elif standard_label in ["Bullish", "Somewhat-Bullish"]:
                sentiment_counts["positive"] += 1
            else:
                sentiment_counts["neutral"] += 1

        # Calculate quality
        if weight_sum >= 0.1:
            avg_score = weighted_total / weight_sum
            data_quality = "good"
        elif weight_sum > 0:
            avg_score = weighted_total / weight_sum
            data_quality = "low_confidence"
        else:
            avg_score = None
            data_quality = "insufficient_recent_data"

        # Daily averages
        daily_avg = {
            d.strftime("%Y-%m-%d"): sum(scores) / len(scores) if scores else 0
            for d, scores in daily_scores.items()
        }

        return {
            "articles_with_sentiment": results,
            "overall_weighted_score": avg_score,
            "sentiment_counts": sentiment_counts,
            "daily_average_sentiment": daily_avg,
            "data_quality": data_quality,
            "total_weight": weight_sum,
            "decay_constant": decay_constant,
            "half_life_hours": math.log(2) / decay_constant if decay_constant > 0 else None
        }

    def analyze_sentiment_with_momentum(self, news_articles: List[Dict]) -> Dict:
        """
        Full sentiment analysis with MACD-style momentum calculation.

        Calculates:
        - Fast Score (7h half-life): Current sentiment
        - Slow Score (24h half-life): Baseline trend
        - Momentum (Fast - Slow): Direction of change
        """
        # Check cache
        articles_hash = self._generate_news_cache_key(news_articles)
        cache_key = f"sentiment_momentum:{articles_hash}"

        try:
            cached = redis_cache.get(cache_key)
            if cached:
                return pickle.loads(cached)
        except Exception as e:
            logger.debug(f"Cache read error: {e}")

        # Calculate decay constants
        half_life_fast = settings.SENTIMENT_HALF_LIFE_FAST_HOURS
        half_life_slow = settings.SENTIMENT_HALF_LIFE_SLOW_HOURS
        k_fast = math.log(2) / half_life_fast
        k_slow = math.log(2) / half_life_slow

        threshold_weak = settings.MOMENTUM_THRESHOLD_WEAK
        threshold_strong = settings.MOMENTUM_THRESHOLD_STRONG

        now_utc = datetime.utcnow()

        # Calculate fast and slow scores
        fast_score, fast_weight, fast_quality, _, fast_volatility, fast_breadth = \
            self._calculate_aggregated_score_with_decay(news_articles, k_fast, now_utc)

        slow_score, slow_weight, slow_quality, articles_meta, slow_volatility, slow_breadth = \
            self._calculate_aggregated_score_with_decay(news_articles, k_slow, now_utc)

        # Calculate momentum
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
            momentum_classification = {
                "label": None,
                "interpretation": "Insufficient data for momentum calculation",
                "direction": None,
                "strength": None,
                "magnitude": None,
                "sign": None
            }

        # Get full analysis
        full_results = self.analyze_sentiment_with_weights(news_articles)

        # Calculate additional metrics
        z_score_data = self._calculate_z_score(news_articles, slow_score, k_slow)
        source_data = self._calculate_source_concentration(articles_meta)
        topic_data = self._calculate_dominant_topic(articles_meta)
        sentiment_by_topic = self._calculate_sentiment_by_topic(articles_meta)

        # Volume interpretation
        volume_interpretation = None
        if slow_weight is not None:
            if slow_weight < 1.0:
                volume_interpretation = "Low Coverage"
            elif slow_weight <= 10.0:
                volume_interpretation = "Medium Coverage"
            else:
                volume_interpretation = "High Coverage"

        # Breadth interpretation
        breadth_interpretation = None
        breadth_quality = None
        if slow_breadth and slow_breadth["total_directional"] > 0:
            total = slow_breadth["total_directional"]
            score = slow_breadth["breadth_score"]
            bulls = slow_breadth["num_bullish"]
            bears = slow_breadth["num_bearish"]

            breadth_quality = "good" if total >= 10 else "low_confidence" if total >= 5 else "insufficient_sample"

            if score > 0.5:
                breadth_interpretation = f"Overwhelmingly Bullish ({bulls} bulls vs {bears} bears)"
            elif score > 0.2:
                breadth_interpretation = f"Moderately Bullish ({bulls} bulls vs {bears} bears)"
            elif score >= -0.2:
                breadth_interpretation = f"Mixed Sentiment ({bulls} bulls vs {bears} bears)"
            elif score >= -0.5:
                breadth_interpretation = f"Moderately Bearish ({bulls} bulls vs {bears} bears)"
            else:
                breadth_interpretation = f"Overwhelmingly Bearish ({bulls} bulls vs {bears} bears)"
        else:
            breadth_quality = "insufficient_sample"
            breadth_interpretation = "Insufficient directional articles"

        # Build final response
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
            "momentum_label": momentum_classification["label"],
            "momentum_interpretation": momentum_classification["interpretation"],
            "momentum_direction": momentum_classification["direction"],
            "momentum_strength": momentum_classification["strength"],
            "momentum_magnitude": momentum_classification["magnitude"],
            "momentum_sign": momentum_classification["sign"],

            # Volatility
            "sentiment_volatility": slow_volatility,
            "volatility_quality": slow_quality,

            # Volume
            "effective_news_volume": slow_weight,
            "volume_interpretation": volume_interpretation,

            # Breadth
            "sentiment_breadth_score": slow_breadth["breadth_score"] if slow_breadth else None,
            "num_bullish_articles": slow_breadth["num_bullish"] if slow_breadth else 0,
            "num_bearish_articles": slow_breadth["num_bearish"] if slow_breadth else 0,
            "total_directional_articles": slow_breadth["total_directional"] if slow_breadth else 0,
            "breadth_interpretation": breadth_interpretation,
            "breadth_quality": breadth_quality,

            # Z-Score
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
            "momentum_threshold_weak": threshold_weak,
            "momentum_threshold_strong": threshold_strong,
            "momentum_definition": get_momentum_definition(),

            # Source & Topic
            "source_concentration_hhi": source_data.get("source_concentration_hhi"),
            "concentration_interpretation": source_data.get("concentration_interpretation"),
            "top_sources": source_data.get("top_sources", []),
            "dominant_topic": topic_data.get("dominant_topic"),
            "dominant_topic_weight": topic_data.get("dominant_topic_weight"),
            "dominant_topic_percentage": topic_data.get("dominant_topic_percentage"),
            "topic_count": topic_data.get("topic_count", 0),
            "sentiment_by_topic": sentiment_by_topic.get("sentiment_by_topic", {}),
            "topic_weights": sentiment_by_topic.get("topic_weights", {})
        })

        # Cache result
        try:
            redis_cache.set(cache_key, pickle.dumps(full_results), 600)
        except Exception as e:
            logger.debug(f"Cache write error: {e}")

        return full_results


# Singleton instance
sentiment_service = SentimentService()
