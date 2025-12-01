# app/services/holding_enrichment_service.py
"""
Holding enrichment service for portfolio data.

This service handles fetching and enriching holding data with:
- Market prices and day change metrics
- News volume and sentiment scores
- Sector and industry information
- Profit/loss calculations

Extracted from routes.py fetch_holding_data to improve code organization and reusability.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Tuple

import yfinance as yf

from app.services.stock_data_service import stock_data_service

logger = logging.getLogger(__name__)


class HoldingEnrichmentService:
    """
    Service for enriching holding data with market data, news sentiment, and sector info.

    This service consolidates parallel data fetching for individual holdings,
    providing a clean interface for the portfolio holdings endpoint.
    """

    def __init__(self):
        self.stock_data_service = stock_data_service

    async def enrich_holding(
        self,
        symbol: str,
        total_qty: float,
        avg_cost: float,
        news_fetcher: callable = None,
        news_timeframe: str = "1W"
    ) -> Dict:
        """
        Fetch market price, news, and sector data in parallel for a symbol.

        Args:
            symbol: Stock ticker symbol
            total_qty: Total quantity held
            avg_cost: Average cost basis per share
            news_fetcher: Async callable to fetch news data (e.g., get_news_data)
            news_timeframe: Timeframe for news fetching

        Returns:
            Dictionary with enriched holding data including market price,
            profit/loss, sentiment, and sector information.
        """
        logger.debug(f"[HOLDING-ENRICHMENT] Starting parallel fetch for {symbol}")

        try:
            # Build parallel tasks
            tasks = [self._fetch_market_data(symbol)]

            if news_fetcher:
                tasks.append(news_fetcher(symbol, timeframe=news_timeframe))
            else:
                tasks.append(asyncio.sleep(0))  # Placeholder

            # Execute in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)

            market_data = results[0]
            news_data = results[1] if news_fetcher else None

            # Process market data
            market_metrics = self._process_market_data(market_data)

            # Calculate profit/loss
            pl_metrics = self._calculate_profit_loss(
                market_metrics.get("market_price"),
                avg_cost,
                total_qty
            )

            # Process news data
            sentiment_metrics = self._process_news_data(news_data, symbol)

            # Fetch sector info (cached, fast)
            sector_info = self._fetch_sector_info(symbol)

            # Build 52-week range object
            range52week = None
            if market_metrics.get("fifty_two_week_high") and market_metrics.get("fifty_two_week_low"):
                range52week = {
                    "low": float(market_metrics["fifty_two_week_low"]),
                    "high": float(market_metrics["fifty_two_week_high"])
                }

            # Calculate position value
            market_price = market_metrics.get("market_price")
            position_value = market_price * total_qty if market_price else avg_cost * total_qty

            return {
                "symbol": symbol,
                "quantity": round(total_qty, 2),
                "averageCostPrice": f"{avg_cost:,.1f}",
                "marketPrice": f"{market_price:,.1f}" if market_price else None,
                "profitLoss": f"{pl_metrics['absolute']:,.1f}" if pl_metrics['absolute'] is not None else None,
                "gainLossPercent": float(pl_metrics['percent']) if pl_metrics['percent'] is not None else None,
                "isPositive": pl_metrics['is_positive'],
                "newsVolume": sentiment_metrics["news_volume"],
                "sentiment": f"{sentiment_metrics['avg_score']:,.2f}",
                "sentimentMomentum": sentiment_metrics.get("momentum"),
                "range52week": range52week,
                "position": f"{position_value:,.1f}",
                "day_change_percent": market_metrics.get("day_change_percent"),
                "day_change_value": market_metrics.get("day_change_value"),
                "previous_close": market_metrics.get("previous_close"),
                "sector": sector_info.get("sector", "N/A"),
                "industry": sector_info.get("industry", "N/A")
            }

        except Exception as e:
            logger.error(f"[HOLDING-ENRICHMENT] Processing failed for {symbol}: {e}", exc_info=True)
            return self._create_error_response(symbol, total_qty, avg_cost)

    async def enrich_holdings_batch(
        self,
        holdings: List[Dict],
        news_fetcher: callable = None,
        news_timeframe: str = "1W"
    ) -> List[Dict]:
        """
        Enrich multiple holdings in parallel.

        Args:
            holdings: List of dicts with 'symbol', 'quantity', 'avg_cost' keys
            news_fetcher: Async callable to fetch news data
            news_timeframe: Timeframe for news fetching

        Returns:
            List of enriched holding dictionaries
        """
        tasks = [
            self.enrich_holding(
                h["symbol"],
                h["quantity"],
                h["avg_cost"],
                news_fetcher,
                news_timeframe
            )
            for h in holdings
        ]

        return await asyncio.gather(*tasks, return_exceptions=True)

    async def _fetch_market_data(self, symbol: str) -> Optional[Dict]:
        """Fetch current market data for a symbol."""
        try:
            return await self.stock_data_service.get_current_market_price(symbol)
        except Exception as e:
            logger.warning(f"[HOLDING-ENRICHMENT] Market data failed for {symbol}: {e}")
            return None

    def _process_market_data(self, market_data: Optional[Dict]) -> Dict:
        """Process raw market data into structured metrics."""
        if isinstance(market_data, Exception) or market_data is None:
            return {
                "market_price": None,
                "day_change_value": None,
                "day_change_percent": None,
                "previous_close": None,
                "fifty_two_week_high": None,
                "fifty_two_week_low": None
            }

        return {
            "market_price": round(market_data.get("market_price", 0), 2),
            "day_change_value": (
                round(market_data.get("day_change_value", 0), 2)
                if market_data.get("day_change_value") is not None else None
            ),
            "day_change_percent": (
                round(market_data.get("day_change_percent", 0), 2)
                if market_data.get("day_change_percent") is not None else None
            ),
            "previous_close": market_data.get("previous_close"),
            "fifty_two_week_high": market_data.get("fifty_two_week_high"),
            "fifty_two_week_low": market_data.get("fifty_two_week_low")
        }

    def _calculate_profit_loss(
        self,
        market_price: Optional[float],
        avg_cost: float,
        quantity: float
    ) -> Dict:
        """
        Calculate profit/loss metrics.

        Args:
            market_price: Current market price (or None)
            avg_cost: Average cost basis per share
            quantity: Number of shares

        Returns:
            Dict with 'absolute', 'percent', and 'is_positive' keys
        """
        if market_price is None:
            return {"absolute": None, "percent": None, "is_positive": None}

        absolute = round((market_price - avg_cost) * quantity, 2)
        percent = round(((market_price - avg_cost) / avg_cost) * 100, 2) if avg_cost > 0 else 0
        is_positive = bool(absolute >= 0)

        return {
            "absolute": absolute,
            "percent": percent,
            "is_positive": is_positive
        }

    def _process_news_data(self, news_data: Optional[Dict], symbol: str) -> Dict:
        """Process raw news data into sentiment metrics."""
        if isinstance(news_data, Exception) or news_data is None:
            logger.warning(f"[HOLDING-ENRICHMENT] News fetch failed for {symbol}")
            return {
                "avg_score": 0,
                "sentiment_label": "N/A",
                "news_volume": 0,
                "momentum": None
            }

        avg_score = news_data.get("avg_score", 0)
        articles = news_data.get("news", [])
        momentum = news_data.get("sentiment_momentum")

        # Derive qualitative sentiment label
        if avg_score > 0.2:
            sentiment_label = "Positive"
        elif avg_score < -0.2:
            sentiment_label = "Negative"
        else:
            sentiment_label = "Neutral"

        news_volume = len(articles)
        logger.debug(f"[HOLDING-ENRICHMENT] News fetched for {symbol}: {news_volume} articles, sentiment={avg_score:.2f}")

        return {
            "avg_score": avg_score,
            "sentiment_label": sentiment_label,
            "news_volume": news_volume,
            "momentum": float(momentum) if momentum is not None else None
        }

    def _fetch_sector_info(self, symbol: str) -> Dict:
        """Fetch sector and industry information (cached, synchronous)."""
        try:
            sector_info = self.stock_data_service.get_ticker_sector_info(symbol)
            return {
                "sector": sector_info.get("sector", "N/A"),
                "industry": sector_info.get("industry", "N/A")
            }
        except Exception as e:
            logger.warning(f"[HOLDING-ENRICHMENT] Sector fetch failed for {symbol}: {e}")
            return {"sector": "N/A", "industry": "N/A"}

    def _create_error_response(self, symbol: str, quantity: float, avg_cost: float) -> Dict:
        """Create minimal response when enrichment fails."""
        return {
            "symbol": symbol,
            "quantity": round(quantity, 2),
            "averageCostPrice": f"{avg_cost:,.1f}",
            "marketPrice": None,
            "profitLoss": None,
            "gainLossPercent": None,
            "isPositive": None,
            "newsVolume": 0,
            "sentiment": "0.00",
            "sentimentMomentum": None,
            "range52week": None,
            "position": f"{avg_cost * quantity:,.1f}",
            "day_change_percent": None,
            "day_change_value": None,
            "previous_close": None,
            "sector": "N/A",
            "industry": "N/A"
        }

    def derive_sentiment_label(self, sentiment_score: float) -> str:
        """
        Derive qualitative sentiment label from score.

        Args:
            sentiment_score: Numeric sentiment score

        Returns:
            'Positive', 'Negative', or 'Neutral'
        """
        if sentiment_score > 0.2:
            return "Positive"
        elif sentiment_score < -0.2:
            return "Negative"
        return "Neutral"


# Create singleton instance
holding_enrichment_service = HoldingEnrichmentService()
