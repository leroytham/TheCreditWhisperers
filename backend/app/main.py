# app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import routes as api_routes

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
app.include_router(api_routes.router, prefix="/api")

# A simple root endpoint
@app.get("/")
def read_root():
    return {"message": "Welcome to the Financial Analysis API"}