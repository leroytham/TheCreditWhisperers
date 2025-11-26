# app/core/pubsub.py
"""
Redis Pub/Sub Manager for Distributed WebSocket Notifications

Enables WebSocket notifications to reach clients regardless of which
server instance they're connected to.

Features:
- Channel-based routing (user, ticker, global)
- Graceful degradation when Redis unavailable
- Automatic reconnection with exponential backoff
- Message deduplication (ignore own messages)
- Instance tracking for debugging

Usage:
    from app.core.pubsub import pubsub_manager

    # In startup
    await pubsub_manager.start()

    # Publishing
    await pubsub_manager.publish_personal("user123", notification)
    await pubsub_manager.publish_ticker("AAPL", notification)
    await pubsub_manager.publish_broadcast(notification)

    # In shutdown
    await pubsub_manager.stop()
"""

import asyncio
import json
import uuid
import logging
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, asdict
from typing import Optional, Set, Callable, Awaitable, TYPE_CHECKING

import redis.asyncio as redis
from redis.asyncio.client import PubSub

from .config import settings

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """Types of Pub/Sub messages for routing."""
    PERSONAL = "personal"
    TICKER = "ticker"
    BROADCAST = "broadcast"


@dataclass
class PubSubMessage:
    """Standard message format for Pub/Sub communication."""
    type: MessageType
    target: str
    data: dict
    timestamp: str
    source_instance: str

    def to_json(self) -> str:
        """Serialize message to JSON string."""
        msg_dict = asdict(self)
        msg_dict["type"] = self.type.value
        return json.dumps(msg_dict)

    @classmethod
    def from_json(cls, data: str) -> "PubSubMessage":
        """Deserialize message from JSON string."""
        parsed = json.loads(data)
        parsed["type"] = MessageType(parsed["type"])
        return cls(**parsed)


