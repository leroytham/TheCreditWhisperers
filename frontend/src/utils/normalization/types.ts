/**
 * Type definitions for portfolio normalization utilities
 */

export interface DataPoint {
  date?: string;
  timestamp?: string;
  close?: number;
  portfolio_value?: number;
  price?: number;
  capital_flow?: number;
  lot_breakdown?: LotBreakdown[];
  [key: string]: unknown;
}

export interface LotBreakdown {
  market_value?: number;
  start_value?: number;
  is_pre_period?: boolean;
}

export interface TWRData {
  error?: string;
  twr_return?: number | null;
  sub_periods?: TWRSubPeriod[];
}

export interface TWRSubPeriod {
  start_date?: string;
  end_date?: string;
  return?: number;
}

export interface NormalizedDataPoint extends Omit<DataPoint, 'price'> {
  close: number | null;
  originalValue: number;
  isZeroBaseline?: boolean;
  hasNoInvestments?: boolean;
  isPreBaseline?: boolean;
  baselineValue?: number;
  baselineDate?: string | null;
  adjustedBaseline?: number;
  capitalFlow?: number;
  isCapitalAdjusted?: boolean;
  hasTWR?: boolean;
  twrReturn?: number;
  isTWRCalculated?: boolean;
  noLotData?: boolean;
  usedFallback?: boolean;
  hybridDenominator?: number;
  prePeriodValue?: number;
  inPeriodCost?: number;
  prePeriodLots?: number;
  inPeriodLots?: number;
  isHybridCalculated?: boolean;
}
