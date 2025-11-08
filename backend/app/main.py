# app/main.py

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from .api import routes as api_routes
from .api.notification_routes import router as notification_router
from .api.portfolio_routes import router as portfolio_router
from .api.websocket import websocket_endpoint
from .database import create_indexes
from .core.config import settings
import logging
import warnings
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Suppress resource_tracker warnings from loky (used by sentence-transformers, torch)
# These semaphore objects are properly cleaned up by the OS, but loky's tracker
# complains about them during shutdown. This is a known issue with loky.
warnings.filterwarnings("ignore", category=UserWarning, module="multiprocessing.resource_tracker")

# Configure loky to use fewer resources (reduces semaphore usage)
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "2")

# VVV THIS IS THE LINE THE ERROR IS ABOUT VVV
# Ensure this line exists and the variable is named 'app'.
app = FastAPI(title="Financial Analysis API", version="1.0.0")

# Configure CORS (Cross-Origin Resource Sharing)
# Note: WebSocket connections also need proper CORS configuration
# Supports both localhost and production Azure deployment
allowed_origins = [
    "http://localhost:3000",      # React dev server
    "ws://localhost:3000",        # WebSocket dev
    "http://localhost:8000",      # Backend dev
    "ws://localhost:8000",        # WebSocket backend dev
]

# Add production URLs from settings if different from localhost
if settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL)
    # Also add WebSocket variant
    ws_url = settings.FRONTEND_URL.replace("http://", "ws://").replace("https://", "wss://")
    allowed_origins.append(ws_url)

# Get API base URL (supports both API_BASE_URL and API_BASE for backward compatibility)
api_base_url = settings.get_api_base_url()
if api_base_url not in allowed_origins:
    allowed_origins.append(api_base_url)
    # Also add WebSocket variant
    ws_url = api_base_url.replace("http://", "ws://").replace("https://", "wss://")
    allowed_origins.append(ws_url)

logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the API router from routes.py
# Note: No prefix needed here - the frontend proxy handles /api routing
app.include_router(api_routes.router)

# Include notification routes
app.include_router(notification_router)

# Include portfolio routes
app.include_router(portfolio_router)

# WebSocket endpoint for real-time notifications
@app.websocket("/ws/notifications/{client_id}")
async def websocket_route(websocket: WebSocket, client_id: str):
    logger.info(f"WebSocket connection request from client: {client_id}")
    try:
        await websocket_endpoint(websocket, client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        raise

# A simple root endpoint
@app.get("/")
def read_root():
    return {"message": "Welcome to the Financial Analysis API"}

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy", "websocket_endpoint": "/ws/notifications/{client_id}"}

# Startup event handler
@app.on_event("startup")
async def startup_event():
    """
    Initialize database indexes and perform startup tasks.
    """
    logger.info("Starting up application...")

    # Create MongoDB indexes for notifications
    try:
        create_indexes()
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Failed to create database indexes: {e}")
        # Continue startup even if index creation fails

    logger.info("Application startup complete")

# Cleanup handler for multiprocessing resources
@app.on_event("shutdown")
async def shutdown_event():
    """
    Clean up multiprocessing resources on application shutdown.
    This helps prevent resource_tracker warnings from loky.
    """
    logger.info("Shutting down application and cleaning up resources...")

    # Force cleanup of any remaining loky executors
    try:
        from loky import get_reusable_executor
        executor = get_reusable_executor(max_workers=None)
        executor.shutdown(wait=True, kill_workers=True)
        logger.info("Successfully cleaned up loky executor")
    except ImportError:
        # loky not installed or not used
        pass
    except Exception as e:
        logger.warning(f"Error during loky cleanup: {e}")

    logger.info("Shutdown complete")