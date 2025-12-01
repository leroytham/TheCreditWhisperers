# =============================================================================
# Portfolio Sentiment Service - Aggregates sentiment across holdings
# =============================================================================

import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
from collections import defaultdict
import statistics
import logging

from app.services.service_client import service_client
from app.core.cache import async_cache_result

logger = logging.getLogger(__name__)


# Sentiment classification thresholds - centralized constants
# Keep in sync with sentiment-service and backend/app/core/sentiment_constants.py
BULLISH_STRONG_THRESHOLD = 0.35
BULLISH_WEAK_THRESHOLD = 0.15
BEARISH_WEAK_THRESHOLD = -0.15
BEARISH_STRONG_THRESHOLD = -0.35

# Momentum thresholds
MOMENTUM_THRESHOLD_WEAK = 0.05
MOMENTUM_THRESHOLD_STRONG = 0.15


class PortfolioSentimentService:
    """
    Aggregates sentiment data across portfolio holdings with position weighting.
    """

    async def get_portfolio_sentiment(
        self,
        holdings_list: List[Dict],
        timeframe: str = "1M"
    ) -> Dict:
        """
        Aggregate sentiment across all portfolio holdings.

        Args:
            holdings_list: List of holdings with symbol, quantity, market_value
            timeframe: Timeframe for sentiment analysis

        Returns:
            Aggregated portfolio sentiment with all advanced metrics
        """
        try:
            # Aggregate holdings by symbol and calculate weights
            symbol_holdings = {}
            total_value = 0

            for holding in holdings_list:
                symbol = holding.get("symbol", "").upper()
                if not symbol:
                    continue

                market_value = float(holding.get("market_value", 0))
                if market_value <= 0:
                    continue

                if symbol not in symbol_holdings:
                    symbol_holdings[symbol] = {
                        "symbol": symbol,
                        "market_value": 0,
                        "quantity": 0
                    }

                symbol_holdings[symbol]["market_value"] += market_value
                symbol_holdings[symbol]["quantity"] += float(holding.get("quantity", 0))
                total_value += market_value

            # Calculate weights
            for symbol_data in symbol_holdings.values():
                symbol_data["weight"] = symbol_data["market_value"] / total_value if total_value > 0 else 0

            # Fetch sentiment for each holding in parallel
            tasks = []
            for symbol, holding_data in symbol_holdings.items():
                task = self._fetch_holding_sentiment(symbol, timeframe)
                tasks.append((symbol, holding_data["weight"], task))

            # Gather results
            task_results = await asyncio.gather(
                *[task for _, _, task in tasks],
                return_exceptions=True
            )

            # Process results
            results = []
            for (symbol, weight, _), result in zip(tasks, task_results):
                if isinstance(result, Exception):
                    logger.error(f"Error fetching sentiment for {symbol}: {result}")
                    results.append((symbol, weight, None))
                else:
                    results.append((symbol, weight, result))

            # Aggregate metrics
            aggregated = self._aggregate_sentiment_metrics(results, total_value)
            aggregated["holdings_count"] = len(symbol_holdings)
            aggregated["timeframe"] = timeframe

            return aggregated

        except Exception as e:
            logger.error(f"Error in portfolio sentiment aggregation: {e}")
            raise

    async def _fetch_holding_sentiment(
        self,
        ticker: str,
        timeframe: str
    ) -> Optional[Dict]:
        """Fetch sentiment for a single holding from Sentiment Service."""
        try:
            result = await service_client.get_ticker_sentiment(ticker, timeframe)
            return result
        except Exception as e:
            logger.error(f"Error fetching sentiment for {ticker}: {e}")
            return None

    def _aggregate_sentiment_metrics(
        self,
        results: List[tuple],
        total_portfolio_value: float
    ) -> Dict:
        """Aggregate sentiment metrics across holdings."""

        valid_holdings = 0
        total_weight_with_data = 0

        # Weighted accumulators
        weighted_fast_score = 0.0
        weighted_slow_score = 0.0
        weighted_overall_score = 0.0
        weighted_momentum = 0.0
        weighted_volatility = 0.0
        weighted_breadth = 0.0

        # Bull/bear counts
        total_bullish = 0
        total_bearish = 0
        total_directional = 0
        total_articles = 0

        # Topic/source aggregation
        topic_weights = defaultdict(float)
        source_weights = defaultdict(float)

        # Daily scores for Z-score
        daily_portfolio_scores = defaultdict(list)

        holdings_with_sentiment = []

        for symbol, weight, sentiment_data in results:
            if not sentiment_data or not sentiment_data.get("success"):
                continue

            # Check if we have actual data
            if sentiment_data.get("data_quality") == "no_data":
                continue

            valid_holdings += 1
            total_weight_with_data += weight
            holdings_with_sentiment.append(symbol)

            # Aggregate scores
            if sentiment_data.get("fast_score") is not None:
                weighted_fast_score += sentiment_data["fast_score"] * weight
            if sentiment_data.get("slow_score") is not None:
                weighted_slow_score += sentiment_data["slow_score"] * weight
            if sentiment_data.get("overall_weighted_score") is not None:
                weighted_overall_score += sentiment_data["overall_weighted_score"] * weight
            if sentiment_data.get("sentiment_momentum") is not None:
                weighted_momentum += sentiment_data["sentiment_momentum"] * weight
            if sentiment_data.get("sentiment_volatility") is not None:
                weighted_volatility += sentiment_data["sentiment_volatility"] * weight
            if sentiment_data.get("sentiment_breadth_score") is not None:
                weighted_breadth += sentiment_data["sentiment_breadth_score"] * weight

            # Bull/bear counts
            total_bullish += sentiment_data.get("num_bullish_articles", 0)
            total_bearish += sentiment_data.get("num_bearish_articles", 0)
            total_directional += sentiment_data.get("total_directional_articles", 0)
            total_articles += sentiment_data.get("article_count", 0)

            # Source concentration
            for source in sentiment_data.get("top_sources", []):
                source_name = source.get("source", "Unknown")
                source_pct = source.get("percentage", 0)
                source_weights[source_name] += source_pct * weight

            # Topic distribution
            for topic, topic_sentiment in sentiment_data.get("sentiment_by_topic", {}).items():
                topic_weights[topic] += abs(topic_sentiment) * weight

        # Normalize aggregated scores
        aggregated = {
            "success": True,
            "valid_holdings": valid_holdings,
            "coverage": total_weight_with_data,
            "holdings_with_sentiment": holdings_with_sentiment,
            "total_articles_analyzed": total_articles
        }

        if total_weight_with_data > 0:
            aggregated["fast_score"] = weighted_fast_score / total_weight_with_data
            aggregated["slow_score"] = weighted_slow_score / total_weight_with_data
            aggregated["overall_weighted_score"] = weighted_overall_score / total_weight_with_data
            aggregated["sentiment_momentum"] = weighted_momentum / total_weight_with_data
            aggregated["sentiment_volatility"] = weighted_volatility / total_weight_with_data
            aggregated["sentiment_breadth_score"] = weighted_breadth / total_weight_with_data if total_directional > 0 else 0

            # Classify momentum
            momentum_value = aggregated["sentiment_momentum"]
            if abs(momentum_value) < MOMENTUM_THRESHOLD_WEAK:
                aggregated["momentum_label"] = "Stable"
                aggregated["momentum_interpretation"] = "Sentiment is stable"
            elif momentum_value >= MOMENTUM_THRESHOLD_STRONG:
                aggregated["momentum_label"] = "Strong Positive Momentum"
                aggregated["momentum_interpretation"] = "Sentiment is significantly improving"
            elif momentum_value > 0:
                aggregated["momentum_label"] = "Weak Positive Momentum"
                aggregated["momentum_interpretation"] = "Sentiment is slightly improving"
            elif momentum_value <= -MOMENTUM_THRESHOLD_STRONG:
                aggregated["momentum_label"] = "Strong Negative Momentum"
                aggregated["momentum_interpretation"] = "Sentiment is significantly deteriorating"
            else:
                aggregated["momentum_label"] = "Weak Negative Momentum"
                aggregated["momentum_interpretation"] = "Sentiment is slightly deteriorating"

            aggregated["momentum_quality"] = "good" if valid_holdings >= 3 else "low_confidence"
            aggregated["data_quality"] = "good" if valid_holdings >= 3 else "low_confidence"
        else:
            aggregated["data_quality"] = "no_data"

        # Bull/bear metrics
        aggregated["num_bullish_articles"] = total_bullish
        aggregated["num_bearish_articles"] = total_bearish
        aggregated["total_directional_articles"] = total_directional

        if total_directional > 0:
            breadth_score = (total_bullish - total_bearish) / total_directional
            if breadth_score > 0.5:
                aggregated["breadth_interpretation"] = f"Overwhelmingly Bullish ({total_bullish} bulls vs {total_bearish} bears)"
            elif breadth_score > 0.2:
                aggregated["breadth_interpretation"] = f"Moderately Bullish ({total_bullish} bulls vs {total_bearish} bears)"
            elif breadth_score >= -0.2:
                aggregated["breadth_interpretation"] = f"Mixed Sentiment ({total_bullish} bulls vs {total_bearish} bears)"
            elif breadth_score >= -0.5:
                aggregated["breadth_interpretation"] = f"Moderately Bearish ({total_bullish} bulls vs {total_bearish} bears)"
            else:
                aggregated["breadth_interpretation"] = f"Overwhelmingly Bearish ({total_bullish} bulls vs {total_bearish} bears)"
            aggregated["breadth_quality"] = "good" if total_directional >= 10 else "low_confidence"
        else:
            aggregated["breadth_interpretation"] = "Insufficient directional articles"
            aggregated["breadth_quality"] = "insufficient_sample"

        # Source concentration (HHI)
        if source_weights:
            total_source_weight = sum(source_weights.values())
            if total_source_weight > 0:
                normalized_sources = {s: w/total_source_weight for s, w in source_weights.items()}
                hhi = sum(pct**2 for pct in normalized_sources.values()) * 10000

                aggregated["source_concentration_hhi"] = round(hhi, 2)
                if hhi < 1500:
                    aggregated["concentration_interpretation"] = "Well Diversified"
                elif hhi < 2500:
                    aggregated["concentration_interpretation"] = "Moderately Concentrated"
                else:
                    aggregated["concentration_interpretation"] = "Highly Concentrated"

                # Top sources
                sorted_sources = sorted(source_weights.items(), key=lambda x: x[1], reverse=True)[:5]
                aggregated["top_sources"] = [
                    {"source": s, "percentage": round(w/total_source_weight*100, 2)}
                    for s, w in sorted_sources
                ]

        # Topic analysis
        if topic_weights:
            total_topic_weight = sum(topic_weights.values())
            if total_topic_weight > 0:
                dominant_topic, dominant_weight = max(topic_weights.items(), key=lambda x: x[1])
                aggregated["dominant_topic"] = dominant_topic
                aggregated["dominant_topic_percentage"] = round(dominant_weight/total_topic_weight*100, 2)
                aggregated["topic_count"] = len(topic_weights)

        return aggregated


portfolio_sentiment_service = PortfolioSentimentService()
