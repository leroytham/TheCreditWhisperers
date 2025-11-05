# app/config/yfinance_sector_mapping.py

"""
Mapping configuration for ETF-based sector analysis.
Provides helpers for resolving ETF tickers from legacy sector identifiers.
"""

# Configuration constants
DEFAULT_SECTOR_TICKER_LIMIT = 15  # Default number of top tickers to fetch per sector (by market weight)

# Special identifier for "All Sectors" - represents the entire market/index
ALL_SECTORS_IDENTIFIERS = ["SPY", "^GSPC", "all-sectors", "all_sectors", "All Sectors", "US All Sectors"]

# Country-level ETF tickers for international markets
COUNTRY_ETFS = {
    # --- US (SPDR and iShares equivalents) ---
    "US": "SPY",            # SPDR S&P 500 ETF Trust
    # "US_SP500": "IVV",     # iShares Core S&P 500 ETF
    # "US_Total": "ITOT",    # iShares Core S&P Total U.S. Stock Market ETF

    # --- Developed Markets (Ex-US) ---
    "Japan": "EWJ",         # iShares MSCI Japan ETF
    "Germany": "EWG",       # iShares MSCI Germany ETF
    "United_Kingdom": "EWU",  # iShares MSCI United Kingdom ETF
    "Canada": "EWC",        # iShares MSCI Canada ETF
    "Australia": "EWA",     # iShares MSCI Australia ETF
    "Switzerland": "EWL",   # iShares MSCI Switzerland ETF
    "France": "EWQ",        # iShares MSCI France ETF
    "Hong_Kong": "EWH",     # iShares MSCI Hong Kong ETF
    "Italy": "EWI",         # iShares MSCI Italy ETF
    "Spain": "EWP",         # iShares MSCI Spain ETF
    "Netherlands": "EWN",   # iShares MSCI Netherlands ETF
    "Sweden": "EWD",        # iShares MSCI Sweden ETF
    "Singapore": "EWS",     # iShares MSCI Singapore ETF
    "Belgium": "EWK",       # iShares MSCI Belgium ETF
    "Austria": "EWO",       # iShares MSCI Austria ETF

    # --- Emerging Markets ---
    "China": "MCHI",        # iShares MSCI China ETF
    "India": "INDA",        # iShares MSCI India ETF
    "Taiwan": "EWT",        # iShares MSCI Taiwan ETF
    "South_Korea": "EWY",   # iShares MSCI South Korea ETF
    "Brazil": "EWZ",        # iShares MSCI Brazil ETF
    "Mexico": "EWW",        # iShares MSCI Mexico ETF
    "South_Africa": "EZA",  # iShares MSCI South Africa ETF
    "Malaysia": "EWM",      # iShares MSCI Malaysia ETF
    "Turkey": "TUR",        # iShares MSCI Turkey ETF
    "Poland": "EPOL",       # iShares MSCI Poland ETF
    "Chile": "ECH",         # iShares MSCI Chile ETF
    "Peru": "EPU",          # iShares MSCI Peru ETF
}

ALL_SECTOR_ETF_TICKERS = set(COUNTRY_ETFS.values())  # ETFs that represent country-level "All Sectors"

