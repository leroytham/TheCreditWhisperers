"""
Prometheus Metrics Routes

Exposes the /metrics endpoint for Prometheus scraping.
This endpoint should be protected in production environments
or only accessible from within the cluster.
"""

from fastapi import APIRouter, Response
from ..middleware.prometheus_middleware import get_metrics, get_metrics_content_type

router = APIRouter(tags=["Monitoring"])


@router.get("/metrics")
async def prometheus_metrics():
    """
    Prometheus metrics endpoint.

    Returns metrics in Prometheus text format for scraping.

    Security Note:
    - In production, restrict access to this endpoint
    - Use network policies to allow only Prometheus server
    - Consider adding authentication if exposed externally

    Returns:
        Response: Prometheus metrics in text format
    """
    metrics_output = get_metrics()
    return Response(
        content=metrics_output,
        media_type=get_metrics_content_type(),
    )


@router.get("/metrics/health")
async def metrics_health():
    """
    Health check for the metrics system.

    Returns:
        dict: Metrics system status
    """
    return {
        "status": "healthy",
        "metrics_enabled": True,
    }
