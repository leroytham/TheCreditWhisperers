# app/main.py

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from .api import routes as api_routes
from .api.websocket import websocket_endpoint

# VVV THIS IS THE LINE THE ERROR IS ABOUT VVV
# Ensure this line exists and the variable is named 'app'.
app = FastAPI(title="Financial Analysis API", version="1.0.0")

# Configure CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
    await websocket_endpoint(websocket, client_id)

# A simple root endpoint
@app.get("/")
def read_root():
    return {"message": "Welcome to the Financial Analysis API"}