"""
JWT Authentication module for TheCreditWhisperers.

This module provides JWT token creation and validation for securing API endpoints.
"""

import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, Header, status

from app.core.config import settings


def create_access_token(user_id: str, email: str) -> str:
    """
    Create a JWT access token after successful OAuth authentication.

    Args:
        user_id: The user's unique identifier (Azure Object ID or email)
        email: The user's email address

    Returns:
        Encoded JWT token string
    """
    payload = {
        "sub": user_id,
        "email": email,
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


async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """
    FastAPI dependency to validate JWT and extract user_id.

    This replaces the placeholder authentication that returned "default_user_id".
    Now properly validates JWT tokens and raises 401 for invalid/missing tokens.

    Args:
        authorization: The Authorization header value (expects "Bearer <token>")

    Returns:
        The user_id (sub claim) from the validated token

    Raises:
        HTTPException: 401 if token is missing, invalid, or expired
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Expected 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return payload.get("sub")


async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """
    Optional version of get_current_user that returns None instead of raising 401.

    Useful for endpoints that can work with or without authentication.

    Args:
        authorization: The Authorization header value

    Returns:
        The user_id if authenticated, None otherwise
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)

    if not payload:
        return None

    return payload.get("sub")
