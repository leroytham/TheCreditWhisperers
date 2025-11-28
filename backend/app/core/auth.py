"""
JWT Authentication module for TheCreditWhisperers.

This module provides JWT token creation and validation for securing API endpoints.
Supports both httpOnly cookies (primary) and Authorization header (fallback).
"""

import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, Header, Cookie, Request, status

from app.core.config import settings


def is_admin_email(email: str) -> bool:
    """
    Check if an email address is in the admin list.

    Args:
        email: The email address to check

    Returns:
        True if the email is in ADMIN_EMAILS, False otherwise
    """
    if not settings.ADMIN_EMAILS:
        return False
    admin_emails = [e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    return email.lower() in admin_emails


def create_access_token(user_id: str, email: str, is_admin: bool = False) -> str:
    """
    Create a JWT access token after successful OAuth authentication.

    Args:
        user_id: The user's unique identifier (Azure Object ID or email)
        email: The user's email address
        is_admin: Whether the user has admin privileges

    Returns:
        Encoded JWT token string
    """
    payload = {
        "sub": user_id,
        "email": email,
        "is_admin": is_admin,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token.

    Args:
        token: The JWT token string to decode

    Returns:
        Decoded payload dict if valid, None if invalid or expired
    """
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


async def get_current_user(
    request: Request,
    access_token: Optional[str] = Cookie(None, alias="access_token"),
    authorization: Optional[str] = Header(None)
) -> str:
    """
    FastAPI dependency to validate JWT and extract user_id.

    Reads JWT from httpOnly cookie (primary) or Authorization header (fallback).
    This supports the migration from localStorage to httpOnly cookies.

    Args:
        request: The FastAPI request object
        access_token: JWT from httpOnly cookie (primary)
        authorization: Authorization header value (fallback, expects "Bearer <token>")

    Returns:
        The user_id (sub claim) from the validated token

    Raises:
        HTTPException: 401 if token is missing, invalid, or expired
    """
    token = access_token

    # Fallback: Check Authorization header (for migration period and API clients)
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return payload.get("sub")


async def get_current_user_optional(
    request: Request,
    access_token: Optional[str] = Cookie(None, alias="access_token"),
    authorization: Optional[str] = Header(None)
) -> Optional[str]:
    """
    Optional version of get_current_user that returns None instead of raising 401.

    Useful for endpoints that can work with or without authentication.
    Reads JWT from httpOnly cookie (primary) or Authorization header (fallback).

    Args:
        request: The FastAPI request object
        access_token: JWT from httpOnly cookie (primary)
        authorization: Authorization header value (fallback)

    Returns:
        The user_id if authenticated, None otherwise
    """
    token = access_token

    # Fallback: Check Authorization header
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]

    if not token:
        return None

    payload = decode_access_token(token)

    if not payload:
        return None

    return payload.get("sub")


async def get_current_admin(
    request: Request,
    access_token: Optional[str] = Cookie(None, alias="access_token"),
    authorization: Optional[str] = Header(None)
) -> str:
    """
    FastAPI dependency for admin-only endpoints.

    Validates JWT and checks that the user has admin privileges.
    Raises 403 Forbidden if user is not an admin.

    Args:
        request: The FastAPI request object
        access_token: JWT from httpOnly cookie (primary)
        authorization: Authorization header value (fallback)

    Returns:
        The user_id (sub claim) from the validated token

    Raises:
        HTTPException: 401 if not authenticated, 403 if not admin
    """
    # First, validate the token and get user_id
    token = access_token

    # Fallback: Check Authorization header
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Check admin status
    if not payload.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return payload.get("sub")
