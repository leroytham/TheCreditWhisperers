# app/services/notification_service.py

from typing import Dict, List, Optional
from datetime import datetime
import asyncio
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Service for managing and sending notifications.
    Now includes database persistence for all notifications.
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
        persist: bool = True,
        user_id: Optional[str] = None,
        preview: Optional[str] = None,
        subcategory: Optional[str] = None,
        show_as_toast: bool = True,
        duration: Optional[int] = None,
        action_url: Optional[str] = None,
        portfolio_id: Optional[str] = None,
        portfolio_name: Optional[str] = None,
        is_global: bool = False,
        affected_tickers: Optional[List[str]] = None,
    ):
        """
        Send a notification to a specific client via WebSocket and optionally persist to database.

        Args:
            client_id: Client identifier (format: "user-{user_id}")
            notification_type: Type of notification ('success', 'error', 'warning', 'info', 'critical')
            title: Notification title
            message: Notification message
            category: Category ('Portfolio', 'Market', 'News', 'System')
            priority: Priority level ('low', 'medium', 'high', 'critical')
            metadata: Additional data
            persist: Whether to save to database (default: True)
            user_id: User ID for database persistence (extracted from client_id if not provided)
            preview: Short preview text
            subcategory: Subcategory for grouping
            show_as_toast: Whether to show as toast notification
            duration: Toast duration in milliseconds
            action_url: Optional action URL
            portfolio_id: Portfolio ID this notification relates to
            portfolio_name: Portfolio name for display
            is_global: True if notification applies to all portfolios
            affected_tickers: List of tickers affected by this notification
        """
        from ..api.websocket import manager

        # Extract user_id from client_id if not provided
        if not user_id and client_id.startswith("user-"):
            user_id = client_id.replace("user-", "").split("-")[0]

        # Create notification dictionary
        notification = {
            "type": notification_type,
            "title": title,
            "message": message,
            "category": category,
            "priority": priority,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {},
            "preview": preview or message[:100] if len(message) > 100 else message,
            "subcategory": subcategory,
            "show_as_toast": show_as_toast,
            "duration": duration,
            "action_url": action_url,
            "portfolio_id": portfolio_id,
            "portfolio_name": portfolio_name,
            "is_global": is_global,
            "affected_tickers": affected_tickers or [],
        }

        # Persist to database if requested and user_id is available
        notification_id = None
        if persist and user_id:
            try:
                from ..models.notification import NotificationModel, create_notification

                # Create notification model
                notification_model = NotificationModel(
                    user_id=user_id,
                    type=notification_type,
                    category=category,
                    subcategory=subcategory,
                    priority=priority,
                    title=title,
                    message=message,
                    preview=preview or notification["preview"],
                    metadata=metadata,
                    show_as_toast=show_as_toast,
                    duration=duration,
                    action_url=action_url,
                    portfolio_id=portfolio_id,
                    portfolio_name=portfolio_name,
                    is_global=is_global,
                    affected_tickers=affected_tickers or [],
                )

                # Save to database
                notification_id = await create_notification(notification_model)
                notification["id"] = notification_id
                logger.info(f"Persisted notification {notification_id} for user {user_id}")

            except Exception as e:
                logger.error(f"Failed to persist notification: {e}")
                # Continue with WebSocket delivery even if persistence fails

        # Send via WebSocket
        try:
            await manager.send_personal_notification(client_id, notification)
            logger.debug(f"Sent notification to client {client_id} via WebSocket")
        except Exception as e:
            logger.warning(f"Failed to send WebSocket notification to {client_id}: {e}")

    async def broadcast_notification(
        self,
        notification_type: str,
        title: str,
        message: str,
        category: str = "System",
        priority: str = "medium",
        metadata: Optional[Dict] = None,
        persist: bool = True,
        preview: Optional[str] = None,
        subcategory: Optional[str] = None,
    ):
        """
        Broadcast a notification to all connected clients and optionally persist for all users.

        Args:
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            category: Category
            priority: Priority level
            metadata: Additional data
            persist: Whether to save to database for all active users
            preview: Short preview text
            subcategory: Subcategory for grouping
        """
        from ..api.websocket import manager

        notification = {
            "type": notification_type,
            "title": title,
            "message": message,
            "category": category,
            "priority": priority,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {},
            "preview": preview or message[:100] if len(message) > 100 else message,
            "subcategory": subcategory,
        }

        # Persist for all active users if requested
        if persist:
            try:
                from ..models.notification import NotificationModel, create_notification
                from ..database import get_database

                # Get all active user IDs (this is a simplified approach)
                # In production, you'd want to get this from a user service or session manager
                db = get_database()
                users_collection = db.get("users") or db.get("Account_Details")

                if users_collection:
                    # Create notification for each user
                    for user_doc in users_collection.find({}, {"_id": 1}).limit(100):
                        user_id = str(user_doc["_id"])
                        notification_model = NotificationModel(
                            user_id=user_id,
                            type=notification_type,
                            category=category,
                            subcategory=subcategory,
                            priority=priority,
                            title=title,
                            message=message,
                            preview=preview or notification["preview"],
                            metadata=metadata,
                            show_as_toast=True,
                        )
                        await create_notification(notification_model)

                    logger.info(f"Persisted broadcast notification for all users")

            except Exception as e:
                logger.error(f"Failed to persist broadcast notification: {e}")

        # Send via WebSocket to all connected clients
        await manager.broadcast(notification)

    async def send_price_alert(
        self,
        client_id: str,
        ticker: str,
        current_price: float,
        alert_price: float,
        alert_type: str,
        alert_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        """
        Send a price alert notification and mark the alert as triggered.

        Args:
            client_id: Client identifier
            ticker: Stock ticker symbol
            current_price: Current stock price
            alert_price: Alert threshold price
            alert_type: Type of alert ('above', 'below', 'percent_increase', 'percent_decrease')
            alert_id: ID of the price alert that triggered (optional)
            user_id: User ID for persistence (optional)
        """
        direction = {
            "above": "risen above",
            "below": "fallen below",
            "percent_increase": "increased by",
            "percent_decrease": "decreased by"
        }.get(alert_type, "reached")

        price_info = f"${alert_price:.2f}" if alert_type in ["above", "below"] else f"{alert_price}%"

        # Mark the alert as triggered if alert_id is provided
        if alert_id:
            try:
                from ..models.notification import trigger_price_alert
                await trigger_price_alert(alert_id, current_price)
                logger.info(f"Marked price alert {alert_id} as triggered")
            except Exception as e:
                logger.error(f"Failed to mark alert as triggered: {e}")

        await self.send_notification(
            client_id=client_id,
            notification_type="warning",
            title=f"Price Alert: {ticker}",
            message=f"{ticker} has {direction} {price_info}. Current price: ${current_price:.2f}",
            category="Market",
            subcategory="Price Alert",
            priority="high",
            metadata={
                "ticker": ticker,
                "currentPrice": current_price,
                "alertPrice": alert_price,
                "alertType": alert_type,
                "alertId": alert_id,
            },
            user_id=user_id,
            action_url=f"/ticker/{ticker}",
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
        portfolio_id: Optional[str] = None,
        portfolio_name: Optional[str] = None,
        affected_tickers: Optional[List[str]] = None,
    ):
        """
        Send a portfolio update notification

        Args:
            client_id: Client identifier
            notification_type: Type of notification
            message: Notification message
            data: Additional portfolio data
            portfolio_id: Portfolio ID this update relates to
            portfolio_name: Portfolio name for display
            affected_tickers: List of tickers affected
        """
        await self.send_notification(
            client_id=client_id,
            notification_type=notification_type,
            title=f"Portfolio Update{f': {portfolio_name}' if portfolio_name else ''}",
            message=message,
            category="Portfolio",
            priority="high" if notification_type == "error" else "medium",
            metadata=data or {},
            portfolio_id=portfolio_id,
            portfolio_name=portfolio_name,
            affected_tickers=affected_tickers,
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

    async def send_portfolio_notification(
        self,
        client_id: str,
        portfolio_id: str,
        portfolio_name: str,
        notification_type: str,
        title: str,
        message: str,
        affected_tickers: Optional[List[str]] = None,
        metadata: Optional[Dict] = None,
        priority: str = "medium",
        subcategory: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        """
        Send a notification specifically for a portfolio.

        Args:
            client_id: Client identifier
            portfolio_id: Portfolio ID
            portfolio_name: Portfolio name for display
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            affected_tickers: List of tickers affected
            metadata: Additional data
            priority: Priority level
            subcategory: Subcategory for grouping
            user_id: User ID for persistence
        """
        await self.send_notification(
            client_id=client_id,
            notification_type=notification_type,
            title=title,
            message=message,
            category="Portfolio",
            priority=priority,
            metadata=metadata,
            persist=True,
            user_id=user_id,
            subcategory=subcategory,
            portfolio_id=portfolio_id,
            portfolio_name=portfolio_name,
            is_global=False,
            affected_tickers=affected_tickers,
        )

    async def get_portfolio_notifications(
        self,
        user_id: str,
        portfolio_id: str,
        include_global: bool = True,
        limit: int = 50,
        offset: int = 0,
    ):
        """
        Get notifications for a specific portfolio.

        Args:
            user_id: User ID
            portfolio_id: Portfolio ID
            include_global: Whether to include global notifications
            limit: Maximum number of notifications to retrieve
            offset: Number of notifications to skip

        Returns:
            List of notifications for the portfolio
        """
        try:
            from ..models.notification import get_portfolio_notifications

            notifications = await get_portfolio_notifications(
                user_id=user_id,
                portfolio_id=portfolio_id,
                include_global=include_global,
                limit=limit,
                offset=offset
            )
            return notifications
        except Exception as e:
            logger.error(f"Failed to get portfolio notifications: {e}")
            return []

    async def notify_portfolio_holders(
        self,
        portfolio_id: str,
        notification_type: str,
        title: str,
        message: str,
        affected_tickers: Optional[List[str]] = None,
        metadata: Optional[Dict] = None,
        priority: str = "medium",
    ):
        """
        Send notification to all holders of a specific portfolio.

        Args:
            portfolio_id: Portfolio ID
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            affected_tickers: List of tickers affected
            metadata: Additional data
            priority: Priority level
        """
        try:
            from ..database import get_portfolios_collection_async
            from ..models.notification import create_notification, NotificationModel
            from bson import ObjectId

            # Get the portfolio
            portfolios = get_portfolios_collection_async()
            portfolio = await portfolios.find_one({"_id": ObjectId(portfolio_id) if isinstance(portfolio_id, str) else portfolio_id})

            if not portfolio:
                logger.error(f"Portfolio {portfolio_id} not found")
                return

            # Get all users associated with this portfolio
            # For now, assume one user per portfolio (username field)
            username = portfolio.get("username")
            portfolio_name = portfolio.get("portfolio_name") or portfolio.get("account_name")

            if username:
                # Create notification for the portfolio owner
                notification_model = NotificationModel(
                    user_id=username,  # Using username as user_id for now
                    type=notification_type,
                    category="Portfolio",
                    priority=priority,
                    title=title,
                    message=message,
                    portfolio_id=str(portfolio_id),
                    portfolio_name=portfolio_name,
                    is_global=False,
                    affected_tickers=affected_tickers or [],
                    metadata=metadata,
                    show_as_toast=True,
                )

                await create_notification(notification_model)

                # Send via WebSocket if client is connected
                client_id = f"user-{username}"
                try:
                    from ..api.websocket import manager
                    await manager.send_personal_notification(client_id, notification_model.dict())
                except Exception as e:
                    logger.warning(f"Failed to send WebSocket notification to {client_id}: {e}")

        except Exception as e:
            logger.error(f"Failed to notify portfolio holders: {e}")


# Global instance
notification_service = NotificationService()
