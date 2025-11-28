"""
Article processor for sentiment analysis.

This module handles:
- FinBERT ML model integration for text sentiment analysis
- Cache key generation for news article sets
- Article text extraction and preparation
"""

import hashlib
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class ArticleProcessor:
    """
    Processes articles for sentiment analysis using FinBERT ML model.

    This class provides:
    1. FinBERT-based text sentiment analysis (when enabled)
    2. Cache key generation for article sets
    3. Helper methods for article text extraction
    """

    def __init__(self):
        """Initialize the article processor with FinBERT model (disabled by default)."""
        # Disabled FinBERT loading - not used in production
        # The application uses Alpha Vantage pre-calculated sentiment scores exclusively.
        # FinBERT loading takes 10-15 minutes and is unnecessary overhead.
        #
        # To enable FinBERT fallback sentiment, uncomment:
        # try:
        #     from transformers import pipeline
        #     self.finbert = pipeline("text-classification", model="ProsusAI/finbert")
        #     self.finbert_available = True
        # except Exception as e:
        #     print(f"WARNING: FinBERT model could not be loaded: {e}")
        #     self.finbert = None
        #     self.finbert_available = False

        self.finbert = None
        self.finbert_available = False

    def analyze_sentiment(self, text: str) -> Dict:
        """
        Analyze sentiment of a single text using FinBERT.

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
            logger.error("Error analyzing sentiment with FinBERT: %s", e)
            return {"label": "neutral", "confidence": 0.0, "score": 0.0}

    def analyze_with_finbert(self, article: Dict) -> Tuple[float, str, float]:
        """
        Analyze an article with FinBERT.

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

    def generate_cache_key(self, news_articles: List[Dict]) -> str:
        """
        Generate a stable cache key from a list of news articles.
        Uses article links and publish dates to create a unique hash.

        Args:
            news_articles: List of news article dictionaries

        Returns:
            16-character hash string representing the article set
        """
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


# Module-level instance for convenience
article_processor = ArticleProcessor()
