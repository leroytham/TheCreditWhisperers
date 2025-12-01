"""
Portfolio sentiment service with aggregation.

This is the main service class that orchestrates portfolio-level sentiment analysis.
It aggregates sentiment data across a portfolio's holdings with proper weighting
by position size.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

import yfinance as yf

from app.services.sentiment_service import sentiment_service
from app.services.news_service import news_service_instance
from app.services.stock_data_service import stock_data_service

from .holding_fetcher import (
    fetch_holding_daily_sentiment,
    fetch_holding_rolling_sentiment,
)
from .aggregation import (
    aggregate_holdings_data,
    initialize_aggregated_metadata,
    finalize_aggregated_metadata,
)

logger = logging.getLogger(__name__)


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
                days = self._get_days_from_timeframe(timeframe)
            elif days is None:
                days = 7

            days = min(max(days, 1), 7300)

            # Aggregate holdings by symbol and calculate weights
            symbol_holdings, total_value = aggregate_holdings_data(holdings_list)

            # Initialize aggregated daily data
            today = datetime.now(timezone.utc).date()
            daily_data = {}
            for i in range(days):
                date = today - timedelta(days=days - 1 - i)
                date_str = date.strftime("%Y-%m-%d")
                daily_data[date_str] = {
                    "score": 0,
                    "count": 0,
                    "weighted_score": 0,
                    "holdings_with_data": 0,
                    "headlines": []
                }

            # Initialize metadata
            aggregated_metadata = initialize_aggregated_metadata()

            # Fetch sentiment data for each holding in parallel
            tasks = []
            for symbol, holding_data in symbol_holdings.items():
                if timeframe:
                    task = fetch_holding_daily_sentiment(
                        symbol, self.sentiment_service, self.news_service, timeframe=timeframe
                    )
                else:
                    task = fetch_holding_daily_sentiment(
                        symbol, self.sentiment_service, self.news_service, days=days
                    )
                tasks.append((symbol, holding_data["weight"], task))

            # Gather results in parallel
            task_results = await asyncio.gather(
                *[task for _, _, task in tasks],
                return_exceptions=True
            )

            # Pair results with symbols and weights
            results = []
            for (symbol, weight, _), result in zip(tasks, task_results):
                if isinstance(result, Exception):
                    logger.error("Error fetching sentiment for %s: %s", symbol, result)
                    results.append((symbol, weight, None))
                else:
                    results.append((symbol, weight, result))

            # Process results and aggregate
            valid_holdings = 0
            total_weight_with_data = 0
            all_headlines = []
            topic_weights = defaultdict(float)
            topic_sentiment_weighted = defaultdict(float)
            source_weights = defaultdict(float)

            # Aggregation accumulators
            weighted_scores = {
                "fast": 0, "slow": 0, "overall": 0, "momentum": 0,
                "volume": 0, "breadth": 0, "volatility": 0
            }
            total_bullish = 0
            total_bearish = 0
            total_directional = 0
            total_articles_analyzed = 0
            portfolio_daily_scores = defaultdict(list)
            holdings_with_sentiment = []

            for symbol, weight, sentiment_data in results:
                if not sentiment_data or "daily" not in sentiment_data:
                    continue

                # Check if holding actually has articles
                has_articles = any(
                    day_data.get("count", 0) > 0
                    for day_data in sentiment_data["daily"].values()
                )

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

                        portfolio_daily_scores[date_str].append((day_data["score"], weight))

                        for headline in day_data.get("headlines", []):
                            headline_copy = headline.copy()
                            headline_copy["symbol"] = symbol
                            headline_copy["weight"] = weight
                            all_headlines.append((date_str, headline_copy))

                # Aggregate metadata
                if sentiment_data.get("metadata"):
                    meta = sentiment_data["metadata"]
                    self._accumulate_weighted_scores(weighted_scores, meta, weight)
                    self._accumulate_breadth_counts(
                        meta, weighted_scores, total_bullish, total_bearish, total_directional
                    )

                    # Update counters
                    total_bullish += meta.get("num_bullish_articles", 0)
                    total_bearish += meta.get("num_bearish_articles", 0)
                    total_directional += meta.get("total_directional_articles", 0)

                    for day_data in sentiment_data.get("daily", {}).values():
                        total_articles_analyzed += day_data.get("count", 0)

                    if aggregated_metadata["half_life_fast_hours"] is None:
                        aggregated_metadata["half_life_fast_hours"] = meta.get("half_life_fast_hours")
                        aggregated_metadata["half_life_slow_hours"] = meta.get("half_life_slow_hours")

                    # Topic distribution
                    if meta.get("topic_distribution"):
                        for topic, topic_weight in meta["topic_distribution"].items():
                            topic_weights[topic] += topic_weight * weight

                        if meta.get("sentiment_by_topic"):
                            for topic, topic_sentiment in meta["sentiment_by_topic"].items():
                                topic_weight_normalized = meta["topic_distribution"].get(topic, 0)
                                topic_sentiment_weighted[topic] += topic_sentiment * weight * topic_weight_normalized

                    # Source breakdown
                    if meta.get("source_breakdown"):
                        for source, source_pct in meta["source_breakdown"].items():
                            source_weights[source] += source_pct * weight

            # Normalize daily data
            for date_str, day_data in daily_data.items():
                if total_weight_with_data > 0 and day_data["holdings_with_data"] > 0:
                    day_data["score"] = day_data["weighted_score"] / total_weight_with_data
                else:
                    day_data["score"] = 0

                date_headlines = [h for d, h in all_headlines if d == date_str]
                date_headlines.sort(
                    key=lambda x: abs(x.get("sentiment_score", 0)) * max(0.0001, x.get("relevance_score", 1.0)) * x.get("weight", 0),
                    reverse=True
                )
                day_data["headlines"] = date_headlines

            # Finalize metadata
            aggregated_metadata = finalize_aggregated_metadata(
                aggregated_metadata,
                total_weight_with_data,
                valid_holdings,
                weighted_scores,
                topic_weights,
                topic_sentiment_weighted,
                source_weights,
                portfolio_daily_scores,
                total_bullish,
                total_bearish,
                total_directional,
                total_articles_analyzed
            )

            # Calculate coverage metrics
            aggregated_metadata["holdings_coverage"] = valid_holdings / len(symbol_holdings) if symbol_holdings else 0
            aggregated_metadata["confidence_score"] = total_weight_with_data
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
            logger.error("Error in portfolio daily sentiment aggregation: %s", e, exc_info=True)
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
            symbol_holdings, total_value = aggregate_holdings_data(holdings_list)

            # Check for ETFs
            for symbol, symbol_data in symbol_holdings.items():
                symbol_data["is_etf"] = False
                try:
                    from app.services.sector_service import sector_service_instance
                    sector_service_instance.resolve_sector_key(symbol)
                    symbol_data["is_etf"] = True
                except KeyError:
                    symbol_data["is_etf"] = False
                except Exception as e:
                    logger.warning(f"Error checking if {symbol} is ETF: {e}")
                    symbol_data["is_etf"] = False

            # Fetch rolling sentiment for each holding
            tasks = []
            for symbol, holding_data in symbol_holdings.items():
                effective_timeframe = timeframe
                if holding_data["is_etf"] and timeframe not in ['1D', '1W', '1M']:
                    effective_timeframe = '1M'

                task = fetch_holding_rolling_sentiment(
                    symbol, self.sentiment_service, self.news_service, effective_timeframe
                )
                tasks.append((symbol, holding_data["weight"], task))

            # Gather results in parallel
            task_results = await asyncio.gather(
                *[task for _, _, task in tasks],
                return_exceptions=True
            )

            # Pair results with symbols and weights
            results = []
            for (symbol, weight, _), result in zip(tasks, task_results):
                if isinstance(result, Exception):
                    logger.error("Error fetching rolling sentiment for %s: %s", symbol, result)
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

                for point in sentiment_data["data"]:
                    timestamp_str = point.get("timestamp")
                    if not timestamp_str:
                        continue

                    try:
                        timestamp_dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    except ValueError:
                        continue

                    canonical_dt = timestamp_dt.replace(second=0, microsecond=0)
                    timestamp_key = canonical_dt.isoformat()

                    if timestamp_key not in aggregated_series:
                        aggregated_series[timestamp_key] = {
                            "timestamp": timestamp_dt,
                            "weighted_score": 0,
                            "article_count": 0,
                            "momentum": 0,
                            "holdings_with_data": 0,
                            "weight_total": 0.0,
                            "headlines": []
                        }
                    else:
                        if timestamp_dt > aggregated_series[timestamp_key]["timestamp"]:
                            aggregated_series[timestamp_key]["timestamp"] = timestamp_dt

                    score = point.get("score", 0)
                    aggregated_series[timestamp_key]["weighted_score"] += score * weight
                    aggregated_series[timestamp_key]["article_count"] += point.get("article_count", 0)
                    aggregated_series[timestamp_key]["holdings_with_data"] += 1
                    aggregated_series[timestamp_key]["weight_total"] += weight

                    if "momentum" in point:
                        aggregated_series[timestamp_key]["momentum"] += point["momentum"] * weight

                    for headline in point.get("headlines", []):
                        headline_copy = headline.copy()
                        headline_copy["symbol"] = symbol
                        headline_copy["weight"] = weight
                        aggregated_series[timestamp_key]["headlines"].append(headline_copy)

            # Normalize and convert to list
            data_points = []
            for point in sorted(aggregated_series.values(), key=lambda item: item["timestamp"]):
                window_weight = point.get("weight_total", 0.0)
                if window_weight > 0:
                    normalized_score = point["weighted_score"] / window_weight
                    normalized_momentum = point["momentum"] / window_weight
                else:
                    normalized_score = 0
                    normalized_momentum = 0

                data_points.append({
                    "timestamp": point["timestamp"].isoformat(),
                    "score": normalized_score,
                    "article_count": point["article_count"],
                    "momentum": normalized_momentum,
                    "holdings_with_data": point["holdings_with_data"],
                    "timezone": "UTC",
                    "headlines": sorted(
                        point["headlines"],
                        key=lambda x: abs(x.get("sentiment_score", 0)) * max(0.0001, x.get("relevance_score", 1.0)) * x.get("weight", 0),
                        reverse=True
                    )
                })

            return {
                "timeframe": timeframe,
                "data": data_points,
                "holdings_count": len(symbol_holdings),
                "valid_holdings": valid_holdings,
                "coverage": total_weight_with_data
            }

        except Exception as e:
            logger.error("Error in portfolio rolling sentiment aggregation: %s", e, exc_info=True)
            raise

    def _get_days_from_timeframe(self, timeframe: str) -> int:
        """Convert timeframe string to number of days."""
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
            return (now - start_of_year).days

        return timeframe_days_map.get(timeframe, 30)

    def _accumulate_weighted_scores(self, weighted_scores: Dict, meta: Dict, weight: float):
        """Accumulate weighted scores from holding metadata."""
        if meta.get("fast_score") is not None:
            weighted_scores["fast"] += meta["fast_score"] * weight
        if meta.get("slow_score") is not None:
            weighted_scores["slow"] += meta["slow_score"] * weight
        if meta.get("overall_weighted_score") is not None:
            weighted_scores["overall"] += meta["overall_weighted_score"] * weight
        if meta.get("sentiment_momentum") is not None:
            weighted_scores["momentum"] += meta["sentiment_momentum"] * weight
        if meta.get("effective_news_volume") is not None:
            weighted_scores["volume"] += meta["effective_news_volume"] * weight
        if meta.get("sentiment_breadth_score") is not None:
            weighted_scores["breadth"] += meta["sentiment_breadth_score"] * weight
        if meta.get("sentiment_volatility") is not None:
            weighted_scores["volatility"] += meta["sentiment_volatility"] * weight

    def _accumulate_breadth_counts(
        self,
        meta: Dict,
        weighted_scores: Dict,
        total_bullish: int,
        total_bearish: int,
        total_directional: int
    ):
        """Accumulate breadth counts from holding metadata."""
        # Counts are accumulated in the main loop
        pass

    # Legacy compatibility methods
    async def _fetch_holding_daily_sentiment(
        self,
        ticker: str,
        days: int = None,
        timeframe: str = None
    ) -> Dict:
        """Legacy compatibility wrapper."""
        return await fetch_holding_daily_sentiment(
            ticker, self.sentiment_service, self.news_service, days, timeframe
        )

    async def _fetch_holding_rolling_sentiment(self, ticker: str, timeframe: str = "1W") -> Dict:
        """Legacy compatibility wrapper."""
        return await fetch_holding_rolling_sentiment(
            ticker, self.sentiment_service, self.news_service, timeframe
        )

    async def aggregate_sentiment_by_sector(
        self,
        holdings_list: List[Dict],
    ) -> Dict:
        """
        Aggregate sentiment analysis by sector for a portfolio.

        This method fetches market data and sentiment for each holding,
        then aggregates by sector with value-weighted sentiment scores.

        Extracted from routes.py get_portfolio_sentiment endpoint for reusability.

        Args:
            holdings_list: List of holdings with symbol, quantity fields

        Returns:
            Dictionary with:
            - overall_sentiment: Portfolio-weighted average sentiment score
            - sentiment_by_sector: Sector breakdown with sentiment, holdings count, value, and weight
            - total_portfolio_value: Sum of all holding market values
        """
        try:
            logger.info("Aggregating portfolio sentiment by sector")

            # Aggregate holdings by symbol and fetch sector + sentiment data
            symbol_data = {}  # {symbol: {sector, industry, quantity, market_value, sentiment}}

            for holding in holdings_list:
                symbol = holding.get("symbol", "").upper()
                if not symbol:
                    continue

                quantity = float(holding.get("quantity", 0))
                if quantity == 0:
                    continue

                # Get market price
                try:
                    ticker = yf.Ticker(symbol)
                    info = ticker.info
                    market_price = info.get("currentPrice") or info.get("regularMarketPrice")

                    if not market_price:
                        logger.warning("No market price for %s, skipping", symbol)
                        continue

                    market_value = quantity * float(market_price)

                    # Get sector info
                    sector_info = stock_data_service.get_ticker_sector_info(symbol)
                    sector = sector_info.get("sector", "N/A")
                    industry = sector_info.get("industry", "N/A")

                    # Initialize or update symbol data
                    if symbol not in symbol_data:
                        symbol_data[symbol] = {
                            "sector": sector,
                            "industry": industry,
                            "quantity": 0,
                            "market_value": 0,
                            "sentiment": None
                        }

                    symbol_data[symbol]["quantity"] += quantity
                    symbol_data[symbol]["market_value"] += market_value

                except Exception as e:
                    logger.warning("Error processing %s: %s", symbol, e)
                    continue

            # Fetch sentiment for each symbol in parallel
            async def fetch_symbol_sentiment(symbol: str) -> Tuple[str, Optional[float]]:
                try:
                    news_articles = await self.news_service.get_ticker_news(symbol)
                    if news_articles:
                        sentiment_results = self.sentiment_service.analyze_sentiment_with_momentum(news_articles)
                        return symbol, sentiment_results.get("overall_weighted_score")
                except Exception as e:
                    logger.warning("Sentiment fetch failed for %s: %s", symbol, e)
                return symbol, None

            sentiment_tasks = [fetch_symbol_sentiment(symbol) for symbol in symbol_data.keys()]
            sentiment_results = await asyncio.gather(*sentiment_tasks)

            # Update symbol_data with sentiment scores
            for symbol, sentiment_score in sentiment_results:
                if symbol in symbol_data:
                    symbol_data[symbol]["sentiment"] = sentiment_score

            # Aggregate by sector
            sector_aggregates = defaultdict(lambda: {
                "sentiment_score": 0,
                "holdings_count": 0,
                "total_value": 0,
                "weight_in_portfolio": 0,
                "weighted_sentiment_sum": 0,
                "sentiment_weight_sum": 0
            })

            total_portfolio_value = sum(data["market_value"] for data in symbol_data.values())
            overall_weighted_sentiment = 0
            overall_sentiment_weight = 0

            for symbol, data in symbol_data.items():
                sector = data["sector"]
                if sector == "N/A":
                    continue

                market_value = data["market_value"]
                sentiment = data["sentiment"]

                sector_aggregates[sector]["holdings_count"] += 1
                sector_aggregates[sector]["total_value"] += market_value

                # Weight sentiment by market value
                if sentiment is not None:
                    sector_aggregates[sector]["weighted_sentiment_sum"] += sentiment * market_value
                    sector_aggregates[sector]["sentiment_weight_sum"] += market_value

                    overall_weighted_sentiment += sentiment * market_value
                    overall_sentiment_weight += market_value

            # Calculate final sector metrics
            sentiment_by_sector = {}
            for sector, data in sector_aggregates.items():
                weight_in_portfolio = data["total_value"] / total_portfolio_value if total_portfolio_value > 0 else 0

                # Calculate weighted average sentiment for sector
                if data["sentiment_weight_sum"] > 0:
                    sector_sentiment = data["weighted_sentiment_sum"] / data["sentiment_weight_sum"]
                else:
                    sector_sentiment = None

                sentiment_by_sector[sector] = {
                    "sentiment_score": round(sector_sentiment, 4) if sector_sentiment is not None else None,
                    "holdings_count": data["holdings_count"],
                    "total_value": round(data["total_value"], 2),
                    "weight_in_portfolio": round(weight_in_portfolio, 4)
                }

            # Calculate overall portfolio sentiment
            if overall_sentiment_weight > 0:
                overall_sentiment = overall_weighted_sentiment / overall_sentiment_weight
            else:
                overall_sentiment = None

            logger.info(
                "Processed %d holdings across %d sectors. Overall sentiment: %s",
                len(symbol_data), len(sentiment_by_sector), overall_sentiment
            )

            return {
                "overall_sentiment": round(overall_sentiment, 4) if overall_sentiment is not None else None,
                "sentiment_by_sector": sentiment_by_sector,
                "total_portfolio_value": round(total_portfolio_value, 2),
                "holdings_processed": len(symbol_data),
                "sectors_count": len(sentiment_by_sector)
            }

        except Exception as e:
            logger.error("Error in sector sentiment aggregation: %s", e, exc_info=True)
            raise


# Create singleton instance
portfolio_sentiment_service = PortfolioSentimentService()