# Primary ETF ticker mapping - SPDR ETFs for US sectors and country ETFs
ETF_TICKERS = {
    # US Market
    "SPY": "US All Sectors",           # SPDR S&P 500 ETF Trust

    # US Sector SPDR ETFs
    "XLK": "Technology",               # Technology Select Sector SPDR
    "XLV": "Health Care",              # Health Care Select Sector SPDR
    "XLF": "Financials",               # Financial Select Sector SPDR
    "XLI": "Industrials",              # Industrial Select Sector SPDR
    "XLY": "Consumer Discretionary",   # Consumer Discretionary Select Sector SPDR
    "XLP": "Consumer Staples",         # Consumer Staples Select Sector SPDR
    "XLE": "Energy",                   # Energy Select Sector SPDR
    "XLB": "Materials",                # Materials Select Sector SPDR
    "XLC": "Communication Services",   # Communication Services Select Sector SPDR
    "XLRE": "Real Estate",             # Real Estate Select Sector SPDR
    "XLU": "Utilities",                # Utilities Select Sector SPDR

    # Country-level ETFs (international markets)
    "EWJ": "Japan",                    # iShares MSCI Japan ETF
    "EWG": "Germany",                  # iShares MSCI Germany ETF
    "EWU": "United Kingdom",           # iShares MSCI United Kingdom ETF
    "EWC": "Canada",                   # iShares MSCI Canada ETF
    "EWA": "Australia",                # iShares MSCI Australia ETF
    "EWL": "Switzerland",              # iShares MSCI Switzerland ETF
    "EWQ": "France",                   # iShares MSCI France ETF
    "EWH": "Hong Kong",                # iShares MSCI Hong Kong ETF
    "EWI": "Italy",                    # iShares MSCI Italy ETF
    "EWP": "Spain",                    # iShares MSCI Spain ETF
    "EWN": "Netherlands",              # iShares MSCI Netherlands ETF
    "EWD": "Sweden",                   # iShares MSCI Sweden ETF
    "EWS": "Singapore",                # iShares MSCI Singapore ETF
    "EWK": "Belgium",                  # iShares MSCI Belgium ETF
    "EWO": "Austria",                  # iShares MSCI Austria ETF
    "MCHI": "China",                   # iShares MSCI China ETF
    "INDA": "India",                   # iShares MSCI India ETF
    "EWT": "Taiwan",                   # iShares MSCI Taiwan ETF
    "EWY": "South Korea",              # iShares MSCI South Korea ETF
    "EWZ": "Brazil",                   # iShares MSCI Brazil ETF
    "EWW": "Mexico",                   # iShares MSCI Mexico ETF
    "EZA": "South Africa",             # iShares MSCI South Africa ETF
    "EWM": "Malaysia",                 # iShares MSCI Malaysia ETF
    "TUR": "Turkey",                   # iShares MSCI Turkey ETF
    "EPOL": "Poland",                  # iShares MSCI Poland ETF
    "ECH": "Chile",                    # iShares MSCI Chile ETF
    "EPU": "Peru",                     # iShares MSCI Peru ETF
}

# Reverse mapping: Display name to ETF ticker
DISPLAY_NAME_TO_ETF = {v: k for k, v in ETF_TICKERS.items()}

