import { countryDefaultTickers, etfToSectorName } from '../config/tickerMappings';

// Type definitions
interface Sector {
  name?: string;
  index?: string;
  ticker?: string;
  available?: boolean;
  yfinanceKey?: string;
}

/**
 * Resolves the appropriate ticker for a given sector and country
 * @param {Object} sector - Sector object with name, index, and ticker properties
 * @param {string} countryCode - Country code (e.g., 'US', 'CHN')
 * @returns {string|null} Resolved ticker symbol or null
 */
export const resolveSectorTicker = (sector: Sector | null | undefined, countryCode: string | undefined): string | null => {
  // Priority 1: Explicit ticker in sector object (ETF ticker)
  if (sector && sector.ticker) {
    return sector.ticker;
  }

  // Priority 2: Index name if it looks like a ticker (contains ^ or .)
  if (sector && sector.index && (/\^|\./).test(sector.index)) {
    return sector.index;
  }

  // Priority 3: Country default ticker
  return (countryCode ? (countryDefaultTickers as Record<string, string>)[countryCode] : null) || null;
};

/**
 * Resolves the identifier used by API endpoints that expect the legacy "yfinance" key.
 * With the ETF migration this now maps to the underlying ETF ticker, but we keep the
 * helper to avoid touching all upstream hook logic in one change.
 * @param {Object|null} sector - Sector object as defined in sectorData config
 * @returns {string|null} Resolved identifier (ETF ticker) or null
 */
/**
 * Resolves the news ticker from a sector ticker
 * Since we're using ETFs directly, no mapping needed
 * @param {string} ticker - Original ticker symbol
 * @returns {string} News ticker (same as input)
 */
export const resolveNewsTicker = (ticker: string): string => {
  return ticker;
};

// Display views use the same ticker
export const resolveDisplayTicker = (ticker: string): string => {
  return ticker;
};

/**
 * Determines if a ticker is valid (non-null and non-empty)
 * @param {string|null} ticker - Ticker to validate
 * @returns {boolean} True if ticker is valid
 */
export const isValidTicker = (ticker: string | null | undefined): boolean => {
  return ticker !== null && ticker !== undefined && ticker.trim() !== '';
};

/**
 * Validates if a ticker is a known ETF
 * @param {string} ticker - Ticker to validate
 * @returns {boolean} True if ticker is a known ETF
 */
export const isKnownETF = (ticker: string | null | undefined): boolean => {
  if (!ticker) {
    return false;
  }
  return Boolean((etfToSectorName as Record<string, string>)[ticker.toUpperCase()]);
};

/**
 * Resolves the identifier used by API endpoints that expect the legacy "yfinance" key.
 * With the ETF migration this now maps to the underlying ETF ticker, but we keep the
 * helper to avoid touching all upstream hook logic in one change.
 * @param {Object|null} sector - Sector object as defined in sectorData config
 * @returns {string|null} Resolved identifier (ETF ticker) or null
 */
export const resolveYfinanceSectorKey = (sector: Sector | null | undefined): string | null => {
  if (!sector) {
    return null;
  }

  if (sector.ticker && typeof sector.ticker === 'string') {
    const ticker = sector.ticker.toUpperCase();
    if (isKnownETF(ticker)) {
      return ticker;
    }
    return sector.ticker;
  }

  if (sector.name) {
    const sectorNameLower = sector.name.toLowerCase();
    const match = Object.entries(etfToSectorName).find(([, name]) => name.toLowerCase() === sectorNameLower);
    if (match) {
      return match[0];
    }
  }

  if (sector.yfinanceKey) {
    return sector.yfinanceKey;
  }

  return null;
};
