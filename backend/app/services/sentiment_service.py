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
from transformers import pipeline

from app.models import News, SentimentScore


class SentimentService:
    """
    Service for analyzing sentiment using the FinBERT model.
    Uses a singleton pattern to ensure the model is loaded only once.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            print("Creating SentimentService instance and loading FinBERT model...")
            cls._instance = super(SentimentService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Loads the FinBERT model."""
        # Suppress the model loading messages
        original_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            self.finbert = pipeline("text-classification", model="ProsusAI/finbert")
        finally:
            sys.stdout = original_stdout
        print("FinBERT model loaded successfully.")

    def analyze_sentiment(self, text: str) -> dict:
        """
        Analyzes sentiment of a single text using FinBERT.

        Args:
            text: Text to analyze

        Returns:
            Dictionary with 'label', 'confidence', 'score', and 'scores_dict' keys
        """
        if not text:
            return {"label": "neutral", "confidence": 0.0, "score": 0.0, "scores_dict": {}}

        sentiment_scores = self.finbert(text, truncation=True, return_all_scores=True)[0]
        scores_dict = {r['label'].lower(): r['score'] for r in sentiment_scores}

        label = max(scores_dict, key=scores_dict.get)
        confidence = scores_dict[label]

        # --- NEW CALCULATION: Weighted Polarity Score (WPS) ---
        # This formula modulates the score by the model's confidence (1 - neutral probability).
        p_pos = scores_dict.get("positive", 0.0)
        p_neg = scores_dict.get("negative", 0.0)
        p_neu = scores_dict.get("neutral", 0.0)
        
        # wps = (P(positive) - P(negative)) * (1 - P(neutral))
        raw_score = (p_pos - p_neg) * (1 - p_neu)

        return {
            "label": label,
            "confidence": confidence,
            "score": raw_score,
            "scores_dict": scores_dict
        }

    def analyze_sentiment_batch(self, texts: list[str]) -> list[dict]:
        """
        Analyzes sentiment for multiple texts.

        Args:
            texts: List of texts to analyze

        Returns:
            List of sentiment dictionaries
        """
        return [self.analyze_sentiment(text) for text in texts if text]

    def analyze_sentiment_with_weights(self, news_articles: list[dict]) -> dict:
        """
        Analyzes sentiment with recency weighting using the FinBERT model.

        This method:
        1. Analyzes sentiment for each article
        2. Applies recency weighting (more recent = higher weight)
        3. Calculates overall weighted score and daily averages
        4. Returns both dict format (backward compatible) and News model objects

        Args:
            news_articles: List of news article dictionaries with 'title' and 'publish_date'

        Returns:
            Dictionary containing:
                - articles_with_sentiment: List of articles with sentiment data
                - news_objects: List of News model objects
                - overall_weighted_score: Weighted average sentiment score
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
        seven_days_ago = today - timedelta(days=6)

        # Normalized recency weights (more recent = higher weight)
        raw_weights = {0: 1.0, 1: 0.8, 2: 0.6, 3: 0.5, 4: 0.4, 5: 0.35, 6: 0.3}
        total_raw = sum(raw_weights.values())
        weights = {k: v / total_raw for k, v in raw_weights.items()}

        for article in news_articles:
            title = article.get("title", "")
            summary = article.get("summary", "")

            # Combine title and summary for a more comprehensive analysis.
            # The FinBERT model can handle longer texts, so this provides more context.
            text_to_analyze = f"{title}. {summary}".strip()

            if not text_to_analyze or text_to_analyze == ".":
                continue

            # Analyze sentiment using FinBERT
            sentiment_result = self.analyze_sentiment(text_to_analyze)

            label = sentiment_result["label"]
            confidence = sentiment_result["confidence"]
            raw_score = sentiment_result["score"]

            # Calculate recency weight
            recency_weight = 0
            pub_date_str = article.get("publish_date")
            if pub_date_str:
                try:
                    pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d").date()
                    if seven_days_ago <= pub_date <= today:
                        days_old = (today - pub_date).days
                        recency_weight = weights.get(days_old, 0)
                        weighted_total += raw_score * recency_weight
                        weight_sum += recency_weight
                        daily_scores[pub_date].append(raw_score * recency_weight)
                except ValueError:
                    pass

            # Add sentiment data to the dictionary (backward compatibility)
            article["sentiment_label"] = label
            article["sentiment_confidence"] = confidence
            article["sentiment_score_raw"] = raw_score
            article["sentiment_weight"] = recency_weight
            results.append(article)
            sentiment_counts[label] += 1

            # Create proper News object with SentimentScore model
            sentiment_score_obj = SentimentScore(
                value=raw_score,
                source="FinBERT (ProsusAI)",
                confidence=confidence
            )
            news_obj = News(
                headline=title,
                source=article.get("provider", "Unknown"),
                sentiment_score=sentiment_score_obj
            )
            # Store additional metadata on the News object
            news_obj.link = article.get("link")
            news_obj.publish_date = pub_date_str
            news_obj.image = article.get("image")
            news_objects.append(news_obj)

        # Calculate daily average sentiment
        daily_avg_sentiment = {}
        for i in range(7):
            date = seven_days_ago + timedelta(days=i)
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

