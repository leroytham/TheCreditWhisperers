import { sectorTickerOverrides, countryDefaultTickers, newsTickerOverrides } from '../config/tickerMappings';

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

/**
 * Determines if a ticker is valid (non-null and non-empty)
 * @param {string|null} ticker - Ticker to validate
 * @returns {boolean} True if ticker is valid
 */
export const isValidTicker = (ticker) => {
  return ticker !== null && ticker !== undefined && ticker.trim() !== '';
};
