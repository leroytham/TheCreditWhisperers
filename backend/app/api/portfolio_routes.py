# app/api/portfolio_routes.py
"""
REST API endpoints for portfolio management.
"""

from fastapi import APIRouter, HTTPException, Query, Header, Depends, Body
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
from bson import ObjectId

from app.models.portfolio_model import (
    PortfolioModel,
    PortfolioSummary,
    PortfolioHoldingModel,
    create_portfolio,
    get_portfolio_by_id,
    get_portfolio_by_account,
    get_user_portfolios,
    get_user_primary_portfolio,
    update_portfolio_holdings_cache,
    set_primary_portfolio
)

from app.database import get_portfolios_collection
from app.schemas.portfolio import (
    PortfolioResponse,
    PortfolioListResponse,
    PortfolioCreateRequest,
    PortfolioUpdateRequest,
    PortfolioHoldingResponse,
    SetPrimaryRequest
)
from app.core.auth import get_current_user
from app.repositories.factory import get_holding_repository
from app.repositories.holding_repository import HoldingRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


# Portfolio Management Endpoints

@router.get("/", response_model=PortfolioListResponse)
async def list_user_portfolios(
    user_id: str = Depends(get_current_user),
    include_inactive: bool = Query(False, description="Include inactive portfolios")
):
    """
    Get all portfolios for the current user.
    """
    try:
        # For now, using username as user_id
        portfolios = await get_user_portfolios(
            db=get_portfolios_collection().database,
            username=user_id,
            include_inactive=include_inactive
        )

        # Convert to response models
        portfolio_responses = []
        for portfolio in portfolios:
            summary = PortfolioSummary.from_portfolio_model(portfolio)
            portfolio_responses.append(PortfolioResponse(
                id=portfolio.id,
                username=portfolio.username,
                account_name=portfolio.account_name,
                portfolio_name=portfolio.portfolio_name or portfolio.account_name,
                is_primary=portfolio.is_primary,
                is_active=portfolio.is_active,
                holdings_count=portfolio.holdings_count,
                total_value=portfolio.total_value,
                tickers=portfolio.tickers,
                created_at=portfolio.created_at,
                updated_at=portfolio.updated_at
            ))

        return PortfolioListResponse(
            portfolios=portfolio_responses,
            total_count=len(portfolio_responses)
        )

    except Exception as e:
        logger.error(f"Error fetching user portfolios: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/primary", response_model=PortfolioResponse)
