import type { Notification, PriceAlert, NotificationType, NotificationCategory, PriorityLevel } from '../../types';

// Counter for generating unique IDs
let notificationIdCounter = 0;
let alertIdCounter = 0;

/**
 * Reset factory counters - call this in beforeEach for consistent IDs
 */
export function resetNotificationFactoryCounters(): void {
  notificationIdCounter = 0;
  alertIdCounter = 0;
}

/**
 * Create a mock Notification object
 *
 * @example
 * ```ts
 * const notification = createNotification();
 * const errorNotification = createNotification({
 *   type: 'error',
 *   title: 'Error',
 *   message: 'Something went wrong',
 *   priority: 'high',
 * });
 * ```
 */
export function createNotification(overrides: Partial<Notification> = {}): Notification {
  notificationIdCounter++;
  const type = overrides.type || 'info';

  return {
    id: `notif_${Date.now()}_${notificationIdCounter}`,
    type: type as NotificationType,
    category: 'System' as NotificationCategory,
    subcategory: 'Operational Alerts',
    priority: 'medium' as PriorityLevel,
    title: `Test Notification ${notificationIdCounter}`,
    message: 'This is a test notification message.',
    preview: 'This is a test...',
    isRead: false,
    isArchived: false,
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    showAsToast: true,
    duration: 5000,
    actionUrl: null,
    metadata: {},
    ...overrides,
  };
}

/**
 * Create multiple notifications
 *
 * @example
 * ```ts
 * const notifications = createNotifications(5);
 * const unreadNotifications = createNotifications(3, { isRead: false });
 * ```
 */
export function createNotifications(
  count: number,
  overrides: Partial<Notification> = {}
): Notification[] {
  return Array.from({ length: count }, (_, i) =>
    createNotification({
      title: `Notification ${i + 1}`,
      message: `This is notification message ${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create notifications with different types
 */
export function createNotificationsByType(): Record<NotificationType, Notification> {
  const types: NotificationType[] = ['success', 'error', 'warning', 'info', 'critical'];

  return types.reduce(
    (acc, type) => {
      acc[type] = createNotification({
        type,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Notification`,
        message: `This is a ${type} notification`,
        priority: type === 'critical' || type === 'error' ? 'high' : 'medium',
      });
      return acc;
    },
    {} as Record<NotificationType, Notification>
  );
}

/**
 * Create notifications with different categories
 */
export function createNotificationsByCategory(): Record<NotificationCategory, Notification> {
  const categories: NotificationCategory[] = ['Portfolio', 'Market', 'News', 'System'];

  return categories.reduce(
    (acc, category) => {
      acc[category] = createNotification({
        category,
        title: `${category} Update`,
        message: `This is a ${category.toLowerCase()} notification`,
      });
      return acc;
    },
    {} as Record<NotificationCategory, Notification>
  );
}

/**
 * Create a mock PriceAlert object
 *
 * @example
 * ```ts
 * const alert = createPriceAlert();
 * const appleAlert = createPriceAlert({
 *   ticker: 'AAPL',
 *   condition: 'above',
 *   target_price: 200,
 * });
 * ```
 */
export function createPriceAlert(overrides: Partial<PriceAlert> = {}): PriceAlert {
  alertIdCounter++;
  return {
    id: `alert_${Date.now()}_${alertIdCounter}`,
    ticker: 'AAPL',
    condition: 'above',
    target_price: 200,
    base_price: 175,
    percent_change: undefined,
    priority: 'medium' as PriorityLevel,
    notes: '',
    portfolioId: undefined,
    portfolioName: undefined,
    isGlobal: true,
    isActive: true,
    triggered: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create multiple price alerts
 *
 * @example
 * ```ts
 * const alerts = createPriceAlerts(3);
 * const activeAlerts = createPriceAlerts(2, { isActive: true });
 * ```
 */
export function createPriceAlerts(
  count: number,
  overrides: Partial<PriceAlert> = {}
): PriceAlert[] {
  const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];

  return Array.from({ length: count }, (_, i) =>
    createPriceAlert({
      ticker: tickers[i % tickers.length],
      ...overrides,
    })
  );
}

/**
 * Create price alerts with different conditions
 */
export function createAlertsByCondition(
  ticker: string
): Record<PriceAlert['condition'], PriceAlert> {
  const conditions: Array<PriceAlert['condition']> = [
    'above',
    'below',
    'percent_increase',
    'percent_decrease',
  ];

  return conditions.reduce(
    (acc, condition) => {
      const isPercent = condition.includes('percent');
      acc[condition] = createPriceAlert({
        ticker,
        condition,
        target_price: isPercent ? undefined : 200,
        percent_change: isPercent ? 5 : undefined,
      });
      return acc;
    },
    {} as Record<PriceAlert['condition'], PriceAlert>
  );
}

/**
 * Create a triggered price alert
 */
export function createTriggeredAlert(overrides: Partial<PriceAlert> = {}): PriceAlert {
  return createPriceAlert({
    triggered: true,
    isActive: false,
    ...overrides,
  });
}
