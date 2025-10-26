# app/services/sector_service.py

"""
Service for managing sector data and retrieving dynamic constituent ticker baskets.
Uses yfinance.Sector() to get real-time sector composition.
"""

import yfinance as yf
from typing import List, Dict, Optional, Tuple
from app.core.cache import cache_result
from app.config.yfinance_sector_mapping import (
    resolve_yfinance_sector_key,
    get_sector_display_name,
    get_all_yfinance_sectors,
    YFINANCE_TO_SP500_TICKER,
    YFINANCE_TO_SPDR_ETF,
    DEFAULT_SECTOR_TICKER_LIMIT
)


class SectorService:
    """
    Service to fetch and manage sector constituent tickers using yfinance.
    """
    _instance = None

    def __new__(cls):
        # Singleton pattern ensures we only ever have one instance
        if cls._instance is None:
            print("Creating SectorService instance...")
            cls._instance = super(SectorService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initializes the service."""
        print("SectorService initialized successfully.")

    @cache_result(ttl=86400)  # Cache for 24 hours (sector composition changes infrequently)
    def get_sector_tickers(
        self,
        yfinance_key: str,
        limit: int = DEFAULT_SECTOR_TICKER_LIMIT
    ) -> Tuple[List[str], float]:
        """
        Retrieves list of top ticker symbols for a sector, sorted by market weight.

        Args:
            yfinance_key: yfinance sector key (e.g., 'technology', 'healthcare')
            limit: Maximum number of tickers to return (default: 15)
                  Set to None or -1 to return all tickers

        Returns:
            Tuple of (tickers, total_market_weight_coverage):
            - tickers: List of ticker symbols sorted by market weight (descending)
            - total_market_weight_coverage: Sum of market weights for returned tickers (0.0-1.0)

        Raises:
            ValueError: If yfinance_key is invalid or data cannot be fetched
        """
        print(f"Fetching sector tickers for: {yfinance_key} (limit: {limit})")

        try:
            # Create yfinance Sector object
            sector = yf.Sector(yfinance_key)

            # Get top companies DataFrame
            top_companies = sector.top_companies

            if top_companies is None or top_companies.empty:
                raise ValueError(f"No companies found for sector: {yfinance_key}")

            # Sort by market weight (descending) - already sorted by yfinance, but ensure it
            top_companies_sorted = top_companies.sort_values('market weight', ascending=False)

            # Apply limit if specified
            if limit is not None and limit > 0:
                top_companies_limited = top_companies_sorted.head(limit)
            else:
                top_companies_limited = top_companies_sorted

            # Extract ticker symbols from the DataFrame index
            tickers = top_companies_limited.index.tolist()

            # Calculate total market weight coverage
            total_market_weight = top_companies_limited['market weight'].sum()

            print(f"Retrieved {len(tickers)} tickers for sector '{yfinance_key}': {tickers[:5]}...")
            print(f"Market weight coverage: {total_market_weight:.2%}")

            return tickers, total_market_weight

        except Exception as e:
            print(f"ERROR: Failed to fetch tickers for sector '{yfinance_key}': {str(e)}")
            raise ValueError(f"Failed to fetch sector data: {str(e)}")

    def resolve_sector_key(self, identifier: str) -> str:
        """
        Resolves any sector identifier to yfinance sector key.

        Args:
            identifier: Can be sector name, S&P 500 ticker, SPDR ETF ticker, or yfinance key

        Returns:
            yfinance sector key (e.g., 'technology')

        Raises:
            ValueError: If identifier cannot be resolved
        """
        return resolve_yfinance_sector_key(identifier)

    def get_sector_metadata(self, yfinance_key: str) -> Dict[str, str]:
        """
        Gets metadata for a sector including display name and related tickers.

        Args:
            yfinance_key: yfinance sector key

        Returns:
            Dictionary with sector metadata:
            {
                'yfinance_key': 'technology',
                'display_name': 'Information Technology',
                'sp500_ticker': '^SP500-45',
                'spdr_etf': 'XLK'
            }
        """
        return {
            'yfinance_key': yfinance_key,
            'display_name': get_sector_display_name(yfinance_key),
            'sp500_ticker': YFINANCE_TO_SP500_TICKER.get(yfinance_key, ''),
            'spdr_etf': YFINANCE_TO_SPDR_ETF.get(yfinance_key, '')
        }

    def get_all_sectors(self) -> List[str]:
        """
        Returns list of all valid yfinance sector keys.

        Returns:
            List of sector keys
        """
        return get_all_yfinance_sectors()


# Create singleton instance
sector_service_instance = SectorService()
