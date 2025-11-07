# app/schemas/portfolio.py
"""
Pydantic models for Portfolio API request/response validation.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class PortfolioHoldingResponse(BaseModel):
    """Response model for portfolio holdings."""
    ticker: str
    quantity: float
    purchase_price: float
    current_price: Optional[float] = None
    market_value: Optional[float] = None
    last_updated: datetime


class PortfolioResponse(BaseModel):
    """Response model for portfolio data."""
    id: str
    username: str
    account_name: str
    portfolio_name: str
    is_primary: bool
    is_active: bool
    holdings_count: int
    total_value: float
    tickers: List[str]
    created_at: datetime
    updated_at: datetime


class PortfolioListResponse(BaseModel):
    """Response model for list of portfolios."""
    portfolios: List[PortfolioResponse]
    total_count: int


class PortfolioCreateRequest(BaseModel):
    """Request model for creating a portfolio."""
    account_name: str = Field(..., min_length=1, max_length=100)
    portfolio_name: Optional[str] = Field(None, max_length=100)
    account_no: Optional[str] = Field(None, max_length=50)


class PortfolioUpdateRequest(BaseModel):
    """Request model for updating a portfolio."""
    portfolio_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class SetPrimaryRequest(BaseModel):
    """Request model for setting primary portfolio."""
    portfolio_id: str


class PortfolioSummaryResponse(BaseModel):
    """Lightweight portfolio summary."""
    portfolio_id: str
    portfolio_name: str
    username: str
    account_name: str
    holdings_count: int
    total_value: float
    is_primary: bool