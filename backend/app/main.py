# app/main.py

from fastapi import FastAPI, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .api import routes as api_routes
from .api.notification_routes import router as notification_router
from .api.portfolio_routes import router as portfolio_router
from .api.health_routes import router as health_router
from .api.metrics_routes import router as metrics_router
from .api.websocket import websocket_endpoint
from .database import create_indexes
from .core.config import settings
from .core.http_client import http_client
import logging
import warnings
import os
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# SENTRY ERROR TRACKING
# =============================================================================
# Initialize Sentry for error tracking and performance monitoring.
# Set SENTRY_DSN environment variable to enable.
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            # Performance monitoring
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            # Profiling (requires Sentry Pro)
            profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
            # Environment tagging
            environment=settings.ENVIRONMENT,
            # Integrations
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                StarletteIntegration(transaction_style="endpoint"),
                LoggingIntegration(
                    level=logging.INFO,        # Capture INFO and above as breadcrumbs
                    event_level=logging.ERROR  # Send ERROR and above as events
                ),
            ],
            # Don't send PII (personal data)
            send_default_pii=False,
            # Release tracking (set via CI/CD)
            release=os.getenv("APP_VERSION", "1.0.0"),
        )
        logger.info("✅ Sentry error tracking initialized")
    except ImportError:
        logger.warning("⚠️ sentry-sdk not installed. Error tracking disabled.")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize Sentry: {e}")
else:
    logger.info("ℹ️ Sentry DSN not configured. Error tracking disabled.")

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

# =============================================================================
# PROMETHEUS METRICS MIDDLEWARE
# =============================================================================
# Add Prometheus metrics collection for observability
if settings.METRICS_ENABLED:
    try:
        from .middleware.prometheus_middleware import PrometheusMiddleware
        app.add_middleware(PrometheusMiddleware, app_name="creditwhisperers")
        logger.info("✅ Prometheus metrics middleware enabled")
    except ImportError:
        logger.warning("⚠️ prometheus-client not installed. Metrics disabled.")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize Prometheus middleware: {e}")

# Include the API router from routes.py
# IMPORTANT: We include routers TWICE to support both localhost and production:
# - Localhost: setupProxy.js strips /api prefix, so backend needs routes without prefix
# - Production: Frontend calls /api/* directly, so backend needs routes with /api prefix
# This dual setup ensures both environments work without code changes

# Routes WITHOUT /api prefix (for localhost development)
app.include_router(api_routes.router)
app.include_router(notification_router)
app.include_router(portfolio_router)
app.include_router(health_router)
app.include_router(metrics_router)  # Prometheus metrics endpoint

# Routes WITH /api prefix (for production deployment)
app.include_router(api_routes.router, prefix="/api")
app.include_router(notification_router, prefix="/api")
app.include_router(portfolio_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")  # Prometheus metrics endpoint

# WebSocket endpoint for real-time notifications
@app.websocket("/ws/notifications/{client_id}")
async def websocket_route(websocket: WebSocket, client_id: str):
    logger.info(f"WebSocket connection request from client: {client_id}")
    try:
        await websocket_endpoint(websocket, client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        raise

# =============================================================================
# STATIC FILE SERVING FOR REACT FRONTEND
# =============================================================================
# The React frontend is built and copied to app/static/ during deployment
# We serve it from the FastAPI backend to support:
# 1. Single deployment (frontend + backend together)
# 2. React Router client-side routing (catch-all route)
# 3. Proper static asset serving (JS, CSS, images)

# Get the static directory paths
# React build creates: build/index.html and build/static/js/, build/static/css/
# After copying to backend/app/static/, we have:
#   - backend/app/static/index.html (for catch-all route)
#   - backend/app/static/static/js/ (for asset files)
STATIC_DIR = Path(__file__).parent / "static"
STATIC_ASSETS_DIR = STATIC_DIR / "static"  # The nested static folder from React build

# Mount the React build's static assets (JS, CSS, images) at /static
# This serves files like /static/js/main.js → backend/app/static/static/js/main.js
if STATIC_ASSETS_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_ASSETS_DIR)), name="static")
    logger.info(f"Mounted static assets directory: {STATIC_ASSETS_DIR}")
elif STATIC_DIR.exists():
    # Fallback: mount the outer directory if inner doesn't exist (for dev)
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    logger.warning(f"Using fallback static directory: {STATIC_DIR}")
else:
    logger.warning(f"Static directory not found: {STATIC_DIR}")
    logger.warning("Frontend will not be served. Run 'npm run build' in frontend/")

# Note: Health check endpoints are now in health_routes.py
# Provides /health/live, /health/ready, /health/startup for Kubernetes probes

# Catch-all route to serve index.html for React Router
# This MUST be defined LAST so API routes take precedence
# Handles all routes like /, /login, /portfolio, etc. by serving index.html
# React Router then handles the client-side routing
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """
    Serve the React frontend for all non-API routes.
    This enables React Router to handle client-side routing.

    NOTE: This route is defined last so API routes take precedence.
    API routes are already registered above via app.include_router()
    """
    index_path = STATIC_DIR / "index.html"

    if index_path.exists():
        return FileResponse(index_path)
    else:
        # If index.html doesn't exist, show helpful error
        return {
            "error": "Frontend not built",
            "message": "Run 'cd frontend && npm run build' to build the React app",
            "static_dir": str(STATIC_DIR),
            "index_exists": index_path.exists()
        }

# Startup event handler
@app.on_event("startup")
async def startup_event():
    """
    Initialize database indexes and perform startup tasks.
    """
    logger.info("Starting up application...")

    # Initialize OpenTelemetry distributed tracing
    if settings.OTEL_ENABLED and settings.OTEL_EXPORTER_OTLP_ENDPOINT:
        try:
            from .core.telemetry import init_telemetry
            if init_telemetry(
                app=app,
                service_name=settings.OTEL_SERVICE_NAME,
                otlp_endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
            ):
                logger.info("✅ OpenTelemetry tracing initialized")
            else:
                logger.info("ℹ️ OpenTelemetry tracing not configured")
        except ImportError:
            logger.warning("⚠️ OpenTelemetry packages not installed. Tracing disabled.")
        except Exception as e:
            logger.warning(f"⚠️ Failed to initialize OpenTelemetry: {e}")

    # Test MongoDB connection
    try:
        from .api.routes import client as motor_client
        # Ping MongoDB to verify connection
        await motor_client.admin.command('ping')
        logger.info("✅ MongoDB connection verified successfully")
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        logger.error("Please check your MONGO_URI environment variable and network connectivity")

    # Create MongoDB indexes for notifications
    try:
        create_indexes()
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Failed to create database indexes: {e}")
        # Continue startup even if index creation fails

    # Initialize shared HTTP session with connection pooling
    try:
        await http_client.get_session()
        logger.info("✅ HTTP connection pool initialized")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize HTTP connection pool: {e}")

    logger.info("Application startup complete")

# Cleanup handler for multiprocessing resources
@app.on_event("shutdown")
async def shutdown_event():
    """
    Clean up multiprocessing resources on application shutdown.
    This helps prevent resource_tracker warnings from loky.
    """
    logger.info("Shutting down application and cleaning up resources...")

    # Close shared HTTP session
    try:
        await http_client.close()
        logger.info("✅ HTTP connection pool closed")
    except Exception as e:
        logger.warning(f"⚠️ Error closing HTTP connection pool: {e}")

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