# Legacy mappings for backward compatibility with previous identifiers
YFINANCE_KEY_TO_ETF = {
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

SECTOR_NAME_TO_ETF = {
    "Information Technology": "XLK",
    "Technology": "XLK",
    "Health Care": "XLV",
    "Healthcare": "XLV",
    "Financials": "XLF",
    "Industrials": "XLI",
    "Consumer Discretionary": "XLY",
    "Consumer Staples": "XLP",
    "Energy": "XLE",
    "Materials": "XLB",
    "Communication Services": "XLC",
    "Real Estate": "XLRE",
    "Utilities": "XLU",
    "US All Sectors": "SPY",
    "All Sectors": "SPY",
    "United States": "SPY",
    "US": "SPY",
    "China": "MCHI",
    "Japan": "EWJ",
    "Germany": "EWG",
    "United Kingdom": "EWU",
    "United_Kingdom": "EWU",
    "Canada": "EWC",
    "Australia": "EWA",
    "Switzerland": "EWL",
    "France": "EWQ",
    "Hong Kong": "EWH",
    "Hong_Kong": "EWH",
    "Italy": "EWI",
    "Spain": "EWP",
    "Netherlands": "EWN",
    "Sweden": "EWD",
    "Singapore": "EWS",
    "Belgium": "EWK",
    "Austria": "EWO",
    "India": "INDA",
    "Taiwan": "EWT",
    "South Korea": "EWY",
    "South_Korea": "EWY",
    "Brazil": "EWZ",
    "Mexico": "EWW",
    "South Africa": "EZA",
    "South_Africa": "EZA",
    "Malaysia": "EWM",
    "Turkey": "TUR",
    "Poland": "EPOL",
    "Chile": "ECH",
    "Peru": "EPU",
}

SP500_TICKER_TO_ETF = {
    "^SP500-45": "XLK",   # Information Technology
    "^SP500-35": "XLV",   # Health Care
    "^SP500-40": "XLF",   # Financials
    "^SP500-20": "XLI",   # Industrials
    "^SP500-25": "XLY",   # Consumer Discretionary
    "^SP500-30": "XLP",   # Consumer Staples
    "^GSPE": "XLE",       # Energy
    "^SP500-15": "XLB",   # Materials
    "^SP500-50": "XLC",   # Communication Services
    "^SP500-60": "XLRE",  # Real Estate
    "^SP500-55": "XLU",   # Utilities
    "^GSPC": "SPY",       # All Sectors
}

# Precompute lowercase lookup for legacy identifiers
LEGACY_IDENTIFIER_TO_ETF = {}

for mapping in (YFINANCE_KEY_TO_ETF, SECTOR_NAME_TO_ETF, SP500_TICKER_TO_ETF, COUNTRY_ETFS):
    for legacy_key, etf in mapping.items():
        if isinstance(legacy_key, str):
            LEGACY_IDENTIFIER_TO_ETF[legacy_key.lower()] = etf

# Additional legacy aliases
LEGACY_IDENTIFIER_TO_ETF.update({
    "all-sectors": "SPY",
    "all_sectors": "SPY",
    "all sectors": "SPY",
    "spdr s&p 500": "SPY",
    "spdr s&p 500 etf": "SPY",
    "spdr s&p 500 etf trust": "SPY",
    "spdr": "SPY",
    "usa": "SPY",
})


def _normalize_identifier(identifier: str) -> str:
    if identifier is None:
        raise ValueError("Sector identifier must not be None")
    normalized = identifier.strip()
    if not normalized:
        raise ValueError("Sector identifier must not be empty")
    return normalized


def resolve_sector_identifier(identifier: str) -> str:
    """Resolves any supported sector identifier to an ETF ticker."""
    normalized = _normalize_identifier(identifier)

    # Direct ETF ticker (case-insensitive)
    upper_identifier = normalized.upper()
    if upper_identifier in ETF_TICKERS:
        return upper_identifier

    # Display name lookup (case-sensitive for exact match)
    if normalized in DISPLAY_NAME_TO_ETF:
        return DISPLAY_NAME_TO_ETF[normalized]

    # Legacy lookups (case-insensitive)
    legacy_match = LEGACY_IDENTIFIER_TO_ETF.get(normalized.lower())
    if legacy_match:
        return legacy_match

    raise ValueError(
        f"Unknown sector identifier: {identifier}. "
        "Provide a supported ETF ticker (e.g., 'XLK') or known sector alias."
    )


def is_valid_etf_ticker(ticker: str) -> bool:
    """Checks if the ticker is a supported ETF ticker."""
    if not ticker:
        return False
    return ticker.upper() in ETF_TICKERS


def get_etf_display_name(ticker: str) -> str:
    """Gets the display name for an ETF ticker."""
    resolved = resolve_sector_identifier(ticker)
    return ETF_TICKERS[resolved]


def get_all_etf_tickers() -> list[str]:
    """Returns list of all supported ETF tickers."""
    return list(ETF_TICKERS.keys())


def is_all_sectors_identifier(identifier: str) -> bool:
    """Checks if the identifier represents an "All Sectors" basket."""
    try:
        resolved = resolve_sector_identifier(identifier)
    except ValueError:
        return False
    return resolved in ALL_SECTOR_ETF_TICKERS


# Compatibility functions for legacy code
def get_all_yfinance_sectors() -> list[str]:
    """Returns list of all US sector ETF tickers (excluding SPY and international ETFs)."""
    return [ticker for ticker in ETF_TICKERS if ticker not in ALL_SECTOR_ETF_TICKERS]


def get_sector_display_name(etf_ticker: str) -> str:
    """Gets the display name for an ETF ticker (legacy compatibility)."""
    return get_etf_display_name(etf_ticker)


def resolve_yfinance_sector_key(identifier: str) -> str:
    """Legacy wrapper for backwards compatibility with previous imports."""
    return resolve_sector_identifier(identifier)
