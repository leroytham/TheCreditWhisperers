# app/middleware/performance_monitor.py
"""
Performance monitoring middleware for tracking API metrics and identifying bottlenecks.
"""

import asyncio
import time
import logging
import json
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import deque, defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import uuid

logger = logging.getLogger(__name__)


class PerformanceMetrics:
    """
    Stores and analyzes performance metrics for API endpoints.
    """

    def __init__(self, max_samples: int = 1000):
        self.max_samples = max_samples
        self.metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=max_samples))
        self.slow_queries: deque = deque(maxlen=100)
        self.error_queries: deque = deque(maxlen=100)
        self._lock = asyncio.Lock()

    async def record_request(
        self,
        endpoint: str,
        method: str,
        duration_ms: float,
        status_code: int,
        request_id: str,
        username: Optional[str] = None,
        cache_hits: int = 0,
        cache_misses: int = 0,
        db_queries: int = 0,
        api_calls: int = 0
    ):
        """Record metrics for a request."""
        async with self._lock:
            metric = {
                "timestamp": datetime.utcnow().isoformat(),
                "request_id": request_id,
                "endpoint": endpoint,
                "method": method,
                "duration_ms": duration_ms,
                "status_code": status_code,
                "username": username,
                "cache_hits": cache_hits,
                "cache_misses": cache_misses,
                "db_queries": db_queries,
                "api_calls": api_calls
            }

            # Store by endpoint
            self.metrics[endpoint].append(metric)

            # Track slow queries (> 1000ms)
            if duration_ms > 1000:
                self.slow_queries.append(metric)

            # Track errors
            if status_code >= 400:
                self.error_queries.append(metric)

    async def get_endpoint_stats(self, endpoint: Optional[str] = None) -> Dict:
        """Get statistics for endpoint(s)."""
        async with self._lock:
            if endpoint:
                metrics_list = list(self.metrics.get(endpoint, []))
            else:
                metrics_list = []
                for endpoint_metrics in self.metrics.values():
                    metrics_list.extend(endpoint_metrics)

            if not metrics_list:
                return {"message": "No metrics available"}

            # Calculate statistics
            durations = [m["duration_ms"] for m in metrics_list]
            status_codes = [m["status_code"] for m in metrics_list]
            cache_hits = sum(m.get("cache_hits", 0) for m in metrics_list)
            cache_misses = sum(m.get("cache_misses", 0) for m in metrics_list)

            # Calculate percentiles
            sorted_durations = sorted(durations)
            p50 = sorted_durations[len(sorted_durations) // 2] if sorted_durations else 0
            p95 = sorted_durations[int(len(sorted_durations) * 0.95)] if sorted_durations else 0
            p99 = sorted_durations[int(len(sorted_durations) * 0.99)] if sorted_durations else 0

            return {
                "endpoint": endpoint,
                "total_requests": len(metrics_list),
                "avg_duration_ms": sum(durations) / len(durations) if durations else 0,
                "min_duration_ms": min(durations) if durations else 0,
                "max_duration_ms": max(durations) if durations else 0,
                "p50_duration_ms": p50,
                "p95_duration_ms": p95,
                "p99_duration_ms": p99,
                "success_rate": sum(1 for s in status_codes if 200 <= s < 300) / len(status_codes) if status_codes else 0,
                "error_rate": sum(1 for s in status_codes if s >= 400) / len(status_codes) if status_codes else 0,
                "cache_hit_rate": cache_hits / (cache_hits + cache_misses) if (cache_hits + cache_misses) > 0 else 0,
                "total_cache_hits": cache_hits,
                "total_cache_misses": cache_misses
            }

    async def get_slow_queries(self, limit: int = 10) -> List[Dict]:
        """Get slowest recent queries."""
        async with self._lock:
            return list(self.slow_queries)[-limit:]

    async def get_error_queries(self, limit: int = 10) -> List[Dict]:
        """Get recent error queries."""
        async with self._lock:
            return list(self.error_queries)[-limit:]

    async def get_health_status(self) -> Dict:
        """Get overall health status based on metrics."""
        stats = await self.get_endpoint_stats()

        if stats.get("message") == "No metrics available":
            return {
                "status": "unknown",
                "message": "No metrics available yet"
            }

        # Determine health based on thresholds
        avg_duration = stats.get("avg_duration_ms", 0)
        error_rate = stats.get("error_rate", 0)
        p95_duration = stats.get("p95_duration_ms", 0)

        health_issues = []

        if avg_duration > 500:
            health_issues.append(f"High average latency: {avg_duration:.0f}ms")

        if p95_duration > 2000:
            health_issues.append(f"High P95 latency: {p95_duration:.0f}ms")

        if error_rate > 0.05:  # 5% error rate
            health_issues.append(f"High error rate: {error_rate * 100:.1f}%")

        if health_issues:
            return {
                "status": "degraded" if len(health_issues) < 2 else "unhealthy",
                "issues": health_issues,
                "stats": stats
            }

        return {
            "status": "healthy",
            "message": "All metrics within normal ranges",
            "stats": stats
        }


class PerformanceMonitorMiddleware(BaseHTTPMiddleware):
    """
    Middleware to monitor and track API performance.
    """

    def __init__(self, app, metrics: Optional[PerformanceMetrics] = None):
        super().__init__(app)
        self.metrics = metrics or PerformanceMetrics()

    async def dispatch(self, request: Request, call_next):
        """Process request and track performance metrics."""
        # Skip static files and docs
        if request.url.path in ["/docs", "/openapi.json", "/favicon.ico"]:
            return await call_next(request)

        # Generate request ID
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        # Track timing
        start_time = time.time()

        # Initialize metrics tracking
        request.state.cache_hits = 0
        request.state.cache_misses = 0
        request.state.db_queries = 0
        request.state.api_calls = 0

        try:
            # Process request
            response = await call_next(request)

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Extract username from path if available
            username = None
            if "username" in request.path_params:
                username = request.path_params["username"]

            # Record metrics
            await self.metrics.record_request(
                endpoint=request.url.path,
                method=request.method,
                duration_ms=duration_ms,
                status_code=response.status_code,
                request_id=request_id,
                username=username,
                cache_hits=getattr(request.state, "cache_hits", 0),
                cache_misses=getattr(request.state, "cache_misses", 0),
                db_queries=getattr(request.state, "db_queries", 0),
                api_calls=getattr(request.state, "api_calls", 0)
            )

            # Add performance headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time-MS"] = f"{duration_ms:.0f}"
            response.headers["X-Cache-Hits"] = str(getattr(request.state, "cache_hits", 0))
            response.headers["X-Cache-Misses"] = str(getattr(request.state, "cache_misses", 0))

            # Log slow queries
            if duration_ms > 1000:
                logger.warning(
                    f"[PERF-SLOW] {request.method} {request.url.path} "
                    f"took {duration_ms:.0f}ms (request_id={request_id})"
                )

            return response

        except Exception as e:
            # Track error
            duration_ms = (time.time() - start_time) * 1000

            await self.metrics.record_request(
                endpoint=request.url.path,
                method=request.method,
                duration_ms=duration_ms,
                status_code=500,
                request_id=request_id,
                username=None
            )

            logger.error(
                f"[PERF-ERROR] {request.method} {request.url.path} "
                f"failed after {duration_ms:.0f}ms: {e}"
            )

            raise


class PerformanceOptimizer:
    """
    Analyzes performance metrics and provides optimization recommendations.
    """

    def __init__(self, metrics: PerformanceMetrics):
        self.metrics = metrics

    async def get_optimization_recommendations(self) -> List[Dict]:
        """Analyze metrics and provide optimization recommendations."""
        recommendations = []

        # Get overall stats
        stats = await self.metrics.get_endpoint_stats()

        if stats.get("message") == "No metrics available":
            return []

        # Check cache hit rate
        cache_hit_rate = stats.get("cache_hit_rate", 0)
        if cache_hit_rate < 0.5:  # Less than 50% cache hits
            recommendations.append({
                "priority": "high",
                "category": "caching",
                "issue": f"Low cache hit rate: {cache_hit_rate * 100:.1f}%",
                "recommendation": "Increase cache TTL or implement more aggressive caching",
                "potential_improvement": "30-50% latency reduction"
            })

        # Check P95 latency
        p95_duration = stats.get("p95_duration_ms", 0)
        if p95_duration > 2000:
            recommendations.append({
                "priority": "high",
                "category": "performance",
                "issue": f"High P95 latency: {p95_duration:.0f}ms",
                "recommendation": "Implement request-level caching and batch operations",
                "potential_improvement": "50-70% P95 latency reduction"
            })

        # Check slow queries
        slow_queries = await self.metrics.get_slow_queries(10)
        slow_endpoints = defaultdict(int)
        for query in slow_queries:
            slow_endpoints[query["endpoint"]] += 1

        for endpoint, count in slow_endpoints.items():
            if count >= 3:  # At least 3 slow queries
                recommendations.append({
                    "priority": "medium",
                    "category": "endpoint-specific",
                    "issue": f"Endpoint {endpoint} has {count} slow queries",
                    "recommendation": f"Optimize {endpoint} with batching and caching",
                    "potential_improvement": "40-60% latency reduction for this endpoint"
                })

        # Check error rate
        error_rate = stats.get("error_rate", 0)
        if error_rate > 0.01:  # More than 1% errors
            recommendations.append({
                "priority": "high",
                "category": "reliability",
                "issue": f"High error rate: {error_rate * 100:.1f}%",
                "recommendation": "Implement circuit breakers and fallback mechanisms",
                "potential_improvement": "90% error reduction"
            })

        return recommendations

    async def get_bottleneck_analysis(self) -> Dict:
        """Analyze and identify performance bottlenecks."""
        # Get metrics for all endpoints
        endpoint_stats = {}

        for endpoint in self.metrics.metrics.keys():
            stats = await self.metrics.get_endpoint_stats(endpoint)
            endpoint_stats[endpoint] = stats

        if not endpoint_stats:
            return {"message": "No data for analysis"}

        # Find slowest endpoints
        slowest_endpoints = sorted(
            endpoint_stats.items(),
            key=lambda x: x[1].get("p95_duration_ms", 0),
            reverse=True
        )[:5]

        # Find endpoints with most errors
        error_endpoints = sorted(
            endpoint_stats.items(),
            key=lambda x: x[1].get("error_rate", 0),
            reverse=True
        )[:5]

        # Find endpoints with worst cache performance
        cache_endpoints = sorted(
            endpoint_stats.items(),
            key=lambda x: x[1].get("cache_hit_rate", 1),
        )[:5]

        return {
            "slowest_endpoints": [
                {
                    "endpoint": ep[0],
                    "p95_ms": ep[1].get("p95_duration_ms", 0),
                    "avg_ms": ep[1].get("avg_duration_ms", 0)
                }
                for ep in slowest_endpoints
            ],
            "error_prone_endpoints": [
                {
                    "endpoint": ep[0],
                    "error_rate": ep[1].get("error_rate", 0),
                    "total_errors": int(ep[1].get("total_requests", 0) * ep[1].get("error_rate", 0))
                }
                for ep in error_endpoints if ep[1].get("error_rate", 0) > 0
            ],
            "cache_inefficient_endpoints": [
                {
                    "endpoint": ep[0],
                    "cache_hit_rate": ep[1].get("cache_hit_rate", 0),
                    "total_misses": ep[1].get("total_cache_misses", 0)
                }
                for ep in cache_endpoints if ep[1].get("cache_hit_rate", 0) < 0.8
            ]
        }


# Global metrics instance
global_metrics = PerformanceMetrics()
performance_optimizer = PerformanceOptimizer(global_metrics)


def create_performance_middleware(app):
    """Factory function to create performance monitoring middleware."""
    return PerformanceMonitorMiddleware(app, global_metrics)