# =============================================================================
# Notification Service Database Configuration
# =============================================================================

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection
from typing import Optional
import logging

from .config import settings

logger = logging.getLogger(__name__)

# Global MongoDB client (singleton)
_mongo_client: Optional[MongoClient] = None


def get_mongo_client() -> MongoClient:
    """Get or create MongoDB client singleton."""
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(settings.MONGO_URI)
        logger.info(f"MongoDB client connected to: {settings.MONGO_URI}")
    return _mongo_client


def get_database():
    """Get the database instance."""
    client = get_mongo_client()
    return client[settings.MONGO_DATABASE]


def get_notifications_collection() -> Collection:
    """Get the notifications collection."""
    db = get_database()
    return db["notifications"]


def get_notification_preferences_collection() -> Collection:
    """Get the notification preferences collection."""
    db = get_database()
    return db["notification_preferences"]


def get_price_alerts_collection() -> Collection:
    """Get the price alerts collection."""
    db = get_database()
    return db["price_alerts"]


def create_indexes():
    """Create MongoDB indexes for notification collections."""
    logger.info("Creating notification database indexes...")

    # Notifications collection indexes
    notifications = get_notifications_collection()
    notifications.create_index([("user_id", ASCENDING), ("is_read", ASCENDING), ("is_archived", ASCENDING)])
    notifications.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    notifications.create_index([("portfolio_id", ASCENDING), ("created_at", DESCENDING)])
    notifications.create_index([("affected_tickers", ASCENDING)])
    notifications.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)  # TTL index

    # Notification preferences collection indexes
    preferences = get_notification_preferences_collection()
    preferences.create_index([("user_id", ASCENDING)], unique=True)

    # Price alerts collection indexes
    alerts = get_price_alerts_collection()
    alerts.create_index([("user_id", ASCENDING), ("is_active", ASCENDING)])
    alerts.create_index([("ticker", ASCENDING), ("is_active", ASCENDING)])
    alerts.create_index([("portfolio_id", ASCENDING), ("is_active", ASCENDING)])
    alerts.create_index([("is_global", ASCENDING), ("is_active", ASCENDING)])

    logger.info("Notification database indexes created successfully")


def close_mongo_connection():
    """Close MongoDB connection."""
    global _mongo_client
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None
        logger.info("MongoDB connection closed")
