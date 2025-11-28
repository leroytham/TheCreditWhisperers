# app/api/transaction_routes.py
"""
Transaction tracking routes for portfolio management.

Uses Repository Pattern for data access via dependency injection.

Endpoints:
- POST /transactions/{username} - Create a new transaction
- GET /transactions/{username}/{account_name} - Get transaction history
- GET /transactions/{username}/{account_name}/stats - Get transaction statistics
- DELETE /transactions/{username}/{transaction_id} - Delete a transaction
- GET /accounts/{username}/{account_name}/performance-twr - Get TWR performance
"""

import logging
from datetime import date, datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query, Path
from typing import Optional

from app.core.validators import validate_account_name, validate_ticker
from app.models.transaction import (
    CreateTransactionRequest,
    TransactionType,
    TransactionSummary,
)
from app.services.twr_calculator_service import TWRCalculatorService
from app.core.dependencies import get_twr_calculator_service
from app.repositories.factory import get_transaction_repository, get_account_repository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.account_repository import AccountRepository

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Transactions"])


@router.post("/transactions/{username}")
async def create_transaction_endpoint(
    username: str = Path(..., min_length=1, max_length=100, description="Username"),
    transaction_data: CreateTransactionRequest = ...,
    repo: TransactionRepository = Depends(get_transaction_repository),
):
    """
    Create a new portfolio transaction.

    Tracks buys, sells, deposits, withdrawals, dividends for accurate TWR calculation.

    Request body:
    {
        "account_name": "Main Account",
        "account_no": "ACC123",  // optional
        "transaction_date": "2024-01-15",  // YYYY-MM-DD format
        "transaction_type": "BUY",  // BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND
        "symbol": "AAPL",  // required for BUY/SELL/DIVIDEND
        "quantity": 10,  // required for BUY/SELL
        "price": 150.00,  // optional
        "cash_flow": -1500.00,  // negative = outflow, positive = inflow
        "fees": 10.00,  // optional, default 0
        "notes": "Initial purchase"  // optional
    }
    """
    try:
        # Validate username
        username = validate_account_name(username)

        # Validate symbol if provided (for BUY/SELL/DIVIDEND)
        if transaction_data.symbol:
            transaction_data.symbol = validate_ticker(transaction_data.symbol)

        # Create transaction via repository (Pydantic model already validated)
        transaction_id = await repo.create_transaction(username, transaction_data)

        return {
            "message": "Transaction created successfully",
            "transaction_id": transaction_id,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error("Error creating transaction for %s: %s", username, e)
        raise HTTPException(status_code=500, detail=f"Failed to create transaction: {str(e)}")


@router.get("/transactions/{username}/{account_name}")
async def get_transactions_endpoint(
    username: str = Path(..., min_length=1, max_length=100, description="Username"),
    account_name: str = Path(..., min_length=1, max_length=100, description="Account name"),
    start_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$", description="Filter start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$", description="Filter end date (YYYY-MM-DD)"),
    transaction_type: Optional[str] = Query(None, regex=r"^(BUY|SELL|DEPOSIT|WITHDRAWAL|DIVIDEND)$", description="Filter by type"),
    symbol: Optional[str] = Query(None, min_length=1, max_length=10, description="Filter by stock symbol"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    skip: int = Query(0, ge=0, alias="offset", description="Results to skip"),
    repo: TransactionRepository = Depends(get_transaction_repository),
):
    """
    Get transaction history for a portfolio.

    Query parameters:
    - start_date: Filter transactions on or after this date (YYYY-MM-DD)
    - end_date: Filter transactions on or before this date (YYYY-MM-DD)
    - transaction_type: Filter by type (BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND)
    - symbol: Filter by stock symbol
    - limit: Maximum number of results (default 100)
    - skip: Number of results to skip for pagination (default 0)

    Returns transactions sorted by date (most recent first)
    """
    try:
        # Parse optional date filters
        start_date_obj = date.fromisoformat(start_date) if start_date else None
        end_date_obj = date.fromisoformat(end_date) if end_date else None

        # Parse optional type filter
        type_filter = None
        if transaction_type:
            try:
                type_filter = TransactionType(transaction_type.upper())
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid transaction_type. Must be one of: {', '.join([t.value for t in TransactionType])}",
                )

        # Fetch transactions via repository
        transactions = await repo.get_transactions(
            username=username,
            account_name=account_name,
            start_date=start_date_obj,
            end_date=end_date_obj,
            transaction_type=type_filter,
            symbol=symbol.upper() if symbol else None,
            limit=limit,
            offset=skip,
        )

        # Convert to summaries for response
        transaction_summaries = [
            TransactionSummary.from_transaction_model(t).model_dump()
            for t in transactions
        ]

        return {
            "transactions": transaction_summaries,
            "count": len(transaction_summaries),
            "has_more": len(transaction_summaries) == limit,
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error fetching transactions for %s/%s: %s", username, account_name, e)
        raise HTTPException(status_code=500, detail=f"Failed to fetch transactions: {str(e)}")


@router.get("/transactions/{username}/{account_name}/stats")
async def get_transaction_stats_endpoint(
    username: str = Path(..., min_length=1, max_length=100, description="Username"),
    account_name: str = Path(..., min_length=1, max_length=100, description="Account name"),
    start_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$", description="Filter start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$", description="Filter end date (YYYY-MM-DD)"),
    repo: TransactionRepository = Depends(get_transaction_repository),
):
    """
    Get transaction statistics for a portfolio.

    Returns:
    - total_transactions: Total count
    - by_type: Breakdown by transaction type with counts and total cash flows
    """
    try:
        start_date_obj = date.fromisoformat(start_date) if start_date else None
        end_date_obj = date.fromisoformat(end_date) if end_date else None

        stats = await repo.get_transaction_stats(
            username=username,
            account_name=account_name,
            start_date=start_date_obj,
            end_date=end_date_obj,
        )

        return stats

    except Exception as e:
        logger.error("Error fetching transaction stats for %s/%s: %s", username, account_name, e)
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


@router.delete("/transactions/{username}/{transaction_id}")
async def delete_transaction_endpoint(
    username: str = Path(..., min_length=1, max_length=100, description="Username"),
    transaction_id: str = Path(..., min_length=1, max_length=50, description="Transaction ID"),
    repo: TransactionRepository = Depends(get_transaction_repository),
):
    """
    Delete a transaction.

    Only the transaction owner can delete it.
    """
    try:
        success = await repo.delete_transaction(transaction_id, username)

        if not success:
            raise HTTPException(
                status_code=404,
                detail="Transaction not found or you don't have permission",
            )

        return {"message": "Transaction deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting transaction %s: %s", transaction_id, e)
        raise HTTPException(status_code=500, detail=f"Failed to delete transaction: {str(e)}")


@router.get("/accounts/{username}/{account_name}/performance-twr")
async def get_portfolio_performance_twr(
    username: str = Path(..., min_length=1, max_length=100, description="Username"),
    account_name: str = Path(..., min_length=1, max_length=100, description="Account name"),
    timeframe: str = Query("1Y", regex=r"^(MTD|QTD|YTD|1Y|5Y|ITD)$", description="Timeframe: MTD, QTD, YTD, 1Y, 5Y, ITD"),
    twr_calculator_service: TWRCalculatorService = Depends(get_twr_calculator_service),
    account_repo: AccountRepository = Depends(get_account_repository),
):
    """
    Calculate portfolio performance using Time-Weighted Returns (TWR).

    TWR isolates investment performance from cash flow effects, providing
    accurate returns that reflect manager skill rather than deposit/withdrawal timing.

    **Key Differences from Standard Performance:**
    - Standard: Simple (End - Start) / Start ignoring cash flows
    - TWR: Breaks period into sub-periods at each cash flow
    - TWR: Chains sub-period returns for accurate total return

    **Example:**
    - Portfolio: $100k -> Deposit $50k -> End $155k
    - Standard return: 55% (WRONG - includes deposit)
    - TWR: ~5% (CORRECT - isolated performance)

    **Timeframes:**
    - MTD: Month-to-Date
    - QTD: Quarter-to-Date
    - YTD: Year-to-Date
    - 1Y: Last 12 months
    - 5Y: Last 5 years
    - ITD: Inception-to-Date (portfolio creation)

    Returns:
    - twr_return: Accurate time-weighted return percentage
    - standard_return: Simple return for comparison
    - difference: Shows impact of cash flows
    - sub_periods: Detailed breakdown of calculation
    - data_quality: Confidence indicators
    """
    try:
        from app.database import get_motor_db

        db = get_motor_db()

        # Parse timeframe to date range
        end_date = date.today()

        if timeframe == "MTD":
            start_date = date(end_date.year, end_date.month, 1)
        elif timeframe == "QTD":
            quarter_month = ((end_date.month - 1) // 3) * 3 + 1
            start_date = date(end_date.year, quarter_month, 1)
        elif timeframe == "YTD":
            start_date = date(end_date.year, 1, 1)
        elif timeframe == "1Y":
            start_date = end_date - timedelta(days=365)
        elif timeframe == "5Y":
            start_date = end_date - timedelta(days=365 * 5)
        elif timeframe == "ITD":
            # Get portfolio inception date using repository
            account = await account_repo.get_by_account_name(username, account_name)
            if account and "open_date" in account:
                start_date = datetime.strptime(account["open_date"], "%Y-%m-%d").date()
            else:
                start_date = date(2020, 1, 1)  # Fallback
        else:
            raise HTTPException(status_code=400, detail=f"Invalid timeframe: {timeframe}")

        # Calculate TWR
        twr_result = await twr_calculator_service.calculate_twr(
            username, account_name, start_date, end_date, db
        )

        # Calculate standard return for comparison
        if twr_result.get("has_data") is False:
            return {
                "timeframe": timeframe,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "twr": twr_result,
                "error": twr_result.get("error"),
                "message": twr_result.get("message"),
            }

        start_value = twr_result.get("start_value", 0)
        end_value = twr_result.get("end_value", 0)
        total_cash_flow = twr_result.get("total_cash_flow", 0)

        # Standard (naive) return calculation
        if start_value > 0:
            standard_return = ((end_value - start_value) / start_value) * 100
        else:
            standard_return = None

        # Calculate difference
        twr_return = twr_result.get("twr_return")
        if twr_return is not None and standard_return is not None:
            difference = standard_return - twr_return
        else:
            difference = None

        return {
            "timeframe": timeframe,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "twr": {
                "return": twr_return,
                "method": "Time-Weighted Return (Modified Dietz)",
                "description": "Isolates investment performance from cash flow timing",
            },
            "standard": {
                "return": round(standard_return, 2) if standard_return is not None else None,
                "method": "Simple Return",
                "description": "Does not account for cash flows",
            },
            "comparison": {
                "difference": round(difference, 2) if difference is not None else None,
                "impact": "High" if difference and abs(difference) > 5 else "Low",
                "explanation": (
                    f"Cash flows caused a {abs(difference):.1f}% distortion in standard return calculation"
                    if difference and abs(difference) > 0.5
                    else "Minimal cash flow impact - both methods agree"
                ),
            },
            "portfolio_values": {
                "start": start_value,
                "end": end_value,
                "change": end_value - start_value,
                "cash_flow_impact": total_cash_flow,
            },
            "sub_periods": twr_result.get("sub_periods", []),
            "data_quality": twr_result.get("data_quality", {}),
            "has_cash_flows": twr_result.get("has_cash_flows", False),
            "cash_flow_count": twr_result.get("cash_flow_count", 0),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error calculating TWR performance for %s/%s: %s", username, account_name, e)
        raise HTTPException(status_code=500, detail=f"Failed to calculate TWR: {str(e)}")
