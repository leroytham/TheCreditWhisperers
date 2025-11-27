# =============================================================================
# HTTP Client Manager - Connection pooling for inter-service communication
# =============================================================================

import aiohttp
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class HTTPClientManager:
    """
    Singleton HTTP client manager with connection pooling.
    """
    _instance: Optional["HTTPClientManager"] = None
    _session: Optional[aiohttp.ClientSession] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(HTTPClientManager, cls).__new__(cls)
        return cls._instance

    async def get_session(self) -> aiohttp.ClientSession:
        """Get or create the shared aiohttp session."""
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,
                limit_per_host=30,
                ttl_dns_cache=300,
                enable_cleanup_closed=True
            )
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout
            )
            logger.info("Created new aiohttp ClientSession with connection pooling")
        return self._session

    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("Closed aiohttp ClientSession")
            self._session = None


http_client = HTTPClientManager()
