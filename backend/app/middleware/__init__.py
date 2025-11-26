"""
Middleware Package

Contains custom middleware for the FastAPI application:
- PrometheusMiddleware: Collects HTTP request metrics for Prometheus
"""

from .prometheus_middleware import PrometheusMiddleware

__all__ = ["PrometheusMiddleware"]
