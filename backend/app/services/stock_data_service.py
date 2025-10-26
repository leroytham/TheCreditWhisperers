# app/services/stock_data_service.py

import pandas as pd
from datetime import datetime, timedelta
import yfinance as yf
from yahooquery import Ticker as YQTicker
import aiohttp
import os
from dotenv import load_dotenv

from app.core.cache import cache_result, async_cache_result
from app.core.config import settings

load_dotenv()


class StockDataService:
    """
    Service for fetching and filtering stock market data.
    Handles historical price data, timeframe filtering, and sector constituents.
    """

    def __init__(self):
        # Sector-to-ETF mapping for S&P 500 sectors
        self.sector_etf_map = {
            '^GSPC': 'SPY',       # S&P 500 (All Sectors)
            '^SP500-25': 'XLY',   # Consumer Discretionary
            '^SP500-30': 'XLP',   # Consumer Staples
            '^SP500-35': 'XLV',   # Health Care
            '^SP500-40': 'XLF',   # Financials
            '^SP500-45': 'XLK',   # Tech
            '^SP500-50': 'XLC',   # Communication Services
            '^SP500-55': 'XLU',   # Utilities
            '^SP500-60': 'XLRE',  # Real Estate
            '^SP500-15': 'XLB',   # Materials
            '^SP500-20': 'XLI',   # Industrials
            '^GSPE': 'XLE',       # Energy
        }
        
        # Load Alpha Vantage API key for company overview
        self.alpha_vantage_api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        if not self.alpha_vantage_api_key:
            print("WARNING: ALPHA_VANTAGE_API_KEY not found. Company overview service will be disabled.")

    @cache_result(ttl=settings.PRICE_CACHE_TTL, key_prefix="stock_data")
    def get_stock_data(self, ticker: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame | None:
        """
        Downloads historical stock data for a ticker.
        Results are cached in Redis for PRICE_CACHE_TTL seconds.

        Args:
            ticker: Stock ticker symbol
            period: Time period (e.g., "1y", "6mo", "1d")
            interval: Data interval (e.g., "1d", "1h", "5m")

        Returns:
            DataFrame with historical stock data or None if error
        """
        try:
            ticker_obj = yf.Ticker(ticker)
            data = ticker_obj.history(period=period, interval=interval)
            if data.empty:
                return None
            # Make timezone naive for easier processing
            data.index = data.index.tz_localize(None)
            return data
        except Exception as e:
            print(f"Error fetching stock data for {ticker}: {e}")
            return None

    def filter_data_by_timeframe(self, df: pd.DataFrame, timeframe: str) -> pd.DataFrame | None:
        """
        Filters a DataFrame based on a timeframe string.

        Args:
            df: DataFrame with datetime index
            timeframe: One of "1D", "1M", "6M", "1Y", "YTD", "5Y"

        Returns:
            Filtered DataFrame or original if timeframe not recognized
        """
        if df is None or df.empty:
            return df

        # For 1D intraday data, return all data without filtering
        if timeframe == "1D":
            return df

        # For daily timeframes (1M, 6M, YTD, 1Y, 5Y), exclude today's incomplete data
        # Only show completed trading days (yesterday and before)

        # Get today's date (normalize to remove time component and handle timezone)
        today = pd.Timestamp.now().normalize()

        print(f"[DEBUG filter_data_by_timeframe] Timeframe: {timeframe}")
        print(f"[DEBUG filter_data_by_timeframe] Today's date: {today}")
        print(f"[DEBUG filter_data_by_timeframe] Input df length: {len(df)}")
        print(f"[DEBUG filter_data_by_timeframe] DataFrame index timezone: {df.index.tz}")

        if len(df) >= 3:
            print(f"[DEBUG filter_data_by_timeframe] Last 3 dates before filtering: {df.index[-3:].tolist()}")

        # Normalize the dataframe index to date only (remove time component)
        df_dates = df.index.normalize()

        # First, exclude any data from today or future (only keep data before today)
        df_without_today = df[df_dates < today]

        print(f"[DEBUG filter_data_by_timeframe] After removing today: {len(df_without_today)} rows")
        if len(df_without_today) > 0:
            print(f"[DEBUG filter_data_by_timeframe] Last date after removing today: {df_without_today.index[-1]}")

        time_deltas = {
            "1M": 29,
            "6M": 179,
            "1Y": 364,
            "5Y": 1824  # Approximately 5 years
        }

        if timeframe in time_deltas:
            start_date = today - pd.Timedelta(days=time_deltas[timeframe])
            # Use normalized dates for comparison
            df_without_today_dates = df_without_today.index.normalize()
            result = df_without_today[df_without_today_dates >= start_date]
        elif timeframe == "YTD":
            start_date = pd.Timestamp(year=today.year, month=1, day=1).normalize()
            df_without_today_dates = df_without_today.index.normalize()
            result = df_without_today[df_without_today_dates >= start_date]
        else:
            # Return the dataframe without today if timeframe is not recognized
            result = df_without_today

        print(f"[DEBUG filter_data_by_timeframe] Final result length: {len(result)}")
        if len(result) > 0:
            print(f"[DEBUG filter_data_by_timeframe] Final last date: {result.index[-1]}")

        return result

    @cache_result(ttl=settings.SECTOR_CACHE_TTL, key_prefix="sector_constituents_v2")
    def get_sector_top_constituents(self, sector_ticker: str) -> list[dict]:
        """
        Fetches all holdings for a given S&P 500 sector ticker.
        Results are cached in Redis for SECTOR_CACHE_TTL seconds.

        Args:
            sector_ticker: S&P 500 sector ticker (e.g., "^SP500-45" for Tech)

        Returns:
            List of dictionaries containing constituent information

        Raises:
            ValueError: If sector ticker is invalid or unsupported
        """
        etf_ticker = self.sector_etf_map.get(sector_ticker)
        if not etf_ticker:
            raise ValueError(f"Invalid or unsupported sector ticker: {sector_ticker}")

        try:
            etf = YQTicker(etf_ticker)
            holdings_data = etf.fund_holding_info

            if not holdings_data or "holdings" not in holdings_data.get(etf_ticker, {}):
                return []  # Return empty list if no holdings data

            holdings = holdings_data[etf_ticker]["holdings"]
            all_symbols = [h.get("symbol") for h in holdings if h.get("symbol")]

            if not all_symbols:
                return []

            # Batch request for faster price lookup
            price_data = YQTicker(all_symbols).price

            all_constituents = []
            for h in holdings:
                symbol = h.get("symbol")
                if not symbol or symbol not in price_data:
                    continue

                p = price_data.get(symbol, {})
                all_constituents.append({
                    "symbol": symbol,
                    "name": p.get("shortName") or h.get("holdingName"),
                    "price": p.get("regularMarketPrice"),
                    "percentChange": p.get("regularMarketChangePercent"),
                    "percentOfAssets": h.get("holdingPercent"),
                    "marketCap": p.get("marketCap"),
                    "volume": p.get("regularMarketVolume"),
                    "avgVolume": p.get("averageVolume"),
                    "dayHigh": p.get("regularMarketDayHigh"),
                    "dayLow": p.get("regularMarketDayLow"),
                    "fiftyTwoWeekHigh": p.get("fiftyTwoWeekHigh"),
                    "fiftyTwoWeekLow": p.get("fiftyTwoWeekLow"),
                    "peRatio": p.get("trailingPE"),
                    "dividendYield": p.get("dividendYield"),
                    "sector": p.get("sector"),
                    "industry": p.get("industry"),
                })

            return all_constituents
        except Exception as e:
            print(f"Error fetching constituents for {etf_ticker}: {e}")
            return []

    @cache_result(ttl=settings.COMPANY_INFO_CACHE_TTL, key_prefix="company_info")
    def get_company_info(self, ticker: str) -> dict | None:
        """
        Gets company information for a ticker.
        Results are cached in Redis for COMPANY_INFO_CACHE_TTL seconds (24 hours).

        Args:
            ticker: Stock ticker symbol

        Returns:
            Dictionary with company info or None if error
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
            }
        except Exception as e:
            print(f"Error fetching company info for {ticker}: {e}")
            return None

    @async_cache_result(ttl=86400, key_prefix="company_overview")  # Cache for 24 hours
    async def get_company_overview(self, ticker: str) -> dict | None:
        """
        Fetch comprehensive company overview from Alpha Vantage API.
        Results are cached in Redis for 24 hours.

        Args:
            ticker: Stock ticker symbol

        Returns:
            Dictionary with comprehensive company data including financial ratios,
            analyst ratings, and key metrics, or None if error
        """
        if not self.alpha_vantage_api_key:
            print(f"Cannot fetch company overview for {ticker}: Alpha Vantage API key not configured")
            return None

        try:
            url = (
                f"https://www.alphavantage.co/query?"
                f"function=OVERVIEW&symbol={ticker}&apikey={self.alpha_vantage_api_key}"
            )

            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status != 200:
                        print(f"Error fetching company overview for {ticker}: HTTP {response.status}")
                        return None

                    data = await response.json()

                    # Check if we got valid data (Alpha Vantage returns empty dict or error message for invalid tickers)
                    if not data or "Symbol" not in data:
                        print(f"No company overview data available for {ticker}")
                        return None

                    return data

        except Exception as e:
            print(f"Error fetching company overview for {ticker}: {e}")
            return None


# Create a singleton instance
stock_data_service = StockDataService()
