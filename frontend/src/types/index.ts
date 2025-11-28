// =============================================================================
// CORE DOMAIN TYPES
// =============================================================================

// User & Authentication
export interface User {
  email: string;
  name?: string;
}

export interface SelectedAccount {
  username: string;
  accountName: string;
  accountNumber?: string;
}

// Portfolio & Holdings
export interface Account {
  id?: string;
  client_account_name: string;
  account_no?: string;
  is_primary?: boolean;
}

export interface Holding {
  ticker: string;
  symbol?: string;
  quantity: number;
  position: string | number;
  cost_basis?: number;
  gain_loss?: number;
  gainLossPercent?: number;
  isPositive?: boolean;
  purchase_date?: string;
  current_price?: number;
  sentiment_score?: number;
  sentiment_label?: SentimentLabel;
  news_volume?: number;
}

export interface PortfolioPerformance {
  account_name: string;
  calculation_date: string;
  performance: PerformanceMetric[];
}

export interface PerformanceMetric {
  period: 'MTD' | 'QTD' | 'YTD' | 'ITD';
  portfolio_return: number;
  sp500_return?: number;
  calculation_date: string;
}

// Notifications & Toasts
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'critical';
export type NotificationCategory = 'Portfolio' | 'Market' | 'News' | 'System';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Toast: Ephemeral UI notification displayed in ToastContainer
 * These are NOT persisted and auto-dismiss after duration
 */
