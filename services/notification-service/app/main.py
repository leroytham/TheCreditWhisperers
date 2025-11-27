# =============================================================================
# Notification Service - FastAPI Entry Point
# =============================================================================
# Standalone microservice for notifications, price alerts, and WebSocket

from fastapi import FastAPI, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from .core.config import settings
from .core.database import create_indexes, close_mongo_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    # Startup
    logger.info(f"Starting {settings.SERVICE_NAME} v{settings.SERVICE_VERSION}")

    # Create database indexes
    try:
        create_indexes()
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Failed to create database indexes: {e}")

    # Initialize Redis Pub/Sub (if enabled)
    if settings.PUBSUB_ENABLED:
        try:
            # TODO: Initialize pubsub manager
            logger.info("Redis Pub/Sub initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Redis Pub/Sub: {e}")

    logger.info(f"Notification service started on port {settings.PORT}")

    yield  # Application runs here

    # Shutdown
    logger.info("Shutting down notification service...")
    close_mongo_connection()
    logger.info("Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Notification Service",
    description="Microservice for notifications, price alerts, and real-time WebSocket updates",
    version=settings.SERVICE_VERSION,
    lifespan=lifespan
)

# Configure CORS
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    settings.FRONTEND_URL,
    settings.API_BASE_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Health Check Endpoints
# =============================================================================

@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "service": settings.SERVICE_NAME}


@app.get("/health/live")
async def liveness_probe():
    """Kubernetes liveness probe - is the process running?"""
    return {"status": "alive"}


@app.get("/health/ready")
async def readiness_probe():
    """Kubernetes readiness probe - is the service ready to serve traffic?"""
    from .core.database import get_mongo_client

    try:
        # Check MongoDB connection
        client = get_mongo_client()
        client.admin.command('ping')
        mongo_status = "connected"
    except Exception as e:
        logger.error(f"MongoDB health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "not ready", "mongo": "disconnected"}
        )

    return {
        "status": "ready",
        "mongo": mongo_status,
        "service": settings.SERVICE_NAME
    }


# =============================================================================
# API Routes (Placeholder - to be expanded)
# =============================================================================

@app.get("/api/notifications/")
async def list_notifications(user_id: str, limit: int = 50, offset: int = 0):
    """List notifications for a user."""
    from .core.database import get_notifications_collection
    from .models.notification import NotificationModel

    collection = get_notifications_collection()
    cursor = collection.find({"user_id": user_id}).sort("created_at", -1).skip(offset).limit(limit)

    notifications = []
    for doc in cursor:
        notifications.append(NotificationModel.from_mongo(doc).dict())

    return {"notifications": notifications, "count": len(notifications)}


@app.get("/api/notifications/unread-count")
async def get_unread_count(user_id: str):
    """Get unread notification count for a user."""
    from .core.database import get_notifications_collection

    collection = get_notifications_collection()
    count = collection.count_documents({
        "user_id": user_id,
        "is_read": False,
        "is_archived": False
    })

    return {"unread_count": count}


@app.post("/api/notifications/")
async def create_notification(request: Request):
    """Create a new notification."""
    from .core.database import get_notifications_collection
    from .models.notification import NotificationModel
    from datetime import datetime, timedelta

    data = await request.json()
    notification = NotificationModel(**data)

    collection = get_notifications_collection()
    doc = notification.to_mongo()

    # Set expiration if not specified (default 365 days)
    if 'expires_at' not in doc:
        doc['expires_at'] = datetime.utcnow() + timedelta(days=365)

    result = collection.insert_one(doc)

    return {"id": str(result.inserted_id), "status": "created"}


@app.patch("/api/notifications/{notification_id}/read")
async def mark_as_read(notification_id: str, user_id: str):
    """Mark a notification as read."""
    from .core.database import get_notifications_collection
    from bson import ObjectId
    from datetime import datetime

    collection = get_notifications_collection()
    result = collection.update_one(
        {"_id": ObjectId(notification_id), "user_id": user_id},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
    )

    return {"modified": result.modified_count > 0}


@app.post("/api/notifications/mark-all-read")
async def mark_all_as_read(user_id: str):
    """Mark all notifications as read for a user."""
    from .core.database import get_notifications_collection
    from datetime import datetime

    collection = get_notifications_collection()
    result = collection.update_many(
        {"user_id": user_id, "is_archived": False},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
    )

    return {"modified_count": result.modified_count}


# =============================================================================
# Internal API (for inter-service communication)
# =============================================================================

@app.post("/internal/price-alert")
async def receive_price_alert(request: Request):
    """
    Internal endpoint for receiving price alert triggers from main backend.
    This is called by the backend service when a price alert condition is met.
    """
    data = await request.json()
    logger.info(f"Received price alert trigger: {data}")

    # TODO: Create notification and broadcast via WebSocket
    # For now, just acknowledge receipt
    return {"status": "received", "data": data}


# =============================================================================
# WebSocket Endpoint (Placeholder)
# =============================================================================

@app.websocket("/ws/notifications/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time notifications."""
    await websocket.accept()
    logger.info(f"WebSocket connection accepted: {client_id}")

    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            logger.debug(f"Received from {client_id}: {data}")

            # Echo back for now (placeholder)
            await websocket.send_json({
                "type": "pong",
                "client_id": client_id
            })
    except Exception as e:
        logger.info(f"WebSocket disconnected: {client_id} - {e}")
