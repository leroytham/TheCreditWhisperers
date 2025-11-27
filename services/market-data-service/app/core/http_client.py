# =============================================================================
# HTTP Client Manager with Connection Pooling
# =============================================================================

import aiohttp
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class HTTPClientManager:
    """
    Centralized HTTP session manager with connection pooling.
    Singleton pattern for efficient connection reuse.
    """

    _instance: Optional["HTTPClientManager"] = None
    _session: Optional[aiohttp.ClientSession] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def get_session(self) -> aiohttp.ClientSession:
        """
        Get or create a shared aiohttp session with connection pooling.
        """
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,
                limit_per_host=30,
                ttl_dns_cache=300,
                keepalive_timeout=60,
                enable_cleanup_closed=True,
                force_close=False,
            )
            timeout = aiohttp.ClientTimeout(
                total=30,
                connect=10,
                sock_read=20,
            )
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout,
                headers={
                    "User-Agent": "CreditWhisperers-MarketData/1.0",
                    "Accept": "application/json",
                },
            )
            logger.info("Created shared HTTP session with connection pooling")
        return self._session

    async def close(self):
        """Close the session gracefully."""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("Closed shared HTTP session")
            self._session = None

    @property
    def is_initialized(self) -> bool:
        """Check if the session has been initialized."""
        return self._session is not None and not self._session.closed


# Singleton instance
http_client = HTTPClientManager()