async def get_primary_portfolio(user_id: str = Depends(get_current_user)):
    """
    Get the primary portfolio for the current user.
    """
    try:
        portfolio = await get_user_primary_portfolio(
            db=get_portfolios_collection().database,
            username=user_id
        )

        if not portfolio:
            raise HTTPException(status_code=404, detail="No primary portfolio found")

        return PortfolioResponse(
            id=portfolio.id,
            username=portfolio.username,
            account_name=portfolio.account_name,
            portfolio_name=portfolio.portfolio_name or portfolio.account_name,
            is_primary=portfolio.is_primary,
            is_active=portfolio.is_active,
            holdings_count=portfolio.holdings_count,
            total_value=portfolio.total_value,
            tickers=portfolio.tickers,
            created_at=portfolio.created_at,
            updated_at=portfolio.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching primary portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio_details(
    portfolio_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Get details for a specific portfolio.
    """
    try:
        if not ObjectId.is_valid(portfolio_id):
            raise HTTPException(status_code=400, detail="Invalid portfolio ID format")

        portfolio = await get_portfolio_by_id(
            db=get_portfolios_collection().database,
            portfolio_id=portfolio_id
        )

        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        # Verify user owns this portfolio
        if portfolio.username != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        return PortfolioResponse(
            id=portfolio.id,
            username=portfolio.username,
            account_name=portfolio.account_name,
            portfolio_name=portfolio.portfolio_name or portfolio.account_name,
            is_primary=portfolio.is_primary,
            is_active=portfolio.is_active,
            holdings_count=portfolio.holdings_count,
            total_value=portfolio.total_value,
            tickers=portfolio.tickers,
            created_at=portfolio.created_at,
            updated_at=portfolio.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching portfolio details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{portfolio_id}/holdings", response_model=List[PortfolioHoldingResponse])
async def get_portfolio_holdings(
    portfolio_id: str,
    user_id: str = Depends(get_current_user),
    holding_repo: HoldingRepository = Depends(get_holding_repository),
):
    """
    Get holdings for a specific portfolio.
    """
    try:
        if not ObjectId.is_valid(portfolio_id):
            raise HTTPException(status_code=400, detail="Invalid portfolio ID format")

        # Get portfolio to verify ownership
        portfolio = await get_portfolio_by_id(
            db=get_portfolios_collection().database,
            portfolio_id=portfolio_id
        )

        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        if portfolio.username != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Get holdings using async repository
        holdings = await holding_repo.get_holdings_by_account(
            portfolio.username,
            portfolio.account_name,
            include_closed=True
        )

        holding_responses = []
        for holding in holdings:
            holding_responses.append(PortfolioHoldingResponse(
                ticker=holding.get("symbol"),
                quantity=holding.get("quantity", 0),
                purchase_price=holding.get("purchase_price", 0),
                current_price=holding.get("current_price"),
                market_value=holding.get("market_value"),
                last_updated=holding.get("last_updated", datetime.utcnow())
            ))

        return holding_responses

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching portfolio holdings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{portfolio_id}/set-primary", response_model=Dict[str, Any])
async def set_portfolio_as_primary(
    portfolio_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Set a portfolio as the user's primary portfolio.
    """
    try:
        if not ObjectId.is_valid(portfolio_id):
            raise HTTPException(status_code=400, detail="Invalid portfolio ID format")

        # Verify portfolio ownership
        portfolio = await get_portfolio_by_id(
            db=get_portfolios_collection().database,
            portfolio_id=portfolio_id
        )

        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        if portfolio.username != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Set as primary
        success = await set_primary_portfolio(
            db=get_portfolios_collection().database,
            username=user_id,
            portfolio_id=portfolio_id
        )

        if success:
            return {
                "success": True,
                "message": f"Portfolio {portfolio_id} is now primary",
                "portfolio_id": portfolio_id
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update primary portfolio")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting primary portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{portfolio_id}/refresh-cache", response_model=Dict[str, Any])
async def refresh_portfolio_cache(
    portfolio_id: str,
    user_id: str = Depends(get_current_user),
    holding_repo: HoldingRepository = Depends(get_holding_repository),
):
    """
    Refresh the cached holdings data for a portfolio.
    """
    try:
        if not ObjectId.is_valid(portfolio_id):
            raise HTTPException(status_code=400, detail="Invalid portfolio ID format")

        # Verify portfolio ownership
        portfolio = await get_portfolio_by_id(
            db=get_portfolios_collection().database,
            portfolio_id=portfolio_id
        )

        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        if portfolio.username != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Get current holdings using async repository
        holdings = await holding_repo.get_holdings_by_account(
            portfolio.username,
            portfolio.account_name,
            include_closed=True
        )

        # Update cache
        success = await update_portfolio_holdings_cache(
            db=get_portfolios_collection().database,
            portfolio_id=portfolio_id,
            holdings=holdings
        )

        if success:
            return {
                "success": True,
                "message": "Portfolio cache refreshed",
                "portfolio_id": portfolio_id,
                "holdings_count": len(holdings)
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to refresh cache")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing portfolio cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/by-account/{account_name}", response_model=PortfolioResponse)
async def get_portfolio_by_account_name(
    account_name: str,
    user_id: str = Depends(get_current_user)
):
    """
    Get portfolio by account name (for backward compatibility).
    """
    try:
        portfolio = await get_portfolio_by_account(
            db=get_portfolios_collection().database,
            username=user_id,
            account_name=account_name
        )

        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        return PortfolioResponse(
            id=portfolio.id,
            username=portfolio.username,
            account_name=portfolio.account_name,
            portfolio_name=portfolio.portfolio_name or portfolio.account_name,
            is_primary=portfolio.is_primary,
            is_active=portfolio.is_active,
            holdings_count=portfolio.holdings_count,
            total_value=portfolio.total_value,
            tickers=portfolio.tickers,
            created_at=portfolio.created_at,
            updated_at=portfolio.updated_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching portfolio by account name: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=PortfolioResponse)
async def create_new_portfolio(
    portfolio_data: PortfolioCreateRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Create a new portfolio (admin/migration use only).
    """
    try:
        # Create portfolio model
        portfolio = PortfolioModel(
            username=user_id,
            account_name=portfolio_data.account_name,
            portfolio_name=portfolio_data.portfolio_name or portfolio_data.account_name,
            account_no=portfolio_data.account_no,
            is_primary=False,  # Will be set to True if it's the first portfolio
            is_active=True
        )

        # Save to database
        portfolio_id = await create_portfolio(
            db=get_portfolios_collection().database,
            portfolio=portfolio
        )

        portfolio.id = portfolio_id

        return PortfolioResponse(
            id=portfolio.id,
            username=portfolio.username,
            account_name=portfolio.account_name,
            portfolio_name=portfolio.portfolio_name,
            is_primary=portfolio.is_primary,
            is_active=portfolio.is_active,
            holdings_count=0,
            total_value=0.0,
            tickers=[],
            created_at=portfolio.created_at,
            updated_at=portfolio.updated_at
        )

    except Exception as e:
        logger.error(f"Error creating portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))