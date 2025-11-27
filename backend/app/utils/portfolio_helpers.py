# app/utils/portfolio_helpers.py
"""
Portfolio business logic helpers.

Contains FIFO lot tracking and sell transaction processing functions
extracted from routes.py for reuse across multiple route modules.
"""

from copy import deepcopy
from datetime import datetime
from typing import Tuple, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorCollection


def reduce_lots_fifo(lots: List[Dict], quantity_to_reduce: float) -> Tuple[List[Dict], float]:
    """
    Reduces lots using FIFO (First In, First Out) method.

    This function implements FIFO cost basis accounting for stock sales.
    Shares are sold from the oldest lots first.

    Args:
        lots: List of lot dictionaries with keys:
            - quantity: Number of shares in this lot
            - purchase_price: Price per share when purchased
            - purchase_date: Date of purchase (YYYY-MM-DD string)
        quantity_to_reduce: Number of shares to sell

    Returns:
        Tuple of (updated_lots, realized_gain_loss)
        - updated_lots: List of remaining lots after the sale
        - realized_gain_loss: Placeholder for future gain/loss tracking (currently 0.0)

    Raises:
        ValueError: If insufficient shares available to sell

    Example:
        >>> lots = [
        ...     {"quantity": 10, "purchase_price": 100, "purchase_date": "2024-01-01"},
        ...     {"quantity": 20, "purchase_price": 110, "purchase_date": "2024-02-01"}
        ... ]
        >>> updated, gain = reduce_lots_fifo(lots, 15)
        >>> # First lot (10 shares) fully consumed, 5 shares from second lot
        >>> updated
        [{"quantity": 15, "purchase_price": 110, "purchase_date": "2024-02-01"}]
    """
    # Calculate total available quantity
    total_quantity = sum(float(lot.get("quantity", 0)) for lot in lots)

    if quantity_to_reduce > total_quantity:
        raise ValueError(
            f"Insufficient shares to sell. Available: {total_quantity}, "
            f"Requested: {quantity_to_reduce}"
        )

    # Sort lots by purchase_date (oldest first) for FIFO
    sorted_lots = sorted(
        deepcopy(lots),
        key=lambda x: x.get("purchase_date", "9999-12-31")
    )

    updated_lots = []
    remaining_to_reduce = quantity_to_reduce
    realized_gain_loss = 0.0

    for lot in sorted_lots:
        lot_quantity = float(lot.get("quantity", 0))
        lot_price = float(lot.get("purchase_price", 0))

        if remaining_to_reduce <= 0:
            # No more to reduce, keep this lot as-is
            updated_lots.append(lot)
        elif lot_quantity <= remaining_to_reduce:
            # Fully consume this lot
            remaining_to_reduce -= lot_quantity
            # Don't add to updated_lots (lot is fully sold)
        else:
            # Partially consume this lot
            quantity_sold_from_lot = remaining_to_reduce
            lot["quantity"] = lot_quantity - quantity_sold_from_lot
            updated_lots.append(lot)
            remaining_to_reduce = 0

    return updated_lots, realized_gain_loss


async def apply_sell_transaction(
    holdings_col: AsyncIOMotorCollection,
    username: str,
    account_name: str,
    account_no: str,
    symbol: str,
    quantity_to_sell: float,
    sell_price: float = None
) -> Dict[str, Any]:
    """
    Applies a SELL transaction to reduce holdings using FIFO lot tracking.

    This function handles the complete sell workflow:
    1. Finds the existing holding in MongoDB
    2. Validates sufficient shares are available
    3. Applies FIFO reduction to lots
    4. Updates or deletes the holding record

    Args:
        holdings_col: MongoDB Stock_Holding collection (Motor async)
        username: Username who owns the holding
        account_name: Account name within the user's portfolio
        account_no: Account number identifier
        symbol: Stock ticker symbol to sell (case-insensitive)
        quantity_to_sell: Number of shares to sell
        sell_price: Optional sell price (for future realized gain/loss calculation)

    Returns:
        Dict with result details:
            - status: "deleted" or "updated"
            - symbol: Stock symbol
            - quantity_sold: Number of shares sold
            - remaining_quantity: Shares remaining after sale
            - realized_gain_loss: Calculated gain/loss (placeholder)

    Raises:
        ValueError: If holding not found or insufficient shares

    Example:
        >>> result = await apply_sell_transaction(
        ...     holdings_col, "john_doe", "Main", "ACC001", "AAPL", 10, 150.0
        ... )
        >>> result
        {
            "status": "updated",
            "symbol": "AAPL",
            "quantity_sold": 10,
            "remaining_quantity": 90,
            "realized_gain_loss": 0.0
        }
    """
    # Find existing holding
    holding = await holdings_col.find_one({
        "username": username,
        "client_account_name": account_name,
        "account_no": account_no,
        "symbol": symbol.upper()
    })

    if not holding:
        raise ValueError(f"No holding found for {symbol}")

    current_quantity = float(holding.get("quantity", 0))
    current_lots = holding.get("lots", [])

    if quantity_to_sell > current_quantity:
        raise ValueError(
            f"Insufficient shares to sell. Available: {current_quantity}, "
            f"Requested: {quantity_to_sell}"
        )

    # Apply FIFO reduction
    updated_lots, realized_gain_loss = reduce_lots_fifo(current_lots, quantity_to_sell)

    new_quantity = current_quantity - quantity_to_sell

    if new_quantity <= 0:
        # Completely sold out - delete holding
        await holdings_col.delete_one({"_id": holding["_id"]})
        return {
            "status": "deleted",
            "symbol": symbol,
            "quantity_sold": quantity_to_sell,
            "remaining_quantity": 0,
            "realized_gain_loss": realized_gain_loss
        }
    else:
        # Partial sale - update holding
        # Recalculate weighted average price from remaining lots
        total_cost = sum(
            float(lot.get("quantity", 0)) * float(lot.get("purchase_price", 0))
            for lot in updated_lots
        )
        new_avg_price = total_cost / new_quantity if new_quantity > 0 else 0

        # Find earliest remaining purchase date
        earliest_date = min(
            lot.get("purchase_date", "9999-12-31")
            for lot in updated_lots
        ) if updated_lots else holding.get("purchase_date")

        await holdings_col.update_one(
            {"_id": holding["_id"]},
            {
                "$set": {
                    "quantity": new_quantity,
                    "purchase_price": round(new_avg_price, 2),
                    "purchase_date": earliest_date,
                    "lots": updated_lots,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        return {
            "status": "updated",
            "symbol": symbol,
            "quantity_sold": quantity_to_sell,
            "remaining_quantity": new_quantity,
            "realized_gain_loss": realized_gain_loss
        }
