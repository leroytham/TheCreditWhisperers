# app/database.py
"""
MongoDB database connection and utility functions.
"""

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from typing import Optional
import certifi
import threading
import time
from app.core.config import settings

# Thread-local storage for MongoDB connections
# This ensures each worker process gets its own connection after fork
_thread_local = threading.local()


def get_client() -> MongoClient:
    """Get or create MongoDB client per-worker/thread."""
    if not hasattr(_thread_local, 'client') or _thread_local.client is None:
        # Determine if we should use TLS/SSL based on the connection string
        # MongoDB Atlas (mongodb+srv://) requires TLS, local MongoDB typically doesn't
        use_tls = settings.MONGO_URI.startswith("mongodb+srv://") or (
            settings.MONGO_URI.startswith("mongodb://") and "ssl=true" in settings.MONGO_URI.lower()
        )

        # Connection parameters optimized for multi-worker environment
        connection_params = {
            "maxPoolSize": 10,  # Max connections per worker
            "minPoolSize": 2,   # Min connections to maintain
            "serverSelectionTimeoutMS": 30000,  # 30 seconds for Azure
            "connectTimeoutMS": 30000,
            "socketTimeoutMS": 30000,
            "retryWrites": True,
            "retryReads": True,
            "maxIdleTimeMS": 60000,  # Close idle connections after 1 minute
            "appName": "credit-fyp",
        }

        if use_tls:
            # Cloud MongoDB (Atlas) - requires TLS
            connection_params.update({
                "tls": True,
                "tlsCAFile": certifi.where(),
            })
            print(f"Connecting to MongoDB (TLS enabled) at {settings.MONGO_URI[:30]}...")
        else:
            print(f"Connecting to MongoDB (local) at {settings.MONGO_URI[:30]}...")

        try:
            _thread_local.client = MongoClient(settings.MONGO_URI, **connection_params)
            # Test connection with retry
            retry_connection(_thread_local.client)
        except Exception as e:
            print(f"❌ Failed to connect to MongoDB: {e}")
            raise

    return _thread_local.client


def retry_connection(client: MongoClient, max_retries: int = 3):
    """Test connection with retry logic and exponential backoff."""
    for attempt in range(max_retries):
        try:
            client.admin.command('ping')
            print(f"✅ MongoDB connected successfully (attempt {attempt + 1}/{max_retries})")
            return
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff: 1, 2, 4 seconds
                print(f"⚠️ MongoDB connection failed (attempt {attempt + 1}/{max_retries}): {e}")
                print(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                print(f"❌ MongoDB connection failed after {max_retries} attempts")
                raise


def get_database(database_name: str = "FYP") -> Database:
    """Get MongoDB database instance."""
    if not hasattr(_thread_local, 'databases'):
        _thread_local.databases = {}

    if database_name not in _thread_local.databases:
        client = get_client()
        _thread_local.databases[database_name] = client[database_name]

    return _thread_local.databases[database_name]


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


def get_sentiment_alerts_collection() -> Collection:
    """Get sentiment alerts collection."""
    return get_collection("sentiment_alerts")


def get_portfolios_collection() -> Collection:
    """Get portfolios collection."""
    return get_collection("portfolios")


# Sector cache collections
def get_sector_news_cache_collection() -> Collection:
    """Get sector news cache collection."""
    return get_collection("sector_news_cache")


def get_sector_daily_sentiment_collection() -> Collection:
    """Get sector daily sentiment collection."""
    return get_collection("sector_daily_sentiment")


def get_news_articles_master_collection() -> Collection:
    """Get master news articles collection for deduplication."""
    return get_collection("news_articles_master")


def reset_connections():
    """
    Reset all MongoDB connections for the current thread/worker.
    This is called after Gunicorn forks a new worker process.
    """
    if hasattr(_thread_local, 'client') and _thread_local.client:
        try:
            _thread_local.client.close()
        except Exception:
            pass  # Ignore errors during cleanup

    # Clear all thread-local data
    _thread_local.client = None
    if hasattr(_thread_local, 'databases'):
        _thread_local.databases = {}

    print("🔄 MongoDB connections reset for current worker")


def ensure_connection() -> bool:
    """
    Ensure MongoDB connection is alive, reconnect if needed.
    Returns True if connected, False otherwise.
    """
    try:
        client = get_client()
        client.admin.command('ping')
        return True
    except Exception as e:
        print(f"❌ MongoDB connection check failed: {e}")
        # Try to reset and reconnect
        reset_connections()
        try:
            client = get_client()
            return True
        except Exception:
            return False


def close_database_connection():
    """Close MongoDB connection (for cleanup)."""
    if hasattr(_thread_local, 'client') and _thread_local.client:
        _thread_local.client.close()
        _thread_local.client = None
        if hasattr(_thread_local, 'databases'):
            _thread_local.databases = {}
        print("🔌 Closed MongoDB connection for current thread")


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

    # Sector news cache indexes
    sector_news_cache = get_sector_news_cache_collection()
    sector_news_cache.create_index([("sector_key", 1), ("timeframe", 1), ("created_at", -1)])
    sector_news_cache.create_index("cache_key", unique=True)
    sector_news_cache.create_index("expires_at", expireAfterSeconds=0, sparse=True)  # TTL index

    # Sector daily sentiment indexes
    sector_daily_sentiment = get_sector_daily_sentiment_collection()
    sector_daily_sentiment.create_index([("sector_key", 1), ("date", -1)])
    sector_daily_sentiment.create_index("created_at")

    # News articles master indexes (for deduplication)
    news_articles_master = get_news_articles_master_collection()
    news_articles_master.create_index("url", unique=True)
    news_articles_master.create_index([("normalized_title", 1), ("publish_date", -1)])
    news_articles_master.create_index([("sectors", 1), ("publish_date", -1)])
    news_articles_master.create_index("ticker_sentiment.ticker")

    print("📇 Created database indexes for notifications, portfolios, and sector caches")