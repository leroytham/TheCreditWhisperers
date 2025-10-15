# app/services/stock_data_service.py

import pandas as pd
from datetime import datetime, timedelta
import yfinance as yf
from yahooquery import Ticker as YQTicker

from app.core.cache import cache_result
from app.core.config import settings


class StockDataService:
    """
    Service for fetching and filtering stock market data.
    Handles historical price data, timeframe filtering, and sector constituents.
    """

    def __init__(self):
        # Sector-to-ETF mapping for S&P 500 sectors
        self.sector_etf_map = {
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
            timeframe: One of "5D", "1M", "3M", "6M", "1Y", "YTD"

        Returns:
            Filtered DataFrame or original if timeframe not recognized
        """
        if df is None or df.empty:
            return df

        end_date = datetime.today()
        time_deltas = {
            "5D": 4,
            "1M": 29,
            "3M": 89,
            "6M": 179,
            "1Y": 364
        }

        if timeframe in time_deltas:
            start_date = end_date - timedelta(days=time_deltas[timeframe])
        elif timeframe == "YTD":
            start_date = datetime(end_date.year, 1, 1)
        else:
            # Return the original dataframe if timeframe is not recognized
            return df

        return df[(df.index >= start_date) & (df.index <= end_date)]

    @cache_result(ttl=settings.SECTOR_CACHE_TTL, key_prefix="sector_constituents")
    def get_sector_top_constituents(self, sector_ticker: str) -> list[dict]:
        """
        Fetches the top 10 holdings for a given S&P 500 sector ticker.
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
            top_symbols = [h.get("symbol") for h in holdings[:10] if h.get("symbol")]

            if not top_symbols:
                return []

            # Batch request for faster price lookup
            price_data = YQTicker(top_symbols).price

            top_constituents = []
            for h in holdings[:10]:
                symbol = h.get("symbol")
                if not symbol or symbol not in price_data:
                    continue

                p = price_data.get(symbol, {})
                top_constituents.append({
                    "symbol": symbol,
                    "name": p.get("shortName") or h.get("holdingName"),
                    "price": p.get("regularMarketPrice"),
                    "percentChange": p.get("regularMarketChangePercent"),
                    "percentOfAssets": h.get("holdingPercent"),
                })

            return top_constituents
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


# Create a singleton instance
stock_data_service = StockDataService()
