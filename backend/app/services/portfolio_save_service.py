# app/services/portfolio_save_service.py
"""
Portfolio save service for handling portfolio creation and updates.

This service handles:
- Symbol validation before saving
- Account creation with validation
- Holdings creation with lot-based tracking
- Weighted average price calculation for lot merging

Extracted from routes.py save_portfolio endpoint for reusability and testability.
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import yfinance as yf

logger = logging.getLogger(__name__)


class PortfolioSaveService:
    """
    Service for saving and managing portfolio data.

    Provides validation and atomic operations for portfolio saves,
    ensuring data integrity by validating all symbols before committing changes.
    """

    async def validate_symbols(self, symbols: List[str]) -> List[str]:
        """
        Validate stock symbols using yfinance.

        Args:
            symbols: List of stock ticker symbols to validate

        Returns:
            List of invalid symbols (empty list if all valid)
        """
        invalid_symbols = []

        for symbol in symbols:
            if not symbol:
                invalid_symbols.append("(empty)")
                continue

            symbol = symbol.upper().strip()

            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="1d")
                if hist.empty:
                    invalid_symbols.append(symbol)
                    logger.debug("Symbol validation failed for %s: no history data", symbol)
            except Exception as e:
                invalid_symbols.append(symbol)
                logger.debug("Symbol validation failed for %s: %s", symbol, e)

        return invalid_symbols

    async def validate_holdings(
        self,
        holdings: List[Dict]
    ) -> Tuple[List[Dict], List[str]]:
        """
        Validate holdings data and return valid holdings and invalid symbols.

        Args:
            holdings: List of holding dicts with symbol, quantity, purchasePrice

        Returns:
            Tuple of (valid_holdings, invalid_symbols)
        """
        valid_holdings = []
        invalid_symbols = []

        for h in holdings:
            symbol = h.get("symbol", "").upper().strip()
            quantity = float(h.get("quantity", 0))
            purchase_price = float(h.get("purchasePrice", 0))

            if not symbol or quantity <= 0 or purchase_price <= 0:
                invalid_symbols.append(symbol or "(empty)")
                continue

            # Validate using yfinance
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="1d")
                if hist.empty:
                    invalid_symbols.append(symbol)
                else:
                    valid_holdings.append({
                        "symbol": symbol,
                        "quantity": quantity,
                        "purchasePrice": purchase_price,
                        "purchaseDate": h.get("purchaseDate")
                    })
            except Exception as e:
                invalid_symbols.append(symbol)
                logger.warning("Symbol validation failed for %s: %s", symbol, e)

        return valid_holdings, invalid_symbols

    async def save_portfolio(
        self,
        username: str,
        account_details: Dict,
        holdings: List[Dict],
        account_repo,
        holding_repo
    ) -> Dict:
        """
        Save a portfolio with atomic validation.

        Validates all symbols before saving any data. If any symbol is invalid,
        the entire save is rejected.

        Args:
            username: User identifier
            account_details: Dict with accountName, accountNumber, openDate
            holdings: List of holding dicts
            account_repo: Account repository instance
            holding_repo: Holding repository instance

        Returns:
            Dict with save results including counts of added/updated holdings

        Raises:
            ValueError: If account already exists or symbols are invalid
        """
        account_name = account_details["accountName"].strip()
        account_no = account_details["accountNumber"].strip()

        # Check if account already exists
        existing_account = await account_repo.get_by_account_no(username, account_no)
        if existing_account:
            raise ValueError("Account already exists for this user.")

        # Validate all holdings first
        valid_holdings, invalid_symbols = await self.validate_holdings(holdings)

        if invalid_symbols:
            raise ValueError(
                f"Invalid stock symbols detected: {', '.join(invalid_symbols)}. "
                f"Portfolio not saved."
            )

        # Create account (all symbols validated at this point)
        await account_repo.create_account(
            username=username,
            account_name=account_name,
            account_no=account_no,
            open_date=account_details.get("openDate"),
        )

        # Process holdings
        holdings_added, holdings_updated = 0, 0

        for h in valid_holdings:
            symbol = h["symbol"]
            quantity = h["quantity"]
            purchase_price = h["purchasePrice"]
            purchase_date = h.get("purchaseDate")

            result = await self._save_holding(
                username=username,
                account_name=account_name,
                account_no=account_no,
                symbol=symbol,
                quantity=quantity,
                purchase_price=purchase_price,
                purchase_date=purchase_date,
                holding_repo=holding_repo
            )

            if result == "added":
                holdings_added += 1
            elif result == "updated":
                holdings_updated += 1

        logger.info(
            "Portfolio saved for %s/%s: %d added, %d updated",
            username, account_name, holdings_added, holdings_updated
        )

        return {
            "message": "Portfolio saved successfully!",
            "account_added": True,
            "holdings_added": holdings_added,
            "holdings_updated": holdings_updated
        }

    async def _save_holding(
        self,
        username: str,
        account_name: str,
        account_no: str,
        symbol: str,
        quantity: float,
        purchase_price: float,
        purchase_date: Optional[str],
        holding_repo
    ) -> str:
        """
        Save or update a single holding.

        Args:
            username: User identifier
            account_name: Account name
            account_no: Account number
            symbol: Stock symbol
            quantity: Number of shares
            purchase_price: Price per share
            purchase_date: Date of purchase
            holding_repo: Holding repository instance

        Returns:
            "added" if new holding created, "updated" if existing holding modified
        """
        existing_holding = await holding_repo.get_holding_by_full_key(
            username, account_name, account_no, symbol
        )

        if existing_holding:
            # Calculate weighted average for update
            old_qty = float(existing_holding["quantity"])
            old_price = float(existing_holding["purchase_price"])
            new_qty = old_qty + quantity
            new_price = self.calculate_weighted_avg_price(
                old_qty, old_price, quantity, purchase_price
            )

            # Create new lot entry
            new_lot = {
                "lot_id": str(uuid.uuid4()),
                "quantity": quantity,
                "purchase_price": purchase_price,
                "purchase_date": purchase_date,
                "created_at": datetime.utcnow()
            }

            # Determine earliest purchase date
            existing_purchase_date = existing_holding.get("purchase_date", purchase_date)
            earliest_date = (
                min(existing_purchase_date, purchase_date)
                if existing_purchase_date and purchase_date
                else purchase_date or existing_purchase_date
            )

            await holding_repo.add_lot_to_holding(
                username=username,
                account_name=account_name,
                account_no=account_no,
                symbol=symbol,
                new_lot=new_lot,
                new_quantity=new_qty,
                new_avg_price=new_price,
                earliest_purchase_date=earliest_date,
            )
            return "updated"
        else:
            # Create new holding with initial lot
            first_lot = {
                "lot_id": str(uuid.uuid4()),
                "quantity": quantity,
                "purchase_price": purchase_price,
                "purchase_date": purchase_date,
                "created_at": datetime.utcnow()
            }

            holding_record = {
                "username": username,
                "client_account_name": account_name,
                "account_no": account_no,
                "symbol": symbol,
                "quantity": quantity,
                "purchase_price": purchase_price,
                "purchase_date": purchase_date,
                "lots": [first_lot],
                "created_at": datetime.utcnow()
            }
            await holding_repo.create(holding_record)
            return "added"

    def calculate_weighted_avg_price(
        self,
        old_qty: float,
        old_price: float,
        new_qty: float,
        new_price: float
    ) -> float:
        """
        Calculate weighted average price for lot merging.

        Args:
            old_qty: Existing quantity
            old_price: Existing average price
            new_qty: New quantity being added
            new_price: Price of new shares

        Returns:
            Weighted average price
        """
        total_qty = old_qty + new_qty
        if total_qty == 0:
            return 0

        return ((old_qty * old_price) + (new_qty * new_price)) / total_qty


# Create singleton instance
portfolio_save_service = PortfolioSaveService()
