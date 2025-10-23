# app/services/notification_service.py

from typing import Dict, List, Optional
from datetime import datetime
import asyncio


class NotificationService:
    """
    Service for managing and sending notifications
    """

    def __init__(self):
        self.notification_queue = []

    async def send_notification(
        self,
        client_id: str,
        notification_type: str,
        title: str,
        message: str,
        category: str = "System",
        priority: str = "medium",
        metadata: Optional[Dict] = None,
    ):
        """
        Send a notification to a specific client via WebSocket

        Args:
            client_id: Client identifier
            notification_type: Type of notification ('success', 'error', 'warning', 'info', 'critical')
            title: Notification title
            message: Notification message
            category: Category ('Portfolio', 'Market', 'News', 'System')
            priority: Priority level ('low', 'medium', 'high', 'critical')
            metadata: Additional data
        """
        from ..api.websocket import manager

        notification = {
            "type": notification_type,
            "title": title,
            "message": message,
            "category": category,
            "priority": priority,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {},
        }

        await manager.send_personal_notification(client_id, notification)

    async def broadcast_notification(
        self,
        notification_type: str,
        title: str,
        message: str,
        category: str = "System",
        priority: str = "medium",
        metadata: Optional[Dict] = None,
    ):
        """
        Broadcast a notification to all connected clients

        Args:
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            category: Category
            priority: Priority level
            metadata: Additional data
        """
        from ..api.websocket import manager

        notification = {
            "type": notification_type,
            "title": title,
            "message": message,
            "category": category,
            "priority": priority,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {},
        }

        await manager.broadcast(notification)

    async def send_price_alert(
        self,
        client_id: str,
        ticker: str,
        current_price: float,
        alert_price: float,
        alert_type: str,
    ):
        """
        Send a price alert notification

        Args:
            client_id: Client identifier
            ticker: Stock ticker symbol
            current_price: Current stock price
            alert_price: Alert threshold price
            alert_type: Type of alert ('above' or 'below')
        """
        direction = "risen above" if alert_type == "above" else "fallen below"

        await self.send_notification(
            client_id=client_id,
            notification_type="warning",
            title=f"Price Alert: {ticker}",
            message=f"{ticker} has {direction} ${alert_price:.2f}. Current price: ${current_price:.2f}",
            category="Market",
            priority="high",
            metadata={
                "ticker": ticker,
                "currentPrice": current_price,
                "alertPrice": alert_price,
                "alertType": alert_type,
            },
        )

    async def send_news_notification(
        self,
        client_id: str,
        ticker: str,
        news_count: int,
        sentiment: float,
    ):
        """
        Send a news update notification

        Args:
            client_id: Client identifier
            ticker: Stock ticker symbol
            news_count: Number of new articles
            sentiment: Overall sentiment score (-1 to 1)
        """
        sentiment_text = (
            "positive" if sentiment > 0.1 else "negative" if sentiment < -0.1 else "neutral"
        )

        await self.send_notification(
            client_id=client_id,
            notification_type="info",
            title=f"{news_count} new article{'s' if news_count > 1 else ''} for {ticker}",
            message=f"Overall sentiment: {sentiment_text}",
            category="News",
            priority="low",
            metadata={
                "ticker": ticker,
                "newsCount": news_count,
                "sentiment": sentiment,
            },
        )

    async def send_portfolio_update(
        self,
        client_id: str,
        notification_type: str,
        message: str,
        data: Optional[Dict] = None,
    ):
        """
        Send a portfolio update notification

        Args:
            client_id: Client identifier
            notification_type: Type of notification
            message: Notification message
            data: Additional portfolio data
        """
        await self.send_notification(
            client_id=client_id,
            notification_type=notification_type,
            title="Portfolio Update",
            message=message,
            category="Portfolio",
            priority="high" if notification_type == "error" else "medium",
            metadata=data or {},
        )

    async def broadcast_market_event(
        self,
        title: str,
        message: str,
        event_data: Optional[Dict] = None,
    ):
        """
        Broadcast a market event to all clients

        Args:
            title: Event title
            message: Event message
            event_data: Additional event data
        """
        await self.broadcast_notification(
            notification_type="warning",
            title=title,
            message=message,
            category="Market",
            priority="high",
            metadata=event_data or {},
        )


# Global instance
notification_service = NotificationService()
