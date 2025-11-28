# app/services/portfolio_timeseries_service.py

import yfinance as yf
import pandas as pd
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import asyncio

from app.core.cache import async_cache_result

logger = logging.getLogger(__name__)


class PortfolioTimeseriesService:
    """
    Service for generating historical time-series data for portfolios.
    Fetches historical prices for all holdings and calculates daily portfolio values.
    """

    def __init__(self):
        # Cache resolved yfinance ticker aliases to avoid repeated fallback lookups
        self._ticker_alias_cache: dict[str, str] = {}

    def _get_ticker_candidates(self, ticker: str) -> List[str]:
        """
        Generate yfinance-friendly ticker candidates for symbols that include
        characters like '.' which often need to be converted to '-' for class shares.

        Args:
            ticker: Original ticker symbol from holdings data

        Returns:
            Ordered list of candidate ticker strings (deduplicated)
        """
        if not ticker:
            return []

        base_symbol = ticker.strip().upper()
        candidates: List[str] = []

        # If we already resolved an alias for this ticker, try it first
        cached_alias = self._ticker_alias_cache.get(base_symbol)
        if cached_alias:
            candidates.append(cached_alias)

        candidates.append(base_symbol)

        # Replace dot notation used by custodians for share classes with yfinance dash
        if '.' in base_symbol:
            candidates.append(base_symbol.replace('.', '-'))

        # Replace space-delimited class notation (e.g. "BRK B") with dash
        if ' ' in base_symbol:
            candidates.append(base_symbol.replace(' ', '-'))

        # Handle preferred share notation that sometimes arrives as "PR" suffix
        if '/PR' in base_symbol:
            candidates.append(base_symbol.replace('/PR', '-P'))

        # Deduplicate while preserving order
        deduped: List[str] = []
        seen = set()
        for candidate in candidates:
            if candidate and candidate not in seen:
                deduped.append(candidate)
                seen.add(candidate)

        return deduped

    def parse_timeframe_to_delta(self, timeframe: str) -> timedelta:
        """
        Converts timeframe string to timedelta.

        Args:
            timeframe: One of "1D", "1W", "1M", "6M", "YTD", "1Y", "3Y", "5Y"

        Returns:
            timedelta for the specified timeframe
        """
        today = datetime.now()

        timeframe_map = {
            "1D": timedelta(days=1),
            "1W": timedelta(days=7),
            "1M": timedelta(days=30),
            "3M": timedelta(days=90),
            "6M": timedelta(days=180),
            "1Y": timedelta(days=365),
            "3Y": timedelta(days=1095),
            "5Y": timedelta(days=1825),
        }

        # Special handling for YTD
        if timeframe == "YTD":
            start_of_year = datetime(today.year, 1, 1)
            return today - start_of_year

        return timeframe_map.get(timeframe, timedelta(days=365))

    async def fetch_historical_prices(
        self,
        ticker: str,
        start_date: datetime,
        end_date: datetime,
        timeframe: str = "1Y"
    ) -> Optional[pd.DataFrame]:
        """
        Fetches historical price data for a single ticker.

        Args:
            ticker: Stock ticker symbol
            start_date: Start date for historical data
            end_date: End date for historical data
            timeframe: Timeframe for determining interval (e.g., "1D", "1W", "1M", "1Y")

        Returns:
            DataFrame with historical prices (Date/Time, Close) or None if error
        """
        try:
            # Determine appropriate interval based on timeframe
            if timeframe == "1D":
                interval = "5m"  # 5-minute intervals for intraday
            elif timeframe == "1W":
                interval = "1h"  # Hourly intervals for 1 week
            else:
                interval = "1d"  # Daily intervals for longer periods

            last_error = None
            for candidate in self._get_ticker_candidates(ticker):
                try:
                    stock = yf.Ticker(candidate)
                    # Run blocking yfinance call in thread pool to prevent event loop blocking
                    hist = await asyncio.wait_for(
                        asyncio.to_thread(
                            stock.history,
                            start=start_date,
                            end=end_date,
                            interval=interval
                        ),
                        timeout=15.0  # 15 second timeout per ticker attempt
                    )

                    if hist.empty:
                        continue

                    # Drop timezone info so downstream date comparisons stay naive
                    if hasattr(hist.index, "tz") and hist.index.tz is not None:
                        hist.index = hist.index.tz_localize(None)

                    if candidate != ticker:
                        logger.debug("Using ticker alias '%s' for '%s' historical data", candidate, ticker)
                        self._ticker_alias_cache[ticker.strip().upper()] = candidate

                    return hist[["Close"]]
                except Exception as candidate_error:  # pragma: no cover - defensive logging
                    last_error = candidate_error
                    continue

            if last_error:
                logger.error("Error fetching historical prices for %s: %s", ticker, last_error)
            else:
                logger.warning("No historical data for %s", ticker)
            return None

        except Exception as e:
            logger.error("Error fetching historical prices for %s: %s", ticker, e)
            return None

    def calculate_position_value(
        self,
        holding: Dict,
        price_data: Optional[pd.DataFrame],
        date: datetime
    ) -> float:
        """
        Calculates the value of a position on a specific date using lot-level tracking.

        Args:
            holding: Holding dict with symbol, quantity, purchase_price, purchase_date, and lots array
            price_data: DataFrame with historical prices
            date: Date to calculate value for

        Returns:
            Position value in dollars
        """
        # Get price for this date first
        if price_data is None or price_data.empty:
            return 0.0

        try:
            # Find the closest available price (forward fill for weekends/holidays)
            date_normalized = pd.Timestamp(date).normalize()

            # Get all dates up to and including target date
            available_dates = price_data.index[price_data.index <= date_normalized]

            if len(available_dates) == 0:
                return 0.0

            # Use the most recent available price
            closest_date = available_dates[-1]
            price = float(price_data.loc[closest_date, 'Close'])

            # Calculate quantity owned on this date using lot-level data
            lots = holding.get("lots", [])
            total_quantity = 0.0

            if lots:
                # Use lot-level tracking for accurate position calculation
                for lot in lots:
                    lot_purchase_date_str = lot.get("purchase_date")
                    lot_quantity = float(lot.get("quantity", 0))

                    if lot_purchase_date_str:
                        try:
                            lot_purchase_date = pd.to_datetime(lot_purchase_date_str).to_pydatetime()
                            # Only count this lot if it was purchased on or before this date
                            if date >= lot_purchase_date:
                                total_quantity += lot_quantity
                        except (ValueError, TypeError) as e:
                            # If parse fails, include the lot (conservative approach)
                            logger.debug(f"Date parsing failed for lot, using fallback: {e}")
                            total_quantity += lot_quantity
                    else:
                        # If no purchase date, include the lot
                        total_quantity += lot_quantity
            else:
                # Fallback for backward compatibility: Use aggregate purchase_date
                # This handles holdings that haven't been migrated to lot tracking yet
                quantity = float(holding.get("quantity", 0))
                purchase_date_str = holding.get("purchase_date")

                if purchase_date_str:
                    try:
                        purchase_date = pd.to_datetime(purchase_date_str).to_pydatetime()
                        # Only count position if purchased on or before this date
                        if date >= purchase_date:
                            total_quantity = quantity
                    except (ValueError, TypeError) as e:
                        logger.debug(f"Date parsing failed for holding, using fallback: {e}")
                        total_quantity = quantity
                else:
                    total_quantity = quantity

            return total_quantity * price

        except Exception as e:
            logger.warning("Error calculating position value for %s: %s", holding.get('symbol'), e)
            return 0.0

    def calculate_lot_breakdown(
        self,
        holding: Dict,
        price_data: Optional[pd.DataFrame],
        date: datetime,
        period_start_date: datetime
    ) -> List[Dict]:
        """
        Calculate per-lot breakdown for hybrid denominator calculation.

        Args:
            holding: Holding dict with symbol, quantity, purchase_price, purchase_date, and lots
            price_data: DataFrame with historical prices
            date: Current date to calculate value for
            period_start_date: Start date of the period (for determining pre/in-period)

        Returns:
            List of lot details with market value, cost basis, and start value
        """
        if price_data is None or price_data.empty:
            return []

        try:
            # Get current price for this date
            date_normalized = pd.Timestamp(date).normalize()
            available_dates = price_data.index[price_data.index <= date_normalized]

            if len(available_dates) == 0:
                return []

            closest_date = available_dates[-1]
            current_price = float(price_data.loc[closest_date, 'Close'])

            # Get price at period start for pre-period holdings
            start_date_normalized = pd.Timestamp(period_start_date).normalize()
            start_dates = price_data.index[price_data.index <= start_date_normalized]

            start_price = current_price  # Default to current if no start data
            if len(start_dates) > 0:
                start_closest = start_dates[-1]
                start_price = float(price_data.loc[start_closest, 'Close'])

            lot_breakdown = []
            lots = holding.get("lots", [])
            symbol = holding.get("symbol", "")

            if lots:
                # Use lot-level data
                for lot in lots:
                    lot_purchase_date_str = lot.get("purchase_date")
                    lot_quantity = float(lot.get("quantity", 0))
                    lot_cost_basis = float(lot.get("purchase_price", 0))

                    if lot_purchase_date_str:
                        try:
                            lot_purchase_date = pd.to_datetime(lot_purchase_date_str).to_pydatetime()

                            # Only include if lot was owned on this date
                            if date < lot_purchase_date:
                                continue

                            # Determine if this is a pre-period lot
                            is_pre_period = lot_purchase_date < period_start_date

                            # Calculate start value using hybrid logic
                            if is_pre_period:
                                # Use market value at period start
                                start_value = lot_quantity * start_price
                            else:
                                # Use cost basis for in-period purchases
                                start_value = lot_quantity * lot_cost_basis

                            lot_breakdown.append({
                                "symbol": symbol,
                                "lot_id": lot.get("lot_id", ""),
                                "quantity": lot_quantity,
                                "market_value": lot_quantity * current_price,
                                "cost_basis": lot_quantity * lot_cost_basis,
                                "purchase_date": lot_purchase_date.strftime("%Y-%m-%d"),
                                "is_pre_period": is_pre_period,
                                "start_value": start_value,
                                "current_price": current_price,
                                "purchase_price": lot_cost_basis
                            })
                        except (ValueError, TypeError) as e:
                            # If date parsing fails, include the lot conservatively
                            logger.debug(f"Date parsing failed for lot breakdown, using conservative fallback: {e}")
                            lot_breakdown.append({
                                "symbol": symbol,
                                "lot_id": lot.get("lot_id", ""),
                                "quantity": lot_quantity,
                                "market_value": lot_quantity * current_price,
                                "cost_basis": lot_quantity * lot_cost_basis,
                                "purchase_date": lot_purchase_date_str,
                                "is_pre_period": True,
                                "start_value": lot_quantity * start_price,
                                "current_price": current_price,
                                "purchase_price": lot_cost_basis
                            })
            else:
                # Fallback: No lots array, use aggregate data
                quantity = float(holding.get("quantity", 0))
                purchase_price = float(holding.get("purchase_price", 0))
                purchase_date_str = holding.get("purchase_date")

                if quantity > 0:
                    is_pre_period = True
                    if purchase_date_str:
                        try:
                            purchase_date = pd.to_datetime(purchase_date_str).to_pydatetime()
                            is_pre_period = purchase_date < period_start_date
                        except (ValueError, TypeError) as e:
                            logger.debug(f"Date parsing failed for aggregate holding: {e}")
                            # Keep is_pre_period = True as conservative default

                    start_value = quantity * start_price if is_pre_period else quantity * purchase_price

                    lot_breakdown.append({
                        "symbol": symbol,
                        "lot_id": "aggregate",
                        "quantity": quantity,
                        "market_value": quantity * current_price,
                        "cost_basis": quantity * purchase_price,
                        "purchase_date": purchase_date_str or "",
                        "is_pre_period": is_pre_period,
                        "start_value": start_value,
                        "current_price": current_price,
                        "purchase_price": purchase_price
                    })

            return lot_breakdown

        except Exception as e:
            logger.warning("Error calculating lot breakdown for %s: %s", holding.get('symbol'), e)
            return []

    async def generate_portfolio_timeseries(
        self,
        holdings_list: List[Dict],
        timeframe: str = "1Y",
        open_date: Optional[str] = None,
        db = None,
        username: str = None,
        account_name: str = None
    ) -> Dict:
        """
        Generates historical time-series data for a portfolio with capital flow tracking and TWR.

        Args:
            holdings_list: List of holdings with symbol, quantity, purchase_price, purchase_date
            timeframe: Time period for historical data
            open_date: Portfolio open date (optional, for ITD calculation)
            db: Database connection (optional, required for capital flow tracking)
            username: Username (optional, required for capital flow tracking)
            account_name: Account name (optional, required for capital flow tracking)

        Returns:
            Dictionary with timeframe, data_points array, and optional TWR data
        """
        try:
            end_date = datetime.now()
            delta = self.parse_timeframe_to_delta(timeframe)
            start_date = end_date - delta

            logger.info("Portfolio timeseries generation - Timeframe: %s, Start: %s, End: %s, Holdings: %d",
                        timeframe, start_date.date(), end_date.date(), len(holdings_list))

            # Aggregate holdings by symbol (handle duplicates, preserve lots)
            aggregated_holdings = {}
            for h in holdings_list:
                symbol = h.get("symbol", "").upper()
                if not symbol:
                    continue

                qty = float(h.get("quantity", 0))
                purchase_price = float(h.get("purchase_price", 0))
                purchase_date = h.get("purchase_date")
                lots = h.get("lots", [])  # Get lot-level data

                if symbol not in aggregated_holdings:
                    aggregated_holdings[symbol] = {
                        "symbol": symbol,
                        "quantity": 0,
                        "total_cost": 0,
                        "purchase_date": purchase_date,  # Use earliest purchase date
                        "lots": []  # Preserve lot-level information
                    }

                aggregated_holdings[symbol]["quantity"] += qty
                aggregated_holdings[symbol]["total_cost"] += qty * purchase_price

                # Preserve lot-level data for accurate position tracking
                if lots:
                    aggregated_holdings[symbol]["lots"].extend(lots)
                else:
                    # Fallback: If no lots array, create a single lot from aggregate data
                    # This handles backward compatibility with existing holdings
                    aggregated_holdings[symbol]["lots"].append({
                        "quantity": qty,
                        "purchase_price": purchase_price,
                        "purchase_date": purchase_date
                    })

            # Calculate average cost for each holding
            for symbol, data in aggregated_holdings.items():
                if data["quantity"] > 0:
                    data["purchase_price"] = data["total_cost"] / data["quantity"]

            holdings = list(aggregated_holdings.values())
            logger.debug("Aggregated to %d unique holdings", len(holdings))

            # Fetch historical prices for all holdings in parallel
            tasks = [
                self.fetch_historical_prices(h["symbol"], start_date, end_date, timeframe)
                for h in holdings
            ]

            historical_prices = await asyncio.gather(*tasks)

            price_data_map: Dict[str, pd.DataFrame] = {}
            missing_price_symbols: List[str] = []

            for holding, price_df in zip(holdings, historical_prices):
                symbol = holding["symbol"]
                if isinstance(price_df, Exception) or price_df is None:
                    missing_price_symbols.append(symbol)
                    continue

                if hasattr(price_df, "empty") and price_df.empty:
                    missing_price_symbols.append(symbol)
                    continue

                price_data_map[symbol] = price_df

            if missing_price_symbols:
                logger.warning("Missing historical data for symbols: %s", missing_price_symbols)

            logger.info("Successfully fetched price data for %d holdings", len(price_data_map))

            # Generate date range (business days only)
            date_range = pd.date_range(start=start_date, end=end_date, freq='D')

            # Calculate portfolio value for each date
            data_points = []
            prev_value = None

            for date in date_range:
                # Calculate total portfolio value for this date
                portfolio_value = 0.0
                all_lot_breakdowns = []  # Collect lot breakdowns for all holdings

                for holding in holdings:
                    symbol = holding["symbol"]
                    price_data = price_data_map.get(symbol)

                    if price_data is not None:
                        position_value = self.calculate_position_value(
                            holding,
                            price_data,
                            date.to_pydatetime()
                        )
                        portfolio_value += position_value

                        # Calculate lot breakdown for this holding
                        lot_breakdown = self.calculate_lot_breakdown(
                            holding,
                            price_data,
                            date.to_pydatetime(),
                            start_date
                        )
                        all_lot_breakdowns.extend(lot_breakdown)

                # Include all dates, even when portfolio value is zero (e.g., fully liquidated)
                # Calculate daily return
                daily_return = None
                if prev_value is not None and prev_value > 0:
                    daily_return = ((portfolio_value - prev_value) / prev_value) * 100

                # Include time fields for intraday data (1D, 1W)
                if timeframe in ["1D", "1W"]:
                    data_points.append({
                        "date": date.strftime("%Y-%m-%d"),
                        "time": date.strftime("%H:%M:%S"),
                        "datetime": date.strftime("%Y-%m-%d %H:%M:%S"),
                        "portfolio_value": round(portfolio_value, 2),
                        "daily_return": round(daily_return, 4) if daily_return is not None else None,
                        "lot_breakdown": all_lot_breakdowns  # Include lot-level data
                    })
                else:
                    # Regular daily data
                    data_points.append({
                        "date": date.strftime("%Y-%m-%d"),
                        "portfolio_value": round(portfolio_value, 2),
                        "daily_return": round(daily_return, 4) if daily_return is not None else None,
                        "lot_breakdown": all_lot_breakdowns  # Include lot-level data
                    })

                prev_value = portfolio_value

            # Calculate cumulative return from start to end
            if len(data_points) > 0:
                start_value = data_points[0]["portfolio_value"]
                end_value = data_points[-1]["portfolio_value"]
                cumulative_return = ((end_value - start_value) / start_value) * 100 if start_value > 0 else 0

                # Add cumulative return to last data point
                data_points[-1]["cumulative_return"] = round(cumulative_return, 2)

            logger.debug("Generated %d data points", len(data_points))

            # Add capital flow tracking and TWR calculation if db connection provided
            twr_data = None
            if db is not None and username and account_name:
                try:
                    # Query transactions for capital flows (DEPOSIT, WITHDRAWAL)
                    from app.models.transaction import get_cash_flows_between_dates
                    from app.services.twr_calculator_service import twr_calculator_service
                    from datetime import date as date_type

                    # Get cash flows for the period
                    cash_flows = await get_cash_flows_between_dates(
                        db,
                        username,
                        account_name,
                        start_date.date() if isinstance(start_date, datetime) else start_date,
                        end_date.date() if isinstance(end_date, datetime) else end_date
                    )

                    # Create a map of date -> capital_flow
                    capital_flow_map = {}
                    for flow in cash_flows:
                        flow_date = flow["date"]
                        date_str = flow_date.isoformat() if hasattr(flow_date, 'isoformat') else str(flow_date)
                        if date_str not in capital_flow_map:
                            capital_flow_map[date_str] = 0.0
                        capital_flow_map[date_str] += flow["amount"]

                    # Add capital_flow field to each data point
                    for point in data_points:
                        point_date = point["date"]
                        point["capital_flow"] = capital_flow_map.get(point_date, 0.0)

                    # Calculate TWR using the TWR calculator service
                    twr_result = await twr_calculator_service.calculate_twr(
                        username,
                        account_name,
                        start_date.date() if isinstance(start_date, datetime) else start_date,
                        end_date.date() if isinstance(end_date, datetime) else end_date,
                        db
                    )

                    twr_data = twr_result

                    logger.info("Added capital flow tracking: %d flows", len(cash_flows))
                    if twr_result.get("twr_return") is not None:
                        logger.info("Calculated TWR: %.2f%%", twr_result['twr_return'])

                except Exception as e:
                    logger.warning("Error adding capital flow/TWR data: %s", e, exc_info=True)
                    # Continue without capital flow data

            result = {
                "timeframe": timeframe,
                "data_points": data_points,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "missing_price_symbols": missing_price_symbols
            }

            # Add TWR data if available
            if twr_data:
                result["twr"] = twr_data

            return result

        except Exception as e:
            logger.error("Error generating portfolio timeseries: %s", e, exc_info=True)
            return {
                "timeframe": timeframe,
                "data_points": [],
                "error": str(e)
            }

    @async_cache_result(ttl=300, key_prefix="benchmark_timeseries")  # Cache for 5 minutes
    async def fetch_benchmark_timeseries(
        self,
        timeframe: str = "1Y",
        benchmark_ticker: str = "^GSPC"
    ) -> Dict:
        """
        Fetches historical time-series data for a benchmark index (default: S&P 500).
        Returns percentage returns normalized to start at 0%.

        Args:
            timeframe: Time period for historical data (1D, 1W, 1M, 6M, YTD, 1Y)
            benchmark_ticker: Ticker symbol for benchmark (default: ^GSPC for S&P 500)

        Returns:
            Dictionary with timeframe, data_points array (normalized to % returns)
        """
        import time
        import logging
        logger = logging.getLogger(__name__)

        fetch_start = time.time()
        logger.info(f"[BENCHMARK-TIMESERIES] Fetching {benchmark_ticker} for timeframe={timeframe}")

        try:
            end_date = datetime.now()
            delta = self.parse_timeframe_to_delta(timeframe)
            start_date = end_date - delta

            logger.debug(f"[BENCHMARK-TIMESERIES] Date range: {start_date.date()} to {end_date.date()}")

            # Determine appropriate interval based on timeframe (same logic as fetch_historical_prices)
            if timeframe == "1D":
                interval = "5m"  # 5-minute intervals for intraday
            elif timeframe == "1W":
                interval = "1h"  # Hourly intervals for 1 week
            else:
                interval = "1d"  # Daily intervals for longer periods

            # Fetch benchmark data with timeout protection
            try:
                logger.debug(f"[BENCHMARK-TIMESERIES] Calling yfinance with timeout=30s for {benchmark_ticker}")
                benchmark = yf.Ticker(benchmark_ticker)
                # Run blocking yfinance call in thread pool to prevent event loop blocking
                hist = await asyncio.wait_for(
                    asyncio.to_thread(
                        benchmark.history,
                        start=start_date,
                        end=end_date,
                        interval=interval
                    ),
                    timeout=30.0  # 30 second timeout
                )
                yf_elapsed_ms = (time.time() - fetch_start) * 1000
                logger.debug(f"[BENCHMARK-TIMESERIES] yfinance returned {len(hist)} records in {yf_elapsed_ms:.0f}ms")
            except asyncio.TimeoutError:
                elapsed_ms = (time.time() - fetch_start) * 1000
                logger.error(f"[BENCHMARK-TIMESERIES-TIMEOUT] {benchmark_ticker} timed out after {elapsed_ms:.0f}ms (30s limit)")
                return {
                    "timeframe": timeframe,
                    "benchmark_ticker": benchmark_ticker,
                    "data_points": [],
                    "error": "Request timeout - Yahoo Finance not responding"
                }
            except Exception as e:
                elapsed_ms = (time.time() - fetch_start) * 1000
                logger.error(f"[BENCHMARK-TIMESERIES-ERROR] Failed to fetch {benchmark_ticker} after {elapsed_ms:.0f}ms: {e}")
                return {
                    "timeframe": timeframe,
                    "benchmark_ticker": benchmark_ticker,
                    "data_points": [],
                    "error": str(e)
                }

            if hist.empty:
                logger.warning("No historical data for benchmark %s", benchmark_ticker)
                return {
                    "timeframe": timeframe,
                    "benchmark_ticker": benchmark_ticker,
                    "data_points": [],
                    "error": "No data available"
                }

            # Remove timezone info
            hist.index = hist.index.tz_localize(None)

            # Get starting value for normalization
            if len(hist) == 0:
                return {
                    "timeframe": timeframe,
                    "benchmark_ticker": benchmark_ticker,
                    "data_points": []
                }

            start_value = float(hist['Close'].iloc[0])

            # Generate data points with percentage returns normalized to 0%
            data_points = []
            for date, row in hist.iterrows():
                current_value = float(row['Close'])
                percent_return = ((current_value - start_value) / start_value) * 100 if start_value > 0 else 0

                data_points.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "close": round(percent_return, 4),  # % return from start
                    "value": round(current_value, 2)  # Absolute index value
                })

            fetch_elapsed_ms = (time.time() - fetch_start) * 1000
            final_return = data_points[-1]['close'] if data_points else 0.0
            logger.info(f"[BENCHMARK-TIMESERIES] Successfully fetched {benchmark_ticker} in {fetch_elapsed_ms:.0f}ms: {len(data_points)} points, return={final_return:.2f}%")

            return {
                "timeframe": timeframe,
                "benchmark_ticker": benchmark_ticker,
                "data_points": data_points,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "start_value": round(start_value, 2)
            }

        except Exception as e:
            logger.error("Error fetching benchmark timeseries: %s", e, exc_info=True)
            return {
                "timeframe": timeframe,
                "benchmark_ticker": benchmark_ticker,
                "data_points": [],
                "error": str(e)
            }


# Create singleton instance
portfolio_timeseries_service = PortfolioTimeseriesService()
