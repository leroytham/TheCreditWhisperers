# =============================================================================
# TheCreditWhisperers - Backend Microservice
# =============================================================================
# FastAPI backend container for API-only serving
# Demonstrates microservices architecture with frontend/backend separation
#
# Features:
# - Python 3.12 slim image for minimal footprint
# - Gunicorn + Uvicorn for production ASGI serving
# - Health check endpoint for container orchestration
# - ML model support (FinBERT, Sentence Transformers)
#
# Usage:
#   docker build -t creditwhisperers/backend:latest ./backend
#   docker run -p 8000:8000 creditwhisperers/backend:latest

FROM python:3.12-slim

# Labels for container metadata
LABEL org.opencontainers.image.title="TheCreditWhisperers Backend"
LABEL org.opencontainers.image.description="FastAPI backend microservice for financial analysis"
LABEL org.opencontainers.image.vendor="TheCreditWhisperers"

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
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY . ./

# Expose the application port
EXPOSE 8000

# Health check for container orchestration (Docker/Kubernetes)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run with Gunicorn + Uvicorn workers for production
# - 4 workers for concurrency
# - UvicornWorker for async support
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "app.main:app"]
