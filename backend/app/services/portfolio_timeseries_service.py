# app/services/portfolio_timeseries_service.py

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import asyncio

from app.core.cache import async_cache_result


class PortfolioTimeseriesService:
    """
    Service for generating historical time-series data for portfolios.
    Fetches historical prices for all holdings and calculates daily portfolio values.
    """

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

            stock = yf.Ticker(ticker)
            hist = stock.history(start=start_date, end=end_date, interval=interval)

            if hist.empty:
                print(f"⚠️ No historical data for {ticker}")
                return None

            # Keep timezone info for intraday data (needed for time display)
            # For daily data, remove timezone
            if interval in ["1m", "5m", "15m", "1h"]:
                # Return Close with datetime index (includes time)
                return hist[['Close']]
            else:
                # For daily data, remove timezone
                hist.index = hist.index.tz_localize(None)
                return hist[['Close']]

        except Exception as e:
            print(f"❌ Error fetching historical prices for {ticker}: {e}")
            return None

    def calculate_position_value(
        self,
        holding: Dict,
        price_data: Optional[pd.DataFrame],
        date: datetime
    ) -> float:
        """
        Calculates the value of a position on a specific date.

        Args:
            holding: Holding dict with symbol, quantity, purchase_price, purchase_date
            price_data: DataFrame with historical prices
            date: Date to calculate value for

        Returns:
            Position value in dollars
        """
        quantity = float(holding.get("quantity", 0))

        if quantity == 0:
            return 0.0

        # Check if holding was owned on this date
        purchase_date_str = holding.get("purchase_date")
        if purchase_date_str:
            try:
                purchase_date = pd.to_datetime(purchase_date_str).to_pydatetime()
                # If not yet purchased, position value is 0
                if date < purchase_date:
                    return 0.0
            except:
                pass  # If parse fails, assume holding was always owned

        # Get price for this date
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

            return quantity * price

        except Exception as e:
            print(f"⚠️ Error calculating position value for {holding.get('symbol')}: {e}")
            return 0.0

    async def generate_portfolio_timeseries(
        self,
        holdings_list: List[Dict],
        timeframe: str = "1Y",
        open_date: Optional[str] = None
    ) -> Dict:
        """
        Generates historical time-series data for a portfolio.

        Args:
            holdings_list: List of holdings with symbol, quantity, purchase_price, purchase_date
            timeframe: Time period for historical data
            open_date: Portfolio open date (optional, for ITD calculation)

        Returns:
            Dictionary with timeframe and data_points array
        """
        try:
            end_date = datetime.now()
            delta = self.parse_timeframe_to_delta(timeframe)
            start_date = end_date - delta

            print(f"\n=== PORTFOLIO TIMESERIES GENERATION ===")
            print(f"Timeframe: {timeframe}")
            print(f"Start: {start_date.date()}, End: {end_date.date()}")
            print(f"Holdings: {len(holdings_list)}")

            # Aggregate holdings by symbol (handle duplicates)
            aggregated_holdings = {}
            for h in holdings_list:
                symbol = h.get("symbol", "").upper()
                if not symbol:
                    continue

                qty = float(h.get("quantity", 0))
                purchase_price = float(h.get("purchase_price", 0))
                purchase_date = h.get("purchase_date")

                if symbol not in aggregated_holdings:
                    aggregated_holdings[symbol] = {
                        "symbol": symbol,
                        "quantity": 0,
                        "total_cost": 0,
                        "purchase_date": purchase_date  # Use first purchase date
                    }

                aggregated_holdings[symbol]["quantity"] += qty
                aggregated_holdings[symbol]["total_cost"] += qty * purchase_price

            # Calculate average cost for each holding
            for symbol, data in aggregated_holdings.items():
                if data["quantity"] > 0:
                    data["purchase_price"] = data["total_cost"] / data["quantity"]

            holdings = list(aggregated_holdings.values())
            print(f"Aggregated to {len(holdings)} unique holdings")

            # Fetch historical prices for all holdings in parallel
            tasks = [
                self.fetch_historical_prices(h["symbol"], start_date, end_date, timeframe)
                for h in holdings
            ]

            historical_prices = await asyncio.gather(*tasks)

            # Map ticker to its price data
            price_data_map = {
                holdings[i]["symbol"]: historical_prices[i]
                for i in range(len(holdings))
                if historical_prices[i] is not None
            }

            print(f"Successfully fetched price data for {len(price_data_map)} holdings")

            # Generate date range (business days only)
            date_range = pd.date_range(start=start_date, end=end_date, freq='D')

            # Calculate portfolio value for each date
            data_points = []
            prev_value = None

            for date in date_range:
                # Calculate total portfolio value for this date
                portfolio_value = 0.0

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

                # Only include dates where portfolio had value
                if portfolio_value > 0:
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
                            "daily_return": round(daily_return, 4) if daily_return is not None else None
                        })
                    else:
                        # Regular daily data
                        data_points.append({
                            "date": date.strftime("%Y-%m-%d"),
                            "portfolio_value": round(portfolio_value, 2),
                            "daily_return": round(daily_return, 4) if daily_return is not None else None
                        })

                    prev_value = portfolio_value

            # Calculate cumulative return from start to end
            if len(data_points) > 0:
                start_value = data_points[0]["portfolio_value"]
                end_value = data_points[-1]["portfolio_value"]
                cumulative_return = ((end_value - start_value) / start_value) * 100 if start_value > 0 else 0

                # Add cumulative return to last data point
                data_points[-1]["cumulative_return"] = round(cumulative_return, 2)

            print(f"Generated {len(data_points)} data points")

            return {
                "timeframe": timeframe,
                "data_points": data_points,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d")
            }

        except Exception as e:
            print(f"❌ Error generating portfolio timeseries: {e}")
            import traceback
            traceback.print_exc()
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
        try:
            end_date = datetime.now()
            delta = self.parse_timeframe_to_delta(timeframe)
            start_date = end_date - delta

            print(f"\n=== BENCHMARK TIMESERIES GENERATION ===")
            print(f"Benchmark: {benchmark_ticker}")
            print(f"Timeframe: {timeframe}")
            print(f"Start: {start_date.date()}, End: {end_date.date()}")

            # Determine appropriate interval based on timeframe (same logic as fetch_historical_prices)
            if timeframe == "1D":
                interval = "5m"  # 5-minute intervals for intraday
            elif timeframe == "1W":
                interval = "1h"  # Hourly intervals for 1 week
            else:
                interval = "1d"  # Daily intervals for longer periods

            # Fetch benchmark data
            benchmark = yf.Ticker(benchmark_ticker)
            hist = benchmark.history(start=start_date, end=end_date, interval=interval)

            if hist.empty:
                print(f"⚠️ No historical data for benchmark {benchmark_ticker}")
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

            print(f"Generated {len(data_points)} benchmark data points")
            print(f"Start value: {start_value:.2f}, End return: {data_points[-1]['close']:.2f}%")

            return {
                "timeframe": timeframe,
                "benchmark_ticker": benchmark_ticker,
                "data_points": data_points,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "start_value": round(start_value, 2)
            }

        except Exception as e:
            print(f"❌ Error fetching benchmark timeseries: {e}")
            import traceback
            traceback.print_exc()
            return {
                "timeframe": timeframe,
                "benchmark_ticker": benchmark_ticker,
                "data_points": [],
                "error": str(e)
            }


# Create singleton instance
portfolio_timeseries_service = PortfolioTimeseriesService()
