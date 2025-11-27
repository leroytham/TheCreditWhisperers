/**
 * Notification Data Normalizers
 *
 * Functions to normalize notification data from snake_case (backend) to camelCase (frontend)
 * Extracted from services/notificationApi.js for use across the codebase
 */

interface RawNotification {
  id?: string;
  _id?: string;
  is_read?: boolean;
  isRead?: boolean;
  is_archived?: boolean;
  isArchived?: boolean;
  created_at?: string;
  timestamp?: string;
  createdAt?: string;
  portfolio_id?: string;
  portfolioId?: string;
  portfolio_name?: string;
  portfolioName?: string;
  is_global?: boolean;
  isGlobal?: boolean;
  affected_tickers?: string[];
  affectedTickers?: string[];
  signal_analysis?: unknown;
  signalAnalysis?: unknown;
  portfolio_impact?: unknown;
  portfolioImpact?: unknown;
  account_servicing?: unknown;
  accountServicing?: unknown;
  [key: string]: unknown;
}

interface NormalizedNotification extends RawNotification {
  isRead: boolean;
  isArchived: boolean;
  timestamp: string;
  createdAt: string;
  portfolioId?: string;
  portfolioName?: string;
  isGlobal: boolean;
  affectedTickers: string[];
  signalAnalysis?: unknown;
  portfolioImpact?: unknown;
  accountServicing?: unknown;
}

/**
 * Normalize notification data from snake_case (backend) to camelCase (frontend)
 * @param notification - Raw notification from backend
 * @returns Normalized notification
 */
export const normalizeNotification = (notification: RawNotification): NormalizedNotification => {
  if (!notification) return notification as NormalizedNotification;

  return {
    ...notification,
    // Top-level field normalization
    isRead: notification.is_read ?? notification.isRead ?? false,
    isArchived: notification.is_archived ?? notification.isArchived ?? false,
    timestamp: notification.created_at || notification.timestamp || '',
    createdAt: notification.created_at || notification.createdAt || '',
    portfolioId: notification.portfolio_id ?? notification.portfolioId,
    portfolioName: notification.portfolio_name ?? notification.portfolioName,
    isGlobal: notification.is_global ?? notification.isGlobal ?? false,
    affectedTickers: notification.affected_tickers ?? notification.affectedTickers ?? [],

    // Nested object normalization
    signalAnalysis: notification.signal_analysis || notification.signalAnalysis,
    portfolioImpact: notification.portfolio_impact || notification.portfolioImpact,
    accountServicing: notification.account_servicing || notification.accountServicing,

    // Keep original fields for backward compatibility
    is_read: notification.is_read ?? notification.isRead ?? false,
    is_archived: notification.is_archived ?? notification.isArchived ?? false,
    created_at: notification.created_at || notification.timestamp,
    portfolio_id: notification.portfolio_id ?? notification.portfolioId,
    portfolio_name: notification.portfolio_name ?? notification.portfolioName,
    is_global: notification.is_global ?? notification.isGlobal ?? false,
    affected_tickers: notification.affected_tickers ?? notification.affectedTickers ?? [],
  };
};

interface NotificationResponse {
  notifications?: RawNotification[];
  notification?: RawNotification;
  id?: string;
  _id?: string;
  [key: string]: unknown;
}

/**
 * Normalize API response data
 * @param data - API response data
 * @returns Normalized data
 */
export const normalizeNotificationResponse = <T extends NotificationResponse>(data: T): T => {
  if (!data) return data;

  // If response has notifications array, normalize each notification
  if (data.notifications && Array.isArray(data.notifications)) {
    return {
      ...data,
      notifications: data.notifications.map(normalizeNotification),
    };
  }

  // If response has notification object (single notification)
  if (data.notification) {
    return {
      ...data,
      notification: normalizeNotification(data.notification),
    };
  }

  // If response is a single notification (from create/update endpoints)
  if (data.id || data._id) {
    return normalizeNotification(data as RawNotification) as unknown as T;
  }

  return data;
};

export type { RawNotification, NormalizedNotification, NotificationResponse };
