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
  [key: string]: unknown;
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
