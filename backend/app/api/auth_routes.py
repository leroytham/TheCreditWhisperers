# app/api/auth_routes.py
"""
Authentication routes for Azure AD OAuth and session management.

Endpoints:
- GET /login - Redirect to Azure AD login
- GET /auth/callback - Handle OAuth callback from Azure
- POST /auth/logout - Clear authentication cookies
- GET /auth/csrf-token - Generate CSRF token for form submissions
- GET /auth/me - Verify authentication status
"""

import secrets
import logging
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.core.auth import get_current_user, create_access_token, is_admin_email
from app.core.azure_auth import get_msal_client, get_redirect_uri, get_frontend_url, SCOPES

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication"])


@router.get("/login")
def azure_login():
    """
    Redirects the user to Microsoft Azure AD login page.

    Returns:
        RedirectResponse to Azure login URL

    Raises:
        HTTPException 503: If Azure AD is not configured
        HTTPException 500: If Azure login initialization fails
    """
    cca = get_msal_client()
    if not cca:
        raise HTTPException(
            status_code=503,
            detail="Azure AD authentication is not configured. Please check APPLICATION_ID and CLIENT_SECRET environment variables."
        )

    try:
        redirect_uri = get_redirect_uri()
        auth_url = cca.get_authorization_request_url(
            SCOPES,
            redirect_uri=redirect_uri,
        )
        logger.info(f"Azure login initiated. Redirect URI: {redirect_uri}")
        return RedirectResponse(auth_url)
    except Exception as e:
        logger.error(f"Azure login error: {e}")
        raise HTTPException(status_code=500, detail=f"Azure login init failed: {str(e)}")


@router.get("/auth/callback")
async def azure_auth_callback(request: Request):
    """
    Handles redirect from Azure after login.

    Exchanges authorization code for access token, creates a JWT,
    sets it in an httpOnly cookie, and redirects to frontend.

    Query Parameters:
        code: Authorization code from Azure
        error: Error code if login failed
        error_description: Human-readable error message

    Returns:
        RedirectResponse to frontend with auth cookie set
    """
    cca = get_msal_client()
    frontend_url = get_frontend_url()
    redirect_uri = get_redirect_uri()

    if not cca:
        logger.error("Azure callback called but MSAL client is not initialized")
        return RedirectResponse(f"{frontend_url}/login?error=not_configured")

    try:
        # Check for error from Azure
        error = request.query_params.get("error")
        error_description = request.query_params.get("error_description")

        if error:
            logger.warning(f"Azure returned error: {error} - {error_description}")
            return RedirectResponse(f"{frontend_url}/login?error={error}")

        code = request.query_params.get("code")
        if not code:
            logger.error("Missing authorization code in callback")
            raise HTTPException(status_code=400, detail="Missing authorization code")

        logger.info(f"Exchanging authorization code for token...")

        result = cca.acquire_token_by_authorization_code(
            code,
            scopes=SCOPES,
            redirect_uri=redirect_uri,
        )

        if "error" in result:
            error_msg = result.get("error", "unknown")
            error_desc = result.get("error_description", "No description")
            logger.error(f"Azure token exchange error: {error_msg} - {error_desc}")
            return RedirectResponse(f"{frontend_url}/login?error=azure_token_failed&msg={error_msg}")

        # Extract user info from Azure ID token claims
        account = result.get("id_token_claims", {})
        username = account.get("preferred_username", "unknown")
        user_id = account.get("oid", username)  # Azure Object ID (stable unique identifier)

        # Check if user is an admin
        is_admin = is_admin_email(username)

        logger.info(f"✓ Azure Login Success: {username} (oid: {user_id}, admin: {is_admin})")

        # Create JWT token for API authentication
        access_token = create_access_token(user_id=user_id, email=username, is_admin=is_admin)

        # Create redirect response and set httpOnly cookie
        response = RedirectResponse(
            url=f"{frontend_url}/portfolio?user={username}",
            status_code=302
        )

        # Set httpOnly cookie for secure token storage (immune to XSS)
        response.set_cookie(
            key=settings.COOKIE_NAME,
            value=access_token,
            max_age=settings.COOKIE_MAX_AGE,
            httponly=settings.COOKIE_HTTPONLY,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path=settings.COOKIE_PATH,
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Azure login callback exception: {type(e).__name__}: {e}")
        return RedirectResponse(f"{frontend_url}/login?error=azure_failed")


@router.post("/auth/logout")
async def logout(response: Response):
    """
    Clear authentication cookie to log out the user.

    Frontend should call this endpoint and then redirect to login page.
    Clears both the auth token cookie and CSRF token cookie.

    Returns:
        JSON message confirming logout
    """
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        path=settings.COOKIE_PATH,
    )
    # Also clear CSRF token cookie
    response.delete_cookie(key="csrf_token", path="/")
    return {"message": "Logged out successfully"}


@router.get("/auth/csrf-token")
async def get_csrf_token(response: Response):
    """
    Generate a CSRF token for state-changing requests.

    Frontend must include this token in X-CSRF-Token header for POST/PUT/DELETE.
    The token is set as a readable cookie for the frontend to access via JavaScript.

    Returns:
        JSON with csrf_token value
    """
    token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=token,
        httponly=False,  # Must be readable by JavaScript
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        path="/",
    )
    return {"csrf_token": token}


@router.get("/auth/me")
async def get_current_user_info(
    user_id: str = Depends(get_current_user)
):
    """
    Verify authentication status and return current user info.

    Used by frontend to check if user is authenticated after page load.
    Requires valid authentication (httpOnly cookie or Authorization header).

    Returns:
        JSON with user_id and authenticated status

    Raises:
        HTTPException 401: If not authenticated
    """
    return {"user_id": user_id, "authenticated": True}
