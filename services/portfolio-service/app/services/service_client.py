# =============================================================================
# Service Client - Inter-service communication
# =============================================================================

import aiohttp
from typing import Optional, Dict, Any, List
import logging

from app.core.config import settings
from app.core.http_client import http_client

logger = logging.getLogger(__name__)


class ServiceClient:
    """
    Client for communicating with Market Data and Sentiment services.
    """

    def __init__(self):
        self.market_data_url = settings.MARKET_DATA_SERVICE_URL
        self.sentiment_url = settings.SENTIMENT_SERVICE_URL
        self.timeout = settings.SERVICE_TIMEOUT_SECONDS

    async def get_session(self) -> aiohttp.ClientSession:
        """Get HTTP session."""
        return await http_client.get_session()

    # =========================================================================
    # Market Data Service
    # =========================================================================

    async def get_stock_quote(self, ticker: str) -> Optional[Dict]:
        """Get current stock quote from Market Data Service."""
        try:
            session = await self.get_session()
            url = f"{self.market_data_url}/api/market/quote/{ticker}"

            async with session.get(url, timeout=self.timeout) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.warning(f"Market data quote failed for {ticker}: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error getting quote for {ticker}: {e}")
            return None

    async def get_batch_quotes(self, tickers: List[str]) -> Dict[str, Any]:
        """Get batch quotes from Market Data Service."""
        try:
            session = await self.get_session()
            tickers_param = ",".join(tickers)
            url = f"{self.market_data_url}/api/market/batch/quotes?tickers={tickers_param}"

            async with session.get(url, timeout=self.timeout) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.warning(f"Batch quotes failed: {response.status}")
                    return {"quotes": {}}
        except Exception as e:
            logger.error(f"Error getting batch quotes: {e}")
            return {"quotes": {}}

    async def get_historical_prices(
        self,
        ticker: str,
        timeframe: str = "1Y"
    ) -> Optional[Dict]:
        """Get historical prices from Market Data Service."""
        try:
            session = await self.get_session()
            url = f"{self.market_data_url}/api/market/history/{ticker}?timeframe={timeframe}"

            async with session.get(url, timeout=self.timeout) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.warning(f"Historical prices failed for {ticker}: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error getting historical prices for {ticker}: {e}")
            return None

    # =========================================================================
    # Sentiment Service
    # =========================================================================

    async def get_ticker_sentiment(
        self,
        ticker: str,
        timeframe: str = "1M"
    ) -> Optional[Dict]:
        """Get sentiment analysis from Sentiment Service."""
        try:
            session = await self.get_session()
            url = f"{self.sentiment_url}/api/sentiment/analyze/{ticker}?timeframe={timeframe}"

            async with session.get(url, timeout=self.timeout) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.warning(f"Sentiment failed for {ticker}: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error getting sentiment for {ticker}: {e}")
            return None

    async def get_quick_sentiment(
        self,
        ticker: str,
        timeframe: str = "1W"
    ) -> Optional[Dict]:
        """Get quick sentiment from Sentiment Service."""
        try:
            session = await self.get_session()
            url = f"{self.sentiment_url}/api/sentiment/quick/{ticker}?timeframe={timeframe}"

            async with session.get(url, timeout=self.timeout) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return None
        except Exception as e:
            logger.error(f"Error getting quick sentiment for {ticker}: {e}")
            return None

    async def get_ticker_news(
        self,
        ticker: str,
        timeframe: str = "1M",
        count: int = 100
    ) -> Optional[Dict]:
        """Get news from Sentiment Service."""
        try:
            session = await self.get_session()
            url = f"{self.sentiment_url}/api/sentiment/news/{ticker}?timeframe={timeframe}&count={count}"

            async with session.get(url, timeout=self.timeout) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return None
        except Exception as e:
            logger.error(f"Error getting news for {ticker}: {e}")
            return None


service_client = ServiceClient()
