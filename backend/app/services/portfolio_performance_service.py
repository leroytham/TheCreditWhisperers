# app/services/portfolio_performance_service.py

"""
Portfolio Performance Service

Extracted helper functions for portfolio performance calculations.
Follows the Extract Method refactoring pattern to improve maintainability.
"""

import asyncio
import logging
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

from app.services.stock_data_service import stock_data_service

logger = logging.getLogger(__name__)


@dataclass
class HoldingPerformance:
    """Data class representing performance metrics for a single holding."""
    symbol: str
    quantity: float
    start_price: float
    current_price: float
    return_percent: float
    price_source: str
    value_at_start: float
    value_now: float
    gain_loss: float = 0.0


@dataclass
class PortfolioPerformanceResult:
    """Data class representing aggregated portfolio performance."""
    period: str
    return_percent: float
    sp500_return: float
    is_positive: bool
    outperformance: float
    portfolio_value_start: float
    portfolio_value_current: float
    holdings_count: int
    top_gainers: List[Dict]
    top_losers: List[Dict]


def calculate_period_boundaries(period_name: str, today: datetime) -> Tuple[datetime, Optional[datetime]]:
    """
    Calculate start and end dates for a given period.

    Args:
        period_name: One of "MTD", "QTD", "YTD", "ITD"
        today: Current date

    Returns:
        Tuple of (start_date, end_date) where end_date is today
    """
    if period_name == "MTD":
        start_date = today.replace(day=1)
    elif period_name == "QTD":
        start_date = today - timedelta(days=90)
    elif period_name == "YTD":
        start_date = today.replace(month=1, day=1)
    elif period_name == "ITD":
        # ITD requires holdings data, return None and calculate later
        start_date = None
    else:
        raise ValueError(f"Unknown period: {period_name}")

    return start_date, today


def calculate_itd_start_date(holdings_list: List[Dict], today: datetime) -> datetime:
    """
    Calculate the earliest purchase date for ITD (Inception-to-Date).

    Args:
        holdings_list: List of holdings with purchase_date field
        today: Current date (used as fallback)

    Returns:
        Earliest purchase date from all holdings
    """
    return min(
        datetime.strptime(h.get("purchase_date", today.strftime("%Y-%m-%d")), "%Y-%m-%d")
        for h in holdings_list
    )


