# app/services/sector_service.py

"""
Service for managing sector data and retrieving ETF constituent ticker baskets.
Uses ETF holdings data for sector composition.
"""

import logging
from typing import List, Dict, Tuple
from yahooquery import Ticker as YQTicker
from app.core.cache import cache_result
from app.config.yfinance_sector_mapping import (
    is_valid_etf_ticker,
    get_etf_display_name,
    get_all_etf_tickers,
    resolve_sector_identifier,
    DEFAULT_SECTOR_TICKER_LIMIT
)

logger = logging.getLogger(__name__)


class SectorService:
    """
    Service to fetch and manage ETF constituent tickers.
    """

    def __init__(self):
        # Guard against re-initialization (module-level singleton handles uniqueness)
        if getattr(self, '_initialized', False):
            return
        logger.info("Creating SectorService instance...")
        self._initialize()
        self._initialized = True

    def _initialize(self):
        """Initializes the service."""
        logger.info("SectorService initialized successfully.")

    @cache_result(ttl=86400)  # Cache for 24 hours (ETF composition changes infrequently)
    def get_sector_tickers(
        self,
        etf_ticker: str,
        limit: int = DEFAULT_SECTOR_TICKER_LIMIT
    ) -> Tuple[List[str], float]:
        """
        Retrieves list of ticker symbols from ETF holdings, sorted by holding weight.

        Args:
            etf_ticker: ETF ticker symbol (e.g., 'XLK', 'SPY')
            limit: Maximum number of tickers to return (default: 15)
                  Set to None or -1 to return all tickers

        Returns:
            Tuple of (tickers, total_weight_coverage):
            - tickers: List of ticker symbols sorted by holding weight (descending)
            - total_weight_coverage: Sum of holding weights for returned tickers (0.0-1.0)

        Raises:
            ValueError: If ETF ticker is invalid or data cannot be fetched
        """
        etf_ticker = resolve_sector_identifier(etf_ticker)
        logger.info("Fetching ETF holdings for: %s (limit: %s)", etf_ticker, limit)

        if not is_valid_etf_ticker(etf_ticker):
            raise ValueError(f"Invalid or unsupported ETF ticker: {etf_ticker}")

        try:
            # Fetch ETF holdings data
            etf = YQTicker(etf_ticker)
            holdings_data = etf.fund_holding_info

            if not holdings_data or "holdings" not in holdings_data.get(etf_ticker, {}):
                raise ValueError(f"No holdings data found for ETF: {etf_ticker}")

            holdings = holdings_data[etf_ticker]["holdings"]

            # Extract symbols and their holding percentages
            holdings_list = []
            for h in holdings:
                symbol = h.get("symbol")
                holding_pct = h.get("holdingPercent", 0)
                if symbol and holding_pct:
                    holdings_list.append((symbol, holding_pct))

            if not holdings_list:
                raise ValueError(f"No valid holdings found for ETF: {etf_ticker}")

            # Sort by holding percentage (descending)
            holdings_list.sort(key=lambda x: x[1], reverse=True)

            # Apply limit if specified
            if limit is not None and limit > 0:
                holdings_limited = holdings_list[:limit]
            else:
                holdings_limited = holdings_list

            # Extract tickers and calculate total coverage
            tickers = [symbol for symbol, _ in holdings_limited]
            total_weight = sum(weight for _, weight in holdings_limited)

            logger.info("Retrieved %d tickers for ETF '%s': %s...", len(tickers), etf_ticker, tickers[:5])
            logger.info("Holding weight coverage: %.2f%%", total_weight * 100)

            return tickers, total_weight

        except Exception as e:
            logger.error("Failed to fetch holdings for ETF '%s': %s", etf_ticker, e)
            raise ValueError(f"Failed to fetch ETF holdings: {str(e)}")

    @cache_result(ttl=86400)  # Cache for 24 hours (sector metadata rarely changes)
    def resolve_sector_key(self, identifier: str) -> str:
        """
        Validates and returns ETF ticker (now acts as sector key).

        Args:
            identifier: ETF ticker symbol (e.g., 'XLK', 'SPY')

        Returns:
            The ETF ticker if valid

        Raises:
            ValueError: If identifier is not a valid ETF ticker
        """
        return resolve_sector_identifier(identifier)

    @cache_result(ttl=86400)  # Cache for 24 hours (sector metadata rarely changes)
    def get_sector_metadata(self, etf_ticker: str) -> Dict[str, str]:
        """
        Gets metadata for an ETF/sector.

        Args:
            etf_ticker: ETF ticker symbol

        Returns:
            Dictionary with ETF metadata:
            {
                'etf_ticker': 'XLK',
                'display_name': 'Technology'
            }
        """
        resolved_ticker = resolve_sector_identifier(etf_ticker)
        return {
            'etf_ticker': resolved_ticker,
            'display_name': get_etf_display_name(resolved_ticker)
        }

    def get_all_sectors(self) -> List[str]:
        """
        Returns list of all valid ETF tickers.

        Returns:
            List of ETF tickers
        """
        return get_all_etf_tickers()


# Create singleton instance
sector_service_instance = SectorService()
