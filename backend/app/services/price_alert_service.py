# app/services/price_alert_service.py

import asyncio
from typing import Dict, List, Set, Optional
from datetime import datetime
import logging
from .notification_service import notification_service

logger = logging.getLogger(__name__)


class PriceAlertService:
    """
    Service for monitoring price alerts and triggering notifications.
    Now uses MongoDB for persistent storage instead of in-memory storage.
    """

    def __init__(self):
        self.monitoring_task = None
        self.is_running = False
        # Cache of active tickers for efficient monitoring
        self._ticker_cache: Set[str] = set()
        self._cache_updated_at: Optional[datetime] = None

    async def add_alert(
        self,
        user_id: str,
        ticker: str,
        condition: str,
        target_price: Optional[float] = None,
        base_price: Optional[float] = None,
        percent_change: Optional[float] = None,
        notification_title: Optional[str] = None,
        notification_message: Optional[str] = None,
        priority: str = "high",
        notes: Optional[str] = None,
        portfolio_id: Optional[str] = None,
        portfolio_name: Optional[str] = None,
        is_global: bool = False,
    ) -> str:
        """
        Add a price alert for a user (database-backed).

        Args:
            user_id: User identifier
            ticker: Stock ticker symbol
            condition: Alert condition ('above', 'below', 'percent_increase', 'percent_decrease')
            target_price: Price threshold for above/below conditions
            base_price: Base price for percentage conditions
            percent_change: Percentage change for percentage conditions
            notification_title: Custom notification title
            notification_message: Custom notification message
            priority: Alert priority
            notes: Optional notes
            portfolio_id: Portfolio ID this alert belongs to
            portfolio_name: Portfolio name for display
            is_global: True if alert applies to ticker across all portfolios

        Returns:
            Alert ID
        """
        from ..models.notification import PriceAlertModel, create_price_alert

        ticker = ticker.upper()

        # If portfolio_id is not provided and not global, try to get user's primary portfolio
        if not portfolio_id and not is_global:
            try:
                from ..database import get_portfolios_collection_async
                portfolios = get_portfolios_collection_async()
                primary = await portfolios.find_one({
                    "username": user_id,  # Using username as user_id for now
                    "is_primary": True,
                    "is_active": True
                })
                if primary:
                    portfolio_id = str(primary["_id"])
                    portfolio_name = primary.get("portfolio_name") or primary.get("account_name")
            except Exception as e:
                logger.warning(f"Could not get primary portfolio for user {user_id}: {e}")

        # Create alert model
        alert = PriceAlertModel(
            user_id=user_id,
            ticker=ticker,
            condition=condition,
            target_price=target_price,
            base_price=base_price,
            percent_change=percent_change,
            notification_title=notification_title,
            notification_message=notification_message,
            priority=priority,
            notes=notes,
            portfolio_id=portfolio_id,
            portfolio_name=portfolio_name,
            is_global=is_global,
        )

        # Save to database
        alert_id = await create_price_alert(alert)

        # Invalidate ticker cache
        self._cache_updated_at = None

        logger.info(f"✅ Price alert added: {ticker} {condition} for user {user_id} (ID: {alert_id})")
        return alert_id

    async def remove_alert(self, user_id: str, alert_id: str) -> bool:
        """
        Remove a specific alert from database.

        Args:
            user_id: User identifier
            alert_id: Alert identifier to remove

        Returns:
            True if alert was deleted, False otherwise
        """
        from ..models.notification import delete_price_alert

        success = await delete_price_alert(alert_id, user_id)

        if success:
            # Invalidate ticker cache
            self._cache_updated_at = None
            logger.info(f"❌ Price alert removed: {alert_id} for user {user_id}")
        else:
            logger.warning(f"Failed to remove price alert: {alert_id} for user {user_id}")

        return success

    async def get_all_monitored_tickers(self) -> Set[str]:
        """
        Get set of all tickers being monitored across all users.
        Uses caching to avoid excessive database queries.
        """
        from ..database import get_price_alerts_collection_async
        from datetime import timedelta

        # Check if cache is still valid (5 minutes)
        if (
            self._cache_updated_at
            and datetime.utcnow() - self._cache_updated_at < timedelta(minutes=5)
        ):
            return self._ticker_cache

        # Query database for all unique tickers with active alerts
        collection = get_price_alerts_collection_async()
        pipeline = [
            {"$match": {"is_active": True, "triggered": False}},
            {"$group": {"_id": "$ticker"}},
        ]

        tickers = set()
        async for doc in collection.aggregate(pipeline):
            tickers.add(doc["_id"])

        # Update cache
        self._ticker_cache = tickers
        self._cache_updated_at = datetime.utcnow()

        return tickers

    async def check_price_alerts(self, ticker: str, current_price: float):
        """
        Check if current price triggers any alerts for a ticker (database-backed).

        Args:
            ticker: Stock ticker symbol
            current_price: Current stock price
        """
        from ..models.notification import get_active_alerts_for_ticker, trigger_price_alert

        ticker = ticker.upper()
        triggered_count = 0

        # Get all active alerts for this ticker from database
        alerts = await get_active_alerts_for_ticker(ticker)

        for alert in alerts:
            # Check if alert condition is met
            if alert.check_condition(current_price):
                try:
                    # Send notification with portfolio context
                    await notification_service.send_notification(
                        client_id=f"user-{alert.user_id}",
                        notification_type="warning",
                        title=f"Price Alert: {ticker}",
                        message=alert.notification_message or self._build_alert_message(
                            ticker, current_price, alert
                        ),
                        category="Market",
                        subcategory="Price Alert",
                        priority=alert.priority,
                        metadata={
                            "ticker": ticker,
                            "currentPrice": current_price,
                            "alertPrice": alert.target_price or alert.percent_change,
                            "alertType": alert.condition,
                            "alertId": alert.id,
                        },
                        user_id=alert.user_id,
                        action_url=f"/ticker/{ticker}",
                        portfolio_id=alert.portfolio_id,
                        portfolio_name=alert.portfolio_name,
                        is_global=alert.is_global,
                        affected_tickers=[ticker],
                    )

                    # Mark alert as triggered in database
                    await trigger_price_alert(alert.id, current_price)

                    triggered_count += 1
                    logger.info(
                        f"🔔 Price alert triggered: {ticker} {alert.condition} "
                        f"{'$' + str(alert.target_price) if alert.target_price else str(alert.percent_change) + '%'} "
                        f"for user {alert.user_id}"
                    )

                except Exception as e:
                    logger.error(f"Error processing alert {alert.id}: {e}")

        if triggered_count > 0:
            # Invalidate ticker cache since some alerts were triggered
            self._cache_updated_at = None

    async def monitor_prices(self, interval: int = 60):
        """
        Background task to monitor prices and check alerts (database-backed).

        Args:
            interval: Monitoring interval in seconds
        """
        logger.info(f"🔄 Starting database-backed price alert monitoring (interval: {interval}s)")
        self.is_running = True

        try:
            from .stock_data_service import stock_service

            while self.is_running:
                # Get all tickers that have active alerts
                tickers = await self.get_all_monitored_tickers()

                if tickers:
                    logger.info(f"Monitoring {len(tickers)} tickers: {', '.join(sorted(tickers))}")

                    # Fetch current prices for all monitored tickers
                    for ticker in tickers:
                        try:
                            # Get current price
                            price_data = await stock_service.get_current_price(ticker)
                            if price_data:
                                current_price = price_data.get("price")
                                if current_price:
                                    await self.check_price_alerts(ticker, current_price)
                        except Exception as e:
                            logger.error(f"Error fetching price for {ticker}: {e}")

                    logger.debug(f"Completed price check cycle, sleeping for {interval} seconds")
                else:
                    logger.debug("No active price alerts to monitor")

                await asyncio.sleep(interval)

        except asyncio.CancelledError:
            logger.info("Price monitoring task cancelled")
            raise
        except Exception as e:
            logger.error(f"Error in price monitoring: {e}", exc_info=True)
        finally:
            self.is_running = False
            logger.info("⏹️ Price alert monitoring stopped")

    def start_monitoring(self, interval: int = 60):
        """Start the background monitoring task"""
        if not self.monitoring_task or self.monitoring_task.done():
            self.monitoring_task = asyncio.create_task(self.monitor_prices(interval))

    def stop_monitoring(self):
        """Stop the background monitoring task"""
        self.is_running = False
        if self.monitoring_task:
            self.monitoring_task.cancel()

    def _build_alert_message(self, ticker: str, current_price: float, alert) -> str:
        """Build a default alert message."""
        direction = {
            "above": "risen above",
            "below": "fallen below",
            "percent_increase": "increased by",
            "percent_decrease": "decreased by"
        }.get(alert.condition, "reached")

        price_info = f"${alert.target_price:.2f}" if alert.target_price else f"{alert.percent_change}%"

        message = f"{ticker} has {direction} {price_info}. Current price: ${current_price:.2f}"
        if alert.portfolio_name:
            message += f" (Portfolio: {alert.portfolio_name})"

        return message

    async def get_portfolio_alerts(
        self,
        user_id: str,
        portfolio_id: str,
        is_active: Optional[bool] = None,
        ticker: Optional[str] = None
    ) -> List:
        """
        Get all alerts for a specific portfolio.

        Args:
            user_id: User identifier
            portfolio_id: Portfolio ID
            is_active: Filter by active status
            ticker: Filter by ticker

        Returns:
            List of price alerts for the portfolio
        """
        from ..models.notification import get_price_alerts

        alerts = await get_price_alerts(
            user_id=user_id,
            portfolio_id=portfolio_id,
            include_global=True,
            is_active=is_active,
            ticker=ticker
        )

        return alerts

    async def check_portfolio_alerts(self, portfolio_id: str, holdings: List[Dict]):
        """
        Check alerts for all holdings in a portfolio.

        Args:
            portfolio_id: Portfolio ID
            holdings: List of holdings with ticker and current price
        """
        from ..models.notification import get_portfolio_alerts_for_ticker

        for holding in holdings:
            ticker = holding.get("ticker") or holding.get("symbol")
            current_price = holding.get("current_price") or holding.get("market_value", 0) / holding.get("quantity", 1)

            if ticker and current_price > 0:
                # Get alerts for this ticker in this portfolio
                alerts = await get_portfolio_alerts_for_ticker(ticker, portfolio_id)

                for alert in alerts:
                    if alert.check_condition(current_price):
                        try:
                            # Send notification
                            await notification_service.send_notification(
                                client_id=f"user-{alert.user_id}",
                                notification_type="warning",
                                title=f"Price Alert: {ticker}",
                                message=alert.notification_message or self._build_alert_message(
                                    ticker, current_price, alert
                                ),
                                category="Market",
                                subcategory="Price Alert",
                                priority=alert.priority,
                                metadata={
                                    "ticker": ticker,
                                    "currentPrice": current_price,
                                    "alertPrice": alert.target_price or alert.percent_change,
                                    "alertType": alert.condition,
                                    "alertId": alert.id,
                                },
                                user_id=alert.user_id,
                                portfolio_id=portfolio_id,
                                portfolio_name=alert.portfolio_name,
                                affected_tickers=[ticker],
                            )

                            # Mark alert as triggered
                            from ..models.notification import trigger_price_alert
                            await trigger_price_alert(alert.id, current_price)

                            logger.info(
                                f"🔔 Portfolio alert triggered: {ticker} in portfolio {portfolio_id}"
                            )

                        except Exception as e:
                            logger.error(f"Error processing portfolio alert {alert.id}: {e}")

    async def copy_alerts_to_portfolio(
        self,
        user_id: str,
        from_portfolio_id: str,
        to_portfolio_id: str
    ) -> int:
        """
        Copy all alerts from one portfolio to another.

        Args:
            user_id: User identifier
            from_portfolio_id: Source portfolio ID
            to_portfolio_id: Target portfolio ID

        Returns:
            Number of alerts copied
        """
        # Get all active alerts from source portfolio
        source_alerts = await self.get_portfolio_alerts(
            user_id=user_id,
            portfolio_id=from_portfolio_id,
            is_active=True
        )

        # Get target portfolio info
        from ..database import get_portfolios_collection_async
        from bson import ObjectId
        portfolios = get_portfolios_collection_async()
        target_portfolio = await portfolios.find_one({"_id": ObjectId(to_portfolio_id)})

        if not target_portfolio:
            logger.error(f"Target portfolio {to_portfolio_id} not found")
            return 0

        copied_count = 0

        for alert in source_alerts:
            if not alert.is_global:  # Don't copy global alerts
                try:
                    # Create new alert for target portfolio
                    await self.add_alert(
                        user_id=user_id,
                        ticker=alert.ticker,
                        condition=alert.condition,
                        target_price=alert.target_price,
                        base_price=alert.base_price,
                        percent_change=alert.percent_change,
                        notification_title=alert.notification_title,
                        notification_message=alert.notification_message,
                        priority=alert.priority,
                        notes=f"Copied from portfolio {from_portfolio_id}",
                        portfolio_id=to_portfolio_id,
                        portfolio_name=target_portfolio.get("portfolio_name") or target_portfolio.get("account_name"),
                        is_global=False,
                    )
                    copied_count += 1
                except Exception as e:
                    logger.error(f"Error copying alert {alert.id}: {e}")

        logger.info(f"Copied {copied_count} alerts from portfolio {from_portfolio_id} to {to_portfolio_id}")
        return copied_count


# Global instance
price_alert_service = PriceAlertService()
