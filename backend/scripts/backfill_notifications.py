#!/usr/bin/env python3
"""
Notification Backfill Script

This script adds portfolio_id to existing notifications by associating them
with users' primary portfolios. It also backfills price alerts with portfolio context.

Usage:
    python backend/scripts/backfill_notifications.py [--dry-run] [--verbose]
"""

import sys
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import argparse
import logging
import re

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from pymongo import MongoClient, errors, UpdateOne
from pymongo.database import Database
from pymongo.collection import Collection
import certifi
from bson import ObjectId

# Import app modules
from app.core.config import settings


class NotificationBackfill:
    """Handles backfilling portfolio context to existing notifications."""

    def __init__(self, database: Database, dry_run: bool = False, verbose: bool = False):
        self.db = database
        self.dry_run = dry_run
        self.verbose = verbose
        self.logger = self._setup_logger()

        # Collections
        self.notifications = self.db["notifications"]
        self.price_alerts = self.db["price_alerts"]
        self.portfolios = self.db["portfolios"]
        self.stock_holding = self.db["Stock_Holding"]

        # Statistics
        self.stats = {
            "notifications": {
                "total": 0,
                "updated": 0,
                "already_has_portfolio": 0,
                "no_portfolio_found": 0,
                "errors": 0
            },
            "price_alerts": {
                "total": 0,
                "updated": 0,
                "already_has_portfolio": 0,
                "no_portfolio_found": 0,
                "errors": 0
            }
        }

        # Cache for user -> primary portfolio mapping
        self.user_portfolio_cache = {}

    def _setup_logger(self) -> logging.Logger:
        """Set up logging configuration."""
        level = logging.DEBUG if self.verbose else logging.INFO
        logging.basicConfig(
            level=level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler(f'notification_backfill_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
            ]
        )
        return logging.getLogger(__name__)

    def get_user_primary_portfolio(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get the primary portfolio for a user."""
        # Check cache first
        if user_id in self.user_portfolio_cache:
            return self.user_portfolio_cache[user_id]

        # Try to find portfolio by user_id (future JWT integration)
        portfolio = self.portfolios.find_one({
            "user_id": user_id,
            "is_primary": True,
            "is_active": True
        })

        # If not found, try by username (current system)
        if not portfolio:
            # Extract username from user_id if it follows a pattern
            username = self.extract_username_from_user_id(user_id)
            if username:
                portfolio = self.portfolios.find_one({
                    "username": username,
                    "is_primary": True,
                    "is_active": True
                })

        # If still not found, get any active portfolio for the user
        if not portfolio:
            portfolio = self.portfolios.find_one({
                "$or": [
                    {"user_id": user_id},
                    {"username": user_id}  # Fallback if user_id is actually username
                ],
                "is_active": True
            })

        # Cache the result (even if None to avoid repeated lookups)
        self.user_portfolio_cache[user_id] = portfolio

        return portfolio

    def extract_username_from_user_id(self, user_id: str) -> Optional[str]:
        """Extract username from user_id if it follows a pattern."""
        # Handle common patterns like "user-john" or "john@example.com"
        if user_id.startswith("user-"):
            return user_id[5:]
        elif "@" in user_id:
            return user_id.split("@")[0]
        else:
            # Assume user_id is the username
            return user_id

    def extract_tickers_from_notification(self, notification: Dict[str, Any]) -> List[str]:
        """Extract ticker symbols from notification content."""
        tickers = []

        # Check if tickers already exist in metadata
        if notification.get("metadata") and notification["metadata"].get("tickers"):
            tickers.extend(notification["metadata"]["tickers"])

        # Extract from portfolio_impact
        if notification.get("portfolio_impact"):
            impact = notification["portfolio_impact"]
            if isinstance(impact, dict):
                if impact.get("ticker"):
                    tickers.append(impact["ticker"])
                if impact.get("tickers"):
                    tickers.extend(impact["tickers"])

        # Extract from message using regex (find uppercase ticker patterns)
        message = notification.get("message", "")
        title = notification.get("title", "")
        combined_text = f"{title} {message}"

        # Common ticker pattern: 2-5 uppercase letters
        ticker_pattern = r'\b[A-Z]{2,5}\b'
        potential_tickers = re.findall(ticker_pattern, combined_text)

        # Filter out common words that match pattern but aren't tickers
        common_words = {"THE", "AND", "FOR", "FROM", "WITH", "THIS", "THAT", "YOUR", "ALL"}
        for ticker in potential_tickers:
            if ticker not in common_words:
                tickers.append(ticker)

        # Remove duplicates and return
        return list(set(tickers))

    def backfill_notifications(self) -> None:
        """Backfill portfolio_id for existing notifications."""
        self.logger.info("Starting notification backfill...")

        # Get all notifications without portfolio_id
        query = {
            "portfolio_id": {"$exists": False}
        }

        cursor = self.notifications.find(query)
        bulk_updates = []

        for notification in cursor:
            self.stats["notifications"]["total"] += 1

            try:
                # Skip if already has portfolio_id (shouldn't happen with our query)
                if notification.get("portfolio_id"):
                    self.stats["notifications"]["already_has_portfolio"] += 1
                    continue

                # Get user's primary portfolio
                user_id = notification.get("user_id")
                if not user_id:
                    self.logger.warning(f"Notification {notification['_id']} has no user_id")
                    self.stats["notifications"]["errors"] += 1
                    continue

                portfolio = self.get_user_primary_portfolio(user_id)

                if not portfolio:
                    self.logger.debug(f"No portfolio found for user {user_id}")
                    self.stats["notifications"]["no_portfolio_found"] += 1

                    # Mark as global notification if no portfolio found
                    update_doc = {
                        "$set": {
                            "is_global": True,
                            "affected_tickers": self.extract_tickers_from_notification(notification)
                        }
                    }
                else:
                    # Associate with primary portfolio
                    update_doc = {
                        "$set": {
                            "portfolio_id": str(portfolio["_id"]),
                            "portfolio_name": portfolio.get("portfolio_name") or portfolio.get("account_name"),
                            "is_global": False,
                            "affected_tickers": self.extract_tickers_from_notification(notification)
                        }
                    }

                if not self.dry_run:
                    bulk_updates.append(
                        UpdateOne(
                            {"_id": notification["_id"]},
                            update_doc
                        )
                    )

                    # Execute in batches
                    if len(bulk_updates) >= 1000:
                        result = self.notifications.bulk_write(bulk_updates)
                        self.stats["notifications"]["updated"] += result.modified_count
                        bulk_updates = []
                else:
                    self.logger.info(f"[DRY RUN] Would update notification {notification['_id']}")
                    self.stats["notifications"]["updated"] += 1

            except Exception as e:
                self.logger.error(f"Error processing notification {notification.get('_id')}: {str(e)}")
                self.stats["notifications"]["errors"] += 1

        # Execute remaining updates
        if bulk_updates and not self.dry_run:
            result = self.notifications.bulk_write(bulk_updates)
            self.stats["notifications"]["updated"] += result.modified_count

        self.logger.info(f"Processed {self.stats['notifications']['total']} notifications")

    def backfill_price_alerts(self) -> None:
        """Backfill portfolio_id for existing price alerts."""
        self.logger.info("Starting price alert backfill...")

        # Get all price alerts without portfolio_id
        query = {
            "portfolio_id": {"$exists": False}
        }

        cursor = self.price_alerts.find(query)
        bulk_updates = []

        for alert in cursor:
            self.stats["price_alerts"]["total"] += 1

            try:
                # Skip if already has portfolio_id
                if alert.get("portfolio_id"):
                    self.stats["price_alerts"]["already_has_portfolio"] += 1
                    continue

                # Get user's primary portfolio
                user_id = alert.get("user_id")
                if not user_id:
                    self.logger.warning(f"Price alert {alert['_id']} has no user_id")
                    self.stats["price_alerts"]["errors"] += 1
                    continue

                # Check if user has the ticker in any portfolio
                ticker = alert.get("ticker")
                portfolio_with_ticker = None

                if ticker:
                    # Find portfolio that contains this ticker
                    username = self.extract_username_from_user_id(user_id)
                    if username:
                        # Check Stock_Holding for this ticker
                        holding = self.stock_holding.find_one({
                            "username": username,
                            "symbol": ticker
                        })

                        if holding:
                            # Get the portfolio for this holding
                            portfolio_with_ticker = self.portfolios.find_one({
                                "username": username,
                                "account_name": holding.get("client_account_name")
                            })

                # Use portfolio with ticker or fall back to primary
                portfolio = portfolio_with_ticker or self.get_user_primary_portfolio(user_id)

                if not portfolio:
                    self.logger.debug(f"No portfolio found for user {user_id}")
                    self.stats["price_alerts"]["no_portfolio_found"] += 1

                    # Mark as global alert if no portfolio found
                    update_doc = {
                        "$set": {
                            "is_global": True
                        }
                    }
                else:
                    # Associate with portfolio
                    update_doc = {
                        "$set": {
                            "portfolio_id": str(portfolio["_id"]),
                            "portfolio_name": portfolio.get("portfolio_name") or portfolio.get("account_name"),
                            "is_global": False
                        }
                    }

                if not self.dry_run:
                    bulk_updates.append(
                        UpdateOne(
                            {"_id": alert["_id"]},
                            update_doc
                        )
                    )

                    # Execute in batches
                    if len(bulk_updates) >= 1000:
                        result = self.price_alerts.bulk_write(bulk_updates)
                        self.stats["price_alerts"]["updated"] += result.modified_count
                        bulk_updates = []
                else:
                    self.logger.info(f"[DRY RUN] Would update price alert {alert['_id']}")
                    self.stats["price_alerts"]["updated"] += 1

            except Exception as e:
                self.logger.error(f"Error processing price alert {alert.get('_id')}: {str(e)}")
                self.stats["price_alerts"]["errors"] += 1

        # Execute remaining updates
        if bulk_updates and not self.dry_run:
            result = self.price_alerts.bulk_write(bulk_updates)
            self.stats["price_alerts"]["updated"] += result.modified_count

        self.logger.info(f"Processed {self.stats['price_alerts']['total']} price alerts")

    def verify_backfill(self) -> None:
        """Verify the backfill results."""
        self.logger.info("Verifying backfill...")

        # Check notifications
        total_notifications = self.notifications.count_documents({})
        with_portfolio = self.notifications.count_documents({"portfolio_id": {"$exists": True}})
        marked_global = self.notifications.count_documents({"is_global": True})

        self.logger.info(f"Notifications - Total: {total_notifications}, With portfolio: {with_portfolio}, Global: {marked_global}")

        # Check price alerts
        total_alerts = self.price_alerts.count_documents({})
        alerts_with_portfolio = self.price_alerts.count_documents({"portfolio_id": {"$exists": True}})
        alerts_marked_global = self.price_alerts.count_documents({"is_global": True})

        self.logger.info(f"Price Alerts - Total: {total_alerts}, With portfolio: {alerts_with_portfolio}, Global: {alerts_marked_global}")

        # Sample documents
        sample_notification = self.notifications.find_one({"portfolio_id": {"$exists": True}})
        if sample_notification:
            self.logger.info(f"Sample notification with portfolio: {sample_notification.get('_id')} -> {sample_notification.get('portfolio_id')}")

        sample_alert = self.price_alerts.find_one({"portfolio_id": {"$exists": True}})
        if sample_alert:
            self.logger.info(f"Sample price alert with portfolio: {sample_alert.get('_id')} -> {sample_alert.get('portfolio_id')}")

    def print_summary(self) -> None:
        """Print backfill summary."""
        print("\n" + "=" * 60)
        print("NOTIFICATION BACKFILL SUMMARY")
        print("=" * 60)
        print("\nNotifications:")
        print(f"  Total processed:             {self.stats['notifications']['total']}")
        print(f"  Updated with portfolio:      {self.stats['notifications']['updated']}")
        print(f"  Already had portfolio:       {self.stats['notifications']['already_has_portfolio']}")
        print(f"  No portfolio found:          {self.stats['notifications']['no_portfolio_found']}")
        print(f"  Errors:                      {self.stats['notifications']['errors']}")

        print("\nPrice Alerts:")
        print(f"  Total processed:             {self.stats['price_alerts']['total']}")
        print(f"  Updated with portfolio:      {self.stats['price_alerts']['updated']}")
        print(f"  Already had portfolio:       {self.stats['price_alerts']['already_has_portfolio']}")
        print(f"  No portfolio found:          {self.stats['price_alerts']['no_portfolio_found']}")
        print(f"  Errors:                      {self.stats['price_alerts']['errors']}")

        print(f"\nDry run mode:                  {self.dry_run}")
        print("=" * 60)


def main():
    """Main backfill script entry point."""
    parser = argparse.ArgumentParser(description="Backfill portfolio context to existing notifications")
    parser.add_argument("--dry-run", action="store_true", help="Run without making changes")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    parser.add_argument("--verify-only", action="store_true", help="Only verify existing backfill")

    args = parser.parse_args()

    # Connect to MongoDB
    print(f"Connecting to MongoDB at {settings.MONGO_URI}...")
    client = MongoClient(
        settings.MONGO_URI,
        tls=True,
        tlsCAFile=certifi.where()
    )

    try:
        # Test connection
        client.server_info()
        print("✅ Connected to MongoDB successfully")

        # Get database
        db = client["FYP"]

        # Create backfill instance
        backfill = NotificationBackfill(db, dry_run=args.dry_run, verbose=args.verbose)

        if args.verify_only:
            # Only run verification
            backfill.verify_backfill()
        else:
            # Run backfill
            print("\n🔄 Running portfolio migration first...")
            print("Please ensure migrate_portfolios.py has been run before this script\n")

            backfill.backfill_notifications()
            backfill.backfill_price_alerts()
            backfill.verify_backfill()
            backfill.print_summary()

    except errors.ConnectionFailure as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Backfill failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()
        print("🔌 Closed MongoDB connection")


if __name__ == "__main__":
    main()