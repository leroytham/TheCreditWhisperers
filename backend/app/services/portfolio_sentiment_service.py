# app/services/portfolio_sentiment_service.py

import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import pandas as pd

from app.services.sentiment_service import sentiment_service
from app.services.news_service import news_service_instance
from app.services.stock_data_service import stock_data_service
from app.core.cache import async_cache_result


class PortfolioSentimentService:
    """
    Service for aggregating sentiment data across a portfolio's holdings.
    Provides portfolio-level sentiment metrics with proper weighting by position size.
    """

    def __init__(self):
        self.sentiment_service = sentiment_service
        self.news_service = news_service_instance

    async def get_portfolio_daily_sentiment(
        self,
        holdings_list: List[Dict],
        days: int = None,
        timeframe: str = None
    ) -> Dict:
        """
        Aggregates daily sentiment data across all portfolio holdings.

        Args:
            holdings_list: List of holdings with symbol, quantity, market_value
            days: Number of days to fetch data for
            timeframe: Timeframe string (e.g., '1M', '6M', 'YTD', '1Y')

        Returns:
            Dictionary with aggregated daily sentiment data and metadata
        """
        try:
            # Determine days from timeframe
            if timeframe:
                timeframe_days_map = {
                    '1D': 1,
                    '1W': 7,
                    '1M': 30,
                    '3M': 90,
                    '6M': 180,
                    'YTD': None,
                    '1Y': 365,
                    '5Y': 1825,
                    '10Y': 3650,
                    'MAX': 7300
                }

                if timeframe == 'YTD':
                    now = datetime.now(timezone.utc)
                    start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)
                    days = (now - start_of_year).days
                else:
                    days = timeframe_days_map.get(timeframe, 30)
            elif days is None:
                days = 7

            days = min(max(days, 1), 7300)

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

            # Initialize aggregated daily data
            today = datetime.now(timezone.utc).date()
            daily_data = {}
            for i in range(days):
                date = today - timedelta(days=days-1-i)
                date_str = date.strftime("%Y-%m-%d")
                daily_data[date_str] = {
                    "score": 0,
                    "count": 0,
                    "weighted_score": 0,
                    "holdings_with_data": 0,
                    "headlines": []
                }

            # Aggregate metadata with ALL advanced analytics fields
            aggregated_metadata = {
                # Fast/Slow Scores and Momentum
                "fast_score": 0,
                "slow_score": 0,
                "overall_weighted_score": 0,
                "sentiment_momentum": 0,
                "momentum_label": None,
                "momentum_interpretation": None,
                "momentum_quality": None,
                "half_life_fast_hours": None,
                "half_life_slow_hours": None,

                # News Coverage Quality
                "effective_news_volume": 0,
                "volume_interpretation": None,

                # Sentiment Breadth (Bull/Bear Ratio)
                "sentiment_breadth_score": 0,
                "num_bullish_articles": 0,
                "num_bearish_articles": 0,
                "total_directional_articles": 0,
                "breadth_interpretation": None,
                "breadth_quality": None,
                "avg_score": 0,

                # Sentiment Shock (Z-Score) - will be calculated portfolio-wide
                "sentiment_z_score": None,
                "z_score_interpretation": None,
                "z_score_historical_mean": None,
                "z_score_historical_std": None,
                "z_score_days_of_history": 0,
                "z_score_quality": None,

                # Volatility Metrics
                "sentiment_volatility": 0,
                "volatility_quality": None,

                # Data Quality
                "data_quality": None,

                # Source & Topic (existing)
                "source_concentration_hhi": 0,
                "concentration_interpretation": "Well Diversified",
                "dominant_source": None,
                "dominant_topic": None,
                "topic_distribution": {},
                "source_breakdown": {},
                "top_sources": [],

                # Coverage metrics (existing)
                "holdings_coverage": 0,
                "confidence_score": 0
            }

            # Fetch sentiment data for each holding in parallel
            tasks = []
            for symbol, holding_data in symbol_holdings.items():
                if timeframe:
                    task = self._fetch_holding_daily_sentiment(symbol, timeframe=timeframe)
                else:
                    task = self._fetch_holding_daily_sentiment(symbol, days=days)
                tasks.append((symbol, holding_data["weight"], task))

            # Gather results in parallel using asyncio.gather
            task_results = await asyncio.gather(
                *[task for _, _, task in tasks],
                return_exceptions=True
            )

            # Pair results with symbols and weights
            results = []
            for (symbol, weight, _), result in zip(tasks, task_results):
                if isinstance(result, Exception):
                    print(f"Error fetching sentiment for {symbol}: {result}")
                    results.append((symbol, weight, None))
                else:
                    results.append((symbol, weight, result))

            # Process results and aggregate
            valid_holdings = 0
            total_weight_with_data = 0
            all_headlines = []
            topic_weights = defaultdict(float)
            topic_sentiment_weighted = defaultdict(float)  # BUG FIX: For weighted sentiment by topic
            source_weights = defaultdict(float)

            # Aggregation accumulators for new metrics
            weighted_fast_score = 0
            weighted_slow_score = 0
            weighted_overall_score = 0
            weighted_momentum = 0
            weighted_effective_volume = 0
            weighted_breadth_score = 0
            total_bullish = 0
            total_bearish = 0
            total_directional = 0
            weighted_volatility = 0
            weighted_avg_score = 0
            total_articles_analyzed = 0

            # For Z-score: collect daily portfolio scores for historical analysis
            portfolio_daily_scores = defaultdict(list)

            # Track holdings with sentiment data
            holdings_with_sentiment = []

            for symbol, weight, sentiment_data in results:
                if not sentiment_data or "daily" not in sentiment_data:
                    continue

                # BUG FIX: Check if holding actually has articles before counting as valid
                has_articles = False
                for date_str, day_data in sentiment_data["daily"].items():
                    if day_data.get("count", 0) > 0:
                        has_articles = True
                        break

                # Only count holding as valid if it has at least one article
                if not has_articles:
                    continue

                valid_holdings += 1
                total_weight_with_data += weight
                holdings_with_sentiment.append(symbol)

                # Aggregate daily scores
                for date_str, day_data in sentiment_data["daily"].items():
                    if date_str not in daily_data:
                        continue

                    if day_data["count"] > 0:
                        daily_data[date_str]["weighted_score"] += day_data["score"] * weight
                        daily_data[date_str]["count"] += day_data["count"]
                        daily_data[date_str]["holdings_with_data"] += 1

                        # Collect for z-score calculation
                        portfolio_daily_scores[date_str].append((day_data["score"], weight))

                        # Add weighted headlines
                        for headline in day_data.get("headlines", []):
                            headline_copy = headline.copy()
                            headline_copy["symbol"] = symbol
                            headline_copy["weight"] = weight
                            all_headlines.append((date_str, headline_copy))

                # Aggregate metadata
                if sentiment_data.get("metadata"):
                    meta = sentiment_data["metadata"]

                    # Fast/Slow Scores and Momentum
                    if meta.get("fast_score") is not None:
                        weighted_fast_score += meta["fast_score"] * weight
                    if meta.get("slow_score") is not None:
                        weighted_slow_score += meta["slow_score"] * weight
                    if meta.get("overall_weighted_score") is not None:
                        weighted_overall_score += meta["overall_weighted_score"] * weight
                    if meta.get("sentiment_momentum") is not None:
                        weighted_momentum += meta["sentiment_momentum"] * weight

                    # Effective News Volume
                    if meta.get("effective_news_volume") is not None:
                        weighted_effective_volume += meta["effective_news_volume"] * weight

                    # Sentiment Breadth
                    if meta.get("sentiment_breadth_score") is not None:
                        weighted_breadth_score += meta["sentiment_breadth_score"] * weight
                    total_bullish += meta.get("num_bullish_articles", 0)
                    total_bearish += meta.get("num_bearish_articles", 0)
                    total_directional += meta.get("total_directional_articles", 0)

                    # Count total articles (sum from daily data)
                    for day_data in sentiment_data.get("daily", {}).values():
                        total_articles_analyzed += day_data.get("count", 0)

                    # Volatility
                    if meta.get("sentiment_volatility") is not None:
                        weighted_volatility += meta["sentiment_volatility"] * weight

                    # Store half-life values (should be same across holdings)
                    if aggregated_metadata["half_life_fast_hours"] is None:
                        aggregated_metadata["half_life_fast_hours"] = meta.get("half_life_fast_hours")
                        aggregated_metadata["half_life_slow_hours"] = meta.get("half_life_slow_hours")

                    # Topic distribution
                    if meta.get("topic_distribution"):
                        for topic, topic_weight in meta["topic_distribution"].items():
                            topic_weights[topic] += topic_weight * weight

                        # BUG FIX: Aggregate sentiment by topic
                        if meta.get("sentiment_by_topic"):
                            for topic, topic_sentiment in meta["sentiment_by_topic"].items():
                                # Weight by both holding weight and topic weight
                                topic_weight_normalized = meta["topic_distribution"].get(topic, 0)
                                topic_sentiment_weighted[topic] += topic_sentiment * weight * topic_weight_normalized

                    # Source breakdown
                    if meta.get("source_breakdown"):
                        for source, source_pct in meta["source_breakdown"].items():
                            source_weights[source] += source_pct * weight

            # Normalize aggregated data
            for date_str, day_data in daily_data.items():
                if total_weight_with_data > 0 and day_data["holdings_with_data"] > 0:
                    # Normalize weighted score by total weight of holdings with data
                    day_data["score"] = day_data["weighted_score"] / total_weight_with_data
                else:
                    day_data["score"] = 0

                # Add top headlines for this date (sorted by relevance * weight)
                date_headlines = [h for d, h in all_headlines if d == date_str]
                date_headlines.sort(
                    key=lambda x: abs(x.get("sentiment_score", 0)) * x.get("weight", 0),
                    reverse=True
                )
                day_data["headlines"] = date_headlines[:10]  # Top 10 headlines

            # Finalize metadata
            if total_weight_with_data > 0:
                # Normalize weighted scores
                aggregated_metadata["fast_score"] = weighted_fast_score / total_weight_with_data
                aggregated_metadata["slow_score"] = weighted_slow_score / total_weight_with_data
                aggregated_metadata["overall_weighted_score"] = weighted_overall_score / total_weight_with_data
                aggregated_metadata["sentiment_momentum"] = weighted_momentum / total_weight_with_data
                aggregated_metadata["effective_news_volume"] = weighted_effective_volume / total_weight_with_data
                aggregated_metadata["sentiment_breadth_score"] = weighted_breadth_score / total_weight_with_data if total_directional > 0 else 0
                aggregated_metadata["sentiment_volatility"] = weighted_volatility / total_weight_with_data
                aggregated_metadata["avg_score"] = weighted_overall_score / total_weight_with_data  # Use overall_weighted_score to match Sector

                # Aggregate bull/bear counts (sum across all holdings)
                aggregated_metadata["num_bullish_articles"] = total_bullish
                aggregated_metadata["num_bearish_articles"] = total_bearish
                aggregated_metadata["total_directional_articles"] = total_directional

                # Classify momentum (using same thresholds as sentiment_service)
                from app.config.scoring import classify_momentum
                momentum_value = aggregated_metadata["sentiment_momentum"]
                if momentum_value is not None:
                    momentum_classification = classify_momentum(momentum_value, 0.05, 0.15)
                    aggregated_metadata["momentum_label"] = momentum_classification["label"]
                    aggregated_metadata["momentum_interpretation"] = momentum_classification["interpretation"]
                    aggregated_metadata["momentum_quality"] = "good" if valid_holdings >= 3 else "low_confidence"

                # Classify volume
                volume = aggregated_metadata["effective_news_volume"]
                if volume < 1.0:
                    aggregated_metadata["volume_interpretation"] = "Low Coverage"
                elif volume <= 10.0:
                    aggregated_metadata["volume_interpretation"] = "Medium Coverage"
                else:
                    aggregated_metadata["volume_interpretation"] = "High Coverage"

                # Classify breadth
                if total_directional >= 10:
                    aggregated_metadata["breadth_quality"] = "good"
                elif total_directional >= 5:
                    aggregated_metadata["breadth_quality"] = "low_confidence"
                else:
                    aggregated_metadata["breadth_quality"] = "insufficient_sample"

                breadth_score = aggregated_metadata["sentiment_breadth_score"]
                if total_directional > 0:
                    if breadth_score > 0.5:
                        aggregated_metadata["breadth_interpretation"] = f"Overwhelmingly Bullish ({total_bullish} bulls vs {total_bearish} bears)"
                    elif breadth_score > 0.2:
                        aggregated_metadata["breadth_interpretation"] = f"Moderately Bullish ({total_bullish} bulls vs {total_bearish} bears)"
                    elif breadth_score >= -0.2:
                        aggregated_metadata["breadth_interpretation"] = f"Mixed Sentiment ({total_bullish} bulls vs {total_bearish} bears)"
                    elif breadth_score >= -0.5:
                        aggregated_metadata["breadth_interpretation"] = f"Moderately Bearish ({total_bullish} bulls vs {total_bearish} bears)"
                    else:
                        aggregated_metadata["breadth_interpretation"] = f"Overwhelmingly Bearish ({total_bullish} bulls vs {total_bearish} bears)"
                else:
                    aggregated_metadata["breadth_interpretation"] = "Insufficient directional articles"

                # Classify volatility
                aggregated_metadata["volatility_quality"] = "good" if valid_holdings >= 3 else "low_confidence"

                # Calculate portfolio-wide Z-score from daily scores
                if len(portfolio_daily_scores) >= 3:
                    import statistics
                    # Calculate daily portfolio-weighted averages
                    daily_portfolio_scores = {}
                    for date_str, scores_weights in portfolio_daily_scores.items():
                        total_weight = sum(w for _, w in scores_weights)
                        if total_weight > 0:
                            weighted_avg = sum(s * w for s, w in scores_weights) / total_weight
                            daily_portfolio_scores[date_str] = weighted_avg

                    if len(daily_portfolio_scores) >= 3:
                        sorted_dates = sorted(daily_portfolio_scores.keys())
                        historical_scores = [daily_portfolio_scores[d] for d in sorted_dates[:-1]]  # Exclude most recent
                        current_score = daily_portfolio_scores[sorted_dates[-1]]

                        if len(historical_scores) >= 2:
                            hist_mean = statistics.mean(historical_scores)
                            hist_std = statistics.stdev(historical_scores) if len(historical_scores) >= 2 else 0

                            if hist_std > 0:
                                z_score = (current_score - hist_mean) / hist_std
                                aggregated_metadata["sentiment_z_score"] = z_score
                                aggregated_metadata["z_score_historical_mean"] = hist_mean
                                aggregated_metadata["z_score_historical_std"] = hist_std
                                aggregated_metadata["z_score_days_of_history"] = len(historical_scores)

                                # Classify Z-Score
                                if z_score > 2.0:
                                    aggregated_metadata["z_score_interpretation"] = "Extreme Positive Shock"
                                    aggregated_metadata["z_score_quality"] = "good"
                                elif z_score > 1.5:
                                    aggregated_metadata["z_score_interpretation"] = "Strong Positive Signal"
                                    aggregated_metadata["z_score_quality"] = "good"
                                elif z_score > 1.0:
                                    aggregated_metadata["z_score_interpretation"] = "Moderately Positive"
                                    aggregated_metadata["z_score_quality"] = "good"
                                elif z_score > 0.5:
                                    aggregated_metadata["z_score_interpretation"] = "Slightly Positive"
                                    aggregated_metadata["z_score_quality"] = "good"
                                elif z_score >= -0.5:
                                    aggregated_metadata["z_score_interpretation"] = "Normal Range"
                                    aggregated_metadata["z_score_quality"] = "good"
                                elif z_score >= -1.0:
                                    aggregated_metadata["z_score_interpretation"] = "Slightly Negative"
                                    aggregated_metadata["z_score_quality"] = "good"
                                elif z_score >= -1.5:
                                    aggregated_metadata["z_score_interpretation"] = "Moderately Negative"
                                    aggregated_metadata["z_score_quality"] = "good"
                                elif z_score >= -2.0:
                                    aggregated_metadata["z_score_interpretation"] = "Strong Negative Signal"
                                    aggregated_metadata["z_score_quality"] = "good"
                                else:
                                    aggregated_metadata["z_score_interpretation"] = "Extreme Negative Shock"
                                    aggregated_metadata["z_score_quality"] = "good"

                                if len(historical_scores) < 5:
                                    aggregated_metadata["z_score_quality"] = "low_confidence"
                            else:
                                aggregated_metadata["z_score_interpretation"] = "No Historical Variation"
                                aggregated_metadata["z_score_quality"] = "low_confidence"

                # Set overall data quality
                aggregated_metadata["data_quality"] = "good" if valid_holdings >= 3 else "low_confidence"

                # Normalize topic distribution
                if topic_weights:
                    total_topic_weight = sum(topic_weights.values())
                    if total_topic_weight > 0:
                        aggregated_metadata["topic_distribution"] = {
                            topic: weight / total_topic_weight
                            for topic, weight in topic_weights.items()
                        }
                        # Store raw weights for frontend use
                        aggregated_metadata["topic_weights"] = dict(topic_weights)

                        # Find dominant topic
                        dominant_topic, dominant_weight = max(
                            topic_weights.items(),
                            key=lambda x: x[1]
                        )
                        aggregated_metadata["dominant_topic"] = dominant_topic
                        aggregated_metadata["dominant_topic_weight"] = dominant_weight
                        aggregated_metadata["dominant_topic_percentage"] = (dominant_weight / total_topic_weight) * 100

                        # BUG FIX: Calculate portfolio-level sentiment by topic
                        if topic_sentiment_weighted:
                            aggregated_metadata["sentiment_by_topic"] = {}
                            for topic, weighted_sentiment in topic_sentiment_weighted.items():
                                topic_weight_total = topic_weights.get(topic, 0)
                                if topic_weight_total > 0:
                                    # Normalize by total topic weight
                                    aggregated_metadata["sentiment_by_topic"][topic] = (
                                        weighted_sentiment / topic_weight_total
                                    )

                # Normalize source breakdown
                if source_weights:
                    total_source_weight = sum(source_weights.values())
                    if total_source_weight > 0:
                        aggregated_metadata["source_breakdown"] = {
                            source: weight / total_source_weight
                            for source, weight in source_weights.items()
                        }
                        aggregated_metadata["dominant_source"] = max(
                            source_weights.items(),
                            key=lambda x: x[1]
                        )[0]

                        # Create top sources list
                        sorted_sources = sorted(source_weights.items(), key=lambda x: x[1], reverse=True)[:5]
                        aggregated_metadata["top_sources"] = [
                            {
                                "source": source,
                                "weight": weight / total_source_weight,
                                "percentage": round((weight / total_source_weight * 100), 2)
                            }
                            for source, weight in sorted_sources
                        ]

                # Calculate HHI for source concentration
                if aggregated_metadata["source_breakdown"]:
                    hhi = sum(pct ** 2 for pct in aggregated_metadata["source_breakdown"].values())
                    aggregated_metadata["source_concentration_hhi"] = hhi * 10000  # Convert to standard HHI scale

                    if hhi < 0.15:
                        aggregated_metadata["concentration_interpretation"] = "Well Diversified"
                    elif hhi < 0.25:
                        aggregated_metadata["concentration_interpretation"] = "Moderately Concentrated"
                    else:
                        aggregated_metadata["concentration_interpretation"] = "Highly Concentrated"

            # Calculate coverage metrics
            aggregated_metadata["holdings_coverage"] = valid_holdings / len(symbol_holdings) if symbol_holdings else 0
            aggregated_metadata["confidence_score"] = total_weight_with_data  # Percentage of portfolio with data
            aggregated_metadata["total_articles_analyzed"] = total_articles_analyzed

            # Add detailed holdings coverage for HoldingsCoverageCard
            aggregated_metadata["holdings_coverage_details"] = {
                "holdings_with_data": valid_holdings,
                "total_holdings": len(symbol_holdings),
                "coverage_percentage": (valid_holdings / len(symbol_holdings) * 100) if symbol_holdings else 0,
                "holdings_list": holdings_with_sentiment
            }

            return {
                "daily": daily_data,
                "metadata": aggregated_metadata,
                "holdings_count": len(symbol_holdings),
                "valid_holdings": valid_holdings
            }

        except Exception as e:
            print(f"Error in portfolio daily sentiment aggregation: {e}")
            import traceback
            traceback.print_exc()
            raise

    async def get_portfolio_rolling_sentiment(
        self,
        holdings_list: List[Dict],
        timeframe: str = "1W"
    ) -> Dict:
        """
        Aggregates rolling-window sentiment data across all portfolio holdings.

        Args:
            holdings_list: List of holdings with symbol, quantity, market_value
            timeframe: Timeframe string (e.g., '1W', '1M', '3M', '6M', '1Y')

        Returns:
            Dictionary with aggregated rolling sentiment time series
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
                        "quantity": 0,
                        "is_etf": False  # Will be determined
                    }

                symbol_holdings[symbol]["market_value"] += market_value
                symbol_holdings[symbol]["quantity"] += float(holding.get("quantity", 0))
                total_value += market_value

            # Calculate weights and identify ETFs
            for symbol, symbol_data in symbol_holdings.items():
                symbol_data["weight"] = symbol_data["market_value"] / total_value if total_value > 0 else 0

                # Check if this is an ETF/sector
                try:
                    from app.services.sector_service import sector_service_instance
                    sector_service_instance.resolve_sector_key(symbol)
                    symbol_data["is_etf"] = True
                except:
                    symbol_data["is_etf"] = False

            # Fetch rolling sentiment for each holding
            tasks = []
            for symbol, holding_data in symbol_holdings.items():
                # Use appropriate timeframe based on holding type
                effective_timeframe = timeframe
                if holding_data["is_etf"] and timeframe not in ['1D', '1W', '1M']:
                    effective_timeframe = '1M'  # Cap ETF timeframes

                task = self._fetch_holding_rolling_sentiment(symbol, effective_timeframe)
                tasks.append((symbol, holding_data["weight"], task))

            # Gather results in parallel using asyncio.gather
            task_results = await asyncio.gather(
                *[task for _, _, task in tasks],
                return_exceptions=True
            )

            # Pair results with symbols and weights
            results = []
            for (symbol, weight, _), result in zip(tasks, task_results):
                if isinstance(result, Exception):
                    print(f"Error fetching rolling sentiment for {symbol}: {result}")
                    results.append((symbol, weight, None))
                else:
                    results.append((symbol, weight, result))

            # Aggregate time series data
            aggregated_series = {}
            valid_holdings = 0
            total_weight_with_data = 0

            for symbol, weight, sentiment_data in results:
                if not sentiment_data or "data" not in sentiment_data:
                    continue

                valid_holdings += 1
                total_weight_with_data += weight

                # Aggregate each time point
                for point in sentiment_data["data"]:
                    timestamp = point.get("timestamp")
                    if not timestamp:
                        continue

                    if timestamp not in aggregated_series:
                        aggregated_series[timestamp] = {
                            "timestamp": timestamp,
                            "weighted_score": 0,
                            "article_count": 0,
                            "momentum": 0,
                            "holdings_with_data": 0
                        }

                    score = point.get("score", 0)
                    aggregated_series[timestamp]["weighted_score"] += score * weight
                    aggregated_series[timestamp]["article_count"] += point.get("article_count", 0)
                    aggregated_series[timestamp]["holdings_with_data"] += 1

                    # Weighted momentum (if available)
                    if "momentum" in point:
                        aggregated_series[timestamp]["momentum"] += point["momentum"] * weight

            # Normalize and convert to list
            data_points = []
            for timestamp in sorted(aggregated_series.keys()):
                point = aggregated_series[timestamp]

                if total_weight_with_data > 0 and point["holdings_with_data"] > 0:
                    normalized_score = point["weighted_score"] / total_weight_with_data
                    normalized_momentum = point["momentum"] / total_weight_with_data
                else:
                    normalized_score = 0
                    normalized_momentum = 0

                data_points.append({
                    "timestamp": timestamp,
                    "score": normalized_score,
                    "article_count": point["article_count"],
                    "momentum": normalized_momentum,
                    "holdings_with_data": point["holdings_with_data"]
                })

            return {
                "timeframe": timeframe,
                "data": data_points,
                "holdings_count": len(symbol_holdings),
                "valid_holdings": valid_holdings,
                "coverage": total_weight_with_data
            }

        except Exception as e:
            print(f"Error in portfolio rolling sentiment aggregation: {e}")
            import traceback
            traceback.print_exc()
            raise

    async def _fetch_holding_daily_sentiment(
        self,
        ticker: str,
        days: int = None,
        timeframe: str = None
    ) -> Dict:
        """
        Fetches daily sentiment data for a single holding.
        This wraps the existing daily-sentiment endpoint logic.
        """
        try:
            # Use the existing daily sentiment logic
            from datetime import datetime, timedelta, timezone

            if timeframe:
                timeframe_days_map = {
                    '1D': 1,
                    '1W': 7,
                    '1M': 30,
                    '3M': 90,
                    '6M': 180,
                    'YTD': None,
                    '1Y': 365,
                    '5Y': 1825,
                    '10Y': 3650,
                    'MAX': 7300
                }

                if timeframe == 'YTD':
                    now = datetime.now(timezone.utc)
                    start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)
                    days = (now - start_of_year).days
                else:
                    days = timeframe_days_map.get(timeframe, 30)

                # Fetch news
                news_articles = await self.news_service.get_ticker_news_for_timeframe(
                    ticker,
                    timeframe=timeframe,
                    trigger_progressive=True
                )
            else:
                days = days or 7
                news_articles = await self.news_service.get_ticker_news(ticker)

            days = min(max(days, 1), 7300)

            # Initialize daily data
            today = datetime.now(timezone.utc).date()
            daily_data = {}
            for i in range(days):
                date = today - timedelta(days=days-1-i)
                date_str = date.strftime("%Y-%m-%d")
                daily_data[date_str] = {"score": 0, "count": 0, "headlines": []}

            if not news_articles:
                return {"ticker": ticker, "daily": daily_data, "metadata": None}

            # Analyze sentiment with full momentum analytics
            momentum_results = self.sentiment_service.analyze_sentiment_with_momentum(news_articles)
            articles_with_sentiment = momentum_results.get("articles_with_sentiment", [])

            # Extract comprehensive metadata with all advanced analytics
            metadata = {
                # Fast/Slow Scores and Momentum
                "fast_score": momentum_results.get("fast_score"),
                "slow_score": momentum_results.get("slow_score"),
                "overall_weighted_score": momentum_results.get("overall_weighted_score"),
                "sentiment_momentum": momentum_results.get("sentiment_momentum"),
                "momentum_label": momentum_results.get("momentum_label"),
                "momentum_interpretation": momentum_results.get("momentum_interpretation"),
                "momentum_quality": momentum_results.get("momentum_quality"),
                "half_life_fast_hours": momentum_results.get("half_life_fast_hours"),
                "half_life_slow_hours": momentum_results.get("half_life_slow_hours"),

                # News Coverage Quality
                "effective_news_volume": momentum_results.get("effective_news_volume"),
                "volume_interpretation": momentum_results.get("volume_interpretation"),

                # Sentiment Breadth (Bull/Bear Ratio)
                "sentiment_breadth_score": momentum_results.get("sentiment_breadth_score"),
                "num_bullish_articles": momentum_results.get("num_bullish_articles", 0),
                "num_bearish_articles": momentum_results.get("num_bearish_articles", 0),
                "total_directional_articles": momentum_results.get("total_directional_articles", 0),
                "breadth_interpretation": momentum_results.get("breadth_interpretation"),
                "breadth_quality": momentum_results.get("breadth_quality"),

                # Sentiment Shock (Z-Score)
                "sentiment_z_score": momentum_results.get("sentiment_z_score"),
                "z_score_interpretation": momentum_results.get("z_score_interpretation"),
                "z_score_historical_mean": momentum_results.get("z_score_historical_mean"),
                "z_score_historical_std": momentum_results.get("z_score_historical_std"),
                "z_score_days_of_history": momentum_results.get("z_score_days_of_history", 0),
                "z_score_quality": momentum_results.get("z_score_quality"),

                # Volatility Metrics
                "sentiment_volatility": momentum_results.get("sentiment_volatility"),
                "volatility_quality": momentum_results.get("volatility_quality"),

                # Data Quality
                "data_quality": momentum_results.get("data_quality"),

                # Source Concentration
                "source_concentration_hhi": momentum_results.get("source_concentration_hhi"),
                "concentration_interpretation": momentum_results.get("concentration_interpretation"),
                "dominant_source": momentum_results.get("top_sources", [{}])[0].get("source") if momentum_results.get("top_sources") else None,
                "top_sources": momentum_results.get("top_sources", []),
                "source_breakdown": {
                    source["source"]: source["percentage"]
                    for source in momentum_results.get("top_sources", [])
                },

                # Topic Analysis
                "dominant_topic": momentum_results.get("dominant_topic"),
                "topic_distribution": momentum_results.get("topic_weights", {}),
                "sentiment_by_topic": momentum_results.get("sentiment_by_topic", {})
            }

            # Group by date
            for article in articles_with_sentiment:
                date = article.get("publish_date")
                if not date or date not in daily_data:
                    continue

                sentiment_score = article.get("sentiment_score_raw", 0)
                daily_data[date]["score"] += sentiment_score
                daily_data[date]["count"] += 1

                daily_data[date]["headlines"].append({
                    "title": article.get("title", ""),
                    "provider": article.get("provider", "Unknown"),
                    "sentiment_score": sentiment_score,
                    "sentiment_label": article.get("sentiment_label", "Neutral"),
                    "link": article.get("link", ""),
                    "relevance_score": article.get("ticker_relevance_score", 0)
                })

            # Calculate averages
            for date, data in daily_data.items():
                if data["count"] > 0:
                    data["score"] = data["score"] / data["count"]
                data["headlines"].sort(key=lambda x: abs(x["sentiment_score"]), reverse=True)

            return {
                "ticker": ticker,
                "daily": daily_data,
                "metadata": metadata
            }

        except Exception as e:
            print(f"Error fetching daily sentiment for {ticker}: {e}")
            return None

    async def _fetch_holding_rolling_sentiment(self, ticker: str, timeframe: str = "1W") -> Dict:
        """
        Fetches rolling sentiment data for a single holding.
        This wraps the existing rolling-sentiment endpoint logic.
        """
        try:
            from datetime import datetime, timedelta, timezone
            from app.services.sector_service import sector_service_instance

            # Check if this is a sector/ETF
            is_sector = False
            sector_key = None

            try:
                sector_key = sector_service_instance.resolve_sector_key(ticker)
                is_sector = True
            except:
                is_sector = False

            # Configure timeframe parameters
            timeframe_configs = {
                '1D': {'hours': 24, 'interval_hours': 1, 'window_hours': 24},
                '1W': {'hours': 168, 'interval_hours': 6, 'window_hours': 24},
                '1M': {'hours': 720, 'interval_hours': 12, 'window_hours': 24},
                '3M': {'days': 90, 'interval_hours': 24, 'window_hours': 24},
                '6M': {'days': 180, 'interval_hours': 24, 'window_hours': 24},
                'YTD': {'days': (datetime.now(timezone.utc) - datetime(datetime.now(timezone.utc).year, 1, 1, tzinfo=timezone.utc)).days, 'interval_hours': 24, 'window_hours': 24},
                '1Y': {'days': 365, 'interval_hours': 24, 'window_hours': 24},
                '5Y': {'days': 1825, 'interval_hours': 24, 'window_hours': 24},
                '10Y': {'days': 3650, 'interval_hours': 48, 'window_hours': 168},
                'MAX': {'days': 7300, 'interval_hours': 168, 'window_hours': 720}
            }

            config = timeframe_configs.get(timeframe, timeframe_configs['1W'])

            # Apply sector limits
            effective_timeframe = timeframe
            if is_sector:
                effective_timeframe = timeframe if timeframe in ['1D', '1W', '1M'] else '1M'
                config = timeframe_configs.get(effective_timeframe, timeframe_configs['1M'])

            # Fetch news
            if is_sector:
                from app.services.sector_service import sector_service_instance
                news_articles = await sector_service_instance.get_sector_news(
                    sector_key,
                    days=config.get('days', config.get('hours', 24) // 24)
                )
            else:
                news_articles = await self.news_service.get_ticker_news_for_timeframe(
                    ticker,
                    timeframe=effective_timeframe,
                    trigger_progressive=True
                )

            if not news_articles:
                return {"timeframe": effective_timeframe, "data": []}

            # Generate time windows
            now = datetime.now(timezone.utc)
            if 'days' in config:
                start_time = now - timedelta(days=config['days'])
            else:
                start_time = now - timedelta(hours=config['hours'])

            time_windows = []
            current_time = start_time

            while current_time <= now:
                window_end = current_time + timedelta(hours=config['window_hours'])
                time_windows.append({
                    'start': current_time,
                    'end': window_end,
                    'timestamp': current_time.isoformat(),
                    'articles': [],
                    'score': 0,
                    'article_count': 0
                })
                current_time += timedelta(hours=config['interval_hours'])

            # Analyze sentiment
            sentiment_results = self.sentiment_service.analyze_sentiment_with_weights(news_articles)
            articles_with_sentiment = sentiment_results.get("articles_with_sentiment", [])

            # Assign articles to windows
            for article in articles_with_sentiment:
                pub_date_str = article.get("publish_date")
                if not pub_date_str:
                    continue

                try:
                    pub_date = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00'))
                    if pub_date.tzinfo is None:
                        pub_date = pub_date.replace(tzinfo=timezone.utc)

                    for window in time_windows:
                        if window['start'] <= pub_date < window['end']:
                            window['articles'].append(article)
                            window['score'] += article.get("sentiment_score_raw", 0)
                            window['article_count'] += 1

                except Exception as e:
                    continue

            # Calculate window averages and momentum
            data_points = []
            prev_score = None

            for window in time_windows:
                if window['article_count'] > 0:
                    avg_score = window['score'] / window['article_count']
                else:
                    avg_score = 0

                # Calculate momentum
                momentum = 0
                if prev_score is not None:
                    momentum = avg_score - prev_score

                data_points.append({
                    'timestamp': window['timestamp'],
                    'score': avg_score,
                    'article_count': window['article_count'],
                    'momentum': momentum
                })

                prev_score = avg_score

            return {
                "timeframe": effective_timeframe,
                "data": data_points
            }

        except Exception as e:
            print(f"Error fetching rolling sentiment for {ticker}: {e}")
            return None


# Create singleton instance
portfolio_sentiment_service = PortfolioSentimentService()