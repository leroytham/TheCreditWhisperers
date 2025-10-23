# app/api/websocket.py

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio
from datetime import datetime

class ConnectionManager:
    """
    Manages WebSocket connections for real-time notifications
    """
    def __init__(self):
        # Map of client_id to WebSocket connection
        self.active_connections: Dict[str, WebSocket] = {}
        # Map of client_id to set of subscribed tickers
        self.subscriptions: Dict[str, Set[str]] = {}

    async def connect(self, client_id: str, websocket: WebSocket):
        """Accept and store new WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.subscriptions[client_id] = set()
        print(f"✅ Client {client_id} connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        """Remove WebSocket connection"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.subscriptions:
            del self.subscriptions[client_id]
        print(f"❌ Client {client_id} disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_notification(self, client_id: str, notification: dict):
        """Send notification to a specific client"""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json({
                    "type": "notification",
                    "data": notification,
                    "timestamp": datetime.now().isoformat()
                })
            except Exception as e:
                print(f"Error sending to {client_id}: {e}")
                self.disconnect(client_id)

    async def broadcast(self, notification: dict, exclude_client: str = None):
        """Broadcast notification to all connected clients"""
        disconnected_clients = []
        for client_id, connection in self.active_connections.items():
            if client_id != exclude_client:
                try:
                    await connection.send_json({
                        "type": "notification",
                        "data": notification,
                        "timestamp": datetime.now().isoformat()
                    })
                except Exception as e:
                    print(f"Error broadcasting to {client_id}: {e}")
                    disconnected_clients.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

    def subscribe(self, client_id: str, ticker: str):
        """Subscribe client to ticker updates"""
        if client_id in self.subscriptions:
            self.subscriptions[client_id].add(ticker.upper())
            print(f"Client {client_id} subscribed to {ticker}")

    def unsubscribe(self, client_id: str, ticker: str):
        """Unsubscribe client from ticker updates"""
        if client_id in self.subscriptions:
            self.subscriptions[client_id].discard(ticker.upper())
            print(f"Client {client_id} unsubscribed from {ticker}")

    async def broadcast_to_subscribers(self, ticker: str, notification: dict):
        """Send notification to all clients subscribed to a ticker"""
        ticker = ticker.upper()
        disconnected_clients = []

        for client_id, subscribed_tickers in self.subscriptions.items():
            if ticker in subscribed_tickers:
                try:
                    await self.active_connections[client_id].send_json({
                        "type": "ticker_update",
                        "ticker": ticker,
                        "data": notification,
                        "timestamp": datetime.now().isoformat()
                    })
                except Exception as e:
                    print(f"Error sending ticker update to {client_id}: {e}")
                    disconnected_clients.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)


# Global connection manager instance
manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for real-time notifications

    URL: /ws/notifications/{client_id}
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
        print(f"WebSocket error for {client_id}: {e}")
        manager.disconnect(client_id)
