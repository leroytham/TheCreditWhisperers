# app/api/routes_integration.py
"""
Integration file to update existing routes.py with optimized endpoints.
This shows how to integrate the optimized portfolio endpoints into your existing application.
"""

from fastapi import APIRouter, Request
from app.api.portfolio_optimized import (
    get_optimized_portfolio_holdings,
    get_optimized_portfolio_performance
)
from app.api.account_optimized import get_optimized_portfolio_account
from app.middleware.performance_monitor import global_metrics, performance_optimizer

# Create router for optimized endpoints
optimized_router = APIRouter(prefix="/api/v2", tags=["Optimized Portfolio"])

# Register optimized endpoints
optimized_router.add_api_route(
    "/portfolio/holdings/{username}/{account_name}",
    get_optimized_portfolio_holdings,
    methods=["GET"],
    summary="Get portfolio holdings (optimized)",
    description="Fetches portfolio holdings with batch operations and multi-level caching"
)

optimized_router.add_api_route(
    "/portfolio/performance/{username}/{account_name}",
    get_optimized_portfolio_performance,
    methods=["GET"],
    summary="Get portfolio performance (optimized)",
    description="Fetches portfolio performance metrics with optimized calculations"
)

optimized_router.add_api_route(
    "/portfolio/account/{username}/{account_name}",
    get_optimized_portfolio_account,
    methods=["GET"],
    summary="Get portfolio account details (optimized)",
    description="Fetches comprehensive account details with all metrics"
)

# Add monitoring endpoints
@optimized_router.get("/admin/performance/stats")
async def get_performance_stats(endpoint: str = None):
    """Get performance statistics for endpoints."""
    return await global_metrics.get_endpoint_stats(endpoint)

@optimized_router.get("/admin/performance/slow-queries")
async def get_slow_queries(limit: int = 10):
    """Get slowest recent queries."""
    return await global_metrics.get_slow_queries(limit)

@optimized_router.get("/admin/performance/errors")
async def get_error_queries(limit: int = 10):
    """Get recent error queries."""
    return await global_metrics.get_error_queries(limit)

@optimized_router.get("/admin/performance/health")
async def get_health_status():
    """Get overall health status based on metrics."""
    return await global_metrics.get_health_status()

@optimized_router.get("/admin/performance/recommendations")
async def get_optimization_recommendations():
    """Get optimization recommendations based on metrics."""
    return await performance_optimizer.get_optimization_recommendations()

@optimized_router.get("/admin/performance/bottlenecks")
async def get_bottleneck_analysis():
    """Analyze and identify performance bottlenecks."""
    return await performance_optimizer.get_bottleneck_analysis()


def update_existing_routes(router: APIRouter):
    """
    Function to update existing routes.py with optimized versions.
    Call this from your main routes.py file.
    """

    # Override existing endpoints with optimized versions
    # Remove or comment out the old endpoints and add these:

    router.add_api_route(
        "/portfolio/holdings/{username}/{account_name}",
        get_optimized_portfolio_holdings,
        methods=["GET"],
        summary="Get portfolio holdings",
        description="Optimized version with batch operations and caching"
    )

    router.add_api_route(
        "/portfolio/performance/{username}/{account_name}",
        get_optimized_portfolio_performance,
        methods=["GET"],
        summary="Get portfolio performance",
        description="Optimized version with efficient calculations"
    )

    router.add_api_route(
        "/portfolio/account/{username}/{account_name}",
        get_optimized_portfolio_account,
        methods=["GET"],
        summary="Get portfolio account details",
        description="Optimized version with comprehensive metrics"
    )

    return router


# Integration instructions to add to your existing routes.py:
"""
To integrate the optimized endpoints into your existing routes.py:

1. At the top of routes.py, add:
   from app.api.routes_integration import update_existing_routes, optimized_router

2. After creating your main router, call:
   router = update_existing_routes(router)

3. Or if you want to keep both old and new endpoints:
   # Keep old endpoints at /api/portfolio/...
   # Add new endpoints at /api/v2/portfolio/...
   app.include_router(optimized_router)

4. In your main.py/app.py, add the middleware:
   from app.middleware.performance_monitor import create_performance_middleware
   from app.services.cache_manager import CacheManager, set_cache_manager
   import redis.asyncio as aioredis

   @app.on_event("startup")
   async def startup_event():
       # Initialize Redis for L2 cache
       redis_client = await aioredis.create_redis_pool('redis://localhost')
       cache_manager = CacheManager(redis_client)
       set_cache_manager(cache_manager)

   # Add performance monitoring
   app.add_middleware(create_performance_middleware)

5. Comment out or remove the old portfolio endpoints to avoid conflicts.
"""