/**
 * Ticker mapping configurations for ETF-based sector analysis
 */

/**
 * Maps ETF tickers to sector/country display names
 * Includes US sectors and all country ETFs
 */
export const etfToSectorName = {
  // US Sectors
  'SPY': 'All Sectors',
  'XLK': 'Information Technology',
  'XLV': 'Health Care',
  'XLF': 'Financials',
  'XLI': 'Industrials',
  'XLY': 'Consumer Discretionary',
  'XLP': 'Consumer Staples',
  'XLE': 'Energy',
  'XLB': 'Materials',
  'XLC': 'Communication Services',
  'XLRE': 'Real Estate',
  'XLU': 'Utilities',

  // Developed Markets
  'EWC': 'Canada',
  'EWJ': 'Japan',
  'EWG': 'Germany',
  'EWU': 'United Kingdom',
  'EWQ': 'France',
  'EWA': 'Australia',
  'EWL': 'Switzerland',
  'EWH': 'Hong Kong',
  'EWI': 'Italy',
  'EWP': 'Spain',
  'EWN': 'Netherlands',
  'EWD': 'Sweden',
  'EWS': 'Singapore',
  'EWK': 'Belgium',
  'EWO': 'Austria',

  // Emerging Markets
  'MCHI': 'China',
  'INDA': 'India',
  'EWT': 'Taiwan',
  'EWY': 'South Korea',
  'EWZ': 'Brazil',
  'EWW': 'Mexico',
  'EZA': 'South Africa',
  'EWM': 'Malaysia',
  'TUR': 'Turkey',
  'EPOL': 'Poland',
  'ECH': 'Chile',
  'EPU': 'Peru'
};

/**
 * Default country ETF tickers
 * Maps ISO country codes to their primary ETF tickers
 */
export const countryDefaultTickers = {
  // United States
  US: 'SPY',

  // Developed Markets
  CAN: 'EWC',
  JPN: 'EWJ',
  DEU: 'EWG',
  GBR: 'EWU',
  FRA: 'EWQ',
  AUS: 'EWA',
  CHE: 'EWL',
  HKG: 'EWH',
  ITA: 'EWI',
  ESP: 'EWP',
  NLD: 'EWN',
  SWE: 'EWD',
  SGP: 'EWS',
  BEL: 'EWK',
  AUT: 'EWO',

  // Emerging Markets
  CHN: 'MCHI',
  IND: 'INDA',
  TWN: 'EWT',
  KOR: 'EWY',
  BRA: 'EWZ',
  MEX: 'EWW',
  ZAF: 'EZA',
  MYS: 'EWM',
  TUR: 'TUR',
  POL: 'EPOL',
  CHL: 'ECH',
  PER: 'EPU'
};

/**
 * Chart timeframe options
 */
export const TIMEFRAMES = ['1D', '1M', '3M', '6M', 'YTD', '1Y'];

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
