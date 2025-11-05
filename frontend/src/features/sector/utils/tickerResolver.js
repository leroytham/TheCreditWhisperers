import { sectorTickerOverrides, countryDefaultTickers, newsTickerOverrides, sectorToYfinance, etfToYfinance } from '../config/tickerMappings';

/**
 * Resolves the appropriate ticker for a given sector and country
 * @param {Object} sector - Sector object with name, index, and ticker properties
 * @param {string} countryCode - Country code (e.g., 'US', 'CHN')
 * @returns {string|null} Resolved ticker symbol or null
 */
export const resolveSectorTicker = (sector, countryCode) => {
  // Priority 1: Explicit ticker in sector object
  if (sector && sector.ticker) {
    return sector.ticker;
  }

  // Priority 2: Sector name override mapping
  if (sector && sector.name && sectorTickerOverrides[sector.name]) {
    return sectorTickerOverrides[sector.name];
  }

  // Priority 3: Index name if it looks like a ticker (contains ^ or .)
  if (sector && sector.index && (/\^|\./).test(sector.index)) {
    return sector.index;
  }

  // Priority 4: Country default ticker
  return countryDefaultTickers[countryCode] || null;
};

/**
 * Resolves the news ticker from a sector ticker
 * Maps S&P sector indices to SPDR ETF tickers for better news coverage
 * @param {string} ticker - Original ticker symbol
 * @returns {string} News ticker (may be same as input if no mapping exists)
 */
export const resolveNewsTicker = (ticker) => {
  return newsTickerOverrides[ticker] || ticker;
};

// Display views share the same mapping as news coverage
export const resolveDisplayTicker = resolveNewsTicker;

/**
 * Determines if a ticker is valid (non-null and non-empty)
 * @param {string|null} ticker - Ticker to validate
 * @returns {boolean} True if ticker is valid
 */
export const isValidTicker = (ticker) => {
  return ticker !== null && ticker !== undefined && ticker.trim() !== '';
};

/**
 * Resolves a yfinance sector key from a sector object or ticker
 * @param {Object|string} sectorOrTicker - Sector object with yfinanceKey property, or ticker string
 * @returns {string|null} yfinance sector key (e.g., 'technology', 'healthcare') or null if not found
 */
export const resolveYfinanceSectorKey = (sectorOrTicker) => {
  // If it's a sector object with yfinanceKey property, use it directly
  if (sectorOrTicker && typeof sectorOrTicker === 'object' && sectorOrTicker.yfinanceKey) {
    return sectorOrTicker.yfinanceKey;
  }

  // If it's a string ticker, resolve from mappings
  if (typeof sectorOrTicker === 'string') {
    const ticker = sectorOrTicker.trim();

    // Check S&P 500 sector ticker mapping
    if (sectorToYfinance[ticker]) {
      return sectorToYfinance[ticker];
    }

    // Check SPDR ETF ticker mapping
    if (etfToYfinance[ticker]) {
      return etfToYfinance[ticker];
    }
  }

  // No yfinance key found
  return null;
};
