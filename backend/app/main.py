# app/main.py

from fastapi import FastAPI, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException
import uuid
from .api import routes as api_routes
from .api.notification_routes import router as notification_router
from .api.portfolio_routes import router as portfolio_router
from .api.health_routes import router as health_router
from .api.metrics_routes import router as metrics_router
# New modular route imports
from .api.auth_routes import router as auth_router
from .api.stock_routes import router as stock_router
from .api.sector_routes import router as sector_router
from .api.news_routes import router as news_router
from .api.transaction_routes import router as transaction_router
from .api.utility_routes import router as utility_router
from .api.websocket import websocket_endpoint, manager as ws_manager
from .database import create_indexes
from .core.config import settings
from .core.http_client import http_client
import logging
import warnings
import os

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
# CSRF PROTECTION MIDDLEWARE
# =============================================================================
# Protects against Cross-Site Request Forgery when using httpOnly cookies
from .middleware.csrf import CSRFMiddleware
app.add_middleware(CSRFMiddleware)
logger.info("✅ CSRF protection middleware enabled")

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

# =============================================================================
# GLOBAL EXCEPTION HANDLERS
# =============================================================================
# Security: Prevent internal error details from leaking to API clients.
# All 500-level errors return generic messages with correlation IDs for debugging.

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler for unhandled exceptions.
    - Logs full details internally for debugging
    - Returns generic message to client (no internal details)
    - Generates correlation ID for tracking
    """
    error_id = str(uuid.uuid4())[:8]

    # Log full details internally (including stack trace)
    logger.error(
        f"Unhandled exception [error_id={error_id}] "
        f"path={request.url.path} method={request.method}",
        exc_info=exc
    )

    # Send to Sentry if configured
    if settings.SENTRY_DSN:
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except Exception:
            pass  # Don't fail if Sentry capture fails

    # Return generic message to client - NO internal details
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred. Please try again later.",
            "error_id": error_id,
            "support": "If this persists, contact support with the error_id above."
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Handle HTTPExceptions with sanitization for 500-level errors.
    - 4xx errors: Return original detail (client errors are safe to expose)
    - 5xx errors: Sanitize to prevent internal detail leakage
    """
    if exc.status_code >= 500:
        error_id = str(uuid.uuid4())[:8]

        # Log the original detail internally
        logger.error(
            f"HTTP {exc.status_code} [error_id={error_id}] "
            f"path={request.url.path} original_detail={exc.detail}",
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": "An internal error occurred. Please try again later.",
                "error_id": error_id
            }
        )

    # 4xx errors - safe to return original detail
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None)
    )


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
# New modular routers (without /api prefix)
app.include_router(auth_router)  # /login, /auth/*
app.include_router(stock_router)  # /stocks/{ticker}/*
app.include_router(sector_router)  # /sectors/{sector}/*
app.include_router(news_router)  # /news, /price, /daily-sentiment, /rolling-sentiment
app.include_router(transaction_router)  # /transactions/*, /accounts/*/performance-twr
app.include_router(utility_router)  # /circuit-breakers, /search-ticker

# Routes WITH /api prefix (for production deployment)
app.include_router(api_routes.router, prefix="/api")
app.include_router(notification_router, prefix="/api")
app.include_router(portfolio_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")  # Prometheus metrics endpoint
# New modular routers (with /api prefix)
app.include_router(auth_router, prefix="/api")
app.include_router(stock_router, prefix="/api")
app.include_router(sector_router, prefix="/api")
app.include_router(news_router, prefix="/api")
app.include_router(transaction_router, prefix="/api")
app.include_router(utility_router, prefix="/api")

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
# MICROSERVICES ARCHITECTURE NOTE
# =============================================================================
# The React frontend is now served by a separate nginx container.
# This backend service only handles API requests.
# See frontend/Dockerfile and frontend/nginx.conf for frontend serving.
#
# Architecture:
#   Frontend (nginx:alpine) → /api/* proxy → Backend (FastAPI)
#   Frontend (nginx:alpine) → /ws/*  proxy → Backend (FastAPI WebSocket)

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
        from .database import get_motor_client
        motor_client = get_motor_client()
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

    # Initialize circuit breaker Prometheus metrics
    try:
        from .core.circuit_breaker_metrics import initialize_circuit_breaker_metrics
        initialize_circuit_breaker_metrics([
            "alpha_vantage",
            "finnhub",
            "newsapi",
            "marketaux",
            "yahoo_finance",
        ])
        logger.info("✅ Circuit breaker metrics initialized")
    except ImportError:
        logger.warning("⚠️ prometheus-client not installed. CB metrics disabled.")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize circuit breaker metrics: {e}")

    # Initialize Redis Pub/Sub for distributed WebSocket notifications
    if settings.PUBSUB_ENABLED:
        try:
            await ws_manager.initialize_pubsub()
            logger.info("✅ WebSocket Pub/Sub initialized")
        except Exception as e:
            logger.warning(f"⚠️ Failed to initialize WebSocket Pub/Sub: {e}")
            logger.warning("WebSocket notifications will be local-only (single instance)")

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

    # Stop Redis Pub/Sub for WebSocket notifications
    try:
        await ws_manager.shutdown_pubsub()
        logger.info("✅ WebSocket Pub/Sub stopped")
    except Exception as e:
        logger.warning(f"⚠️ Error stopping WebSocket Pub/Sub: {e}")

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