async def fetch_current_prices_batch(
    holdings_list: List[Dict]
) -> Dict[str, float]:
    """
    Fetch current market prices for all holdings in parallel.

    Args:
        holdings_list: List of holdings with symbol field

    Returns:
        Dictionary mapping symbol to current price
    """
    async def fetch_single_price(symbol: str) -> Tuple[str, Optional[float]]:
        """Fetch current price for a single symbol."""
        try:
            price_data = await stock_data_service.get_current_market_price(symbol)
            if price_data and price_data.get("market_price"):
                return symbol, float(price_data["market_price"])
        except Exception as e:
            logger.warning("Error fetching current price for %s: %s", symbol, e)
        return symbol, None

    # Get unique symbols
    unique_symbols = list(set(
        h.get("symbol", "").upper()
        for h in holdings_list
        if h.get("symbol")
    ))

    # Fetch all prices in parallel
    tasks = [fetch_single_price(symbol) for symbol in unique_symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Build price map
    current_prices = {}
    for result in results:
        if not isinstance(result, Exception) and result:
            symbol, price = result
            if price is not None:
                current_prices[symbol] = price

    logger.info("Fetched current prices for %d holdings", len(current_prices))
    return current_prices


async def calculate_holding_performance(
    holding: Dict,
    period_start: datetime,
    current_prices: Dict[str, float],
    today: datetime
) -> Optional[HoldingPerformance]:
    """
    Calculate performance for a single holding using hybrid logic.

    Hybrid Logic:
    - If purchase_date >= period_start: Use purchase price (cost basis)
    - If purchase_date < period_start: Use market price at period start

    Args:
        holding: Holding dictionary with symbol, quantity, purchase_price, purchase_date
        period_start: Start date of the performance period
        current_prices: Pre-fetched map of symbol to current price
        today: Current date

    Returns:
        HoldingPerformance object or None if calculation fails
    """
    symbol = holding.get("symbol", "").upper()
    quantity = float(holding.get("quantity", 0))
    purchase_price = float(holding.get("purchase_price", 0))
    purchase_date_str = holding.get("purchase_date", today.strftime("%Y-%m-%d"))
    purchase_date = datetime.strptime(purchase_date_str, "%Y-%m-%d")

    try:
        # Determine start price using hybrid logic
        if purchase_date >= period_start:
            # Stock was bought WITHIN this period - use cost basis
            period_start_price = purchase_price
            price_source = "Purchase Price (bought in period)"
        else:
            # Stock was bought BEFORE this period - use market price at period start
            start_str = (period_start - timedelta(days=5)).strftime("%Y-%m-%d")
            end_str = (period_start + timedelta(days=5)).strftime("%Y-%m-%d")

            hist_data = await stock_data_service.get_historical_price(symbol, start_str, end_str)

            if hist_data and hist_data.get("start_price"):
                period_start_price = float(hist_data["start_price"])
                price_source = f"Market Price on {period_start.strftime('%Y-%m-%d')}"
            else:
                logger.warning("No market data for %s at period start, using purchase price", symbol)
                period_start_price = purchase_price
                price_source = "Purchase Price (fallback)"

        # Get current price from pre-fetched cache
        current_price = current_prices.get(symbol)
        if not current_price:
            logger.warning("No current price for %s", symbol)
            return None

        # Calculate values and return
        value_at_start = quantity * period_start_price
        value_now = quantity * current_price
        holding_return = ((current_price - period_start_price) / period_start_price) * 100 if period_start_price > 0 else 0

        return HoldingPerformance(
            symbol=symbol,
            quantity=quantity,
            start_price=period_start_price,
            current_price=current_price,
            return_percent=holding_return,
            price_source=price_source,
            value_at_start=value_at_start,
            value_now=value_now,
            gain_loss=round(value_now - value_at_start, 2)
        )

    except Exception as e:
        logger.error("Error calculating performance for %s: %s", symbol, e)
        return None


async def fetch_sp500_return(start_date: datetime, end_date: datetime) -> float:
    """
    Fetch S&P 500 return for the given period.

    Args:
        start_date: Period start date
        end_date: Period end date (usually today)

    Returns:
        S&P 500 return percentage
    """
    try:
        sp500 = yf.Ticker("^GSPC")
        sp500_hist = await asyncio.wait_for(
            asyncio.to_thread(
                sp500.history,
                start=(start_date - timedelta(days=5)).strftime("%Y-%m-%d"),
                end=end_date.strftime("%Y-%m-%d")
            ),
            timeout=20.0
        )

        if len(sp500_hist) >= 2:
            sp500_start = float(sp500_hist['Close'].iloc[0])
            sp500_end = float(sp500_hist['Close'].iloc[-1])
            return ((sp500_end - sp500_start) / sp500_start) * 100
        else:
            logger.warning("Insufficient S&P 500 data")
            return 0.0

    except Exception as e:
        logger.error("Error fetching S&P 500 data: %s", e)
        return 0.0


def aggregate_portfolio_performance(
    holdings_performance: List[HoldingPerformance],
    period_name: str,
    sp500_return: float
) -> PortfolioPerformanceResult:
    """
    Aggregate individual holding performances into portfolio-level metrics.

    Args:
        holdings_performance: List of HoldingPerformance objects
        period_name: Name of the period (MTD, QTD, YTD, ITD)
        sp500_return: S&P 500 return for comparison

    Returns:
        PortfolioPerformanceResult with aggregated metrics
    """
    # Calculate totals
    total_value_at_start = sum(h.value_at_start for h in holdings_performance)
    total_value_now = sum(h.value_now for h in holdings_performance)

    # Calculate portfolio return
    if total_value_at_start > 0:
        portfolio_return = ((total_value_now - total_value_at_start) / total_value_at_start) * 100
    else:
        portfolio_return = 0.0

    # Calculate outperformance
    outperformance = portfolio_return - sp500_return

    # Sort for top gainers/losers
    sorted_holdings = sorted(holdings_performance, key=lambda x: x.return_percent, reverse=True)

    # Top gainers (up to 5)
    top_gainers = [
        {
            "symbol": h.symbol,
            "quantity": h.quantity,
            "start_price": h.start_price,
            "current_price": h.current_price,
            "return": round(h.return_percent, 2),
            "price_source": h.price_source,
            "value_at_start": h.value_at_start,
            "value_now": h.value_now,
            "gain_loss": h.gain_loss,
            "return_percent": round(h.return_percent, 2)
        }
        for h in sorted_holdings if h.return_percent > 0
    ][:5]

    # Top losers (up to 5)
    all_losers = [h for h in sorted_holdings if h.return_percent < 0]
    top_losers = [
        {
            "symbol": h.symbol,
            "quantity": h.quantity,
            "start_price": h.start_price,
            "current_price": h.current_price,
            "return": round(h.return_percent, 2),
            "price_source": h.price_source,
            "value_at_start": h.value_at_start,
            "value_now": h.value_now,
            "gain_loss": h.gain_loss,
            "return_percent": round(h.return_percent, 2)
        }
        for h in sorted(all_losers, key=lambda x: x.return_percent)
    ][:5]

    return PortfolioPerformanceResult(
        period=period_name,
        return_percent=round(portfolio_return, 2),
        sp500_return=round(sp500_return, 2),
        is_positive=portfolio_return >= 0,
        outperformance=round(outperformance, 2),
        portfolio_value_start=round(total_value_at_start, 2),
        portfolio_value_current=round(total_value_now, 2),
        holdings_count=len(holdings_performance),
        top_gainers=top_gainers,
        top_losers=top_losers
    )


async def generate_portfolio_events(
    holdings_list: List[Dict],
    today: datetime
) -> List[Dict]:
    """
    Generate portfolio events timeline (dividends, splits, purchases).

    Args:
        holdings_list: List of holdings
        today: Current date

    Returns:
        List of event dictionaries sorted by date (most recent first)
    """
    events = []
    one_year_ago = today - timedelta(days=365)
    unique_symbols = list(set(h.get("symbol", "").upper() for h in holdings_list if h.get("symbol")))

    # Fetch dividends and splits for each symbol
    for symbol in unique_symbols:
        try:
            ticker = yf.Ticker(symbol)

            # Fetch dividends
            dividends = await asyncio.wait_for(
                asyncio.to_thread(lambda: ticker.dividends),
                timeout=10.0
            )
            if not dividends.empty:
                recent_divs = dividends[dividends.index >= pd.Timestamp(one_year_ago)]
                for div_date, div_amount in recent_divs.items():
                    holding_qty = sum(
                        float(h.get("quantity", 0))
                        for h in holdings_list
                        if h.get("symbol", "").upper() == symbol
                    )
                    total_dividend = holding_qty * float(div_amount)

                    events.append({
                        "date": div_date.strftime("%Y-%m-%d"),
                        "type": "dividend",
                        "description": f"Received dividend from {symbol}",
                        "ticker": symbol,
                        "impact_value": round(total_dividend, 2)
                    })

            # Fetch splits
            splits = await asyncio.wait_for(
                asyncio.to_thread(lambda: ticker.splits),
                timeout=10.0
            )
            if not splits.empty:
                recent_splits = splits[splits.index >= pd.Timestamp(one_year_ago)]
                for split_date, split_ratio in recent_splits.items():
                    events.append({
                        "date": split_date.strftime("%Y-%m-%d"),
                        "type": "split",
                        "description": f"{symbol} stock split {split_ratio}:1",
                        "ticker": symbol,
                        "impact_value": None
                    })

        except Exception as e:
            logger.warning("Error fetching events for %s: %s", symbol, e)
            continue

    # Add purchase events
    for holding in holdings_list:
        purchase_date = holding.get("purchase_date")
        if purchase_date:
            try:
                symbol = holding.get("symbol", "").upper()
                quantity = float(holding.get("quantity", 0))
                purchase_price = float(holding.get("purchase_price", 0))
                total_cost = quantity * purchase_price

                purchase_dt = pd.to_datetime(purchase_date).date()
                if purchase_dt >= one_year_ago.date():
                    events.append({
                        "date": purchase_date,
                        "type": "purchase",
                        "description": f"Purchased {quantity:.2f} shares of {symbol}",
                        "ticker": symbol,
                        "impact_value": round(total_cost, 2)
                    })
            except Exception as e:
                logger.warning("Error processing purchase event: %s", e)
                continue

    # Sort by date (most recent first)
    events.sort(key=lambda x: x["date"], reverse=True)
    logger.debug("Generated %d portfolio events", len(events))

    return events


# Module-level singleton instance
portfolio_performance_service = None


def get_portfolio_performance_service():
    """Get or create the portfolio performance service singleton."""
    global portfolio_performance_service
    if portfolio_performance_service is None:
        portfolio_performance_service = {}  # Placeholder for future stateful service
    return portfolio_performance_service
