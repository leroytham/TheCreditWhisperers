# app/services/sentiment_service.py

import os
import sys
import io
import warnings
from datetime import datetime, timedelta
from collections import defaultdict

# Suppress verbose library outputs
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
warnings.filterwarnings('ignore')

from app.models import News, SentimentScore, RelevanceScore
from app.config.scoring import map_alpha_vantage_label, classify_sentiment


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
        """Loads the FinBERT model for fallback sentiment analysis."""
        try:
            # Suppress the model loading messages
            original_stdout = sys.stdout
            sys.stdout = io.StringIO()
            try:
                from transformers import pipeline
                self.finbert = pipeline("text-classification", model="ProsusAI/finbert")
                self.finbert_available = True
            finally:
                sys.stdout = original_stdout
            print("FinBERT model loaded successfully for fallback sentiment analysis.")
        except Exception as e:
            print(f"WARNING: FinBERT model could not be loaded: {e}")
            print("Fallback articles will use neutral sentiment (0.0).")
            self.finbert = None
            self.finbert_available = False

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

    def analyze_sentiment_with_weights(self, news_articles: list[dict]) -> dict:
        """
        Hybrid sentiment analysis with recency weighting.

        This method intelligently chooses the best sentiment analyzer:
        1. For Alpha Vantage articles: Uses pre-calculated ticker_sentiment_score (fast, accurate)
        2. For fallback articles: Uses FinBERT ML model to analyze text (comprehensive)
        3. Applies recency weighting for calculating overall_weighted_score
        4. Returns both dict format (backward compatible) and News model objects

        Args:
            news_articles: List of news article dictionaries (may have Alpha Vantage scores or not)

        Returns:
            Dictionary containing:
                - articles_with_sentiment: List of articles with sentiment data
                - news_objects: List of News model objects
                - overall_weighted_score: Weighted average sentiment score (with recency weighting)
                - sentiment_counts: Count of positive/neutral/negative articles
                - daily_average_sentiment: Daily sentiment averages
        """
        if not news_articles:
            return {
                "articles_with_sentiment": [],
                "news_objects": [],
                "overall_weighted_score": 0.0,
                "sentiment_counts": {},
                "daily_average_sentiment": {}
            }

        results = []
        news_objects = []
        weighted_total = 0
        weight_sum = 0
        sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}

        daily_scores = defaultdict(list)
        today = datetime.utcnow().date()

        # Normalized recency weights (more recent = higher weight)
        # We'll calculate days old from today for each article
        raw_weights = {0: 1.0, 1: 0.8, 2: 0.6, 3: 0.5, 4: 0.4, 5: 0.35, 6: 0.3}
        total_raw = sum(raw_weights.values())
        normalized_weights = {k: v / total_raw for k, v in raw_weights.items()}

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

            # Calculate recency weight for overall score
            recency_weight = 0
            pub_date_str = article.get("publish_date")
            if pub_date_str:
                try:
                    pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date()
                    days_old = (today - pub_date).days

                    # Use weight for articles within first 7 days, else use minimal weight
                    if days_old <= 6:
                        recency_weight = normalized_weights.get(days_old, 0.1)
                    else:
                        # For older articles, use a diminishing weight
                        recency_weight = 0.1 / (1 + (days_old - 6) / 7)

                    weighted_total += raw_score * recency_weight
                    weight_sum += recency_weight
                    daily_scores[pub_date].append(raw_score * recency_weight)
                except ValueError:
                    pass

            # Add sentiment data to the dictionary using Bullish/Bearish format
            article["sentiment_label"] = standard_label  # Use Bullish/Bearish format
            article["sentiment_confidence"] = confidence
            article["sentiment_score_raw"] = raw_score  # Keep raw score
            article["sentiment_weight"] = recency_weight
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

            # Create RelevanceScore object if available (only from Alpha Vantage)
            relevance_score_obj = None
            ticker_relevance_score = article.get("ticker_relevance_score")
            if ticker_relevance_score is not None and ticker_relevance_score > 0:
                try:
                    relevance_score_obj = RelevanceScore(
                        value=ticker_relevance_score,
                        source="Alpha Vantage",
                        confidence=1.0
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

        # Calculate overall weighted average
        avg_score = weighted_total / weight_sum if weight_sum else 0

        return {
            "articles_with_sentiment": results,
            "news_objects": news_objects,
            "overall_weighted_score": avg_score,
            "sentiment_counts": sentiment_counts,
            "daily_average_sentiment": daily_avg_sentiment,
        }


# Create a singleton instance
sentiment_service = SentimentService()

