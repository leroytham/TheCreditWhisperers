# app/database.py
"""
MongoDB database connection and utility functions.

Provides both sync (PyMongo) and async (Motor) clients for different use cases:
- Sync client: Used by notification services and background tasks
- Async client: Used by FastAPI route handlers for non-blocking I/O
"""

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from typing import Optional
import certifi
from app.core.config import settings

# =============================================================================
# SYNC CLIENT (PyMongo) - For background tasks and services
# =============================================================================
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


# =============================================================================
# ASYNC CLIENT (Motor) - For FastAPI route handlers
# =============================================================================
_motor_client: Optional[AsyncIOMotorClient] = None
_motor_database: Optional[AsyncIOMotorDatabase] = None


def get_motor_client() -> AsyncIOMotorClient:
    """
    Get or create async Motor client singleton with optimized connection pooling.

    This client is used by FastAPI route handlers for non-blocking database operations.
    Connection settings are optimized for Azure Cosmos DB / MongoDB Atlas.
    """
    global _motor_client
    if _motor_client is None:
        _motor_client = AsyncIOMotorClient(
            settings.MONGO_URI,
            tls=True,
            tlsCAFile=certifi.where(),
            # Connection pool settings
            maxPoolSize=50,              # Maximum connections in the pool
            minPoolSize=10,              # Minimum connections to maintain
            maxIdleTimeMS=45000,         # Close idle connections after 45 seconds
            # Timeout settings
            serverSelectionTimeoutMS=5000,  # 5 second timeout for server selection
            connectTimeoutMS=10000,         # 10 second timeout for initial connection
            socketTimeoutMS=30000,          # 30 second timeout for socket operations
            # Retry and keep-alive settings
            retryWrites=True,            # Automatically retry write operations
            retryReads=True,             # Automatically retry read operations
            heartbeatFrequencyMS=10000,  # Send heartbeat every 10 seconds
            appname="FYP-Backend"        # Application name for MongoDB logs
        )
    return _motor_client


def get_motor_database(database_name: str = "FYP") -> AsyncIOMotorDatabase:
    """Get async Motor database instance."""
    global _motor_database
    if _motor_database is None:
        client = get_motor_client()
        _motor_database = client[database_name]
    return _motor_database


# Alias for simpler access
def get_motor_db(database_name: str = "FYP") -> AsyncIOMotorDatabase:
    """Alias for get_motor_database() - returns async Motor database instance."""
    return get_motor_database(database_name)


def get_motor_collection(collection_name: str, database_name: str = "FYP") -> AsyncIOMotorCollection:
    """Get async Motor collection."""
    database = get_motor_database(database_name)
    return database[collection_name]


# Async collection helpers for routes
def get_accounts_collection_async() -> AsyncIOMotorCollection:
    """Get Account_Details collection (async)."""
    return get_motor_collection("Account_Details")


def get_holdings_collection_async() -> AsyncIOMotorCollection:
    """Get Stock_Holding collection (async)."""
    return get_motor_collection("Stock_Holding")


def get_transactions_collection_async() -> AsyncIOMotorCollection:
    """Get Transactions collection (async)."""
    return get_motor_collection("Transactions")


async def close_motor_connection():
    """Close async Motor connection (for cleanup)."""
    global _motor_client, _motor_database
    if _motor_client:
        _motor_client.close()
        _motor_client = None
        _motor_database = None
        print("🔌 Closed Motor (async) MongoDB connection")


# =============================================================================
# DATABASE INDEXES
# =============================================================================
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