# app/services/sentiment_alert_service.py

import asyncio
from typing import Set, Optional
from datetime import datetime
import logging
from .notification_service import notification_service

logger = logging.getLogger(__name__)


class SentimentAlertService:
    """
    Service for monitoring sentiment alerts and triggering notifications.
    Uses the existing sentiment_service to calculate sentiment scores.
    """

    def __init__(self):
        self.monitoring_task = None
        self.is_running = False
        # Cache of active tickers for efficient monitoring
        self._ticker_cache: Set[str] = set()
        self._cache_updated_at: Optional[datetime] = None

    async def get_all_monitored_tickers(self) -> Set[str]:
        """Get unique tickers from all active sentiment alerts."""
        from app.models.notification import get_sentiment_alerts

        # Refresh cache every 60 seconds
        if (self._cache_updated_at is None or
            (datetime.utcnow() - self._cache_updated_at).total_seconds() > 60):

            all_alerts = []
            # Get all active alerts (across all users)
            from app.database import get_sentiment_alerts_collection
            collection = get_sentiment_alerts_collection()
            cursor = collection.find({"is_active": True, "triggered": False})

            from app.models.notification import SentimentAlertModel
            for doc in cursor:
                all_alerts.append(SentimentAlertModel.from_mongo(doc))

            self._ticker_cache = {alert.ticker.upper() for alert in all_alerts}
            self._cache_updated_at = datetime.utcnow()

        return self._ticker_cache

    async def check_sentiment_alerts(self, ticker: str, sentiment_data: dict):
        """
        Check all active sentiment alerts for a ticker.

        Args:
            ticker: Stock ticker symbol
            sentiment_data: Sentiment analysis result from sentiment_service
                           Contains: overall_weighted_score, sentiment_momentum, etc.
        """
        from app.models.notification import (
            get_active_sentiment_alerts_for_ticker,
            trigger_sentiment_alert,
            update_sentiment_alert_state,
            SentimentAlertCondition
        )

        # Get sentiment values
        current_sentiment = sentiment_data.get("overall_weighted_score")
        current_momentum = sentiment_data.get("sentiment_momentum")

        if current_sentiment is None:
            logger.warning(f"No sentiment score available for {ticker}")
            return

        # Get active alerts for this ticker
        alerts = await get_active_sentiment_alerts_for_ticker(ticker)

        if not alerts:
            return

        logger.debug(f"Checking {len(alerts)} sentiment alerts for {ticker}")

        triggered_count = 0

        for alert in alerts:
            try:
                # Check if condition is met
                if alert.check_condition(current_sentiment, current_momentum):
                    # Generate notification
                    condition_desc = self._get_condition_description(alert, current_sentiment, current_momentum)

                    title = alert.notification_title or f"Sentiment Alert: {ticker}"
                    message = alert.notification_message or f"{ticker} sentiment {condition_desc}"

                    await notification_service.send_notification(
                        client_id=alert.user_id,
                        notification_type="warning",
                        title=title,
                        message=message,
                        category="Market",
                        subcategory="Sentiment Alert",
                        priority=alert.priority,
                        metadata={
                            "ticker": ticker,
                            "currentSentiment": current_sentiment,
                            "currentMomentum": current_momentum,
                            "condition": alert.condition.value,
                            "alertId": alert.id,
                        },
                        user_id=alert.user_id,
                        action_url=f"/ticker/{ticker}",
                        portfolio_id=alert.portfolio_id,
                        portfolio_name=alert.portfolio_name,
                        is_global=alert.is_global,
                        affected_tickers=[ticker],
                    )

                    # Mark alert as triggered
                    await trigger_sentiment_alert(alert.id, current_sentiment)

                    triggered_count += 1
                    logger.info(
                        f"Sentiment alert triggered: {ticker} {alert.condition.value} "
                        f"(sentiment: {current_sentiment:.2f}) for user {alert.user_id}"
                    )
                else:
                    # Update alert state for next check
                    await update_sentiment_alert_state(alert.id, current_sentiment, current_momentum)

            except Exception as e:
                logger.error(f"Error processing sentiment alert {alert.id}: {e}")

        if triggered_count > 0:
            # Invalidate ticker cache since some alerts were triggered
            self._cache_updated_at = None

    def _get_condition_description(self, alert, sentiment: float, momentum: Optional[float]) -> str:
        """Generate human-readable condition description."""
        from app.models.notification import SentimentAlertCondition

        if alert.condition == SentimentAlertCondition.BECOMES_BULLISH:
            return f"became BULLISH (score: {sentiment:.2f})"
        elif alert.condition == SentimentAlertCondition.BECOMES_BEARISH:
            return f"became BEARISH (score: {sentiment:.2f})"
        elif alert.condition == SentimentAlertCondition.BECOMES_NEUTRAL:
            return f"became NEUTRAL (score: {sentiment:.2f})"
        elif alert.condition == SentimentAlertCondition.CROSSES_ABOVE:
            return f"crossed above {alert.threshold:.2f} (current: {sentiment:.2f})"
        elif alert.condition == SentimentAlertCondition.CROSSES_BELOW:
            return f"crossed below {alert.threshold:.2f} (current: {sentiment:.2f})"
        elif alert.condition == SentimentAlertCondition.MOMENTUM_POSITIVE:
            return f"momentum became positive (current: {momentum:.2f if momentum else 'N/A'})"
        elif alert.condition == SentimentAlertCondition.MOMENTUM_NEGATIVE:
            return f"momentum became negative (current: {momentum:.2f if momentum else 'N/A'})"
        return f"condition met (score: {sentiment:.2f})"

    async def monitor_sentiments(self, interval: int = 60):
        """
        Background task to monitor sentiments and check alerts.
        Default interval is 60 seconds (1 minute).

        Args:
            interval: Monitoring interval in seconds
        """
        logger.info(f"Starting sentiment alert monitoring (interval: {interval}s)")
        self.is_running = True

        try:
            # Import sentiment service (uses your existing implementation)
            from .sentiment_service import sentiment_service
            from .news_service import news_service_instance

            while self.is_running:
                # Get all tickers that have active alerts
                tickers = await self.get_all_monitored_tickers()

                if tickers:
                    logger.info(f"Monitoring sentiment for {len(tickers)} tickers: {', '.join(sorted(tickers))}")

                    # Fetch sentiment for all monitored tickers IN PARALLEL
                    async def check_ticker_sentiment(ticker: str):
                        try:
                            # Get news articles for the ticker
                            articles = await news_service_instance.get_ticker_news(ticker)

                            if articles:
                                # Analyze sentiment using YOUR existing sentiment_service
                                sentiment_data = await sentiment_service.analyze_sentiment_with_momentum(articles)

                                if sentiment_data:
                                    logger.info(
                                        f"Sentiment for {ticker}: {sentiment_data.get('overall_weighted_score', 'N/A'):.2f}, "
                                        f"Momentum: {sentiment_data.get('sentiment_momentum', 'N/A'):.2f}"
                                    )
                                    await self.check_sentiment_alerts(ticker, sentiment_data)
                                else:
                                    logger.warning(f"No sentiment data available for {ticker}")
                            else:
                                logger.debug(f"No articles found for {ticker}")

                        except Exception as e:
                            logger.error(f"Error fetching sentiment for {ticker}: {e}")

                    # Process all tickers in parallel for faster execution
                    await asyncio.gather(*[check_ticker_sentiment(ticker) for ticker in tickers])

                    logger.debug(f"Completed sentiment check cycle, sleeping for {interval} seconds")
                else:
                    logger.debug("No active sentiment alerts to monitor")

                await asyncio.sleep(interval)

        except asyncio.CancelledError:
            logger.info("Sentiment monitoring task cancelled")
            raise
        except Exception as e:
            logger.error(f"Error in sentiment monitoring: {e}", exc_info=True)
        finally:
            self.is_running = False
            logger.info("Sentiment alert monitoring stopped")

    def start_monitoring(self, interval: int = 60):
        """Start the background monitoring task"""
        if not self.monitoring_task or self.monitoring_task.done():
            self.monitoring_task = asyncio.create_task(self.monitor_sentiments(interval))
            logger.info(f"Sentiment alert monitoring task started (interval: {interval}s)")
        else:
            logger.warning("Sentiment monitoring task already running")

    def stop_monitoring(self):
        """Stop the background monitoring task"""
        if self.monitoring_task and not self.monitoring_task.done():
            self.is_running = False
            self.monitoring_task.cancel()
            logger.info("Sentiment alert monitoring task stopped")


# Global sentiment alert service instance
sentiment_alert_service = SentimentAlertService()
