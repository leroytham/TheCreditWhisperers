# app/api/websocket.py
"""
WebSocket connection manager for real-time notifications.

Integrated with Redis Pub/Sub for distributed notifications across
multiple server instances.

Features:
- Personal notifications to specific users
- Ticker-based subscriptions for price updates
- Broadcast to all connected clients
- Redis Pub/Sub for cross-instance delivery
- Graceful fallback to local-only when Redis unavailable
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set, Optional
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time notifications.

    Integrated with Redis Pub/Sub for distributed notifications:
    - Local delivery for clients on this instance
    - Pub/Sub for clients on other instances
    """

    def __init__(self):
        # Map of client_id to WebSocket connection (local only)
        self.active_connections: Dict[str, WebSocket] = {}
        # Map of client_id to set of subscribed tickers (local only)
        self.subscriptions: Dict[str, Set[str]] = {}
        # Pub/Sub manager (initialized on startup)
        self._pubsub_manager = None

    async def initialize_pubsub(self):
        """
        Initialize Redis Pub/Sub for distributed notifications.
        Called from application startup event.
        """
        try:
            from ..core.pubsub import pubsub_manager
            self._pubsub_manager = pubsub_manager

            # Set message handler for incoming Pub/Sub messages
            self._pubsub_manager.set_message_handler(self._handle_pubsub_message)

            # Start the Pub/Sub subscriber
            success = await self._pubsub_manager.start()
            if success:
                logger.info("WebSocket Pub/Sub integration initialized")
            else:
                logger.warning("WebSocket running in local-only mode (Pub/Sub unavailable)")
        except Exception as e:
            logger.warning(f"Failed to initialize Pub/Sub: {e}")
            self._pubsub_manager = None

    async def shutdown_pubsub(self):
        """Stop Redis Pub/Sub. Called from application shutdown event."""
        if self._pubsub_manager:
            await self._pubsub_manager.stop()
            logger.info("WebSocket Pub/Sub stopped")

    def _extract_user_id(self, client_id: str) -> Optional[str]:
        """
        Extract user ID from client_id format.

        Client IDs are typically in format: 'user-{username}' or 'user-{username}-{tab_id}'

        Args:
            client_id: WebSocket client identifier

        Returns:
            User ID string or None if not extractable
        """
        if client_id and client_id.startswith("user-"):
            # Remove 'user-' prefix and take first part (before any additional suffixes)
            parts = client_id[5:].split("-")
            if parts:
                return parts[0]
        return None

    def _has_other_connections(self, user_id: str, exclude_client: str) -> bool:
        """
        Check if user has other active connections on this instance.

        Args:
            user_id: User identifier
            exclude_client: Client ID to exclude from check

        Returns:
            True if user has other connections
        """
        for cid in self.active_connections:
            if cid != exclude_client and self._extract_user_id(cid) == user_id:
                return True
        return False

    def _ticker_has_subscribers(self, ticker: str) -> bool:
        """
        Check if any local client subscribes to this ticker.

        Args:
            ticker: Stock ticker symbol

        Returns:
            True if any client is subscribed
        """
        ticker = ticker.upper()
        for subscribed in self.subscriptions.values():
            if ticker in subscribed:
                return True
        return False

    async def connect(self, client_id: str, websocket: WebSocket):
        """
        Accept and store new WebSocket connection.

        Also subscribes to user's personal notification channel in Redis.
        """
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.subscriptions[client_id] = set()

        # Subscribe to user's personal channel in Redis
        if self._pubsub_manager and self._pubsub_manager.is_available:
            user_id = self._extract_user_id(client_id)
            if user_id:
                await self._pubsub_manager.subscribe_user(user_id)

        logger.info(f"Client {client_id} connected. Total: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        """
        Remove WebSocket connection.

        Unsubscribes from user channel if no other connections for this user.
        """
        # Get user_id before removing connection
        user_id = self._extract_user_id(client_id)

        # Remove from local maps
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.subscriptions:
            del self.subscriptions[client_id]

        # Unsubscribe from user channel if no other connections
        if self._pubsub_manager and self._pubsub_manager.is_available and user_id:
            if not self._has_other_connections(user_id, client_id):
                asyncio.create_task(self._pubsub_manager.unsubscribe_user(user_id))

        logger.info(f"Client {client_id} disconnected. Total: {len(self.active_connections)}")

    async def send_personal_notification(self, client_id: str, notification: dict):
        """
        Send notification to a specific client.

        Tries local delivery first, then publishes to Redis for other instances.
        """
        message = {
            "type": "notification",
            "data": notification,
            "timestamp": datetime.now().isoformat()
        }

        # Try local delivery first
        delivered_locally = False
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
                delivered_locally = True
            except Exception as e:
                logger.warning(f"Local delivery failed for {client_id}: {e}")
                self.disconnect(client_id)

        # Publish to Redis for other instances (if not delivered locally or for redundancy)
        if self._pubsub_manager and self._pubsub_manager.is_available and not delivered_locally:
            user_id = self._extract_user_id(client_id)
            if user_id:
                await self._pubsub_manager.publish_personal(user_id, message)

    async def broadcast(self, notification: dict, exclude_client: str = None):
        """
        Broadcast notification to all connected clients.

        Delivers locally and publishes to Redis for other instances.
        """
        message = {
            "type": "notification",
            "data": notification,
            "timestamp": datetime.now().isoformat()
        }

        # Local delivery
        disconnected_clients = []
        for client_id, connection in self.active_connections.items():
            if client_id != exclude_client:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Broadcast failed for {client_id}: {e}")
                    disconnected_clients.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

        # Publish to Redis for other instances
        if self._pubsub_manager and self._pubsub_manager.is_available:
            await self._pubsub_manager.publish_broadcast(message)

    def subscribe(self, client_id: str, ticker: str):
        """
        Subscribe client to ticker updates.

        Also subscribes to ticker channel in Redis.
        """
        ticker = ticker.upper()
        if client_id in self.subscriptions:
            self.subscriptions[client_id].add(ticker)
            logger.debug(f"Client {client_id} subscribed to {ticker}")

            # Subscribe to ticker channel in Redis
            if self._pubsub_manager and self._pubsub_manager.is_available:
                asyncio.create_task(self._pubsub_manager.subscribe_ticker(ticker))

    def unsubscribe(self, client_id: str, ticker: str):
        """
        Unsubscribe client from ticker updates.

        Unsubscribes from ticker channel if no other local clients need it.
        """
        ticker = ticker.upper()
        if client_id in self.subscriptions:
            self.subscriptions[client_id].discard(ticker)
            logger.debug(f"Client {client_id} unsubscribed from {ticker}")

            # Unsubscribe from ticker channel if no other clients need it
            if self._pubsub_manager and self._pubsub_manager.is_available:
                if not self._ticker_has_subscribers(ticker):
                    asyncio.create_task(self._pubsub_manager.unsubscribe_ticker(ticker))

    async def broadcast_to_subscribers(self, ticker: str, notification: dict):
        """
        Send notification to all clients subscribed to a ticker.

        Delivers locally and publishes to Redis for other instances.
        """
        ticker = ticker.upper()
        message = {
            "type": "ticker_update",
            "ticker": ticker,
            "data": notification,
            "timestamp": datetime.now().isoformat()
        }

        # Local delivery
        disconnected_clients = []
        for client_id, subscribed_tickers in self.subscriptions.items():
            if ticker in subscribed_tickers:
                try:
                    await self.active_connections[client_id].send_json(message)
                except Exception as e:
                    logger.warning(f"Ticker update failed for {client_id}: {e}")
                    disconnected_clients.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

        # Publish to Redis for other instances
        if self._pubsub_manager and self._pubsub_manager.is_available:
            await self._pubsub_manager.publish_ticker(ticker, {"notification": notification})

    async def _handle_pubsub_message(self, message_type: str, target: str, data: dict):
        """
        Handle incoming Pub/Sub message from Redis.

        Routes messages to appropriate local WebSocket connections.

        Args:
            message_type: Type of message ("personal", "ticker", "broadcast")
            target: Target identifier (user_id, ticker, or "all")
            data: Message payload
        """
        if message_type == "personal":
            # Find local connection(s) for this user
            for client_id, ws in list(self.active_connections.items()):
                if self._extract_user_id(client_id) == target:
                    try:
                        await ws.send_json(data)
                    except Exception as e:
                        logger.warning(f"Pub/Sub delivery failed for {client_id}: {e}")
                        self.disconnect(client_id)

        elif message_type == "ticker":
            # Deliver to local clients subscribed to this ticker
            notification = data.get("notification", {})
            message = {
                "type": "ticker_update",
                "ticker": target,
                "data": notification,
                "timestamp": datetime.now().isoformat()
            }

            disconnected = []
            for client_id, subscribed in self.subscriptions.items():
                if target in subscribed and client_id in self.active_connections:
                    try:
                        await self.active_connections[client_id].send_json(message)
                    except Exception:
                        disconnected.append(client_id)

            for client_id in disconnected:
                self.disconnect(client_id)

        elif message_type == "broadcast":
            # Deliver to all local clients (don't re-publish)
            disconnected = []
            for client_id, ws in list(self.active_connections.items()):
                try:
                    await ws.send_json(data)
                except Exception:
                    disconnected.append(client_id)

            for client_id in disconnected:
                self.disconnect(client_id)

    def get_status(self) -> dict:
        """Get connection manager status for monitoring."""
        pubsub_status = None
        if self._pubsub_manager:
            pubsub_status = self._pubsub_manager.get_status()

        return {
            "active_connections": len(self.active_connections),
            "total_subscriptions": sum(len(s) for s in self.subscriptions.values()),
            "pubsub": pubsub_status,
        }


# Global connection manager instance
manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time notifications.

    URL: /ws/notifications/{client_id}

    Supported message types from client:
    - subscribe: Subscribe to ticker updates
    - unsubscribe: Unsubscribe from ticker updates
    - ping: Keepalive ping (responds with pong)
    """
    await manager.connect(client_id, websocket)

    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "subscribe":
                # Subscribe to ticker updates
                ticker = data.get("ticker")
                if ticker:
                    manager.subscribe(client_id, ticker)
                    await websocket.send_json({
                        "type": "subscribed",
                        "ticker": ticker,
                        "message": f"Subscribed to {ticker} updates"
                    })

            elif message_type == "unsubscribe":
                # Unsubscribe from ticker updates
                ticker = data.get("ticker")
                if ticker:
                    manager.unsubscribe(client_id, ticker)
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "ticker": ticker,
                        "message": f"Unsubscribed from {ticker} updates"
                    })

            elif message_type == "ping":
                # Respond to ping for keepalive
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
        manager.disconnect(client_id)
