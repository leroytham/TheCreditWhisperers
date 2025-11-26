# =============================================================================
# TheCreditWhisperers - Multi-stage Docker Build
# =============================================================================
# This Dockerfile creates a production-ready container with:
# - React frontend built and served as static files
# - FastAPI backend with ML models (FinBERT, Sentence Transformers)
# - Gunicorn + Uvicorn for production ASGI serving

# -----------------------------------------------------------------------------
# Stage 1: Build React Frontend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files first for better layer caching
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci --silent

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Python Backend with ML Models
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS backend

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies for ML libraries (torch, transformers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ ./

# Copy built frontend to static directory
# React build output goes to app/static/ for FastAPI to serve
COPY --from=frontend-builder /app/frontend/build ./app/static/

# Expose the application port
EXPOSE 8000

# Health check for container orchestration (Docker/Kubernetes)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run with Gunicorn + Uvicorn workers for production
# - 4 workers for concurrency
# - UvicornWorker for async support
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "app.main:app"]
