# app/core/validators.py
"""
Shared input validation utilities for API routes.

This module provides reusable validators for common input types like
ticker symbols, timeframes, and query parameters. Use these to ensure
consistent validation across all API endpoints.

Usage:
    from app.core.validators import validate_ticker, TickerPath, TimeframeQuery

    @router.get("/{ticker}/data")
    async def get_data(
        ticker: str = TickerPath(),
        timeframe: str = TimeframeQuery("1M"),
    ):
        ticker = validate_ticker(ticker)
        ...
"""

import re
from enum import Enum
from typing import Optional
from fastapi import Query, Path, HTTPException


# =============================================================================
# ENUMS
# =============================================================================

class TimeframeEnum(str, Enum):
    """Valid timeframe values for stock/news data queries."""
    DAY = "1D"
    WEEK = "1W"
    MONTH = "1M"
    QUARTER = "3M"
    HALF_YEAR = "6M"
    YTD = "YTD"
    YEAR = "1Y"
    THREE_YEARS = "3Y"
    FIVE_YEARS = "5Y"
    MAX = "MAX"


# =============================================================================
# REGEX PATTERNS
# =============================================================================

# Ticker: 1-10 uppercase alphanumeric chars, dots, dashes (e.g., AAPL, BRK.B, BF-A)
TICKER_PATTERN = re.compile(r'^[A-Z0-9.\-]{1,10}$')

# Timeframe: Valid timeframe strings
TIMEFRAME_REGEX = r"^(1D|1W|1M|3M|6M|YTD|1Y|3Y|5Y|MAX)$"

# Sector identifier: Alphanumeric with spaces, hyphens, ampersands (e.g., "Technology", "Real Estate")
SECTOR_PATTERN = re.compile(r'^[A-Za-z0-9\s\-&]{1,50}$')

# Account/username: Alphanumeric with underscores, hyphens (e.g., "john_doe", "user-123")
ACCOUNT_PATTERN = re.compile(r'^[A-Za-z0-9_\-]{1,100}$')

# Quarter format: YYYYQN (e.g., 2024Q1, 2023Q4)
QUARTER_PATTERN = re.compile(r'^20[0-9]{2}Q[1-4]$')


# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

def validate_ticker(ticker: str) -> str:
    """
    Validate and normalize a stock ticker symbol.

    Args:
        ticker: Raw ticker input from user

    Returns:
        Normalized uppercase ticker

    Raises:
        HTTPException: If ticker format is invalid
    """
    if not ticker:
        raise HTTPException(
            status_code=400,
            detail="Ticker symbol is required"
        )

    ticker = ticker.upper().strip()

    if not TICKER_PATTERN.match(ticker):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ticker format: '{ticker}'. Must be 1-10 alphanumeric characters (dots and dashes allowed)."
        )

    return ticker


def validate_sector(sector: str) -> str:
    """
    Validate and normalize a sector identifier.

    Args:
        sector: Raw sector identifier from user

    Returns:
        Normalized sector identifier

    Raises:
        HTTPException: If sector format is invalid
    """
    if not sector:
        raise HTTPException(
            status_code=400,
            detail="Sector identifier is required"
        )

    sector = sector.strip()

    if not SECTOR_PATTERN.match(sector):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sector identifier: '{sector}'. Must be 1-50 alphanumeric characters."
        )

    return sector


def validate_account_name(account_name: str) -> str:
    """
    Validate and normalize an account or username.

    Args:
        account_name: Raw account name from user

    Returns:
        Normalized account name

    Raises:
        HTTPException: If account name format is invalid
    """
    if not account_name:
        raise HTTPException(
            status_code=400,
            detail="Account name is required"
        )

    account_name = account_name.strip()

    if not ACCOUNT_PATTERN.match(account_name):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid account name: '{account_name}'. Must be 1-100 alphanumeric characters (underscores and hyphens allowed)."
        )

    return account_name


def validate_quarter(quarter: str) -> str:
    """
    Validate a quarter string format.

    Args:
        quarter: Raw quarter string (e.g., "2024Q1")

    Returns:
        Validated quarter string

    Raises:
        HTTPException: If quarter format is invalid
    """
    if not quarter:
        raise HTTPException(
            status_code=400,
            detail="Quarter is required"
        )

    quarter = quarter.upper().strip()

    if not QUARTER_PATTERN.match(quarter):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid quarter format: '{quarter}'. Expected format: YYYYQN (e.g., 2024Q1)"
        )

    return quarter


def validate_timeframe(timeframe: str) -> str:
    """
    Validate a timeframe string.

    Args:
        timeframe: Raw timeframe string

    Returns:
        Validated timeframe string

    Raises:
        HTTPException: If timeframe is invalid
    """
    if not timeframe:
        raise HTTPException(
            status_code=400,
            detail="Timeframe is required"
        )

    timeframe = timeframe.upper().strip()
    valid_timeframes = {"1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "MAX"}

    if timeframe not in valid_timeframes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid timeframe: '{timeframe}'. Valid options: {', '.join(sorted(valid_timeframes))}"
        )

    return timeframe


# =============================================================================
# FASTAPI PARAMETER FACTORIES
# =============================================================================
# These return FastAPI Query/Path objects with built-in validation.
# Use them as default values in route function signatures.

def TickerPath(description: str = "Stock ticker symbol (e.g., AAPL, MSFT)") -> str:
    """Create a Path parameter for ticker symbols with validation."""
    return Path(
        ...,
        min_length=1,
        max_length=10,
        description=description,
        examples=["AAPL", "MSFT", "GOOGL"]
    )


def TickerQuery(
    default: Optional[str] = None,
    required: bool = True,
    description: str = "Stock ticker symbol"
) -> str:
    """Create a Query parameter for ticker symbols with validation."""
    if required:
        return Query(
            ...,
            min_length=1,
            max_length=10,
            description=description
        )
    return Query(
        default,
        min_length=1 if default else None,
        max_length=10,
        description=description
    )


def TimeframeQuery(
    default: str = "1M",
    description: str = "Data timeframe"
) -> str:
    """Create a Query parameter for timeframes with regex validation."""
    return Query(
        default,
        regex=TIMEFRAME_REGEX,
        description=f"{description}. Valid: 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, MAX"
    )


def LimitQuery(
    default: int = 50,
    max_val: int = 200,
    description: str = "Maximum number of results to return"
) -> int:
    """Create a Query parameter for result limits with bounds."""
    return Query(
        default,
        ge=1,
        le=max_val,
        description=f"{description} (max: {max_val})"
    )


def DaysQuery(
    default: int = 30,
    max_val: int = 365,
    description: str = "Number of days of historical data"
) -> int:
    """Create a Query parameter for day counts with bounds."""
    return Query(
        default,
        ge=1,
        le=max_val,
        description=f"{description} (max: {max_val})"
    )


def OffsetQuery(
    default: int = 0,
    description: str = "Number of results to skip"
) -> int:
    """Create a Query parameter for pagination offset."""
    return Query(
        default,
        ge=0,
        description=description
    )


def SectorPath(description: str = "Sector identifier (e.g., Technology, Healthcare)") -> str:
    """Create a Path parameter for sector identifiers."""
    return Path(
        ...,
        min_length=1,
        max_length=50,
        description=description
    )
