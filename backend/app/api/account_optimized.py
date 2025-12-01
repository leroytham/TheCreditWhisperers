# app/api/account_optimized.py
"""
Optimized portfolio account details endpoint with comprehensive performance metrics.
"""

import asyncio
import logging
import time
import uuid
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from fastapi import HTTPException, Query
import yfinance as yf
import pandas as pd

from app.services.batch_services import (
    batch_market_service,
    batch_sector_service
)
from app.services.cache_manager import get_cache_manager
from app.api.portfolio_optimized import portfolio_service
from app.core.cache import async_cache_result

logger = logging.getLogger(__name__)


class OptimizedAccountService:
    """
    Service for optimized portfolio account operations with comprehensive metrics.
    """

    def __init__(self):
        self.cache_manager = get_cache_manager()
        self._benchmark_cache = {}  # Cache for benchmark data

    @async_cache_result(ttl=30, key_prefix="portfolio_account")
    async def get_portfolio_account_details(
        self,
        username: str,
        account_name: str,
        timeframe: str = "1Y",
        include_timeseries: bool = True,
        include_events: bool = False,
        request_id: Optional[str] = None
    ) -> Dict:
        """
        Get comprehensive portfolio account details with performance metrics.

        Args:
            username: User identifier
            account_name: Account name
            timeframe: Time period for metrics
            include_timeseries: Whether to include historical data
            include_events: Whether to include dividend/split events
            request_id: Unique request ID for caching

        Returns:
            Comprehensive account details with performance metrics
        """
        start_time = time.time()
        request_id = request_id or str(uuid.uuid4())[:8]
        request_cache = self.cache_manager.get_request_cache(request_id)

        logger.info(f"[ACCOUNT-OPT-{request_id}] Starting account fetch for {username}/{account_name}")

        try:
            # Import here to avoid circular dependency
            from app.database import get_holdings_collection_async, get_accounts_collection_async
            holdings_col = get_holdings_collection_async()
            accounts_col = get_accounts_collection_async()

            # Fetch account info
            account_info = await accounts_col.find_one({
                "username": username,
                "client_account_name": account_name
            })

            if not account_info:
                raise HTTPException(status_code=404, detail="Account not found")

            # Fetch holdings in parallel with account metrics
            tasks = []

            # Task 1: Get holdings summary
            tasks.append(portfolio_service.get_portfolio_holdings(
                username, account_name, request_id, page=1, page_size=1000
            ))

            # Task 2: Calculate period returns
            tasks.append(self._calculate_period_returns(
                holdings_col, username, account_name, request_cache
            ))

            # Task 3: Get benchmark performance
            tasks.append(self._get_benchmark_performance(timeframe, request_cache))

            # Execute all tasks in parallel
            holdings_result, period_returns, benchmark_data = await asyncio.gather(*tasks)

            # Extract holdings data
            holdings = holdings_result["holdings"]
            total_value = sum(h["positionValue"] for h in holdings)
            total_cost = sum(h["quantity"] * h["averageCostPrice"] for h in holdings)

            # Calculate portfolio metrics
            portfolio_metrics = self._calculate_portfolio_metrics(
                holdings, total_value, total_cost
            )

            # Build response
            result = {
                "account": {
                    "username": username,
                    "accountName": account_name,
                    "accountType": account_info.get("account_type", "INDIVIDUAL"),
                    "openDate": account_info.get("open_date"),
                    "status": account_info.get("status", "ACTIVE")
                },
                "portfolio": {
                    "totalValue": round(total_value, 2),
                    "totalCost": round(total_cost, 2),
                    "totalProfitLoss": portfolio_metrics["total_pl"],
                    "totalProfitLossPercent": portfolio_metrics["total_pl_percent"],
                    "dayChange": portfolio_metrics["day_change"],
                    "dayChangePercent": portfolio_metrics["day_change_percent"],
                    "holdingsCount": len(holdings),
                    "uniqueSymbols": len(set(h["symbol"] for h in holdings))
                },
                "performance": {
                    "periods": period_returns,
                    "benchmark": benchmark_data,
                    "outperformance": self._calculate_outperformance(
                        period_returns, benchmark_data
                    )
                },
                "allocation": {
                    "bySector": portfolio_metrics["sector_allocation"],
                    "byAssetClass": portfolio_metrics["asset_allocation"],
                    "concentration": portfolio_metrics["concentration"]
                },
                "risk": {
                    "volatility": None,  # Would need historical data
                    "beta": None,        # Would need correlation calc
                    "sharpeRatio": None  # Would need risk-free rate
                },
                "topMovers": {
                    "gainers": portfolio_metrics["top_gainers"],
                    "losers": portfolio_metrics["top_losers"],
                    "byVolume": portfolio_metrics["top_by_volume"]
                }
            }

            # Add optional timeseries data
            if include_timeseries:
                timeseries_data = await self._get_portfolio_timeseries(
                    holdings, timeframe, request_cache
                )
                result["timeseries"] = timeseries_data

            # Add optional events data
            if include_events:
                events_data = await self._get_portfolio_events(
                    holdings, timeframe, request_cache
                )
                result["events"] = events_data

            elapsed_ms = (time.time() - start_time) * 1000
            result["metadata"] = {
                "request_id": request_id,
                "response_time_ms": round(elapsed_ms, 1),
                "timeframe": timeframe,
                "cache_stats": request_cache.get_stats()
            }

            logger.info(f"[ACCOUNT-OPT-{request_id}] Completed in {elapsed_ms:.0f}ms")
            return result

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[ACCOUNT-OPT-{request_id}] Error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

        finally:
            self.cache_manager.cleanup_request_cache(request_id)

    async def _calculate_period_returns(
        self,
        holdings_col,
        username: str,
        account_name: str,
        request_cache
    ) -> Dict:
        """Calculate returns for standard periods (MTD, QTD, YTD, ITD)."""
        cache_key = request_cache.get_key("period_returns", username, account_name)
        cached = request_cache.get(cache_key)
        if cached:
            return cached

        today = datetime.now()
        periods = {
            "1D": today - timedelta(days=1),
            "1W": today - timedelta(days=7),
            "MTD": today.replace(day=1),
            "QTD": today - timedelta(days=90),
            "YTD": today.replace(month=1, day=1),
            "1Y": today - timedelta(days=365)
        }

        # Fetch holdings
        holdings_cursor = holdings_col.find({
            "username": username,
            "client_account_name": account_name
        })
        holdings_list = await holdings_cursor.to_list(length=None)

        if not holdings_list:
            return {period: {"return": 0, "value": 0} for period in periods}

        # Get unique symbols
        symbols = list(set(h.get("symbol", "").upper() for h in holdings_list if h.get("symbol")))

        # Batch fetch current prices
        current_prices = await batch_market_service.get_batch_current_prices(symbols)

        # Calculate returns for each period
        returns = {}
        for period_name, start_date in periods.items():
            period_return = await self._calculate_single_period_return(
                holdings_list, current_prices, start_date, today
            )
            returns[period_name] = period_return

        request_cache.set(cache_key, returns)
        return returns

    async def _calculate_single_period_return(
        self,
        holdings_list: List[Dict],
        current_prices: Dict,
        start_date: datetime,
        end_date: datetime
    ) -> Dict:
        """Calculate return for a single period."""
        total_start_value = 0
        total_end_value = 0

        for holding in holdings_list:
            symbol = holding.get("symbol", "").upper()
            quantity = float(holding.get("quantity", 0))
            purchase_price = float(holding.get("purchase_price", 0))
            purchase_date_str = holding.get("purchase_date", "")

            if purchase_date_str:
                purchase_date = datetime.strptime(purchase_date_str, "%Y-%m-%d")
            else:
                purchase_date = end_date

            # Get current price
            market_data = current_prices.get(symbol)
            if not market_data:
                continue

            current_price = market_data.get("market_price")
            if not current_price:
                continue

            # Determine start value
            if purchase_date >= start_date:
                # Bought during period - use purchase price
                start_value = quantity * purchase_price
            else:
                # Owned before period - would need historical price
                # For simplification, using purchase price
                start_value = quantity * purchase_price

            end_value = quantity * current_price

            total_start_value += start_value
            total_end_value += end_value

        if total_start_value > 0:
            period_return = ((total_end_value - total_start_value) / total_start_value) * 100
        else:
            period_return = 0

        return {
            "return": round(period_return, 2),
            "startValue": round(total_start_value, 2),
            "endValue": round(total_end_value, 2)
        }

    async def _get_benchmark_performance(
        self,
        timeframe: str,
        request_cache
    ) -> Dict:
        """Get S&P 500 benchmark performance."""
        cache_key = request_cache.get_key("benchmark", timeframe)
        cached = request_cache.get(cache_key)
        if cached:
            return cached

        try:
            # Map timeframe to period for yfinance
            period_map = {
                "1D": "1d",
                "1W": "5d",
                "1M": "1mo",
                "3M": "3mo",
                "6M": "6mo",
                "YTD": "ytd",
                "1Y": "1y",
                "3Y": "3y",
                "5Y": "5y"
            }

            period = period_map.get(timeframe, "1y")

            # Fetch S&P 500 data
            sp500 = yf.Ticker("^GSPC")
            hist = await asyncio.to_thread(
                sp500.history,
                period=period
            )

            if len(hist) >= 2:
                start_price = float(hist['Close'].iloc[0])
                end_price = float(hist['Close'].iloc[-1])
                benchmark_return = ((end_price - start_price) / start_price) * 100

                result = {
                    "symbol": "^GSPC",
                    "name": "S&P 500",
                    "return": round(benchmark_return, 2),
                    "startPrice": round(start_price, 2),
                    "endPrice": round(end_price, 2)
                }
            else:
                result = {
                    "symbol": "^GSPC",
                    "name": "S&P 500",
                    "return": 0,
                    "error": "Insufficient data"
                }

            request_cache.set(cache_key, result)
            return result

        except Exception as e:
            logger.error(f"Benchmark fetch failed: {e}")
            return {
                "symbol": "^GSPC",
                "name": "S&P 500",
                "return": 0,
                "error": str(e)
            }

    def _calculate_portfolio_metrics(
        self,
        holdings: List[Dict],
        total_value: float,
        total_cost: float
    ) -> Dict:
        """Calculate various portfolio metrics."""
        # Basic P&L
        total_pl = sum(h["profitLoss"] or 0 for h in holdings)
        total_pl_percent = (total_pl / total_cost * 100) if total_cost > 0 else 0

        # Day change
        day_change = sum(
            (h["dayChangeValue"] or 0) * h["quantity"]
            for h in holdings
        )
        day_change_percent = (day_change / total_value * 100) if total_value > 0 else 0

        # Sector allocation
        sector_allocation = {}
        for holding in holdings:
            sector = holding["sector"]
            if sector != "N/A":
                if sector not in sector_allocation:
                    sector_allocation[sector] = {
                        "value": 0,
                        "percentage": 0,
                        "holdings": 0
                    }
                sector_allocation[sector]["value"] += holding["positionValue"]
                sector_allocation[sector]["holdings"] += 1

        # Calculate sector percentages
        for sector, data in sector_allocation.items():
            data["percentage"] = round((data["value"] / total_value) * 100, 2)
            data["value"] = round(data["value"], 2)

        # Asset allocation (simplified - would need more data)
        asset_allocation = {
            "stocks": {
                "value": total_value,
                "percentage": 100.0
            }
        }

        # Concentration metrics
        sorted_holdings = sorted(holdings, key=lambda x: x["positionValue"], reverse=True)
        top_10_value = sum(h["positionValue"] for h in sorted_holdings[:10])
        top_10_concentration = (top_10_value / total_value * 100) if total_value > 0 else 0

        # Top movers
        top_gainers = sorted(
            [h for h in holdings if (h["profitLossPercent"] or 0) > 0],
            key=lambda x: x["profitLossPercent"] or 0,
            reverse=True
        )[:5]

        top_losers = sorted(
            [h for h in holdings if (h["profitLossPercent"] or 0) < 0],
            key=lambda x: x["profitLossPercent"] or 0
        )[:5]

        top_by_volume = sorted(
            holdings,
            key=lambda x: x["newsVolume"],
            reverse=True
        )[:5]

        return {
            "total_pl": round(total_pl, 2),
            "total_pl_percent": round(total_pl_percent, 2),
            "day_change": round(day_change, 2),
            "day_change_percent": round(day_change_percent, 2),
            "sector_allocation": sector_allocation,
            "asset_allocation": asset_allocation,
            "concentration": {
                "top10Percentage": round(top_10_concentration, 2),
                "largestPosition": sorted_holdings[0]["symbol"] if sorted_holdings else None,
                "largestPositionPercentage": round(
                    (sorted_holdings[0]["positionValue"] / total_value * 100), 2
                ) if sorted_holdings else 0
            },
            "top_gainers": [
                {
                    "symbol": h["symbol"],
                    "return": h["profitLossPercent"],
                    "value": h["positionValue"]
                }
                for h in top_gainers
            ],
            "top_losers": [
                {
                    "symbol": h["symbol"],
                    "return": h["profitLossPercent"],
                    "value": h["positionValue"]
                }
                for h in top_losers
            ],
            "top_by_volume": [
                {
                    "symbol": h["symbol"],
                    "newsVolume": h["newsVolume"],
                    "sentiment": h["sentiment"]
                }
                for h in top_by_volume
            ]
        }

    def _calculate_outperformance(
        self,
        period_returns: Dict,
        benchmark_data: Dict
    ) -> Dict:
        """Calculate outperformance vs benchmark."""
        benchmark_return = benchmark_data.get("return", 0)
        outperformance = {}

        for period, data in period_returns.items():
            period_return = data.get("return", 0)
            outperformance[period] = round(period_return - benchmark_return, 2)

        return outperformance

    async def _get_portfolio_timeseries(
        self,
        holdings: List[Dict],
        timeframe: str,
        request_cache
    ) -> Dict:
        """Get simplified timeseries data for portfolio value."""
        # This would normally fetch detailed historical data
        # Simplified for optimization
        return {
            "timeframe": timeframe,
            "dataPoints": [],
            "message": "Detailed timeseries available via separate endpoint"
        }

    async def _get_portfolio_events(
        self,
        holdings: List[Dict],
        timeframe: str,
        request_cache
    ) -> List[Dict]:
        """Get portfolio events (dividends, splits, etc.)."""
        # This would normally fetch dividend and split data
        # Simplified for optimization
        return []


# Create singleton service instance
account_service = OptimizedAccountService()


# FastAPI route function
async def get_optimized_portfolio_account(
    username: str,
    account_name: str,
    timeframe: str = Query("1Y", regex="^(1D|1W|1M|3M|6M|YTD|1Y|3Y|5Y)$"),
    include_timeseries: bool = Query(False),
    include_events: bool = Query(False)
):
    """
    Optimized endpoint for comprehensive portfolio account details.
    """
    return await account_service.get_portfolio_account_details(
        username=username,
        account_name=account_name,
        timeframe=timeframe,
        include_timeseries=include_timeseries,
        include_events=include_events
    )