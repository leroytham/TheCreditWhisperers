"""
Time-Weighted Returns (TWR) Calculator Service

Implements accurate portfolio performance calculations that isolate
investment returns from cash flow effects (deposits/withdrawals).

Uses the Modified Dietz method to calculate sub-period returns, then
chains them together for total return calculation.

Mathematical Foundation:
- TWR = [(1 + R₁) × (1 + R₂) × ... × (1 + Rₙ)] - 1
- Where Rᵢ = (End Value - Start Value - Net Cash Flow) / (Start Value + Weighted Cash Flow)
- Weighted Cash Flow = Σ(CF × Days Remaining / Total Days)
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import asyncio


class TWRCalculatorService:
    """
    Time-Weighted Returns Calculator Service.

    Calculates accurate portfolio returns by breaking periods into sub-periods
    at each cash flow event, calculating returns for each sub-period, and
    chaining them together.
    """

    def __init__(self):
        """Initialize the TWR calculator service."""
        self.MIN_VALUE_THRESHOLD = 0.01  # Minimum portfolio value for valid calculation

    async def calculate_twr(
        self,
        username: str,
        account_name: str,
        start_date: date,
        end_date: date,
        db
    ) -> Dict:
        """
        Calculate Time-Weighted Return for a portfolio over a period.

        Args:
            username: User identifier
            account_name: Portfolio/account name
            start_date: Start date of calculation period
            end_date: End date of calculation period
            db: Database connection

        Returns:
            Dictionary containing:
            - twr_return: Total TWR percentage
            - sub_periods: List of sub-period details
            - start_value: Portfolio value at start
            - end_value: Portfolio value at end
            - total_cash_flow: Net cash flow during period
            - data_quality: Quality indicators
        """
        try:
            # 1. Fetch all cash flows in the period
            from app.models.transaction import get_cash_flows_between_dates

            cash_flows = await get_cash_flows_between_dates(
                db, username, account_name, start_date, end_date
            )

            # 2. Get portfolio values at key dates
            start_value = await self._calculate_portfolio_value(
                db, username, account_name, start_date
            )
            end_value = await self._calculate_portfolio_value(
                db, username, account_name, end_date
            )

            # 3. Handle edge cases
            if start_value < self.MIN_VALUE_THRESHOLD:
                return {
                    "twr_return": None,
                    "error": "zero_baseline",
                    "message": "Portfolio starts at $0. Cannot calculate percentage returns.",
                    "start_value": start_value,
                    "end_value": end_value,
                    "has_data": False
                }

            # 4. If no cash flows, simple calculation
            if not cash_flows:
                simple_return = ((end_value - start_value) / start_value) * 100
                return {
                    "twr_return": round(simple_return, 2),
                    "sub_periods": [{
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat(),
                        "start_value": start_value,
                        "end_value": end_value,
                        "cash_flows": [],
                        "return": round(simple_return, 2)
                    }],
                    "start_value": start_value,
                    "end_value": end_value,
                    "total_cash_flow": 0.0,
                    "has_cash_flows": False,
                    "data_quality": {
                        "calculation_method": "simple",
                        "confidence": "high"
                    }
                }

            # 5. Break period into sub-periods at each cash flow
            sub_periods = await self._create_sub_periods(
                db, username, account_name, start_date, end_date, cash_flows
            )

            # 6. Calculate return for each sub-period
            sub_period_returns = []
            for period in sub_periods:
                period_return = self._calculate_sub_period_return(
                    period["start_value"],
                    period["end_value"],
                    period["cash_flows"],
                    period["days"]
                )
                period["return"] = round(period_return, 4)
                sub_period_returns.append(period_return)

            # 7. Chain sub-period returns to get total TWR
            total_twr = self._chain_returns(sub_period_returns)

            # 8. Calculate total cash flow
            total_cash_flow = sum(cf["amount"] for cf in cash_flows)

            return {
                "twr_return": round(total_twr, 2),
                "sub_periods": sub_periods,
                "start_value": start_value,
                "end_value": end_value,
                "total_cash_flow": total_cash_flow,
                "has_cash_flows": True,
                "cash_flow_count": len(cash_flows),
                "data_quality": {
                    "calculation_method": "modified_dietz",
                    "sub_period_count": len(sub_periods),
                    "confidence": "high"
                }
            }

        except Exception as e:
            print(f"Error calculating TWR: {e}")
            import traceback
            traceback.print_exc()
            return {
                "twr_return": None,
                "error": "calculation_failed",
                "message": str(e),
                "has_data": False
            }

    def _calculate_sub_period_return(
        self,
        start_value: float,
        end_value: float,
        cash_flows: List[Dict],
        total_days: int
    ) -> float:
        """
        Calculate return for a single sub-period using Modified Dietz method.

        Formula: R = (End Value - Start Value - Net Cash Flow) / (Start Value + Weighted Cash Flow)

        Where Weighted Cash Flow = Σ(CF × Days Remaining / Total Days)

        Args:
            start_value: Portfolio value at start of sub-period
            end_value: Portfolio value at end of sub-period
            cash_flows: List of cash flows in this sub-period with timing
            total_days: Total days in the sub-period

        Returns:
            Return as decimal (0.05 = 5%)
        """
        # Handle zero or very small starting value
        if start_value < self.MIN_VALUE_THRESHOLD:
            return 0.0

        # Calculate net cash flow
        net_cash_flow = sum(cf["amount"] for cf in cash_flows)

        # Calculate weighted cash flow
        weighted_cash_flow = self._calculate_weighted_cash_flow(
            cash_flows, total_days
        )

        # Modified Dietz formula
        denominator = start_value + weighted_cash_flow

        # Avoid division by zero
        if abs(denominator) < self.MIN_VALUE_THRESHOLD:
            return 0.0

        period_return = (end_value - start_value - net_cash_flow) / denominator

        # Sanity check: extreme returns are likely errors
        if abs(period_return) > 10.0:  # More than 1000% return is suspicious
            print(f"WARNING: Extreme return detected: {period_return * 100:.2f}%")
            print(f"  Start: ${start_value:,.2f}, End: ${end_value:,.2f}")
            print(f"  Net CF: ${net_cash_flow:,.2f}, Weighted CF: ${weighted_cash_flow:,.2f}")

        return period_return

    def _calculate_weighted_cash_flow(
        self,
        cash_flows: List[Dict],
        total_days: int
    ) -> float:
        """
        Calculate weighted cash flow based on timing within period.

        Cash flows that occur earlier in the period should be weighted more
        heavily than those occurring later, as they have more time to
        contribute to portfolio value changes.

        Args:
            cash_flows: List of cash flows with 'amount' and 'days_in_period' keys
            total_days: Total days in the period

        Returns:
            Weighted cash flow amount
        """
        if total_days <= 0:
            return 0.0

        weighted_sum = 0.0
        for cf in cash_flows:
            # Weight = (Days Remaining after CF) / Total Days
            days_remaining = total_days - cf.get("days_in_period", 0)
            weight = days_remaining / total_days
            weighted_sum += cf["amount"] * weight

        return weighted_sum

    def _chain_returns(self, sub_period_returns: List[float]) -> float:
        """
        Chain sub-period returns to calculate total return.

        Formula: Total Return = [(1 + R₁) × (1 + R₂) × ... × (1 + Rₙ)] - 1

        Args:
            sub_period_returns: List of sub-period returns as decimals

        Returns:
            Total chained return as percentage
        """
        if not sub_period_returns:
            return 0.0

        # Start with 1.0 (100%)
        chained_value = 1.0

        # Multiply by (1 + return) for each sub-period
        for r in sub_period_returns:
            chained_value *= (1.0 + r)

        # Convert back to percentage return
        total_return = (chained_value - 1.0) * 100

        return total_return

    async def _create_sub_periods(
        self,
        db,
        username: str,
        account_name: str,
        start_date: date,
        end_date: date,
        cash_flows: List[Dict]
    ) -> List[Dict]:
        """
        Break the overall period into sub-periods at each cash flow event.

        Args:
            db: Database connection
            username: User identifier
            account_name: Portfolio name
            start_date: Overall start date
            end_date: Overall end date
            cash_flows: List of cash flow events (sorted by date)

        Returns:
            List of sub-period dictionaries with start/end dates and values
        """
        sub_periods = []

        # Sort cash flows by date (should already be sorted, but ensure it)
        sorted_flows = sorted(cash_flows, key=lambda x: x["date"])

        # Create sub-periods between cash flows
        current_start = start_date
        current_start_value = await self._calculate_portfolio_value(
            db, username, account_name, start_date
        )

        for i, cf in enumerate(sorted_flows):
            cf_date = cf["date"]

            # Skip if cash flow is on the same day as start (include in first period)
            if cf_date == current_start:
                continue

            # Create sub-period up to (but not including) cash flow date
            period_end_date = cf_date - timedelta(days=1)

            if period_end_date >= current_start:
                # Get portfolio value right before cash flow
                period_end_value = await self._calculate_portfolio_value(
                    db, username, account_name, period_end_date
                )

                # Collect any cash flows that occurred in this sub-period
                period_cash_flows = []
                for flow in sorted_flows:
                    if current_start <= flow["date"] <= period_end_date:
                        days_in_period = (flow["date"] - current_start).days
                        period_cash_flows.append({
                            "date": flow["date"].isoformat(),
                            "amount": flow["amount"],
                            "type": flow["type"],
                            "symbol": flow.get("symbol"),
                            "days_in_period": days_in_period
                        })

                total_days = (period_end_date - current_start).days + 1

                sub_periods.append({
                    "start_date": current_start.isoformat(),
                    "end_date": period_end_date.isoformat(),
                    "start_value": current_start_value,
                    "end_value": period_end_value,
                    "cash_flows": period_cash_flows,
                    "days": total_days
                })

                # Start next period after the cash flow
                current_start = cf_date
                # Value after cash flow = value before + cash flow amount
                current_start_value = period_end_value + cf["amount"]

        # Create final sub-period from last cash flow to end date
        if current_start <= end_date:
            final_value = await self._calculate_portfolio_value(
                db, username, account_name, end_date
            )

            # Collect cash flows in final period
            final_cash_flows = []
            for flow in sorted_flows:
                if current_start <= flow["date"] <= end_date:
                    days_in_period = (flow["date"] - current_start).days
                    final_cash_flows.append({
                        "date": flow["date"].isoformat(),
                        "amount": flow["amount"],
                        "type": flow["type"],
                        "symbol": flow.get("symbol"),
                        "days_in_period": days_in_period
                    })

            total_days = (end_date - current_start).days + 1

            sub_periods.append({
                "start_date": current_start.isoformat(),
                "end_date": end_date.isoformat(),
                "start_value": current_start_value,
                "end_value": final_value,
                "cash_flows": final_cash_flows,
                "days": total_days
            })

        return sub_periods

    async def _calculate_portfolio_value(
        self,
        db,
        username: str,
        account_name: str,
        value_date: date
    ) -> float:
        """
        Calculate total portfolio value on a specific date.

        Sums market value of all holdings on that date using historical prices.

        Args:
            db: Database connection
            username: User identifier
            account_name: Portfolio name
            value_date: Date to calculate value for

        Returns:
            Total portfolio value in dollars
        """
        try:
            import yfinance as yf
            from pymongo import MongoClient

            # Get all holdings for this portfolio
            holdings_col = db["Stock_Holding"]
            holdings = list(holdings_col.find({
                "username": username,
                "client_account_name": account_name
            }))

            if not holdings:
                return 0.0

            total_value = 0.0

            # Calculate value for each holding
            for holding in holdings:
                symbol = holding.get("symbol")
                quantity = float(holding.get("quantity", 0))
                purchase_date_str = holding.get("purchase_date")

                # Skip if holding wasn't owned yet
                if purchase_date_str:
                    purchase_date = datetime.strptime(purchase_date_str, "%Y-%m-%d").date()
                    if value_date < purchase_date:
                        continue

                # Fetch historical price for this date
                try:
                    ticker = yf.Ticker(symbol)
                    # Fetch a small window around the date to handle weekends/holidays
                    start = value_date - timedelta(days=7)
                    end = value_date + timedelta(days=1)
                    hist = ticker.history(start=start.isoformat(), end=end.isoformat())

                    if not hist.empty:
                        # Get price closest to (but not after) value_date
                        hist_dates = [d.date() for d in hist.index]
                        valid_dates = [d for d in hist_dates if d <= value_date]

                        if valid_dates:
                            closest_date = max(valid_dates)
                            price = float(hist.loc[hist.index.date == closest_date, "Close"].iloc[0])
                            total_value += quantity * price
                        else:
                            # No data before value_date - use first available price
                            price = float(hist["Close"].iloc[0])
                            total_value += quantity * price

                except Exception as e:
                    print(f"Warning: Could not fetch price for {symbol} on {value_date}: {e}")
                    # Skip this holding if price unavailable
                    continue

            return total_value

        except Exception as e:
            print(f"Error calculating portfolio value: {e}")
            import traceback
            traceback.print_exc()
            return 0.0


# Singleton instance
twr_calculator_service = TWRCalculatorService()
