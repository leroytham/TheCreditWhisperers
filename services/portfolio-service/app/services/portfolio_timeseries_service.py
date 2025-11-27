# =============================================================================
# Portfolio Timeseries Service - Historical portfolio value tracking
# =============================================================================

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import asyncio
import logging

from app.core.cache import async_cache_result

logger = logging.getLogger(__name__)


class PortfolioTimeseriesService:
    """
    Generates historical time-series data for portfolios.
    """

    def __init__(self):
        self._ticker_alias_cache: dict[str, str] = {}

    def _get_ticker_candidates(self, ticker: str) -> List[str]:
        """Generate yfinance-friendly ticker candidates."""
        if not ticker:
            return []

        base_symbol = ticker.strip().upper()
        candidates = []

        cached_alias = self._ticker_alias_cache.get(base_symbol)
        if cached_alias:
            candidates.append(cached_alias)

        candidates.append(base_symbol)

        if '.' in base_symbol:
            candidates.append(base_symbol.replace('.', '-'))
        if ' ' in base_symbol:
            candidates.append(base_symbol.replace(' ', '-'))
        if '/PR' in base_symbol:
            candidates.append(base_symbol.replace('/PR', '-P'))

        # Deduplicate
        seen = set()
        deduped = []
        for c in candidates:
            if c and c not in seen:
                deduped.append(c)
                seen.add(c)
        return deduped

    def parse_timeframe_to_delta(self, timeframe: str) -> timedelta:
        """Convert timeframe string to timedelta."""
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
        """Fetch historical price data for a ticker."""
        try:
            if timeframe == "1D":
                interval = "5m"
            elif timeframe == "1W":
                interval = "1h"
            else:
                interval = "1d"

            last_error = None
            for candidate in self._get_ticker_candidates(ticker):
                try:
                    stock = yf.Ticker(candidate)
                    hist = await asyncio.wait_for(
                        asyncio.to_thread(
                            stock.history,
                            start=start_date,
                            end=end_date,
                            interval=interval
                        ),
                        timeout=15.0
                    )

                    if hist.empty:
                        continue

                    if hasattr(hist.index, "tz") and hist.index.tz is not None:
                        hist.index = hist.index.tz_localize(None)

                    if candidate != ticker:
                        logger.info(f"Using ticker alias '{candidate}' for '{ticker}'")
                        self._ticker_alias_cache[ticker.strip().upper()] = candidate

                    return hist[["Close"]]
                except Exception as e:
                    last_error = e
                    continue

            if last_error:
                logger.warning(f"Error fetching prices for {ticker}: {last_error}")
            return None

        except Exception as e:
            logger.error(f"Error fetching prices for {ticker}: {e}")
            return None

    def calculate_position_value(
        self,
        holding: Dict,
        price_data: Optional[pd.DataFrame],
        date: datetime
    ) -> float:
        """Calculate position value on a specific date."""
        if price_data is None or price_data.empty:
            return 0.0

        try:
            date_normalized = pd.Timestamp(date).normalize()
            available_dates = price_data.index[price_data.index <= date_normalized]

            if len(available_dates) == 0:
                return 0.0

            closest_date = available_dates[-1]
            price = float(price_data.loc[closest_date, 'Close'])

            # Calculate quantity owned using lots
            lots = holding.get("lots", [])
            total_quantity = 0.0

            if lots:
                for lot in lots:
                    lot_purchase_date_str = lot.get("purchase_date")
                    lot_quantity = float(lot.get("quantity", 0))

                    if lot_purchase_date_str:
                        try:
                            lot_purchase_date = pd.to_datetime(lot_purchase_date_str).to_pydatetime()
                            if date >= lot_purchase_date:
                                total_quantity += lot_quantity
                        except:
                            total_quantity += lot_quantity
                    else:
                        total_quantity += lot_quantity
            else:
                quantity = float(holding.get("quantity", 0))
                purchase_date_str = holding.get("purchase_date")

                if purchase_date_str:
                    try:
                        purchase_date = pd.to_datetime(purchase_date_str).to_pydatetime()
                        if date >= purchase_date:
                            total_quantity = quantity
                    except:
                        total_quantity = quantity
                else:
                    total_quantity = quantity

            return total_quantity * price

        except Exception as e:
            logger.warning(f"Error calculating position value: {e}")
            return 0.0

    async def generate_portfolio_timeseries(
        self,
        holdings_list: List[Dict],
        timeframe: str = "1Y"
    ) -> Dict:
        """Generate historical time-series data for a portfolio."""
        try:
            end_date = datetime.now()
            delta = self.parse_timeframe_to_delta(timeframe)
            start_date = end_date - delta

            logger.info(f"Generating timeseries: {timeframe}, {start_date.date()} to {end_date.date()}")

            # Aggregate holdings by symbol
            aggregated_holdings = {}
            for h in holdings_list:
                symbol = h.get("symbol", "").upper()
                if not symbol:
                    continue

                qty = float(h.get("quantity", 0))
                purchase_price = float(h.get("purchase_price", 0))
                purchase_date = h.get("purchase_date")
                lots = h.get("lots", [])

                if symbol not in aggregated_holdings:
                    aggregated_holdings[symbol] = {
                        "symbol": symbol,
                        "quantity": 0,
                        "total_cost": 0,
                        "purchase_date": purchase_date,
                        "lots": []
                    }

                aggregated_holdings[symbol]["quantity"] += qty
                aggregated_holdings[symbol]["total_cost"] += qty * purchase_price

                if lots:
                    aggregated_holdings[symbol]["lots"].extend(lots)
                else:
                    aggregated_holdings[symbol]["lots"].append({
                        "quantity": qty,
                        "purchase_price": purchase_price,
                        "purchase_date": purchase_date
                    })

            for symbol, data in aggregated_holdings.items():
                if data["quantity"] > 0:
                    data["purchase_price"] = data["total_cost"] / data["quantity"]

            holdings = list(aggregated_holdings.values())

            # Fetch prices in parallel
            tasks = [
                self.fetch_historical_prices(h["symbol"], start_date, end_date, timeframe)
                for h in holdings
            ]
            historical_prices = await asyncio.gather(*tasks)

            price_data_map: Dict[str, pd.DataFrame] = {}
            missing_symbols: List[str] = []

            for holding, price_df in zip(holdings, historical_prices):
                symbol = holding["symbol"]
                if price_df is None or (hasattr(price_df, "empty") and price_df.empty):
                    missing_symbols.append(symbol)
                else:
                    price_data_map[symbol] = price_df

            logger.info(f"Price data for {len(price_data_map)}/{len(holdings)} holdings")

            # Generate date range
            date_range = pd.date_range(start=start_date, end=end_date, freq='D')

            data_points = []
            prev_value = None

            for date in date_range:
                portfolio_value = 0.0

                for holding in holdings:
                    symbol = holding["symbol"]
                    price_data = price_data_map.get(symbol)
                    if price_data is not None:
                        portfolio_value += self.calculate_position_value(
                            holding, price_data, date.to_pydatetime()
                        )

                daily_return = None
                if prev_value is not None and prev_value > 0:
                    daily_return = ((portfolio_value - prev_value) / prev_value) * 100

                data_points.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "portfolio_value": round(portfolio_value, 2),
                    "daily_return": round(daily_return, 4) if daily_return is not None else None
                })

                prev_value = portfolio_value

            # Add cumulative return
            if len(data_points) > 0:
                start_value = data_points[0]["portfolio_value"]
                end_value = data_points[-1]["portfolio_value"]
                cumulative_return = ((end_value - start_value) / start_value) * 100 if start_value > 0 else 0
                data_points[-1]["cumulative_return"] = round(cumulative_return, 2)

            return {
                "timeframe": timeframe,
                "data_points": data_points,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "missing_price_symbols": missing_symbols
            }

        except Exception as e:
            logger.error(f"Error generating timeseries: {e}")
            return {"timeframe": timeframe, "data_points": [], "error": str(e)}

    @async_cache_result(ttl=600, key_prefix="benchmark_timeseries")
    async def fetch_benchmark_timeseries(
        self,
        timeframe: str = "1Y",
        benchmark_ticker: str = "^GSPC"
    ) -> Dict:
        """Fetch benchmark timeseries (S&P 500 by default)."""
        try:
            end_date = datetime.now()
            delta = self.parse_timeframe_to_delta(timeframe)
            start_date = end_date - delta

            if timeframe == "1D":
                interval = "5m"
            elif timeframe == "1W":
                interval = "1h"
            else:
                interval = "1d"

            benchmark = yf.Ticker(benchmark_ticker)
            hist = await asyncio.wait_for(
                asyncio.to_thread(
                    benchmark.history,
                    start=start_date,
                    end=end_date,
                    interval=interval
                ),
                timeout=30.0
            )

            if hist.empty:
                return {"timeframe": timeframe, "benchmark_ticker": benchmark_ticker, "data_points": []}

            hist.index = hist.index.tz_localize(None)
            start_value = float(hist['Close'].iloc[0])

            data_points = []
            for date, row in hist.iterrows():
                current_value = float(row['Close'])
                percent_return = ((current_value - start_value) / start_value) * 100 if start_value > 0 else 0

                data_points.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "close": round(percent_return, 4),
                    "value": round(current_value, 2)
                })

            return {
                "timeframe": timeframe,
                "benchmark_ticker": benchmark_ticker,
                "data_points": data_points,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "start_value": round(start_value, 2)
            }

        except asyncio.TimeoutError:
            logger.error(f"Benchmark fetch timeout for {benchmark_ticker}")
            return {"timeframe": timeframe, "benchmark_ticker": benchmark_ticker, "data_points": [], "error": "timeout"}
        except Exception as e:
            logger.error(f"Error fetching benchmark: {e}")
            return {"timeframe": timeframe, "benchmark_ticker": benchmark_ticker, "data_points": [], "error": str(e)}


portfolio_timeseries_service = PortfolioTimeseriesService()