export interface Toast {
  id: string | number;
  type: NotificationType;
  category: NotificationCategory;
  subcategory?: string;
  priority: PriorityLevel;
  title?: string;
  message: string;
  preview?: string;
  timestamp: string;
  duration?: number | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Notification: Server-persisted notification managed via React Query
 * Used in NotificationPage for notification history
 */
export interface Notification {
  id: string | number;
  type: NotificationType;
  category: NotificationCategory;
  subcategory?: string;
  priority: PriorityLevel;
  title?: string;
  message: string;
  preview?: string;
  isRead: boolean;
  isArchived: boolean;
  timestamp: string;
  createdAt?: string;
  showAsToast?: boolean;
  duration?: number | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PriceAlert {
  id: string;
  ticker: string;
  condition: 'above' | 'below' | 'percent_increase' | 'percent_decrease';
  target_price?: number;
  base_price?: number;
  percent_change?: number;
  priority: PriorityLevel;
  notes?: string;
  portfolioId?: string;
  portfolioName?: string;
  isGlobal?: boolean;
  isActive: boolean;
  triggered: boolean;
  createdAt: string;
}

// Sentiment & News
export type SentimentLabel = 'Bullish' | 'Somewhat-Bullish' | 'Neutral' | 'Somewhat-Bearish' | 'Bearish';

export interface Sentiment {
  ticker: string;
  avg_score: number;
  sentiment_momentum?: number;
  sentiment_volatility?: number;
  effective_news_volume?: number;
  sentiment_breadth_score?: number;
  sentiment_z_score?: number;
  data_quality?: string;
  source_concentration_hhi?: number;
  top_sources?: SourceInfo[];
  dominant_topic?: string;
  sentiment_by_topic?: Record<string, number>;
}

export interface SourceInfo {
  source: string;
  count: number;
  hhi_weight?: number;
}

export interface NewsArticle {
  id?: string;
  ticker: string;
  title: string;
  summary?: string;
  url: string;
  image?: string;
  provider?: string;
  source?: string;
  publish_date?: string;
  sentiment_label?: SentimentLabel;
  sentiment_score?: number;
  relevance_score?: number;
  topics?: string[];
}

export interface DailySentimentData {
  score: number;
  count: number;
  holdings_with_data?: number;
  headlines?: string[];
}

// Stock Data
export interface StockPrice {
  ticker: string;
  current_price: number;
  previous_close?: number;
  change?: number;
  change_percent?: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
  timestamp?: string;
}

export interface CompanyOverview {
  Symbol?: string;
  Name?: string;
  Description?: string;
  Sector?: string;
  Industry?: string;
  MarketCapitalization?: string;
  PERatio?: string;
  DividendYield?: string;
  Exchange?: string;
  Currency?: string;
  Country?: string;
  Address?: string;
  OfficialSite?: string;
  ForwardPE?: string;
  PEGRatio?: string;
  PriceToBookRatio?: string;
  PriceToSalesRatioTTM?: string;
  EPS?: string;
  Beta?: string;
  '52WeekHigh'?: string;
  '52WeekLow'?: string;
  '50DayMovingAverage'?: string;
  RevenueTTM?: string;
  GrossProfitTTM?: string;
  EBITDA?: string;
  ProfitMargin?: string;
  OperatingMarginTTM?: string;
  ReturnOnAssetsTTM?: string;
  ReturnOnEquityTTM?: string;
  QuarterlyRevenueGrowthYOY?: string;
  AnalystTargetPrice?: string;
  AnalystRatingStrongBuy?: string;
  AnalystRatingBuy?: string;
  AnalystRatingHold?: string;
  AnalystRatingSell?: string;
  AnalystRatingStrongSell?: string;
  SharesOutstanding?: string;
  SharesFloat?: string;
  PercentInsiders?: string;
  PercentInstitutions?: string;
  DividendPerShare?: string;
  ExDividendDate?: string;
  [key: string]: string | undefined;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export interface NotificationResponse {
  notifications: Notification[];
  total_count: number;
  has_more: boolean;
}

export interface NewsResponse {
  ticker: string;
  news: NewsArticle[];
  avg_score: number;
  items?: number;
}

export interface HoldingsResponse {
  holdings: Holding[];
}

export interface AccountsResponse {
  accounts: Account[];
}

// =============================================================================
// PRICE & CHART TYPES
// =============================================================================

export interface PriceDataPoint {
  date: string;
  time?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  price?: number;
  volume?: number;
  adjClose?: number;
}

export interface PriceRange {
  high: number;
  low: number;
  change: number;
  changePercent: number;
}

// =============================================================================
// EARNINGS TYPES
// =============================================================================

export interface EarningsEvent {
  earnings_date: string;
  days_until: number;
  estimated_eps?: number;
  reported_eps?: number;
  surprise?: number;
  surprise_percent?: number;
  currency?: string;
  fiscal_period_ending?: string;
}

export interface EarningsCalendarResponse {
  ticker: string;
  data: EarningsEvent[];
  totalEvents?: number;
  next_earnings?: EarningsEvent;
}

export interface TranscriptSegment {
  speaker: string;
  title?: string;
  content: string;
  sentiment: number;
  word_count: number;
}

export interface EarningsTranscriptResponse {
  ticker: string;
  quarter: string;
  transcript: TranscriptSegment[];
  overall_sentiment?: number;
  summary?: string;
}

// =============================================================================
// SEARCH TYPES
// =============================================================================

export interface SearchResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType: string;
  exchange?: string;
  sector?: string;
  industry?: string;
}

// =============================================================================
// DAILY SENTIMENT & EVENTS TYPES
// =============================================================================

export interface DailySentimentPoint {
  date: string;
  timestamp?: string;
  label?: string;
  volume: number;
  sentiment: number;
  score?: number;
  count?: number;
  headlines?: string[];
}

export interface SignificantEvent {
  start_date: string;
  end_date?: string;
  trend: 'Upward' | 'Downward';
  total_move_pct: number;
  days?: number;
  title?: string;
  description?: string;
  source?: string;
  news?: NewsArticle[];
  // Legacy fields for backward compatibility
  date?: string;
  type?: string;
  impact?: number;
  sentiment?: number;
}

// =============================================================================
// API METADATA TYPES
// =============================================================================

export interface ApiMetadata {
  source?: string;
  cached?: boolean;
  cache_ttl?: number;
  last_updated?: string;
  request_id?: string;
  // News-related metadata
  items?: number;
  total_articles?: number;
  sentiment_score_definition?: string;
  relevance_score_definition?: string;
  tickers_queried?: string[];
  is_portfolio?: boolean;
  // Sector-related metadata
  sector_name?: string;
}

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

export interface SentimentCardProps {
  loading?: boolean;
  error?: Error | null;
}

export interface TopicWeights {
  [topic: string]: number;
}

export interface SentimentByTopic {
  [topic: string]: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type TimeframeOption = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL';

export type ChartType = 'line' | 'area' | 'candlestick' | 'bar';

export interface DateFormatOptions {
  month?: 'short' | 'long' | 'numeric' | '2-digit';
  day?: 'numeric' | '2-digit';
  year?: 'numeric' | '2-digit';
  hour?: 'numeric' | '2-digit';
  minute?: 'numeric' | '2-digit';
}
