/**
 * Type definitions for PerformanceCard components
 */

export interface PerformanceDataPoint {
  period: string;
  return: number;
  sp500: number;
  isPositive?: boolean;
  outperformance: number;
  holdings_count: number;
  portfolio_value_current?: number;
}

export interface PerformanceCardProps {
  onViewPerformance: () => void;
}

export interface PerformanceBarChartProps {
  performanceData: PerformanceDataPoint[];
  showSP500: boolean;
}

export interface PerformanceListViewProps {
  performanceData: PerformanceDataPoint[];
  showSP500: boolean;
}
