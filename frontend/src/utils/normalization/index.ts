/**
 * Portfolio Normalization Utilities
 *
 * Functions for normalizing time-series portfolio data to percentage returns.
 * Extracted from formatters.ts for better modularity.
 */

// Types
export type {
  DataPoint,
  LotBreakdown,
  TWRData,
  TWRSubPeriod,
  NormalizedDataPoint
} from './types';

// Normalization functions
export { normalizeToPercentageReturn } from './normalizeToPercentageReturn';
export { normalizeToPercentageReturnWithCapitalFlows } from './normalizeToPercentageReturnWithCapitalFlows';
export { normalizeToTWR } from './normalizeToTWR';
export { normalizeToHybridReturn } from './normalizeToHybridReturn';
