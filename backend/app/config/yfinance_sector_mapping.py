# app/config/yfinance_sector_mapping.py

"""
Mapping configuration between S&P 500 sectors and yfinance sector keys.
This enables dynamic retrieval of sector constituents using yfinance.Sector().top_companies
"""

# Configuration constants
DEFAULT_SECTOR_TICKER_LIMIT = 15  # Default number of top tickers to fetch per sector (by market weight)

# Special identifier for "All Sectors" - represents the entire market/index
ALL_SECTORS_IDENTIFIERS = ["^GSPC", "SPY", "all-sectors", "all_sectors", "All Sectors"]

# Maps S&P 500 sector names to yfinance sector keys
SECTOR_NAME_TO_YFINANCE = {
    "Information Technology": "technology",
    "Health Care": "healthcare",
    "Financials": "financial-services",
    "Industrials": "industrials",
    "Consumer Discretionary": "consumer-cyclical",
    "Consumer Staples": "consumer-defensive",
    "Energy": "energy",
    "Materials": "basic-materials",
    "Communication Services": "communication-services",
    "Real Estate": "real-estate",
    "Utilities": "utilities",
}

# Maps S&P 500 sector index tickers to yfinance sector keys
SP500_TICKER_TO_YFINANCE = {
    "^SP500-45": "technology",          # Information Technology
    "^SP500-35": "healthcare",           # Health Care
    "^SP500-40": "financial-services",   # Financials
    "^SP500-20": "industrials",          # Industrials
    "^SP500-25": "consumer-cyclical",    # Consumer Discretionary
    "^SP500-30": "consumer-defensive",   # Consumer Staples
    "^GSPE": "energy",                   # Energy
    "^SP500-15": "basic-materials",      # Materials
    "^SP500-50": "communication-services", # Communication Services
    "^SP500-60": "real-estate",          # Real Estate
    "^SP500-55": "utilities",            # Utilities
}

# Maps SPDR ETF tickers to yfinance sector keys
SPDR_ETF_TO_YFINANCE = {
    "XLK": "technology",          # Technology Select Sector SPDR
    "XLV": "healthcare",          # Health Care Select Sector SPDR
    "XLF": "financial-services",  # Financial Select Sector SPDR
    "XLI": "industrials",         # Industrial Select Sector SPDR
    "XLY": "consumer-cyclical",   # Consumer Discretionary Select Sector SPDR
    "XLP": "consumer-defensive",  # Consumer Staples Select Sector SPDR
    "XLE": "energy",              # Energy Select Sector SPDR
    "XLB": "basic-materials",     # Materials Select Sector SPDR
    "XLC": "communication-services", # Communication Services Select Sector SPDR
    "XLRE": "real-estate",        # Real Estate Select Sector SPDR
    "XLU": "utilities",           # Utilities Select Sector SPDR
}

# Reverse mapping: yfinance sector key to display name
YFINANCE_TO_DISPLAY_NAME = {
    "technology": "Information Technology",
    "healthcare": "Health Care",
    "financial-services": "Financials",
    "industrials": "Industrials",
    "consumer-cyclical": "Consumer Discretionary",
    "consumer-defensive": "Consumer Staples",
    "energy": "Energy",
    "basic-materials": "Materials",
    "communication-services": "Communication Services",
    "real-estate": "Real Estate",
    "utilities": "Utilities",
}

# Reverse mapping: yfinance sector key to S&P 500 ticker
YFINANCE_TO_SP500_TICKER = {
    "technology": "^SP500-45",
    "healthcare": "^SP500-35",
    "financial-services": "^SP500-40",
    "industrials": "^SP500-20",
    "consumer-cyclical": "^SP500-25",
    "consumer-defensive": "^SP500-30",
    "energy": "^GSPE",
    "basic-materials": "^SP500-15",
    "communication-services": "^SP500-50",
    "real-estate": "^SP500-60",
    "utilities": "^SP500-55",
}

# Reverse mapping: yfinance sector key to SPDR ETF ticker
YFINANCE_TO_SPDR_ETF = {
    "technology": "XLK",
    "healthcare": "XLV",
    "financial-services": "XLF",
    "industrials": "XLI",
    "consumer-cyclical": "XLY",
    "consumer-defensive": "XLP",
    "energy": "XLE",
    "basic-materials": "XLB",
    "communication-services": "XLC",
    "real-estate": "XLRE",
    "utilities": "XLU",
}


def resolve_yfinance_sector_key(identifier: str) -> str:
    """
    Resolves any sector identifier (name, S&P ticker, or ETF ticker) to yfinance sector key.

    Args:
        identifier: Can be sector name, S&P 500 ticker, or SPDR ETF ticker

    Returns:
        yfinance sector key (e.g., 'technology', 'healthcare')

    Raises:
        ValueError: If identifier cannot be resolved to a known sector
    """
    # Check if already a yfinance key
    if identifier in YFINANCE_TO_DISPLAY_NAME:
        return identifier

    # Check S&P 500 ticker
    if identifier in SP500_TICKER_TO_YFINANCE:
        return SP500_TICKER_TO_YFINANCE[identifier]

    # Check SPDR ETF ticker
    if identifier in SPDR_ETF_TO_YFINANCE:
        return SPDR_ETF_TO_YFINANCE[identifier]

    # Check sector name
    if identifier in SECTOR_NAME_TO_YFINANCE:
        return SECTOR_NAME_TO_YFINANCE[identifier]

    raise ValueError(f"Unknown sector identifier: {identifier}. Must be a valid sector name, S&P 500 ticker, or SPDR ETF ticker.")


def get_sector_display_name(yfinance_key: str) -> str:
    """
    Gets the display name for a yfinance sector key.

    Args:
        yfinance_key: yfinance sector key (e.g., 'technology')

    Returns:
        Display name (e.g., 'Information Technology')

    Raises:
        ValueError: If yfinance_key is not valid
    """
    if yfinance_key not in YFINANCE_TO_DISPLAY_NAME:
        raise ValueError(f"Unknown yfinance sector key: {yfinance_key}")

    return YFINANCE_TO_DISPLAY_NAME[yfinance_key]


def get_all_yfinance_sectors() -> list[str]:
    """
    Returns list of all valid yfinance sector keys.

    Returns:
        List of yfinance sector keys
    """
    return list(YFINANCE_TO_DISPLAY_NAME.keys())


def is_all_sectors_identifier(identifier: str) -> bool:
    """
    Checks if the identifier represents "All Sectors" (entire market index).

    Args:
        identifier: Sector identifier to check

    Returns:
        True if identifier represents all sectors, False otherwise
    """
    return identifier in ALL_SECTORS_IDENTIFIERS
