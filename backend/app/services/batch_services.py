# app/services/batch_services.py
"""
Batch services for efficient bulk data fetching.
Reduces API calls by fetching multiple symbols in single requests.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import yfinance as yf
import aiohttp
import pandas as pd
from app.core.cache import async_cache_result
from app.core.http_client import http_client

logger = logging.getLogger(__name__)


class BatchMarketDataService:
    """
    Service for fetching market data for multiple symbols in batch operations.
    Uses Yahoo Finance's batch capabilities to minimize API calls.
    """

    def __init__(self):
        self._session_cache = {}  # In-memory cache for current session
        self._batch_size = 50  # Yahoo Finance optimal batch size

    @async_cache_result(ttl=60, key_prefix="batch_market")
    async def get_batch_current_prices(
        self,
        symbols: List[str],
        include_extended_data: bool = True
    ) -> Dict[str, Dict]:
        """
        Fetch current market prices for multiple symbols in a single API call.

        Args:
            symbols: List of stock symbols
            include_extended_data: Whether to include 52-week range, volume, etc.

        Returns:
            Dictionary mapping symbol to market data
        """
        if not symbols:
            return {}

        results = {}
        unique_symbols = list(set(symbols))  # Remove duplicates

        # Process in batches for optimal performance
        for i in range(0, len(unique_symbols), self._batch_size):
            batch = unique_symbols[i:i + self._batch_size]
            batch_results = await self._fetch_batch_prices(batch, include_extended_data)
            results.update(batch_results)

        logger.info(f"[BATCH-MARKET] Fetched prices for {len(results)}/{len(unique_symbols)} symbols")
        return results

    async def _fetch_batch_prices(
        self,
        symbols: List[str],
        include_extended_data: bool
    ) -> Dict[str, Dict]:
        """
        Fetch prices for a batch of symbols.
        """
        try:
            # Create space-separated string for yfinance
            symbols_str = ' '.join(symbols)

            # Run blocking yfinance call in thread pool
            tickers = await asyncio.to_thread(yf.Tickers, symbols_str)

            results = {}
            for symbol in symbols:
                try:
                    ticker = tickers.tickers.get(symbol)
                    if not ticker:
                        logger.warning(f"[BATCH-MARKET] No data for {symbol}")
                        results[symbol] = None
                        continue

                    # Get fast_info for current data
                    info = ticker.fast_info

                    market_data = {
                        "symbol": symbol,
                        "market_price": float(info.last_price) if hasattr(info, 'last_price') else None,
                        "previous_close": float(info.previous_close) if hasattr(info, 'previous_close') else None,
                        "timestamp": datetime.now().isoformat()
                    }

                    # Calculate day change if we have both prices
                    if market_data["market_price"] and market_data["previous_close"]:
                        market_data["day_change_value"] = round(
                            market_data["market_price"] - market_data["previous_close"], 2
                        )
                        market_data["day_change_percent"] = round(
                            (market_data["day_change_value"] / market_data["previous_close"]) * 100, 2
                        )

                    if include_extended_data:
                        market_data.update({
                            "fifty_two_week_high": float(info.year_high) if hasattr(info, 'year_high') else None,
                            "fifty_two_week_low": float(info.year_low) if hasattr(info, 'year_low') else None,
                            "volume": int(info.regular_market_volume) if hasattr(info, 'regular_market_volume') else None,
                            "market_cap": float(info.market_cap) if hasattr(info, 'market_cap') else None
                        })

                    results[symbol] = market_data

                except Exception as e:
                    logger.error(f"[BATCH-MARKET] Error processing {symbol}: {e}")
                    results[symbol] = None

            return results

        except Exception as e:
            logger.error(f"[BATCH-MARKET] Batch fetch failed: {e}")
            # Return None for all symbols on batch failure
            return {symbol: None for symbol in symbols}

    @async_cache_result(ttl=300, key_prefix="batch_historical")
    async def get_batch_historical_prices(
        self,
        symbols: List[str],
        period: str = "1d",
        interval: str = "1m"
    ) -> Dict[str, pd.DataFrame]:
        """
        Fetch historical prices for multiple symbols.

        Args:
            symbols: List of stock symbols
            period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)

        Returns:
            Dictionary mapping symbol to DataFrame of historical data
        """
        results = {}
        unique_symbols = list(set(symbols))

        # Process in smaller batches for historical data
        batch_size = 20  # Smaller batch for historical data
        for i in range(0, len(unique_symbols), batch_size):
            batch = unique_symbols[i:i + batch_size]

            # Fetch in parallel for each symbol in batch
            tasks = [
                self._fetch_single_historical(symbol, period, interval)
                for symbol in batch
            ]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for symbol, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    logger.error(f"[BATCH-HISTORICAL] Error for {symbol}: {result}")
                    results[symbol] = pd.DataFrame()
                else:
                    results[symbol] = result

        return results

    async def _fetch_single_historical(
        self,
        symbol: str,
        period: str,
        interval: str
    ) -> pd.DataFrame:
        """Fetch historical data for a single symbol."""
        try:
            ticker = yf.Ticker(symbol)
            hist = await asyncio.to_thread(
                ticker.history,
                period=period,
                interval=interval
            )
            return hist
        except Exception as e:
            logger.error(f"[BATCH-HISTORICAL] Failed for {symbol}: {e}")
            return pd.DataFrame()


class BatchSectorService:
    """
    Service for fetching sector and industry information for multiple symbols.
    """

    def __init__(self):
        self._cache = {}  # Simple in-memory cache
        self._batch_size = 30

    @async_cache_result(ttl=86400, key_prefix="batch_sector")  # Cache for 24 hours
    async def get_batch_sector_info(
        self,
        symbols: List[str]
    ) -> Dict[str, Dict]:
        """
        Fetch sector and industry info for multiple symbols.

        Returns:
            Dictionary mapping symbol to {sector, industry, market_cap, employees}
        """
        results = {}
        unique_symbols = list(set(symbols))

        # Check cache first
        uncached_symbols = []
        for symbol in unique_symbols:
            if symbol in self._cache:
                results[symbol] = self._cache[symbol]
            else:
                uncached_symbols.append(symbol)

        if not uncached_symbols:
            return results

        # Fetch uncached symbols in batches
        for i in range(0, len(uncached_symbols), self._batch_size):
            batch = uncached_symbols[i:i + self._batch_size]
            batch_results = await self._fetch_batch_sector_info(batch)

            # Update cache and results
            for symbol, info in batch_results.items():
                self._cache[symbol] = info
                results[symbol] = info

        logger.info(f"[BATCH-SECTOR] Fetched info for {len(results)}/{len(unique_symbols)} symbols")
        return results

    async def _fetch_batch_sector_info(
        self,
        symbols: List[str]
    ) -> Dict[str, Dict]:
        """Fetch sector info for a batch of symbols."""
        try:
            # Create tickers object for batch
            symbols_str = ' '.join(symbols)
            tickers = await asyncio.to_thread(yf.Tickers, symbols_str)

            results = {}
            for symbol in symbols:
                try:
                    ticker = tickers.tickers.get(symbol)
                    if not ticker:
                        results[symbol] = {
                            "sector": "N/A",
                            "industry": "N/A",
                            "error": "Symbol not found"
                        }
                        continue

                    # Get info in thread pool to avoid blocking
                    info = await asyncio.to_thread(lambda: ticker.info)

                    results[symbol] = {
                        "sector": info.get("sector", "N/A"),
                        "industry": info.get("industry", "N/A"),
                        "longName": info.get("longName", symbol),
                        "market_cap": info.get("marketCap"),
                        "employees": info.get("fullTimeEmployees"),
                        "country": info.get("country", "N/A"),
                        "website": info.get("website")
                    }

                except Exception as e:
                    logger.warning(f"[BATCH-SECTOR] Error for {symbol}: {e}")
                    results[symbol] = {
                        "sector": "N/A",
                        "industry": "N/A",
                        "error": str(e)
                    }

            return results

        except Exception as e:
            logger.error(f"[BATCH-SECTOR] Batch fetch failed: {e}")
            return {
                symbol: {"sector": "N/A", "industry": "N/A", "error": str(e)}
                for symbol in symbols
            }


class BatchNewsService:
    """
    Service for fetching news for multiple symbols efficiently.
    """

    def __init__(self, alpha_vantage_api_key: Optional[str] = None):
        self.api_key = alpha_vantage_api_key
        self._batch_size = 10  # Alpha Vantage limit

    async def get_batch_news(
        self,
        symbols: List[str],
        time_from: Optional[str] = None,
        limit: int = 50
    ) -> Dict[str, List[Dict]]:
        """
        Fetch news for multiple symbols.

        Args:
            symbols: List of stock symbols
            time_from: Start time in YYYYMMDDTHHMM format
            limit: Max articles per symbol

        Returns:
            Dictionary mapping symbol to list of news articles
        """
        if not self.api_key:
            logger.warning("[BATCH-NEWS] No API key configured")
            return {symbol: [] for symbol in symbols}

        results = {}
        unique_symbols = list(set(symbols))

        # Alpha Vantage supports comma-separated tickers
        for i in range(0, len(unique_symbols), self._batch_size):
            batch = unique_symbols[i:i + self._batch_size]
            batch_str = ','.join(batch)

            try:
                news_data = await self._fetch_alpha_vantage_batch(batch_str, time_from, limit)

                # Distribute news to appropriate symbols
                for symbol in batch:
                    symbol_news = []
                    for article in news_data:
                        # Check if this article is relevant to the symbol
                        ticker_sentiments = article.get("ticker_sentiment", [])
                        for sentiment in ticker_sentiments:
                            if sentiment.get("ticker") == symbol:
                                symbol_news.append(article)
                                break
                    results[symbol] = symbol_news

            except Exception as e:
                logger.error(f"[BATCH-NEWS] Error fetching batch {batch}: {e}")
                for symbol in batch:
                    results[symbol] = []

        return results

    async def _fetch_alpha_vantage_batch(
        self,
        tickers: str,
        time_from: Optional[str],
        limit: int
    ) -> List[Dict]:
        """Fetch news from Alpha Vantage for multiple tickers."""
        url = f"https://www.alphavantage.co/query"
        params = {
            "function": "NEWS_SENTIMENT",
            "tickers": tickers,
            "limit": limit,
            "apikey": self.api_key
        }

        if time_from:
            params["time_from"] = time_from

        try:
            session = await http_client.get_session()
            async with session.get(url, params=params, timeout=30) as response:
                data = await response.json()

                if "Note" in data:  # Rate limit
                    logger.warning(f"[BATCH-NEWS] Rate limit hit")
                    return []

                return data.get("feed", [])

        except asyncio.TimeoutError:
            logger.error("[BATCH-NEWS] Request timeout")
            return []
        except Exception as e:
            logger.error(f"[BATCH-NEWS] Request failed: {e}")
            return []


# Singleton instances
batch_market_service = BatchMarketDataService()
batch_sector_service = BatchSectorService()
batch_news_service = BatchNewsService()