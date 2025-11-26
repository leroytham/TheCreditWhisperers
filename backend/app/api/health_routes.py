# =============================================================================
# TheCreditWhisperers - Health Probe Endpoints
# =============================================================================
# Kubernetes-compliant health probe endpoints for self-healing and
# traffic management. Implements the three probe types:
#
# - /health/live   - Liveness: Is the app process alive?
# - /health/ready  - Readiness: Is the app ready to serve traffic?
# - /health/startup - Startup: Has the app finished initializing?
# - /health        - General health check (alias for readiness)
#
# Usage in Kubernetes:
#   livenessProbe:
#     httpGet:
#       path: /health/live
#       port: 8000
#   readinessProbe:
#     httpGet:
#       path: /health/ready
#       port: 8000

from fastapi import APIRouter, Response, status
from datetime import datetime
import asyncio
import time
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/live")
async def liveness():
    """
    Liveness probe for Kubernetes.

    Fast check that only verifies the app process is running.
    Does NOT check dependencies (MongoDB, Redis) to avoid cascading failures.

    If this fails, Kubernetes will restart the container.

    Returns:
        200: App is alive
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/ready")
async def readiness(response: Response):
    """
    Readiness probe for Kubernetes.

    Thorough check that verifies the app can serve traffic by checking
    all critical dependencies (MongoDB). Optional dependencies (Redis)
    are checked but don't affect readiness status.

    If this fails, Kubernetes removes the pod from service endpoints
    (stops sending traffic) but does NOT restart it.

    Returns:
        200: App is ready to serve traffic
        503: App is not ready (dependency failure)
    """
    start_time = time.time()
    checks = {}
    is_ready = True

    # Check MongoDB (required dependency)
    try:
        from app.api.routes import client as motor_client
        await asyncio.wait_for(
            motor_client.admin.command('ping'),
            timeout=2.0
        )
        checks["mongodb"] = {
            "status": "connected",
            "response_time_ms": round((time.time() - start_time) * 1000, 2)
        }
    except asyncio.TimeoutError:
        checks["mongodb"] = {
            "status": "timeout",
            "error": "MongoDB ping timeout after 2 seconds"
        }
        is_ready = False
        logger.warning("Health check: MongoDB timeout")
    except Exception as e:
        checks["mongodb"] = {
            "status": "disconnected",
            "error": str(e)
        }
        is_ready = False
        logger.warning(f"Health check: MongoDB error - {e}")

    # Check Redis (optional dependency - app works without it)
    redis_start = time.time()
    try:
        from app.core.cache import redis_cache
        if redis_cache and redis_cache._redis_client:
            await asyncio.wait_for(
                redis_cache._redis_client.ping(),
                timeout=1.0
            )
            checks["redis"] = {
                "status": "connected",
                "response_time_ms": round((time.time() - redis_start) * 1000, 2)
            }
        else:
            checks["redis"] = {
                "status": "disabled",
                "message": "Redis not configured"
            }
    except asyncio.TimeoutError:
        checks["redis"] = {
            "status": "timeout",
            "error": "Redis ping timeout after 1 second"
        }
        # Redis is optional, don't fail readiness
        logger.debug("Health check: Redis timeout (non-critical)")
    except Exception as e:
        checks["redis"] = {
            "status": "unavailable",
            "error": str(e)
        }
        # Redis is optional, don't fail readiness
        logger.debug(f"Health check: Redis unavailable (non-critical) - {e}")

    # Set response status code
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    total_time = round((time.time() - start_time) * 1000, 2)

    return {
        "status": "ready" if is_ready else "not_ready",
        "timestamp": datetime.utcnow().isoformat(),
        "response_time_ms": total_time,
        "checks": checks
    }


@router.get("/startup")
async def startup(response: Response):
    """
    Startup probe for Kubernetes.

    Used for slow-starting containers (e.g., loading ML models).
    Same checks as readiness, but Kubernetes allows more time/retries.

    While startup probe is failing, liveness and readiness probes
    are disabled to prevent premature restarts.

    Returns:
        200: App has started successfully
        503: App is still starting or failed to start
    """
    return await readiness(response)


@router.get("")
async def health(response: Response):
    """
    General health check endpoint.

    Alias for the readiness probe. Use this for:
    - Manual health checks
    - Load balancer health checks
    - Monitoring systems

    Returns:
        200: App is healthy
        503: App is unhealthy
    """
    return await readiness(response)
