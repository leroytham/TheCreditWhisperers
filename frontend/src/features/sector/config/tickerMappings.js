/**
 * Ticker mapping configurations for sector analysis
 */

/**
 * Maps sector names to their corresponding ticker symbols
 * Used for resolving sector-specific data when explicit ticker not provided
 */
export const sectorTickerOverrides = {
  'All Sectors': '^GSPC',
  'Communication Services': 'sp500-communication-services',
  'Consumer Discretionary': 'sp500-consumer-discretionary',
  'Consumer Staples': 'sp500-consumer-staples',
  'Energy': 'sp500-energy',
  'Financials': 'sp500-financials',
  'Health Care': 'sp500-health-care',
  'Industrials': 'sp500-industrials',
  'Information Technology': 'sp500-45',
  'Materials': 'sp500-materials',
  'Real Estate': 'sp500-real-estate',
  'Utilities': 'sp500-utilities'
};

/**
 * Maps S&P sector index codes to SPDR ETF tickers for news fetching
 * Many news services have better coverage for ETFs than sector indices
 */
export const newsTickerOverrides = {
  '^SP500-25': 'XLY',   // Consumer Discretionary
  '^SP500-30': 'XLP',   // Consumer Staples
  '^SP500-35': 'XLV',   // Health Care
  '^SP500-40': 'XLF',   // Financials
  '^SP500-45': 'XLK',   // Information Technology
  '^SP500-50': 'XLC',   // Communication Services
  '^SP500-55': 'XLU',   // Utilities
  '^SP500-60': 'XLRE',  // Real Estate
  '^SP500-15': 'XLB',   // Materials
  '^SP500-20': 'XLI',   // Industrials
  '^GSPE': 'XLE',       // Energy
};

/**
 * Default country index tickers as fallback
 */
export const countryDefaultTickers = {
  US: '^GSPC',
  CHN: '000300.SS',
  JPN: '^N225',
  HKG: '^HSI',
  IND: '^NSEI',
  FRA: '^FCHI',
  GBR: '^FTSE',
  CAN: '^GSPTSE',
  DEU: '^GDAXI',
  SAU: '^TASI.SR'
};

/**
 * Chart timeframe options
 */
export const TIMEFRAMES = ['1D', '1M', '3M', '6M', 'YTD', '1Y', '5Y'];

/**
 * Chart display configuration
 */
export const CHART_CONFIG = {
  NUM_X_AXIS_POINTS: 6,
  DEFAULT_WIDTH: 660,
  MIN_WIDTH: 300,
  MAX_WIDTH: 1000,
  HEIGHT: 250,
  SENTIMENT_CHART_HEIGHT: 350,
};
