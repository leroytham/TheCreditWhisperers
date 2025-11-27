"""
CSRF Protection Middleware for TheCreditWhisperers.

Implements double-submit cookie pattern for CSRF protection when using httpOnly cookies.
Only validates CSRF tokens for state-changing requests (POST, PUT, DELETE, PATCH)
when an auth cookie is present.
"""

import hmac
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware using double-submit cookie pattern.

    How it works:
    1. Frontend calls /auth/csrf-token to get a CSRF token (stored in readable cookie)
    2. For state-changing requests, frontend includes token in X-CSRF-Token header
    3. This middleware validates that header value matches cookie value

    Skip conditions:
    - Safe methods (GET, HEAD, OPTIONS, TRACE)
    - Auth-related paths that don't need CSRF
    - Requests without auth cookie (API token auth or unauthenticated)
    """

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}

    # Paths to skip CSRF validation
    SKIP_PATHS = {
        "/auth/callback",
        "/auth/logout",
        "/auth/csrf-token",
        "/api/auth/callback",
        "/api/auth/logout",
        "/api/auth/csrf-token",
        "/health",
        "/health/live",
        "/health/ready",
        "/metrics",
    }

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip CSRF check for safe methods
        if request.method in self.SAFE_METHODS:
            return await call_next(request)

        # Skip CSRF for specific paths
        path = request.url.path
        if path in self.SKIP_PATHS or any(path.endswith(p) for p in self.SKIP_PATHS):
            return await call_next(request)

        # Skip CSRF if no auth cookie present (using header-based auth or unauthenticated)
        if "access_token" not in request.cookies:
            return await call_next(request)

        # Validate CSRF token for cookie-authenticated requests
        csrf_header = request.headers.get("X-CSRF-Token")
        csrf_cookie = request.cookies.get("csrf_token")

        if not csrf_header or not csrf_cookie:
            raise HTTPException(
                status_code=403,
                detail="CSRF token missing. Call /auth/csrf-token first."
            )

        # Use constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(csrf_header, csrf_cookie):
            raise HTTPException(
                status_code=403,
                detail="CSRF token invalid"
            )

        return await call_next(request)
