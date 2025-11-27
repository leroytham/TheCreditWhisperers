# =============================================================================
# Stock Data Service
# =============================================================================
# Handles fetching and caching of stock market data

import pandas as pd
from datetime import datetime
import yfinance as yf
from yahooquery import Ticker as YQTicker
import aiohttp
import os
import logging

from app.core.config import settings
from app.core.cache import cache_result, async_cache_result
from app.core.http_client import http_client
from app.core.circuit_breaker import get_circuit_breaker, CircuitBreakerOpenError

logger = logging.getLogger(__name__)


class StockDataService:
    """
    Service for fetching and filtering stock market data.
    Handles historical price data, company info, and ETF constituents.
    """

    def __init__(self):
        self.alpha_vantage_api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        if not self.alpha_vantage_api_key:
            logger.warning("ALPHA_VANTAGE_API_KEY not found")

    @cache_result(ttl=settings.PRICE_CACHE_TTL, key_prefix="stock_data")
    def get_stock_data(self, ticker: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame | None:
        """
        Downloads historical stock data for a ticker.
        Cached for PRICE_CACHE_TTL seconds.
        """
        try:
            ticker_obj = yf.Ticker(ticker)
            data = ticker_obj.history(period=period, interval=interval)
            if data.empty:
                return None
            data.index = data.index.tz_localize(None)
            return data
        except Exception as e:
            logger.error(f"Error fetching stock data for {ticker}: {e}")
            return None

    def filter_data_by_timeframe(self, df: pd.DataFrame, timeframe: str) -> pd.DataFrame | None:
        """
        Filters a DataFrame based on a timeframe string.
        Timeframes: "1D", "1M", "3M", "6M", "1Y", "YTD"
        """
        if df is None or df.empty:
            return df

        if timeframe == "1D":
            return df

        today = pd.Timestamp.now().normalize()
        df_dates = df.index.normalize()
        df_without_today = df[df_dates < today]

        time_deltas = {
            "1M": 29,
            "3M": 89,
            "6M": 179,
            "1Y": 364,
        }

        if timeframe in time_deltas:
            start_date = today - pd.Timedelta(days=time_deltas[timeframe])
            df_without_today_dates = df_without_today.index.normalize()
            return df_without_today[df_without_today_dates >= start_date]
        elif timeframe == "YTD":
            start_date = pd.Timestamp(year=today.year, month=1, day=1).normalize()
            df_without_today_dates = df_without_today.index.normalize()
            return df_without_today[df_without_today_dates >= start_date]
        else:
            return df_without_today

    @cache_result(ttl=settings.SECTOR_CACHE_TTL, key_prefix="sector_constituents")
    def get_sector_constituents(self, etf_ticker: str, limit: int = 30) -> list[dict]:
        """
        Fetches holdings for a given ETF ticker.
        Cached for SECTOR_CACHE_TTL seconds.
        """
        try:
            etf = YQTicker(etf_ticker)
            holdings_data = etf.fund_holding_info

            if not holdings_data or "holdings" not in holdings_data.get(etf_ticker, {}):
                return []

            holdings = holdings_data[etf_ticker]["holdings"]
            all_symbols = [h.get("symbol") for h in holdings if h.get("symbol")]

            if not all_symbols:
                return []

            batch_client = YQTicker(all_symbols)
            price_data = batch_client.price or {}
            summary_detail = getattr(batch_client, "summary_detail", {}) or {}

            constituents: list[dict] = []
            for h in holdings:
                symbol = h.get("symbol")
                if not symbol:
                    continue

                price_entry = price_data.get(symbol)
                if not price_entry:
                    continue

                summary_entry = summary_detail.get(symbol, {})

                constituents.append({
                    "symbol": symbol,
                    "name": price_entry.get("shortName") or h.get("holdingName"),
                    "price": price_entry.get("regularMarketPrice"),
                    "percentChange": price_entry.get("regularMarketChangePercent"),
                    "percentOfAssets": h.get("holdingPercent"),
                    "marketCap": price_entry.get("marketCap"),
                    "volume": price_entry.get("regularMarketVolume"),
                    "avgVolume": price_entry.get("averageVolume"),
                    "dayHigh": price_entry.get("regularMarketDayHigh"),
                    "dayLow": price_entry.get("regularMarketDayLow"),
                    "fiftyTwoWeekHigh": price_entry.get("fiftyTwoWeekHigh") or summary_entry.get("fiftyTwoWeekHigh"),
                    "fiftyTwoWeekLow": price_entry.get("fiftyTwoWeekLow") or summary_entry.get("fiftyTwoWeekLow"),
                    "peRatio": price_entry.get("trailingPE"),
                    "dividendYield": price_entry.get("dividendYield"),
                    "sector": price_entry.get("sector"),
                    "industry": price_entry.get("industry"),
                })

            # Sort by market cap
            constituents.sort(key=lambda x: float(x.get("marketCap") or 0), reverse=True)
            return constituents[:limit]

        except Exception as e:
            logger.error(f"Error fetching constituents for {etf_ticker}: {e}")
            return []

    @cache_result(ttl=settings.COMPANY_INFO_CACHE_TTL, key_prefix="company_info")
    def get_company_info(self, ticker: str) -> dict | None:
        """
        Gets company information for a ticker.
        Cached for 24 hours.
        """
        try:
            ticker_obj = yf.Ticker(ticker)
            info = ticker_obj.info
            return {
                "name": info.get("longName", ticker),
                "currency": info.get("currency", "USD"),
                "symbol": info.get("symbol", ticker),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "marketCap": info.get("marketCap"),
                "description": info.get("longBusinessSummary"),
            }
        except Exception as e:
            logger.error(f"Error fetching company info for {ticker}: {e}")
            return None

    @async_cache_result(ttl=settings.PRICE_CACHE_TTL, key_prefix="market_price")
    async def get_current_market_price(self, ticker: str) -> dict | None:
        """
        Get current market price with day change and 52-week range.
        Cached for 5 minutes.
        """
        try:
            ticker_obj = yf.Ticker(ticker)
            info = ticker_obj.info

            market_price = info.get("regularMarketPrice") or info.get("currentPrice")

            if market_price is None:
                hist = ticker_obj.history(period="1d")
                if hist.empty:
                    return None
                market_price = float(hist["Close"].iloc[-1])
            else:
                market_price = float(market_price)

            previous_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
            fifty_two_week_high = info.get("fiftyTwoWeekHigh")
            fifty_two_week_low = info.get("fiftyTwoWeekLow")

            day_change_value = None
            day_change_percent = None
            if market_price and previous_close:
                day_change_value = float(market_price - previous_close)
                day_change_percent = float((day_change_value / previous_close) * 100)

            return {
                "ticker": ticker,
                "market_price": market_price,
                "previous_close": previous_close,
                "day_change_value": day_change_value,
                "day_change_percent": day_change_percent,
                "fifty_two_week_high": fifty_two_week_high,
                "fifty_two_week_low": fifty_two_week_low,
            }
        except Exception as e:
            logger.error(f"Error fetching market price for {ticker}: {e}")
            return None

    @async_cache_result(ttl=settings.PRICE_CACHE_TTL, key_prefix="historical_price")
    async def get_historical_price(self, ticker: str, start_date: str, end_date: str) -> dict | None:
        """
        Get historical price data for a specific date range.
        Cached for 5 minutes.
        """
        try:
            ticker_obj = yf.Ticker(ticker)
            hist = ticker_obj.history(start=start_date, end=end_date)

            if hist.empty:
                return None

            return {
                "ticker": ticker,
                "start_price": float(hist['Close'].iloc[0]) if len(hist) > 0 else None,
                "end_price": float(hist['Close'].iloc[-1]) if len(hist) > 0 else None,
                "start_date": start_date,
                "end_date": end_date,
            }
        except Exception as e:
            logger.error(f"Error fetching historical price for {ticker}: {e}")
            return None

    @async_cache_result(ttl=86400, key_prefix="company_overview")
    async def get_company_overview(self, ticker: str) -> dict | None:
        """
        Fetch comprehensive company overview from Alpha Vantage API.
        Cached for 24 hours.
        """
        if not self.alpha_vantage_api_key:
            logger.warning(f"Cannot fetch company overview for {ticker}: API key not configured")
            return None

        cb = get_circuit_breaker("alpha_vantage")
        url = (
            f"https://www.alphavantage.co/query?"
            f"function=OVERVIEW&symbol={ticker}&apikey={self.alpha_vantage_api_key}"
        )

        async def _make_request():
            session = await http_client.get_session()
            async with session.get(url) as response:
                if response.status != 200:
                    raise aiohttp.ClientResponseError(
                        response.request_info,
                        response.history,
                        status=response.status
                    )
                return await response.json()

        try:
            data = await cb.call(_make_request)

            if not data or "Symbol" not in data:
                logger.warning(f"No company overview data for {ticker}")
                return None

            return data

        except CircuitBreakerOpenError:
            logger.warning(f"[ALPHA_VANTAGE] Circuit breaker open for {ticker}")
            return None
        except Exception as e:
            logger.error(f"Error fetching company overview for {ticker}: {e}")
            return None


# Singleton instance
stock_data_service = StockDataService()
