# app/main.py

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from .api import routes as api_routes
from .api.websocket import websocket_endpoint
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# VVV THIS IS THE LINE THE ERROR IS ABOUT VVV
# Ensure this line exists and the variable is named 'app'.
app = FastAPI(title="Financial Analysis API", version="1.0.0")

# Configure CORS (Cross-Origin Resource Sharing)
# Note: WebSocket connections also need proper CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "ws://localhost:3000",
        "http://localhost:8000",
        "ws://localhost:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the API router from routes.py
# Note: No prefix needed here - the frontend proxy handles /api routing
app.include_router(api_routes.router)

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