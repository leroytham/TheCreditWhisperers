# app/database.py
"""
MongoDB database connection and utility functions.
"""

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from typing import Optional
import certifi
from app.core.config import settings

# Global MongoDB client instance
_client: Optional[MongoClient] = None
_database: Optional[Database] = None


def get_client() -> MongoClient:
    """Get or create MongoDB client singleton."""
    global _client
    if _client is None:
        _client = MongoClient(
            settings.MONGO_URI,
            tls=True,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000  # 5 second timeout
        )
        # Test connection
        _client.server_info()
        print(f"✅ Connected to MongoDB at {settings.MONGO_URI}")
    return _client


def get_database(database_name: str = "FYP") -> Database:
    """Get MongoDB database instance."""
    global _database
    if _database is None:
        client = get_client()
        _database = client[database_name]
    return _database


def get_collection(collection_name: str, database_name: str = "FYP") -> Collection:
    """Get MongoDB collection."""
    database = get_database(database_name)
    return database[collection_name]


# Collection helpers for notifications
def get_notifications_collection() -> Collection:
    """Get notifications collection."""
    return get_collection("notifications")


def get_notification_preferences_collection() -> Collection:
    """Get notification preferences collection."""
    return get_collection("notification_preferences")


def get_price_alerts_collection() -> Collection:
    """Get price alerts collection."""
    return get_collection("price_alerts")


def get_portfolios_collection() -> Collection:
    """Get portfolios collection."""
    return get_collection("portfolios")


def close_database_connection():
    """Close MongoDB connection (for cleanup)."""
    global _client, _database
    if _client:
        _client.close()
        _client = None
        _database = None
        print("🔌 Closed MongoDB connection")


# Create indexes for better performance
def create_indexes():
    """Create database indexes for notifications and portfolios."""

    # Notifications indexes
    notifications = get_notifications_collection()

    # Existing indexes
    notifications.create_index([("user_id", 1), ("is_read", 1), ("is_archived", 1)])
    notifications.create_index([("user_id", 1), ("created_at", -1)])
    notifications.create_index([("created_at", -1)])
    notifications.create_index([("user_id", 1), ("category", 1)])

    # NEW Portfolio-aware indexes
    notifications.create_index([("user_id", 1), ("portfolio_id", 1), ("created_at", -1)])
    notifications.create_index([("portfolio_id", 1), ("is_read", 1), ("created_at", -1)])
    notifications.create_index([("user_id", 1), ("is_global", 1), ("created_at", -1)])
    notifications.create_index([("portfolio_id", 1), ("category", 1)])
    notifications.create_index("affected_tickers")  # For ticker-based queries

    # TTL index for automatic expiration
    notifications.create_index(
        "expires_at",
        expireAfterSeconds=0,
        sparse=True
    )

    # Notification preferences indexes
    preferences = get_notification_preferences_collection()
    preferences.create_index("user_id", unique=True)
    preferences.create_index("enabled_portfolios")  # For portfolio preference queries

    # Price alerts indexes
    alerts = get_price_alerts_collection()
    alerts.create_index([("user_id", 1), ("is_active", 1)])
    alerts.create_index([("ticker", 1), ("is_active", 1)])
    alerts.create_index([("user_id", 1), ("ticker", 1), ("is_active", 1)])

    # NEW Portfolio-aware price alert indexes
    alerts.create_index([("portfolio_id", 1), ("is_active", 1)])
    alerts.create_index([("user_id", 1), ("portfolio_id", 1), ("is_active", 1)])
    alerts.create_index([("portfolio_id", 1), ("ticker", 1), ("is_active", 1)])
    alerts.create_index([("is_global", 1), ("is_active", 1)])

    # Portfolio collection indexes
    portfolios = get_portfolios_collection()
    portfolios.create_index("username")
    portfolios.create_index([("username", 1), ("account_name", 1)], unique=True)
    portfolios.create_index([("username", 1), ("is_primary", -1)])
    portfolios.create_index([("username", 1), ("is_active", 1)])
    portfolios.create_index("created_at")
    portfolios.create_index("tickers")  # For queries by ticker

    print("📇 Created database indexes for notifications and portfolios")