class PubSubManager:
    """
    Manages Redis Pub/Sub for distributed WebSocket notifications.

    Singleton pattern ensures one subscriber per server instance.
    Graceful degradation: continues working in local-only mode if Redis unavailable.
    """

    _instance: Optional["PubSubManager"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True
        self._redis_client: Optional[redis.Redis] = None
        self._pubsub: Optional[PubSub] = None
        self._subscriber_task: Optional[asyncio.Task] = None
        self._is_running: bool = False
        self._instance_id: str = uuid.uuid4().hex[:8]
        self._subscribed_channels: Set[str] = set()
        self._message_handler: Optional[Callable[[str, str, dict], Awaitable[None]]] = None
        self._reconnect_attempts: int = 0

    @property
    def instance_id(self) -> str:
        """Unique identifier for this server instance."""
        return self._instance_id

    @property
    def is_available(self) -> bool:
        """Check if Redis Pub/Sub is available."""
        return self._redis_client is not None and self._is_running

    def set_message_handler(self, handler: Callable[[str, str, dict], Awaitable[None]]):
        """
        Set the callback for handling incoming messages.

        Args:
            handler: Async function(message_type, target, data) to call for each message
        """
        self._message_handler = handler
        logger.debug(f"[PUBSUB] Message handler set (instance: {self._instance_id})")

    async def _get_redis_client(self) -> Optional[redis.Redis]:
        """Get or create Redis client for Pub/Sub."""
        if self._redis_client is None:
            try:
                if settings.REDIS_URL:
                    self._redis_client = redis.from_url(
                        settings.REDIS_URL,
                        decode_responses=True,
                        socket_connect_timeout=5,
                        socket_timeout=5,
                    )
                else:
                    self._redis_client = redis.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        db=settings.REDIS_DB,
                        password=settings.REDIS_PASSWORD or None,
                        decode_responses=True,
                        socket_connect_timeout=5,
                        socket_timeout=5,
                    )
                await self._redis_client.ping()
                logger.info(f"[PUBSUB] Redis client connected (instance: {self._instance_id})")
            except Exception as e:
                logger.warning(f"[PUBSUB] Redis connection failed: {e}")
                self._redis_client = None
        return self._redis_client

    async def start(self) -> bool:
        """
        Start the Pub/Sub subscriber.

        Returns:
            True if started successfully, False if Redis unavailable
        """
        if not settings.PUBSUB_ENABLED:
            logger.info("[PUBSUB] Pub/Sub disabled by configuration")
            return False

        client = await self._get_redis_client()
        if client is None:
            logger.warning("[PUBSUB] Starting in local-only mode (Redis unavailable)")
            return False

        try:
            self._pubsub = client.pubsub()

            # Subscribe to global channel
            await self._pubsub.subscribe("notifications:global")
            self._subscribed_channels.add("notifications:global")

            # Start subscriber loop
            self._is_running = True
            self._subscriber_task = asyncio.create_task(self._subscriber_loop())

            logger.info(f"[PUBSUB] Started successfully (instance: {self._instance_id})")
            return True

        except Exception as e:
            logger.error(f"[PUBSUB] Failed to start: {e}")
            self._is_running = False
            return False

    async def stop(self):
        """Stop the Pub/Sub subscriber gracefully."""
        self._is_running = False

        if self._subscriber_task:
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass

        if self._pubsub:
            try:
                await self._pubsub.unsubscribe()
                await self._pubsub.close()
            except Exception as e:
                logger.warning(f"[PUBSUB] Error closing pubsub: {e}")
            self._pubsub = None

        if self._redis_client:
            try:
                await self._redis_client.close()
            except Exception as e:
                logger.warning(f"[PUBSUB] Error closing Redis client: {e}")
            self._redis_client = None

        self._subscribed_channels.clear()
        logger.info(f"[PUBSUB] Stopped (instance: {self._instance_id})")

    async def _subscriber_loop(self):
        """Background task that listens for Pub/Sub messages."""
        logger.info(f"[PUBSUB] Subscriber loop started (instance: {self._instance_id})")

        while self._is_running:
            try:
                message = await self._pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0
                )

                if message and message["type"] == "message":
                    await self._handle_message(message)
                    self._reconnect_attempts = 0  # Reset on successful message

            except asyncio.CancelledError:
                break
            except redis.ConnectionError as e:
                logger.warning(f"[PUBSUB] Connection lost: {e}")
                await self._handle_reconnect()
            except Exception as e:
                logger.error(f"[PUBSUB] Error in subscriber loop: {e}")
                await asyncio.sleep(1)

        logger.info("[PUBSUB] Subscriber loop ended")

    async def _handle_reconnect(self):
        """Handle reconnection with exponential backoff."""
        if self._reconnect_attempts >= settings.PUBSUB_MAX_RECONNECT_ATTEMPTS:
            logger.error("[PUBSUB] Max reconnection attempts reached, stopping")
            self._is_running = False
            return

        delay = min(settings.PUBSUB_RECONNECT_DELAY * (2 ** self._reconnect_attempts), 60)
        self._reconnect_attempts += 1

        logger.info(f"[PUBSUB] Reconnecting in {delay}s (attempt {self._reconnect_attempts})")
        await asyncio.sleep(delay)

        # Reset client and pubsub
        self._redis_client = None
        self._pubsub = None

        # Try to reconnect
        client = await self._get_redis_client()
        if client:
            try:
                self._pubsub = client.pubsub()
                # Resubscribe to all channels
                for channel in list(self._subscribed_channels):
                    await self._pubsub.subscribe(channel)
                logger.info("[PUBSUB] Reconnected successfully")
            except Exception as e:
                logger.error(f"[PUBSUB] Reconnection failed: {e}")

    async def _handle_message(self, message: dict):
        """Process incoming Pub/Sub message."""
        try:
            channel = message["channel"]
            data = message["data"]

            pubsub_msg = PubSubMessage.from_json(data)

            # Skip messages from this instance (already delivered locally)
            if pubsub_msg.source_instance == self._instance_id:
                return

            logger.debug(
                f"[PUBSUB] Received {pubsub_msg.type.value} message "
                f"for {pubsub_msg.target} from instance {pubsub_msg.source_instance}"
            )

            # Dispatch to handler
            if self._message_handler:
                await asyncio.wait_for(
                    self._message_handler(
                        pubsub_msg.type.value,
                        pubsub_msg.target,
                        pubsub_msg.data
                    ),
                    timeout=settings.PUBSUB_MESSAGE_TIMEOUT
                )

        except asyncio.TimeoutError:
            logger.warning("[PUBSUB] Message handler timed out")
        except json.JSONDecodeError as e:
            logger.error(f"[PUBSUB] Invalid JSON in message: {e}")
        except Exception as e:
            logger.error(f"[PUBSUB] Error handling message: {e}")

    async def _publish(self, channel: str, message: PubSubMessage) -> bool:
        """Publish message to a channel."""
        if not self.is_available:
            return False

        try:
            await self._redis_client.publish(channel, message.to_json())
            logger.debug(f"[PUBSUB] Published to {channel}")
            return True
        except Exception as e:
            logger.error(f"[PUBSUB] Publish failed: {e}")
            return False

    async def publish_personal(self, user_id: str, notification: dict) -> bool:
        """
        Publish notification to a specific user's channel.

        Args:
            user_id: Target user identifier
            notification: Notification data dict

        Returns:
            True if published successfully, False otherwise
        """
        channel = f"notifications:user:{user_id}"
        message = PubSubMessage(
            type=MessageType.PERSONAL,
            target=user_id,
            data=notification,
            timestamp=datetime.utcnow().isoformat(),
            source_instance=self._instance_id,
        )
        return await self._publish(channel, message)

    async def publish_ticker(self, ticker: str, notification: dict) -> bool:
        """
        Publish notification to a ticker's channel.

        Args:
            ticker: Stock ticker symbol
            notification: Notification data dict

        Returns:
            True if published successfully, False otherwise
        """
        ticker = ticker.upper()
        channel = f"notifications:ticker:{ticker}"
        message = PubSubMessage(
            type=MessageType.TICKER,
            target=ticker,
            data=notification,
            timestamp=datetime.utcnow().isoformat(),
            source_instance=self._instance_id,
        )
        return await self._publish(channel, message)

    async def publish_broadcast(self, notification: dict) -> bool:
        """
        Publish notification to global channel (all instances).

        Args:
            notification: Notification data dict

        Returns:
            True if published successfully, False otherwise
        """
        channel = "notifications:global"
        message = PubSubMessage(
            type=MessageType.BROADCAST,
            target="all",
            data=notification,
            timestamp=datetime.utcnow().isoformat(),
            source_instance=self._instance_id,
        )
        return await self._publish(channel, message)

    async def subscribe_user(self, user_id: str):
        """
        Subscribe to a user's personal notification channel.

        Args:
            user_id: User identifier
        """
        if not self.is_available:
            return

        channel = f"notifications:user:{user_id}"
        if channel not in self._subscribed_channels:
            try:
                await self._pubsub.subscribe(channel)
                self._subscribed_channels.add(channel)
                logger.debug(f"[PUBSUB] Subscribed to {channel}")
            except Exception as e:
                logger.error(f"[PUBSUB] Failed to subscribe to {channel}: {e}")

    async def unsubscribe_user(self, user_id: str):
        """
        Unsubscribe from a user's personal notification channel.

        Args:
            user_id: User identifier
        """
        if not self.is_available:
            return

        channel = f"notifications:user:{user_id}"
        if channel in self._subscribed_channels:
            try:
                await self._pubsub.unsubscribe(channel)
                self._subscribed_channels.discard(channel)
                logger.debug(f"[PUBSUB] Unsubscribed from {channel}")
            except Exception as e:
                logger.error(f"[PUBSUB] Failed to unsubscribe from {channel}: {e}")

    async def subscribe_ticker(self, ticker: str):
        """
        Subscribe to a ticker's notification channel.

        Args:
            ticker: Stock ticker symbol
        """
        if not self.is_available:
            return

        ticker = ticker.upper()
        channel = f"notifications:ticker:{ticker}"
        if channel not in self._subscribed_channels:
            try:
                await self._pubsub.subscribe(channel)
                self._subscribed_channels.add(channel)
                logger.debug(f"[PUBSUB] Subscribed to {channel}")
            except Exception as e:
                logger.error(f"[PUBSUB] Failed to subscribe to {channel}: {e}")

    async def unsubscribe_ticker(self, ticker: str):
        """
        Unsubscribe from a ticker's notification channel.

        Args:
            ticker: Stock ticker symbol
        """
        if not self.is_available:
            return

        ticker = ticker.upper()
        channel = f"notifications:ticker:{ticker}"
        if channel in self._subscribed_channels:
            try:
                await self._pubsub.unsubscribe(channel)
                self._subscribed_channels.discard(channel)
                logger.debug(f"[PUBSUB] Unsubscribed from {channel}")
            except Exception as e:
                logger.error(f"[PUBSUB] Failed to unsubscribe from {channel}: {e}")

    def get_status(self) -> dict:
        """Get current Pub/Sub status for monitoring."""
        return {
            "instance_id": self._instance_id,
            "is_available": self.is_available,
            "is_running": self._is_running,
            "subscribed_channels": len(self._subscribed_channels),
            "reconnect_attempts": self._reconnect_attempts,
        }


# Singleton instance
pubsub_manager = PubSubManager()


# =============================================================================
# Exports
# =============================================================================
__all__ = [
    "PubSubManager",
    "PubSubMessage",
    "MessageType",
    "pubsub_manager",
]
