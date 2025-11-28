# app/core/azure_auth.py
"""
Azure AD MSAL authentication configuration.

This module provides a singleton MSAL ConfidentialClientApplication
for Azure AD OAuth authentication. The client is lazily initialized
only when valid credentials are present.
"""

import msal
import threading
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Thread lock for thread-safe lazy initialization
_auth_lock = threading.Lock()

# Global MSAL client singleton
_cca: Optional[msal.ConfidentialClientApplication] = None
_initialized: bool = False

# OAuth scopes required for user authentication
SCOPES = ["user.read"]


def get_msal_client() -> Optional[msal.ConfidentialClientApplication]:
    """
    Get or create singleton MSAL ConfidentialClientApplication for Azure AD (thread-safe).

    Returns:
        MSAL client if credentials are configured, None otherwise.

    Note:
        The client is initialized lazily on first call. Subsequent calls
        return the cached instance for efficiency. Uses double-checked locking
        for thread safety.

    Example:
        >>> client = get_msal_client()
        >>> if client:
        ...     auth_url = client.get_authorization_request_url(SCOPES, redirect_uri=...)
    """
    global _cca, _initialized

    # Return cached client if already initialized
    if _initialized:
        return _cca

    with _auth_lock:
        # Double-checked locking pattern
        if _initialized:
            return _cca

        _initialized = True

        # Check if Azure AD credentials are configured
        client_id = settings.APPLICATION_ID
        client_secret = settings.CLIENT_SECRET

        if not client_id or client_id == "<your-client-id>":
            logger.warning("Azure CLIENT_ID (APPLICATION_ID) is not configured. Azure authentication disabled.")
            return None

        if not client_secret:
            logger.warning("Azure CLIENT_SECRET is not configured. Azure authentication disabled.")
            return None

        # Initialize MSAL client
        try:
            _cca = msal.ConfidentialClientApplication(
                client_id=client_id,
                authority=settings.AZURE_AUTHORITY,
                client_credential=client_secret,
            )
            logger.info("Azure AD authentication initialized")
            logger.info("Redirect URI: %s", settings.get_redirect_uri())
            logger.info("Authority: %s", settings.AZURE_AUTHORITY)
            logger.info("Frontend URL: %s", settings.FRONTEND_URL)
            return _cca
        except Exception as e:
            logger.error("Failed to initialize Azure AD authentication: %s", e)
            return None


def reset_msal_client():
    """
    Reset MSAL client state for testing or reconfiguration.

    This function is primarily used in tests to ensure clean state between tests.
    """
    global _cca, _initialized
    with _auth_lock:
        _cca = None
        _initialized = False


def get_redirect_uri() -> str:
    """Get the OAuth redirect URI from settings."""
    return settings.get_redirect_uri()


def get_frontend_url() -> str:
    """Get the frontend URL for post-login redirect."""
    return settings.FRONTEND_URL


def is_azure_auth_enabled() -> bool:
    """
    Check if Azure AD authentication is properly configured and enabled.

    Returns:
        True if MSAL client can be initialized, False otherwise.
    """
    client = get_msal_client()
    return client is not None
