"""
HTTP Client Manager with Connection Pooling

Provides a centralized, singleton HTTP session manager for efficient
connection reuse across all services making external API calls.

Features:
- Connection pooling (100 total, 30 per host)
- DNS caching (5 minute TTL)
- Keep-alive connections (60 seconds)
- Configurable timeouts
- Graceful shutdown support

Usage:
    from app.core.http_client import http_client

    # In async context
    session = await http_client.get_session()
    async with session.get(url) as response:
        data = await response.json()

    # Session is automatically managed by app lifecycle
"""

import aiohttp
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class HTTPClientManager:
    """
    Centralized HTTP session manager with connection pooling.

    Uses singleton pattern to ensure a single shared session across
    all services, maximizing connection reuse and minimizing overhead.
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

        The session is lazily initialized on first use and reused for
        all subsequent requests. Connection pooling settings:
        - limit: 100 total connections
        - limit_per_host: 30 connections per host
        - ttl_dns_cache: 300 seconds (5 minutes)
        - keepalive_timeout: 60 seconds

        Returns:
            aiohttp.ClientSession: Shared session with connection pooling
        """
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,                    # Max total connections
                limit_per_host=30,            # Max connections per host
                ttl_dns_cache=300,            # DNS cache TTL (5 min)
                keepalive_timeout=60,         # Keep connections alive 60s
                enable_cleanup_closed=True,   # Clean up closed connections
                force_close=False,            # Reuse connections
            )
            timeout = aiohttp.ClientTimeout(
                total=30,                     # Total request timeout
                connect=10,                   # Connection timeout
                sock_read=20,                 # Socket read timeout
            )
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout,
                headers={
                    "User-Agent": "CreditWhisperers/1.0",
                    "Accept": "application/json",
                },
            )
            logger.info("✅ Created shared HTTP session with connection pooling")
        return self._session

    async def close(self):
        """
        Close the session gracefully.

        Should be called on application shutdown to properly close
        all connections and release resources.
        """
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("✅ Closed shared HTTP session")
            self._session = None

    @property
    def is_initialized(self) -> bool:
        """Check if the session has been initialized."""
        return self._session is not None and not self._session.closed


# Singleton instance for application-wide use
http_client = HTTPClientManager()
