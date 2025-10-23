# app/services/price_alert_service.py

import asyncio
from typing import Dict, List, Set
from datetime import datetime
from .notification_service import notification_service


class PriceAlertService:
    """
    Service for monitoring price alerts and triggering notifications
    """

    def __init__(self):
        # Structure: { client_id: { ticker: [alerts] } }
        self.alerts: Dict[str, Dict[str, List[Dict]]] = {}
        self.monitoring_task = None
        self.is_running = False

    def add_alert(
        self,
        client_id: str,
        ticker: str,
        condition: str,
        target_price: float,
        alert_id: str,
    ):
        """
        Add a price alert for a client

        Args:
            client_id: Client identifier
            ticker: Stock ticker symbol
            condition: Alert condition ('above' or 'below')
            target_price: Price threshold
            alert_id: Unique alert identifier
        """
        ticker = ticker.upper()

        if client_id not in self.alerts:
            self.alerts[client_id] = {}

        if ticker not in self.alerts[client_id]:
            self.alerts[client_id][ticker] = []

        alert = {
            "id": alert_id,
            "condition": condition,
            "target_price": target_price,
            "created_at": datetime.now().isoformat(),
        }

        self.alerts[client_id][ticker].append(alert)
        print(f"✅ Price alert added: {ticker} {condition} ${target_price} for client {client_id}")

    def remove_alert(self, client_id: str, alert_id: str):
        """
        Remove a specific alert

        Args:
            client_id: Client identifier
            alert_id: Alert identifier to remove
        """
        if client_id not in self.alerts:
            return

        for ticker in self.alerts[client_id]:
            self.alerts[client_id][ticker] = [
                a for a in self.alerts[client_id][ticker] if a["id"] != alert_id
            ]

        # Clean up empty structures
        self.alerts[client_id] = {
            ticker: alerts
            for ticker, alerts in self.alerts[client_id].items()
            if alerts
        }

        if not self.alerts[client_id]:
            del self.alerts[client_id]

        print(f"❌ Price alert removed: {alert_id} for client {client_id}")

    def get_all_monitored_tickers(self) -> Set[str]:
        """Get set of all tickers being monitored"""
        tickers = set()
        for client_alerts in self.alerts.values():
            tickers.update(client_alerts.keys())
        return tickers

    async def check_price_alerts(self, ticker: str, current_price: float):
        """
        Check if current price triggers any alerts for a ticker

        Args:
            ticker: Stock ticker symbol
            current_price: Current stock price
        """
        ticker = ticker.upper()
        triggered_alerts = []

        for client_id, client_alerts in self.alerts.items():
            if ticker not in client_alerts:
                continue

            for alert in client_alerts[ticker]:
                should_trigger = False

                if alert["condition"] == "above" and current_price >= alert["target_price"]:
                    should_trigger = True
                elif alert["condition"] == "below" and current_price <= alert["target_price"]:
                    should_trigger = True

                if should_trigger:
                    # Send notification
                    await notification_service.send_price_alert(
                        client_id=client_id,
                        ticker=ticker,
                        current_price=current_price,
                        alert_price=alert["target_price"],
                        alert_type=alert["condition"],
                    )

                    triggered_alerts.append((client_id, alert["id"]))
                    print(f"🔔 Price alert triggered: {ticker} {alert['condition']} ${alert['target_price']}")

        # Remove triggered alerts
        for client_id, alert_id in triggered_alerts:
            self.remove_alert(client_id, alert_id)

    async def monitor_prices(self, interval: int = 60):
        """
        Background task to monitor prices and check alerts

        Args:
            interval: Monitoring interval in seconds
        """
        print(f"🔄 Starting price alert monitoring (interval: {interval}s)")
        self.is_running = True

        try:
            from .stock_data_service import stock_service

            while self.is_running:
                tickers = self.get_all_monitored_tickers()

                if tickers:
                    print(f"Monitoring {len(tickers)} tickers: {', '.join(sorted(tickers))}")

                    # Fetch current prices for all monitored tickers
                    for ticker in tickers:
                        try:
                            # Get current price (you'll need to implement this based on your stock service)
                            price_data = await stock_service.get_current_price(ticker)
                            if price_data:
                                current_price = price_data.get("price")
                                if current_price:
                                    await self.check_price_alerts(ticker, current_price)
                        except Exception as e:
                            print(f"Error fetching price for {ticker}: {e}")

                await asyncio.sleep(interval)

        except Exception as e:
            print(f"Error in price monitoring: {e}")
        finally:
            self.is_running = False
            print("⏹️ Price alert monitoring stopped")

    def start_monitoring(self, interval: int = 60):
        """Start the background monitoring task"""
        if not self.monitoring_task or self.monitoring_task.done():
            self.monitoring_task = asyncio.create_task(self.monitor_prices(interval))

    def stop_monitoring(self):
        """Stop the background monitoring task"""
        self.is_running = False
        if self.monitoring_task:
            self.monitoring_task.cancel()


# Global instance
price_alert_service = PriceAlertService()
