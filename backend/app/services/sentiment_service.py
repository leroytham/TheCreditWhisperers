# app/services/sentiment_service.py

import os
import sys
import io
import warnings
import math
from datetime import datetime, timedelta
from collections import defaultdict

# Suppress verbose library outputs
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
warnings.filterwarnings('ignore')

from app.models import News, SentimentScore, RelevanceScore
from app.config.scoring import map_alpha_vantage_label, classify_sentiment, classify_momentum, get_momentum_definition
from app.core.config import settings
from app.core.cache import cache_result, redis_cache
import pickle


class SentimentService:
    """
    Hybrid sentiment analysis service that uses:
    1. Alpha Vantage pre-calculated scores when available (primary)
    2. FinBERT ML model for fallback news sources (secondary)
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            print("Creating SentimentService instance...")
            cls._instance = super(SentimentService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """
        Initialize sentiment service.

        NOTE: FinBERT model loading is disabled because it's not currently used in production.
        The application uses Alpha Vantage pre-calculated sentiment scores exclusively.
        FinBERT loading takes 10-15 minutes and is unnecessary overhead.
        """
        # Disabled FinBERT loading - not used in production
        # If you need FinBERT fallback sentiment, uncomment the code below:
        #
        # try:
        #     from transformers import pipeline
        #     self.finbert = pipeline("text-classification", model="ProsusAI/finbert")
        #     self.finbert_available = True
        #     print("FinBERT model loaded successfully for fallback sentiment analysis.")
        # except Exception as e:
        #     print(f"WARNING: FinBERT model could not be loaded: {e}")
        #     print("Fallback articles will use neutral sentiment (0.0).")
        #     self.finbert = None
        #     self.finbert_available = False

        self.finbert = None
        self.finbert_available = False
        print("SentimentService initialized (FinBERT disabled - using Alpha Vantage scores only)")

    def analyze_sentiment(self, text: str) -> dict:
        """
        Analyzes sentiment of a single text using FinBERT.

        Args:
            text: Text to analyze (article title + body)

        Returns:
            Dictionary with 'label', 'confidence', and 'score' keys
        """
        if not text or not self.finbert_available:
            return {"label": "neutral", "confidence": 0.0, "score": 0.0}

        try:
            sentiment_scores = self.finbert(text, truncation=True, return_all_scores=True)[0]
            scores_dict = {r['label'].lower(): r['score'] for r in sentiment_scores}

            label = max(scores_dict, key=scores_dict.get)
            confidence = scores_dict[label]

            # Weighted Polarity Score (WPS) calculation
            # wps = (P(positive) - P(negative)) * (1 - P(neutral))
            # This modulates the score by the model's confidence
            p_pos = scores_dict.get("positive", 0.0)
            p_neg = scores_dict.get("negative", 0.0)
            p_neu = scores_dict.get("neutral", 0.0)

            raw_score = (p_pos - p_neg) * (1 - p_neu)

            return {
                "label": label,
                "confidence": confidence,
                "score": raw_score
            }
        except Exception as e:
            print(f"Error analyzing sentiment with FinBERT: {e}")
            return {"label": "neutral", "confidence": 0.0, "score": 0.0}

    def _analyze_with_finbert(self, article: dict) -> tuple[float, str, float]:
        """
        Helper method to analyze an article with FinBERT.

        Args:
            article: Article dictionary with 'title' and optionally 'body'

        Returns:
            Tuple of (score, label, confidence)
        """
        title = article.get("title", "")
        body = article.get("body", article.get("summary", ""))

        # Combine title and body for comprehensive analysis
        # FinBERT can handle longer texts, providing better context
        text_to_analyze = f"{title}. {body}".strip()

        if not text_to_analyze or text_to_analyze == ".":
            return (0.0, "neutral", 0.0)

        sentiment_result = self.analyze_sentiment(text_to_analyze)
        return (
            sentiment_result["score"],
            sentiment_result["label"],
            sentiment_result["confidence"]
        )

    def _generate_news_cache_key(self, news_articles: list[dict]) -> str:
        """
        Generate a stable cache key from a list of news articles.
        Uses article links and publish dates to create a unique hash.

        Args:
            news_articles: List of news article dictionaries

        Returns:
            16-character hash string representing the article set
        """
        import hashlib

        if not news_articles:
            return "empty"

        # Sort articles by link to ensure consistent ordering
        article_ids = sorted([
            f"{article.get('link', article.get('url', ''))}:{article.get('publish_date', article.get('time_published', ''))}"
            for article in news_articles
        ])

        # Generate MD5 hash and take first 16 characters
        combined = ":".join(article_ids)
        return hashlib.md5(combined.encode()).hexdigest()[:16]

    def _calculate_aggregated_score_with_decay(
        self,
        news_articles: list[dict],
        decay_constant: float,
        now_utc: datetime = None
    ) -> tuple[float, float, str, list[dict], float, dict]:
        """
        Core method to calculate aggregated sentiment score with exponential decay, weighted volatility, and breadth.

        This is the reusable core that powers both single-score and momentum calculations.
        It applies the full weighting formula: CombinedWeight = relevance × e^(-k × age_hours)

        Args:
            news_articles: List of news article dictionaries
            decay_constant: The k value for exponential decay (k = ln(2) / half_life_hours)
            now_utc: Current UTC time for age calculation (defaults to datetime.utcnow())

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
            return (None, 0.0, "no_data", [], None)

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
            else:
                # Use FinBERT for fallback sources
                raw_score, _, _ = self._analyze_with_finbert(article)

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

            # Store metadata for this article
            article_meta = {
                "sentiment_score_raw": raw_score,
                "relevance_score": relevance_score,
                "recency_weight": recency_weight,
                "combined_weight": combined_weight,
                "age_hours": age_hours,
                # Include original article data for source/topic analysis
                "source": article.get("provider", "Unknown"),
                "topics": article.get("topics", [])
            }
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
        # Volatility measures dispersion of sentiment scores around the aggregated score
        # Formula: sqrt(sum(CombinedWeight * (score - mean)²) / sum(CombinedWeight))
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
        # Count articles by directional sentiment (ignoring neutrals)
        # Only count articles with minimum relevance threshold
        MIN_RELEVANCE_THRESHOLD = 0.1
        BULLISH_THRESHOLD = 0.35
        BEARISH_THRESHOLD = -0.35
        
        num_bullish = 0
        num_bearish = 0
        
        for article_meta in articles_with_metadata:
            score = article_meta["sentiment_score_raw"]
            relevance = article_meta["relevance_score"]
            
            # Only count articles that pass minimum relevance threshold
            if relevance >= MIN_RELEVANCE_THRESHOLD:
                if score >= BULLISH_THRESHOLD:
                    num_bullish += 1
                elif score <= BEARISH_THRESHOLD:
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

    def _calculate_z_score_from_articles(
        self,
        news_articles: list[dict],
        current_slow_score: float,
        decay_constant_slow: float
    ) -> dict:
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
        
        # Calculate daily sentiment scores (using slow decay for consistency)
        daily_scores = {}
        sorted_dates = sorted(daily_articles.keys())
        
        for date in sorted_dates:
            articles_for_day = daily_articles[date]
            # Calculate score for this day using the same slow decay
            score, weight, quality, _, _, _ = self._calculate_aggregated_score_with_decay(
                articles_for_day,
                decay_constant_slow,
                datetime.combine(date, datetime.min.time())
            )
            if score is not None and weight >= 0.1:  # Only include days with sufficient data
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
        historical_scores = [daily_scores[d] for d in sorted_score_dates[:-1]]  # Exclude most recent
        
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
        
        # Need at least 2 data points for standard deviation
        if len(historical_scores) >= 2:
            historical_std = statistics.stdev(historical_scores)
        else:
            historical_std = 0.0
        
        # Calculate Z-Score
        if historical_std == 0:
            # No variation in historical data
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

    def _calculate_source_concentration_hhi(self, articles_with_metadata: list[dict]) -> dict:
        """
        Calculate Herfindahl-Hirschman Index (HHI) for source diversity.
        
        The HHI measures market concentration by summing the squared market shares.
        In our context, it measures whether sentiment comes from diverse sources
        or is dominated by a single outlet.
        
        Formula: HHI = Σ(share_i² × 10000) where share_i = source_weight / total_weight
        
        Args:
            articles_with_metadata: List of article dicts with 'source' and 'combined_weight'
            
        Returns:
            Dictionary with:
                - source_concentration_hhi: float (0-10000)
                - concentration_interpretation: str ("Low/Moderate/High Concentration")
                - top_sources: list[dict] with top 5 sources, weights, and percentages
        """
        source_weights = defaultdict(float)
        
        # 1. Aggregate TotalWeight per source
        for article in articles_with_metadata:
            source = article.get("source", "Unknown")
            combined_weight = article.get("combined_weight", 0)
            source_weights[source] += combined_weight
        
        # 2. Calculate grand total
        grand_total = sum(source_weights.values())
        
        if grand_total == 0:
            return {
                "source_concentration_hhi": None,
                "concentration_interpretation": "No Data",
                "top_sources": []
            }
        
        # 3. Calculate HHI = sum((share^2) * 10000)
        hhi = 0.0
        for source, weight in source_weights.items():
            share = weight / grand_total
            hhi += (share ** 2) * 10000
        
        # 4. Interpret concentration level
        if hhi < 1500:
            interpretation = "Low Concentration"  # Diverse, healthy distribution
        elif hhi < 2500:
            interpretation = "Moderate Concentration"  # Few sources dominant
        else:
            interpretation = "High Concentration"  # Single source bias risk
        
        # 5. Get top 5 sources by weight
        sorted_sources = sorted(source_weights.items(), key=lambda x: x[1], reverse=True)[:5]
        top_sources = [
            {
                "source": source,
                "weight": weight,
                "percentage": round((weight / grand_total * 100), 2) if grand_total > 0 else 0
            }
            for source, weight in sorted_sources
        ]
        
        return {
            "source_concentration_hhi": round(hhi, 2),
            "concentration_interpretation": interpretation,
            "top_sources": top_sources
        }

    def _calculate_dominant_topic(self, articles_with_metadata: list[dict]) -> dict:
        """
        Find dominant topic using weighted mode calculation.
        
        Each article may have multiple topics. We weight each topic by the article's
        CombinedWeight to find which topic has the most influence on overall sentiment.
        
        Args:
            articles_with_metadata: List of article dicts with 'topics' and 'combined_weight'
            
        Returns:
            Dictionary with:
                - dominant_topic: str or None
                - dominant_topic_weight: float
                - dominant_topic_percentage: float
                - topic_count: int (total unique topics)
        """
        topic_weights = defaultdict(float)
        grand_total = 0.0
        
        for article in articles_with_metadata:
            topics = article.get("topics", [])
            combined_weight = article.get("combined_weight", 0)
            
            # Add weight to each topic this article mentions
            for topic_item in topics:
                # Handle both string topics and dict topics with 'topic' key
                if isinstance(topic_item, dict):
                    topic_name = topic_item.get("topic", "Unknown")
                else:
                    topic_name = str(topic_item)
                
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

    def _calculate_sentiment_by_topic(self, articles_with_metadata: list[dict]) -> dict:
        """
        Calculate full weighted sentiment score breakdown by topic.
        
        This is similar to the main sentiment score calculation, but grouped by topic.
        For each topic, we calculate: weighted_avg = Σ(sentiment × weight) / Σ(weight)
        
        This reveals conflicts (e.g., Earnings +0.65 vs Legal -0.70) and provides
        diagnostic insight into what's driving the overall sentiment.
        
        Args:
            articles_with_metadata: List of article dicts with 'topics', 'sentiment_score_raw',
                                   and 'combined_weight'
            
        Returns:
            Dictionary with:
                - sentiment_by_topic: dict mapping topic name to weighted avg sentiment score
                - topic_weights: dict mapping topic name to total weight
        """
        topic_weighted_sentiment_sum = defaultdict(float)
        topic_total_weight_sum = defaultdict(float)
        
        for article in articles_with_metadata:
            topics = article.get("topics", [])
            combined_weight = article.get("combined_weight", 0)
            sentiment_score = article.get("sentiment_score_raw", 0.0)
            
            # Add to each topic's weighted sum
            for topic_item in topics:
                # Handle both string topics and dict topics with 'topic' key
                if isinstance(topic_item, dict):
                    topic_name = topic_item.get("topic", "Unknown")
                else:
                    topic_name = str(topic_item)
                
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

    def analyze_sentiment_with_weights(self, news_articles: list[dict]) -> dict:
        """
        Hybrid sentiment analysis with exponential decay and relevance weighting.

        This method intelligently chooses the best sentiment analyzer:
        1. For Alpha Vantage articles: Uses pre-calculated ticker_sentiment_score (fast, accurate)
        2. For fallback articles: Uses FinBERT ML model to analyze text (comprehensive)
        3. Applies exponential decay for recency weighting (24-hour half-life)
        4. Combines recency weight with relevance score for final weight
        5. Returns both dict format (backward compatible) and News model objects

        Weighting Formula:
            RecencyWeight = e^(-k × age_hours)
            CombinedWeight = relevance_score × RecencyWeight
            AggregatedScore = Σ(sentiment_score × CombinedWeight) / Σ(CombinedWeight)

        Args:
            news_articles: List of news article dictionaries (may have Alpha Vantage scores or not)

        Returns:
            Dictionary containing:
                - articles_with_sentiment: List of articles with sentiment data
                - news_objects: List of News model objects
                - overall_weighted_score: Weighted average sentiment score (with combined weighting)
                - sentiment_counts: Count of positive/neutral/negative articles
                - daily_average_sentiment: Daily sentiment averages
                - data_quality: Quality indicator ("good", "insufficient_recent_data", etc.)
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

        # Get decay constant from config (24-hour half-life by default)
        decay_constant = settings.SENTIMENT_DECAY_CONSTANT

        for article in news_articles:
            # Detect which sentiment analyzer to use
            has_alpha_vantage_score = "ticker_sentiment_score" in article

            if has_alpha_vantage_score:
                # Use Alpha Vantage pre-calculated score (primary method)
                raw_score = article.get("ticker_sentiment_score", 0.0)
                av_label = article.get("ticker_sentiment_label", "Neutral")

                # Map Alpha Vantage labels to our standardized Bullish/Bearish labels
                # Alpha Vantage labels: Bearish, Somewhat-Bearish, Neutral, Somewhat-Bullish, Bullish
                standard_label = map_alpha_vantage_label(av_label)

                # Calculate confidence based on absolute score value
                confidence = min(abs(raw_score), 1.0)
                sentiment_source = "Alpha Vantage"

            else:
                # Use FinBERT for fallback sources (secondary method)
                raw_score, finbert_label, confidence = self._analyze_with_finbert(article)
                sentiment_source = "FinBERT (ProsusAI)"

                # Classify using our standardized thresholds
                standard_label = classify_sentiment(raw_score)

            # Get relevance score (default to 1.0 for fallback sources)
            relevance_score = article.get("ticker_relevance_score", 1.0)

            # Ensure relevance is within valid range
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
                    # With k=0.0289 (24-hour half-life):
                    # - 0 hours old: weight = 1.0 (100%)
                    # - 24 hours old: weight = 0.5 (50%)
                    # - 48 hours old: weight = 0.25 (25%)
                    # - 168 hours (7 days) old: weight ≈ 0.04 (4%)
                    recency_weight = math.exp(-decay_constant * age_hours)

                    # Combine relevance and recency weights
                    combined_weight = relevance_score * recency_weight

                    # Update aggregation sums
                    weighted_total += raw_score * combined_weight
                    weight_sum += combined_weight

                    # Track daily scores
                    pub_date = pub_datetime.date()
                    daily_scores[pub_date].append(raw_score * combined_weight)

                except ValueError:
                    # Invalid date format, skip weighting for this article
                    combined_weight = 0.0
            else:
                combined_weight = 0.0

            # Add sentiment data to the dictionary using Bullish/Bearish format
            article["sentiment_label"] = standard_label  # Use Bullish/Bearish format
            article["sentiment_confidence"] = confidence
            article["sentiment_score_raw"] = raw_score  # Keep raw score
            article["recency_weight"] = recency_weight
            article["relevance_score"] = relevance_score
            article["combined_weight"] = combined_weight
            article["age_hours"] = age_hours
            results.append(article)

            # Update sentiment counts using standard label categories
            if standard_label in ["Bearish", "Somewhat-Bearish"]:
                sentiment_counts["negative"] += 1
            elif standard_label in ["Bullish", "Somewhat-Bullish"]:
                sentiment_counts["positive"] += 1
            else:
                sentiment_counts["neutral"] += 1

            # Create proper News object with SentimentScore model
            sentiment_score_obj = SentimentScore(
                value=raw_score,
                source=sentiment_source,  # Dynamic: "Alpha Vantage" or "FinBERT (ProsusAI)"
                confidence=confidence
            )

            # Create RelevanceScore object if available
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
                    # Invalid relevance score, skip it
                    pass

            news_obj = News(
                headline=article.get("title", ""),
                source=article.get("provider", "Unknown"),
                sentiment_score=sentiment_score_obj,
                relevance_score=relevance_score_obj
            )
            # Store additional metadata on the News object
            news_obj.link = article.get("link")
            news_obj.publish_date = pub_date_str
            news_obj.image = article.get("image")
            news_objects.append(news_obj)

        # Calculate daily average sentiment (using weighted scores)
        daily_avg_sentiment = {}
        # Get unique dates from all articles
        all_dates = sorted(set(
            datetime.strptime(article.get("publish_date"), "%Y-%m-%d").date()
            for article in news_articles
            if article.get("publish_date")
        ))

        for date in all_dates:
            scores = daily_scores.get(date, [])
            daily_avg_sentiment[date.strftime("%Y-%m-%d")] = sum(scores) / len(scores) if scores else 0

        # Calculate overall weighted average and determine data quality
        # Threshold of 0.1 for minimum total weight to ensure statistical significance
        data_quality = "good"
        avg_score = None

        if weight_sum >= 0.1:
            avg_score = weighted_total / weight_sum
            data_quality = "good"
        elif weight_sum > 0:
            # Some data exists but very low weight (old news or low relevance)
            avg_score = weighted_total / weight_sum
            data_quality = "low_confidence"
        else:
            # No valid weighted data
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

    def analyze_sentiment_with_momentum(self, news_articles: list[dict]) -> dict:
        """
        Hybrid sentiment analysis with momentum calculation (MACD-style Fast vs. Slow).

        This method calculates sentiment using TWO decay constants:
        1. Fast Score (k_fast): Short half-life, captures current intraday sentiment
        2. Slow Score (k_slow): Long half-life, captures daily trend baseline
        3. Momentum = Fast Score - Slow Score

        Positive momentum (+) means news is getting better (bullish trend)
        Negative momentum (-) means news is getting worse (bearish trend)
        Near-zero momentum means sentiment is stable

        This is analogous to MACD (Moving Average Convergence Divergence) in technical analysis.

        Args:
            news_articles: List of news article dictionaries

        Returns:
            Dictionary containing all fields from analyze_sentiment_with_weights() PLUS:
                - fast_score: Sentiment score with fast decay (short half-life)
                - slow_score: Sentiment score with slow decay (long half-life)
                - sentiment_momentum: fast_score - slow_score
                - momentum_quality: Data quality for momentum calculation
                - momentum_label: Classification label (e.g., "Positive Momentum")
                - momentum_interpretation: Human-readable interpretation
                - momentum_direction: "improving", "stable", or "deteriorating"
                - momentum_strength: "strong", "weak", or "neutral"
                - momentum_magnitude: Absolute value of momentum
                - momentum_sign: "+", "-", or "~"
                - decay_k_fast: Fast decay constant
                - decay_k_slow: Slow decay constant
                - half_life_fast_hours: Fast score half-life in hours
                - half_life_slow_hours: Slow score half-life in hours
                - momentum_definition: Human-readable definition of thresholds

        Cached for 10 minutes based on the news article set to avoid redundant calculations.
        """
        # Check cache first using news articles hash as key
        articles_hash = self._generate_news_cache_key(news_articles)
        cache_key = f"sentiment_momentum:{articles_hash}"

        try:
            cached_result = redis_cache.get(cache_key)
            if cached_result:
                return pickle.loads(cached_result)
        except Exception as e:
            print(f"Cache read error in analyze_sentiment_with_momentum: {e}")

        # Calculate decay constants from configured half-lives
        # Formula: k = ln(2) / half_life_hours
        half_life_fast = settings.SENTIMENT_HALF_LIFE_FAST_HOURS
        half_life_slow = settings.SENTIMENT_HALF_LIFE_SLOW_HOURS
        k_fast = math.log(2) / half_life_fast
        k_slow = math.log(2) / half_life_slow

        # Get momentum thresholds from config
        threshold_weak = settings.MOMENTUM_THRESHOLD_WEAK
        threshold_strong = settings.MOMENTUM_THRESHOLD_STRONG

        # Use current UTC time for both calculations (ensures consistency)
        now_utc = datetime.utcnow()

        # Calculate fast score (short half-life, sensitive to breaking news)
        fast_score, fast_weight, fast_quality, _, fast_volatility, fast_breadth = self._calculate_aggregated_score_with_decay(
            news_articles,
            k_fast,
            now_utc
        )

        # Calculate slow score (long half-life, stable baseline trend)
        slow_score, slow_weight, slow_quality, articles_with_metadata_slow, slow_volatility, slow_breadth = self._calculate_aggregated_score_with_decay(
            news_articles,
            k_slow,
            now_utc
        )

        # Calculate sentiment momentum
        momentum = None
        momentum_quality = None
        momentum_classification = None

        if fast_score is not None and slow_score is not None:
            momentum = fast_score - slow_score

            # Determine momentum data quality (inherits from both scores)
            if fast_quality == "insufficient_recent_data" or slow_quality == "insufficient_recent_data":
                momentum_quality = "insufficient_recent_data"
            elif fast_quality == "low_confidence" or slow_quality == "low_confidence":
                momentum_quality = "low_confidence"
            else:
                momentum_quality = "good"

            # Classify momentum
            momentum_classification = classify_momentum(momentum, threshold_weak, threshold_strong)
        else:
            # At least one score is None
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

        # Now call the full analyze_sentiment_with_weights to get all the detailed article data
        # This uses the slow decay (k_slow) as the primary score
        full_results = self.analyze_sentiment_with_weights(news_articles)

        # Calculate Z-Score (sentiment shock) from article history
        z_score_data = self._calculate_z_score_from_articles(
            news_articles,
            slow_score,
            k_slow
        )

        # Calculate Source Concentration (HHI) and Topic Analysis
        # Use slow metadata since it's the primary/baseline sentiment
        source_concentration_data = self._calculate_source_concentration_hhi(articles_with_metadata_slow)
        dominant_topic_data = self._calculate_dominant_topic(articles_with_metadata_slow)
        sentiment_by_topic_data = self._calculate_sentiment_by_topic(articles_with_metadata_slow)

        # Add momentum fields to the response
        # Classify effective news volume coverage
        volume_interpretation = None
        if slow_weight is not None:
            if slow_weight < 1.0:
                volume_interpretation = "Low Coverage"
            elif slow_weight <= 10.0:
                volume_interpretation = "Medium Coverage"
            else:
                volume_interpretation = "High Coverage"

        # Generate breadth interpretation
        breadth_interpretation = None
        breadth_quality = None
        if slow_breadth and slow_breadth["total_directional"] > 0:
            total = slow_breadth["total_directional"]
            bulls = slow_breadth["num_bullish"]
            bears = slow_breadth["num_bearish"]
            score = slow_breadth["breadth_score"]
            
            # Classify breadth quality based on sample size
            if total >= 10:
                breadth_quality = "good"
            elif total >= 5:
                breadth_quality = "low_confidence"
            else:
                breadth_quality = "insufficient_sample"
            
            # Generate interpretation
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
            breadth_interpretation = "Insufficient directional articles for breadth calculation"

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

            # Volatility (weighted standard deviation using slow score as baseline)
            "sentiment_volatility": slow_volatility,
            "volatility_quality": slow_quality,  # Same quality as slow score

            # Effective News Volume (quantity/coverage metric)
            "effective_news_volume": slow_weight,
            "volume_interpretation": volume_interpretation,

            # Sentiment Breadth (bull/bear ratio)
            "sentiment_breadth_score": slow_breadth["breadth_score"] if slow_breadth else None,
            "num_bullish_articles": slow_breadth["num_bullish"] if slow_breadth else 0,
            "num_bearish_articles": slow_breadth["num_bearish"] if slow_breadth else 0,
            "total_directional_articles": slow_breadth["total_directional"] if slow_breadth else 0,
            "breadth_interpretation": breadth_interpretation,
            "breadth_quality": breadth_quality,

            # Sentiment Shock (Z-Score from historical articles)
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
            "source_concentration_hhi": source_concentration_data.get("source_concentration_hhi"),
            "concentration_interpretation": source_concentration_data.get("concentration_interpretation"),
            "top_sources": source_concentration_data.get("top_sources", []),
            "dominant_topic": dominant_topic_data.get("dominant_topic"),
            "dominant_topic_weight": dominant_topic_data.get("dominant_topic_weight"),
            "dominant_topic_percentage": dominant_topic_data.get("dominant_topic_percentage"),
            "topic_count": dominant_topic_data.get("topic_count", 0),
            "sentiment_by_topic": sentiment_by_topic_data.get("sentiment_by_topic", {}),
            "topic_weights": sentiment_by_topic_data.get("topic_weights", {})
        })

        # Cache the result for 10 minutes (600 seconds)
        try:
            redis_cache.set(cache_key, pickle.dumps(full_results), 600)
        except Exception as e:
            print(f"Cache write error in analyze_sentiment_with_momentum: {e}")

        return full_results


# Create a singleton instance
sentiment_service = SentimentService()

